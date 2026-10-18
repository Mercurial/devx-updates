import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { digest, gap, list, object, text } from "./core";
import { github } from "./discovery";
import { addEvidence, Store } from "./store";
import type { NativeInput, Snapshot } from "./types";
import { COLLECT_ADAPTERS, type CollectAdapter } from "./types";
import { publishCollection, reuseCollection, type CollectOptions } from "./collection";
import { collectExpanded } from "./collect-expanded";
import { normalizeNativePaths, pinnedCheckout, sourcePath } from "./source";

const exec = promisify(execFile);

async function cargoContext(directory: string) {
  const versions = await Promise.all([exec("cargo", ["--version"], { cwd: directory }), exec("rustc", ["--version"], { cwd: directory })]);
  const toolchain = versions.map((v) => v.stdout.trim()).join("; ");
  const configPaths = [join(process.env.CARGO_HOME ?? join(homedir(), ".cargo"), "config"), join(process.env.CARGO_HOME ?? join(homedir(), ".cargo"), "config.toml"), join(directory, ".cargo/config"), join(directory, ".cargo/config.toml")];
  const configuration = configPaths.map((path) => existsSync(path) ? digest(readFileSync(path, "utf8")) : null);
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(CARGO_|RUST)/.test(key) && !/(TOKEN|PASSWORD|SECRET|KEY)/.test(key)));
  return { toolchain, fingerprint: digest({ toolchain, configuration, environment, host: `${process.platform}-${process.arch}` }) };
}

export async function collect(snapshot: Snapshot, store: Store, options: CollectOptions) {
  const tool = snapshot.tools.find((t) => t.id === options.toolId);
  if (!tool?.revision || !tool.repo || !tool.release) throw new Error("Discover this tool's immutable source first");
  try {
    if (["pnpm-lock", "go-packages", "uv-tree"].includes(options.adapter)) return await collectExpanded(snapshot, store, options);
    const selection = { revision: tool.revision, adapter: options.adapter, roots: options.roots, path: options.path ?? "", platform: options.platform, resolverContext: "committed-lockfile" };
    const directory = options.adapter === "cargo-metadata" ? await pinnedCheckout(tool.repo, tool.revision, options.stateDir) : resolve(options.stateDir, "sources", tool.revision);
    if (options.adapter === "cargo-metadata") selection.resolverContext = (await cargoContext(directory)).fingerprint;
    if (reuseCollection(snapshot, store, options, selection)) return;
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
      const context = await cargoContext(directory);
      toolchain = context.toolchain; selection.resolverContext = context.fingerprint;
      const args = ["metadata", "--locked", "--format-version", "1", "--filter-platform", options.platform];
      if (options.path) {
        if (!tool.manifests.includes(options.path) || !options.path.endsWith("Cargo.toml")) throw new Error("Select a discovered Cargo.toml");
        sourcePath(directory, options.path);
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
    publishCollection(snapshot, store, selection, profile, raw, supporting, sourceUrl);
  } catch (error) {
    const failure = error as Error & { cmd?: string; code?: string | number; signal?: string; stdout?: string; stderr?: string };
    const evidence = store.evidence(normalizeNativePaths({
      toolId: tool.id, revision: tool.revision, adapter: options.adapter,
      command: failure.cmd ?? null, exitCode: failure.code ?? null, signal: failure.signal ?? null,
      message: String(error), stdout: failure.stdout ?? "", stderr: failure.stderr ?? "",
    }, { [resolve(options.stateDir, "sources", tool.revision)]: "/source" }), `Failed native collection for ${tool.id}`);
    addEvidence(snapshot, evidence); tool.evidenceIds.push(evidence.id);
    const reason = `Collection failed (${options.adapter}): ${String(error).slice(0, 1500)}`;
    tool.gaps = tool.gaps.filter((g) => g.code !== `native-collection-failed:${options.adapter}`);
    tool.gaps.push(gap("resolution", reason, "Inspect the native resolver error and retry this pinned profile.", undefined, `native-collection-failed:${options.adapter}`));
    store.save(snapshot); throw error;
  }
}

export async function refreshNative(snapshot: Snapshot, store: Store, stateDir: string, refresh = false) {
  const requests = new Map<string, Omit<CollectOptions, "stateDir" | "refresh">>();
  for (const collection of snapshot.collections ?? []) {
    const evidence = snapshot.evidence.find((e) => e.id === collection.evidenceId)!;
    const selection = object(object(store.readEvidence(evidence)).selection);
    if (!(COLLECT_ADAPTERS as readonly unknown[]).includes(selection.adapter)) continue;
    const request = { toolId: collection.toolId, adapter: selection.adapter as CollectAdapter, roots: list(selection.roots).map((root) => text(root)), path: typeof selection.path === "string" && selection.path ? selection.path : undefined, platform: text(selection.platform), ...(typeof selection.pythonVersion === "string" ? { pythonVersion: selection.pythonVersion } : {}), ...(selection.patterns ? { patterns: list(selection.patterns).map((p) => text(p)) } : {}), ...(selection.tags ? { tags: list(selection.tags).map((p) => text(p)) } : {}) };
    requests.set(digest(request), request);
  }
  let failed = 0;
  for (const request of requests.values()) {
    try { await collect(snapshot, store, { ...request, stateDir, refresh }); }
    catch (error) { failed++; console.error(`Native refresh failed for ${request.toolId}: ${String(error).slice(0, 500)}`); }
  }
  return { profilesRequested: requests.size, failed };
}
