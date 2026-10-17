import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { digest, gap, list, object, text } from "./core";
import { github } from "./discovery";
import { resolveNative } from "./adapters";
import { addEvidence, mergeResolution, Store } from "./store";
import type { NativeInput, Snapshot } from "./types";

const exec = promisify(execFile);

async function cargoContext(directory: string) {
  const versions = await Promise.all([exec("cargo", ["--version"], { cwd: directory }), exec("rustc", ["--version"], { cwd: directory })]);
  const toolchain = versions.map((v) => v.stdout.trim()).join("; ");
  const configPaths = [join(process.env.CARGO_HOME ?? join(homedir(), ".cargo"), "config"), join(process.env.CARGO_HOME ?? join(homedir(), ".cargo"), "config.toml"), join(directory, ".cargo/config"), join(directory, ".cargo/config.toml")];
  const configuration = configPaths.map((path) => existsSync(path) ? digest(readFileSync(path, "utf8")) : null);
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(CARGO_|RUST)/.test(key) && !/(TOKEN|PASSWORD|SECRET|KEY)/.test(key)));
  return { toolchain, fingerprint: digest({ toolchain, configuration, environment, host: `${process.platform}-${process.arch}` }) };
}

export async function collect(snapshot: Snapshot, store: Store, options: { toolId: string; adapter: "npm-lock" | "cargo-metadata"; roots: string[]; path?: string; platform: string; stateDir: string; refresh?: boolean }) {
  const tool = snapshot.tools.find((t) => t.id === options.toolId);
  if (!tool?.revision || !tool.repo || !tool.release) throw new Error("Discover this tool's immutable source first");
  try {
    const selection = { revision: tool.revision, adapter: options.adapter, roots: options.roots, path: options.path ?? "", platform: options.platform, resolverContext: "committed-lockfile" };
    const directory = resolve(options.stateDir, "sources", tool.revision);
    const git = (args: string[]) => exec("git", args, { cwd: directory, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    let sourceMatches = false;
    if (options.adapter === "cargo-metadata" && existsSync(join(directory, ".git"))) {
      if ((await git(["status", "--porcelain"])).stdout.trim()) throw new Error("Collection checkout contains local changes; preserve or reconcile them before collecting.");
      try { sourceMatches = (await git(["rev-parse", "HEAD"])).stdout.trim() === tool.revision; } catch { sourceMatches = false; }
      if (sourceMatches) selection.resolverContext = (await cargoContext(directory)).fingerprint;
    }
    let requestKey = digest({ ...selection, collectorVersion: 2 });
    const request = snapshot.collections?.find((c) => c.key === requestKey && c.toolId === tool.id);
    if (request && !options.refresh && (options.adapter === "npm-lock" || sourceMatches)) {
      if (snapshot.profiles.some((p) => p.id === request.profileId)) { console.log(`Reused ${tool.id} native collection ${requestKey.slice(0, 12)}`); return; }
    }
    let raw: unknown; let command: string; let toolchain: string;
    const supporting: string[] = [];
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
      mkdirSync(directory, { recursive: true });
      if (!existsSync(join(directory, ".git"))) {
        await git(["init"]);
        await git(["remote", "add", "origin", `https://github.com/${tool.repo}.git`]);
      }
      if (!sourceMatches) {
        await git(["fetch", "--depth=1", "origin", tool.revision]);
        await git(["checkout", "--detach", tool.revision]);
      }
      const context = await cargoContext(directory);
      toolchain = context.toolchain; selection.resolverContext = context.fingerprint;
      requestKey = digest({ ...selection, collectorVersion: 2 });
      const args = ["metadata", "--locked", "--format-version", "1", "--filter-platform", options.platform];
      if (options.path) {
        if (!tool.manifests.includes(options.path) || !options.path.endsWith("Cargo.toml")) throw new Error("Select a discovered Cargo.toml");
        args.push("--manifest-path", options.path);
      }
      const { stdout } = await exec("cargo", args, { cwd: directory, timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
      raw = JSON.parse(stdout); command = `cargo ${args.join(" ")}`;
      // Retain the actual lock and workspace manifest alongside metadata for replay.
      for (const filename of ["Cargo.lock", options.path ?? "Cargo.toml"]) {
        const fullPath = join(directory, filename);
        if (existsSync(fullPath)) {
          const evidence = store.evidence({ path: filename, revision: tool.revision, content: readFileSync(fullPath, "utf8") }, `Native input ${tool.id}/${filename}`, `${sourceUrl}/${filename}`);
          addEvidence(snapshot, evidence); supporting.push(evidence.id);
        }
      }
    }
    const profile: NativeInput = { toolId: tool.id, release: tool.release, revision: tool.revision, platform: options.platform, features: ["default"], command, toolchain, origin: "source-reconstruction", adapter: options.adapter, rootNames: options.roots };
    const nativeEvidence = store.evidence(raw, `${options.adapter} for ${tool.id} ${tool.release}`, sourceUrl);
    const profileEvidence = store.evidence(profile, "Native collection profile and command", sourceUrl);
    const result = resolveNative(raw, profile, { native: nativeEvidence.id, configuration: profileEvidence.id, supporting });
    addEvidence(snapshot, nativeEvidence); addEvidence(snapshot, profileEvidence);
    mergeResolution(snapshot, result);
    const requestEvidence = store.evidence({ selection, profileId: result.profile.id }, `Collection request for ${tool.id}`);
    addEvidence(snapshot, requestEvidence);
    tool.evidenceIds.push(requestEvidence.id);
    snapshot.collections ??= [];
    snapshot.collections = snapshot.collections.filter((c) => c.toolId !== tool.id || (c.key !== requestKey && c.profileId !== result.profile.id));
    snapshot.collections.push({ key: requestKey, toolId: tool.id, profileId: result.profile.id, evidenceId: requestEvidence.id });
    tool.gaps = tool.gaps.filter((g) => g.code !== `native-collection-failed:${options.adapter}`);
    store.save(snapshot);
    console.log(`Collected ${tool.id}: ${result.occurrences.length} occurrences, ${result.edges.length} edges, ${result.profile.coverage} profile`);
  } catch (error) {
    const reason = `Collection failed (${options.adapter}): ${String(error).slice(0, 1500)}`;
    tool.gaps = tool.gaps.filter((g) => g.code !== `native-collection-failed:${options.adapter}`);
    tool.gaps.push(gap("resolution", reason, "Inspect the native resolver error and retry this pinned profile.", undefined, `native-collection-failed:${options.adapter}`));
    store.save(snapshot); throw error;
  }
}

export async function refreshNative(snapshot: Snapshot, store: Store, stateDir: string, refresh = false) {
  const requests = new Map<string, { toolId: string; adapter: "npm-lock" | "cargo-metadata"; roots: string[]; path?: string; platform: string }>();
  for (const collection of snapshot.collections ?? []) {
    const evidence = snapshot.evidence.find((e) => e.id === collection.evidenceId)!;
    const selection = object(object(store.readEvidence(evidence)).selection);
    if (!["npm-lock", "cargo-metadata"].includes(selection.adapter as string)) continue;
    const request = { toolId: collection.toolId, adapter: selection.adapter as "npm-lock" | "cargo-metadata", roots: list(selection.roots).map((root) => text(root)), path: typeof selection.path === "string" && selection.path ? selection.path : undefined, platform: text(selection.platform) };
    requests.set(digest(request), request);
  }
  let failed = 0;
  for (const request of requests.values()) {
    try { await collect(snapshot, store, { ...request, stateDir, refresh }); }
    catch (error) { failed++; console.error(`Native refresh failed for ${request.toolId}: ${String(error).slice(0, 500)}`); }
  }
  return { profilesRequested: requests.size, failed };
}
