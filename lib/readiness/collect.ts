import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { digest, gap, object, text } from "./core";
import { github } from "./discovery";
import { resolveNative } from "./adapters";
import { addEvidence, mergeResolution, Store } from "./store";
import type { NativeInput, Snapshot } from "./types";

const exec = promisify(execFile);

export async function collect(snapshot: Snapshot, store: Store, options: { toolId: string; adapter: "npm-lock" | "cargo-metadata"; roots: string[]; path?: string; platform: string; stateDir: string; refresh?: boolean }) {
  const tool = snapshot.tools.find((t) => t.id === options.toolId);
  if (!tool?.revision || !tool.repo || !tool.release) throw new Error("Discover this tool's immutable source first");
  const selection = { revision: tool.revision, adapter: options.adapter, roots: options.roots, path: options.path ?? "", platform: options.platform };
  const requestKey = digest(selection);
  const requestEvidence = snapshot.evidence.find((e) => e.description === `Collection request ${tool.id} ${requestKey}`);
  if (requestEvidence && !options.refresh) {
    const record = object(store.readEvidence(requestEvidence));
    if (snapshot.profiles.some((p) => p.id === record.profileId)) { console.log(`Reused ${tool.id} native collection ${requestKey.slice(0, 12)}`); return; }
  }
  try {
    let raw: unknown; let command: string; let toolchain: string;
    const sourceUrl = `https://github.com/${tool.repo}/tree/${tool.revision}`;
    if (options.adapter === "npm-lock") {
      const path = options.path ?? "package-lock.json";
      if (!tool.manifests.includes(path)) throw new Error(`No discovered manifest ${path}`);
      const blob = object(await github(`repos/${tool.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${tool.revision}`));
      if (blob.encoding !== "base64") throw new Error("GitHub did not return file content; collect this lock locally");
      raw = JSON.parse(Buffer.from(text(blob.content), "base64").toString("utf8"));
      command = `Read committed ${path} at ${tool.revision}`;
      toolchain = `npm lockfile format ${object(raw).lockfileVersion}; producing npm version unknown`;
    } else {
      const directory = resolve(options.stateDir, "sources", tool.revision);
      mkdirSync(directory, { recursive: true });
      const git = (args: string[]) => exec("git", args, { cwd: directory, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
      if (!existsSync(join(directory, ".git"))) {
        await git(["init"]);
        await git(["remote", "add", "origin", `https://github.com/${tool.repo}.git`]);
      }
      await git(["fetch", "--depth=1", "origin", tool.revision]);
      await git(["checkout", "--detach", tool.revision]);
      const args = ["metadata", "--locked", "--format-version", "1", "--filter-platform", options.platform];
      if (options.path) {
        if (!tool.manifests.includes(options.path) || !options.path.endsWith("Cargo.toml")) throw new Error("Select a discovered Cargo.toml");
        args.push("--manifest-path", options.path);
      }
      const { stdout } = await exec("cargo", args, { cwd: directory, timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
      raw = JSON.parse(stdout); command = `cargo ${args.join(" ")}`;
      const versions = await Promise.all([exec("cargo", ["--version"], { cwd: directory }), exec("rustc", ["--version"], { cwd: directory })]);
      toolchain = versions.map((v) => v.stdout.trim()).join("; ");
      // Retain the actual lock and workspace manifest alongside metadata for replay.
      for (const filename of ["Cargo.lock", options.path ?? "Cargo.toml"]) {
        const fullPath = join(directory, filename);
        if (existsSync(fullPath)) addEvidence(snapshot, store.evidence({ path: filename, revision: tool.revision, content: readFileSync(fullPath, "utf8") }, `Native input ${tool.id}/${filename}`, `${sourceUrl}/${filename}`));
      }
    }
    const profile: NativeInput = { toolId: tool.id, release: tool.release, revision: tool.revision, platform: options.platform, features: ["default"], command, toolchain, origin: "source-reconstruction", adapter: options.adapter, rootNames: options.roots };
    const nativeEvidence = store.evidence(raw, `${options.adapter} for ${tool.id} ${tool.release}`, sourceUrl);
    const profileEvidence = store.evidence(profile, "Native collection profile and command", sourceUrl);
    const result = resolveNative(raw, profile, [nativeEvidence.id, profileEvidence.id]);
    addEvidence(snapshot, nativeEvidence); addEvidence(snapshot, profileEvidence);
    mergeResolution(snapshot, result);
    addEvidence(snapshot, store.evidence({ selection, profileId: result.profile.id }, `Collection request ${tool.id} ${requestKey}`));
    tool.gaps = tool.gaps.filter((g) => !g.reason.startsWith(`Collection failed (${options.adapter}):`));
    store.save(snapshot);
    console.log(`Collected ${tool.id}: ${result.occurrences.length} occurrences, ${result.edges.length} edges, ${result.profile.coverage} profile`);
  } catch (error) {
    const reason = `Collection failed (${options.adapter}): ${String(error).slice(0, 1500)}`;
    tool.gaps = tool.gaps.filter((g) => !g.reason.startsWith(`Collection failed (${options.adapter}):`));
    tool.gaps.push(gap("resolution", reason, "Inspect the native resolver error and retry this pinned profile."));
    store.save(snapshot); throw error;
  }
}
