import { dirname, posix } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { load, JSON_SCHEMA } from "js-yaml";
import { digest, object } from "./core";
import { parseJsonStream } from "./go";
import { pinnedCheckout, sourcePath, retainSource, execute } from "./source";
import { publishCollection, reuseCollection, type CollectOptions, type CollectionSelection } from "./collection";
import type { Snapshot, NativeInput } from "./types";
import type { Store } from "./store";

export async function collectExpanded(snapshot: Snapshot, store: Store, options: CollectOptions) {
  const tool = snapshot.tools.find((t) => t.id === options.toolId)!;
  const defaults = { "pnpm-lock": "pnpm-lock.yaml", "go-packages": "go.mod", "uv-tree": "pyproject.toml" };
  if (!(options.adapter in defaults)) throw new Error("Unknown extended collector");
  const path = options.path ?? defaults[options.adapter as keyof typeof defaults];
  if (!tool.manifests.includes(path)) throw new Error(`No discovered manifest ${path}`);
  if (options.adapter === "go-packages" && !/^\w+\/\w+$/.test(options.platform)) throw new Error("Go platform must be GOOS/GOARCH, such as linux/amd64");
  if (options.adapter === "uv-tree" && !/^3\.\d+(\.\d+)?$/.test(options.pythonVersion ?? "")) throw new Error("uv collection requires --python-version, such as 3.13");
  const root = await pinnedCheckout(tool.repo!, tool.revision!, options.stateDir);
  const cwd = dirname(sourcePath(root, path));
  const selection: CollectionSelection = { revision: tool.revision!, adapter: options.adapter, roots: options.roots, path, platform: options.platform, resolverContext: "committed-lockfile" };
  let raw: unknown; let command: string; let toolchain: string; let features: string[];
  let supportPaths: string[];
  if (options.adapter === "pnpm-lock") {
    if (reuseCollection(snapshot, store, options, selection)) return;
    const lock = object(load(readFileSync(sourcePath(root, path), "utf8"), { schema: JSON_SCHEMA }));
    const manifests: Record<string, unknown> = {};
    supportPaths = [path, posix.join(posix.dirname(path), "pnpm-workspace.yaml"), posix.join(posix.dirname(path), ".npmrc")];
    for (const importer of Object.keys(object(lock.importers))) {
      const file = posix.join(posix.dirname(path), importer, "package.json");
      const full = sourcePath(root, file);
      if (existsSync(full)) { manifests[importer] = JSON.parse(readFileSync(full, "utf8")); supportPaths.push(file); }
    }
    for (const patch of Object.values(object(lock.patchedDependencies ?? {}))) {
      const patchPath = object(patch).path;
      if (typeof patchPath === "string") supportPaths.push(posix.join(posix.dirname(path), patchPath));
    }
    raw = { lock, manifests, sourceDirectory: posix.dirname(path) };
    command = `Read committed ${path} and importer manifests at ${tool.revision}`;
    toolchain = `pnpm lockfile format ${lock.lockfileVersion}; producing pnpm version recorded in source manifests when available`;
    features = ["all-lockfile-targets", "workspace-peer-contexts"];
  } else if (options.adapter === "go-packages") {
    const [GOOS, GOARCH] = options.platform.split("/");
    const env = { ...process.env, GOOS, GOARCH, CGO_ENABLED: "0", GOWORK: "off", GOFLAGS: "", GOTOOLCHAIN: "local" };
    const run = (args: string[]) => execute("go", args, { cwd, env, timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
    const environment = object(JSON.parse((await run(["env", "-json", "GOOS", "GOARCH", "CGO_ENABLED", "GOWORK", "GOVERSION", "GOFLAGS", "GOTOOLCHAIN"])).stdout));
    toolchain = (await run(["version"])).stdout.trim();
    selection.patterns = options.patterns ?? ["./..."]; selection.tags = options.tags ?? [];
    if (!selection.patterns.length || selection.patterns.some((p) => !p || p.startsWith("-") || p.includes("..") && p !== "./..." && !p.endsWith("/..."))) throw new Error("Invalid Go package pattern");
    selection.resolverContext = digest({ environment, toolchain, goEnvironment: Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith("GO") && !/(TOKEN|PASSWORD|SECRET|KEY)/.test(key))) });
    if (reuseCollection(snapshot, store, options, selection)) return;
    const flags = ["list", "-e", "-deps", "-json", "-mod=readonly", ...(selection.tags.length ? [`-tags=${selection.tags.join(",")}`] : [])];
    const packages = parseJsonStream((await run([...flags, ...selection.patterns])).stdout);
    const tests = parseJsonStream((await run([...flags, "-test", ...selection.patterns])).stdout);
    raw = { formatVersion: 1, sourceRoot: root, environment, packages, tests };
    command = `go ${[...flags, ...selection.patterns].join(" ")}; go ${[...flags, "-test", ...selection.patterns].join(" ")}`;
    features = ["cgo:0", "workspace:off", ...selection.patterns.map((p) => `packages:${p}`), ...selection.tags.map((tag) => `tag:${tag}`)];
    supportPaths = [path, posix.join(posix.dirname(path), "go.sum")];
  } else {
    const lockPath = posix.join(posix.dirname(path), "uv.lock");
    if (!existsSync(sourcePath(root, lockPath))) throw new Error("uv collection requires a committed uv.lock; no fresh resolution is substituted");
    toolchain = (await execute("uv", ["--version"], { timeout: 30000 })).stdout.trim();
    selection.pythonVersion = options.pythonVersion;
    selection.resolverContext = digest({ toolchain, targetPython: options.pythonVersion, platform: options.platform });
    if (reuseCollection(snapshot, store, options, selection)) return;
    const args = ["tree", "--locked", "--offline", "--format", "json", "--all-groups", "--depth", "255", "--python-version", options.pythonVersion!, "--python-platform", options.platform, "--no-build", "--no-python-downloads", "--no-config"];
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith("UV_")) delete env[key];
    raw = { ...object(JSON.parse((await execute("uv", args, { cwd, env, timeout: 300000, maxBuffer: 64 * 1024 * 1024 })).stdout)), collectionSourceRoot: root };
    command = `uv ${args.join(" ")}`;
    features = [`python:${options.pythonVersion}`, "all-groups", "extras:conditional"];
    supportPaths = [lockPath, ...tool.manifests.filter((file) => file.endsWith("pyproject.toml")), posix.join(posix.dirname(path), "uv.toml")];
  }
  const supporting = retainSource(snapshot, store, tool.id, root, supportPaths);
  const profile: NativeInput = { toolId: tool.id, release: tool.release!, revision: tool.revision!, platform: options.platform, features, command, toolchain, origin: "source-reconstruction", adapter: options.adapter, rootNames: options.roots };
  publishCollection(snapshot, store, selection, profile, raw, supporting, `https://github.com/${tool.repo}/tree/${tool.revision}`);
}
