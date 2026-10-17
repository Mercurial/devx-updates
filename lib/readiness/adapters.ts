import { artifact, digest, gap, list, object, text } from "./core";
import type { Edge, NativeInput, Resolution, Scope } from "./types";

export function parseNativeInput(value: unknown): NativeInput {
  const v = object(value, "profile");
  for (const key of ["toolId", "release", "revision", "platform", "command", "toolchain"]) text(v[key], key);
  if (!/^[a-f0-9]{40,64}$/.test(v.revision as string)) throw new Error("revision must be an immutable source commit/digest");
  for (const key of ["features", "rootNames"]) list(v[key], key).forEach((item) => text(item, key));
  if (!(v.rootNames as string[]).length) throw new Error("Select at least one root package");
  if (!["release-build", "source-reconstruction"].includes(v.origin as string)) throw new Error("Invalid resolution origin");
  if (!["npm-lock", "cargo-metadata", "cabal-plan"].includes(v.adapter as string)) throw new Error("Unsupported native adapter");
  return v as unknown as NativeInput;
}

export function resolveNative(raw: unknown, input: NativeInput, evidenceIds: string[]): Resolution {
  const data = object(raw, "native output");
  const inputDigest = digest({ raw, input, adapterVersion: 1 });
  const profileId = `profile:${input.toolId}:${inputDigest.slice(0, 24)}`;
  const result: Resolution = {
    profile: { id: profileId, toolId: input.toolId, release: input.release, revision: input.revision, platform: input.platform, features: input.features, command: input.command, toolchain: input.toolchain, origin: input.origin, roots: [], inputDigest, evidenceIds, coverage: "complete" },
    artifacts: [], occurrences: [], edges: [], gaps: [],
  };
  const locators = new Map<string, string>();
  const addNode = (locator: string, name: string, version: string | null, source: string, integrity: string | null) => {
    const a = artifact({ ecosystem: input.adapter.split("-")[0], name, version, source, integrity });
    if (!result.artifacts.some((existing) => existing.id === a.id)) result.artifacts.push(a);
    const id = `occurrence:${digest({ profileId, locator })}`;
    if (locators.has(locator)) throw new Error(`Duplicate native locator ${locator}`);
    result.occurrences.push({ id, artifactId: a.id, profileId, locator, evidenceIds }); locators.set(locator, id);
    return id;
  };
  const missing = (reason: string) => {
    result.gaps.push(gap("resolution", reason, "Recollect a complete native build plan for this profile.", profileId));
    result.profile.coverage = "partial";
  };
  const addEdge = (from: string, to: string, scope: Scope, optional = false, condition: string | null = null, constraint: string | null = null) => {
    if (!locators.has(to)) { missing(`Unresolved dependency ${to} from ${from}`); return; }
    const fields: Omit<Edge, "id"> = { from: locators.get(from)!, to: locators.get(to)!, type: "package", scope, optional, condition, constraint, verification: "verified", evidenceIds };
    const id = `edge:${digest(fields)}`;
    if (!result.edges.some((e) => e.id === id)) result.edges.push({ id, ...fields });
  };

  if (input.adapter === "npm-lock") {
    if (![2, 3].includes(data.lockfileVersion as number)) throw new Error("Only npm lockfile versions 2 and 3 are supported");
    const packages = object(data.packages, "packages");
    const entries = Object.entries(packages).map(([path, value]) => [path, object(value)] as const);
    for (const [path, pkg] of entries) {
      if (pkg.link) continue;
      const name = typeof pkg.name === "string" ? pkg.name : path ? path.split("node_modules/").pop()! : text(data.name, "root package name");
      const version = typeof pkg.version === "string" ? pkg.version : null;
      const source = typeof pkg.resolved === "string" && !pkg.resolved.startsWith("file:") ? pkg.resolved : `source:${input.revision}:${path}`;
      addNode(path, name, version, source, typeof pkg.integrity === "string" ? pkg.integrity : null);
      if (input.rootNames.includes(name) && !path.includes("node_modules/")) result.profile.roots.push(locators.get(path)!);
    }
    const dereference = (path: string): string | undefined => {
      const pkg = packages[path] ? object(packages[path]) : undefined;
      if (!pkg) return undefined;
      if (pkg.link) return typeof pkg.resolved === "string" && locators.has(pkg.resolved) ? pkg.resolved : undefined;
      return locators.has(path) ? path : undefined;
    };
    const lookup = (from: string, name: string) => {
      let directory = from;
      for (;;) {
        const found = dereference(`${directory ? `${directory}/` : ""}node_modules/${name}`);
        if (found !== undefined) return found;
        if (!directory) return undefined;
        directory = directory.includes("/") ? directory.slice(0, directory.lastIndexOf("/")) : "";
      }
    };
    for (const [path, pkg] of entries) {
      if (pkg.link) continue;
      const optionalDeps = object(pkg.optionalDependencies ?? {});
      const peerMeta = object(pkg.peerDependenciesMeta ?? {});
      for (const [key, scope] of [["dependencies", "runtime"], ["optionalDependencies", "runtime"], ["peerDependencies", "runtime"], ["devDependencies", "development"]] as const) {
        for (const [name, constraint] of Object.entries(object(pkg[key] ?? {}))) {
          if (key === "dependencies" && name in optionalDeps) continue;
          const optional = key === "optionalDependencies" || (key === "peerDependencies" && object(peerMeta[name] ?? {}).optional === true);
          const target = lookup(path, name);
          if (target === undefined) { missing(`${optional ? "Optional " : ""}${key} ${name} from ${path || "root"} has no locked occurrence.`); continue; }
          addEdge(path, target, scope, optional, key === "peerDependencies" ? "peer binding" : null, typeof constraint === "string" ? constraint : null);
        }
      }
    }
    missing("Lockfile graph is an all-platform selection, not an installed or release-build dependency inventory. Platform/optional pruning and shipped artifact correspondence remain unverified.");
  } else if (input.adapter === "cargo-metadata") {
    const packages = list(data.packages, "packages").map((p) => object(p));
    const resolve = object(data.resolve, "resolve (do not use --no-deps)");
    const nodes = list(resolve.nodes, "resolve.nodes").map((n) => object(n));
    const members = new Set(list(data.workspace_members, "workspace_members").map((id) => text(id)));
    for (const pkg of packages) {
      const id = text(pkg.id); const name = text(pkg.name);
      addNode(id, name, text(pkg.version), typeof pkg.source === "string" ? pkg.source : `source:${input.revision}:${text(pkg.manifest_path).replace(text(data.workspace_root), ".")}`, null);
      if (members.has(id) && input.rootNames.includes(name)) result.profile.roots.push(locators.get(id)!);
    }
    for (const node of nodes) {
      const from = text(node.id);
      for (const rawDep of list(node.deps, "node.deps")) {
        const dep = object(rawDep);
        for (const rawKind of list(dep.dep_kinds, "dep_kinds")) {
          const kind = object(rawKind);
          const scope = kind.kind === "build" ? "build" : kind.kind === "dev" ? "development" : "runtime";
          addEdge(from, text(dep.pkg), scope, kind.target !== null, typeof kind.target === "string" ? kind.target : null);
        }
      }
    }
    if (!input.command.includes("--filter-platform")) missing("Cargo metadata has no declared --filter-platform; target applicability requires review.");
  } else {
    const units = list(data["install-plan"], "install-plan").map((v) => object(v));
    for (const unit of units) {
      const name = text(unit["pkg-name"]); const id = text(unit.id);
      const source = unit["pkg-src"] ? JSON.stringify(unit["pkg-src"]) : `compiler:${text(data["compiler-id"])}:${id}`;
      addNode(id, name, text(unit["pkg-version"]), unit.style === "local" ? `source:${input.revision}:${source}` : source, typeof unit["pkg-src-sha256"] === "string" ? unit["pkg-src-sha256"] : null);
      if (input.rootNames.includes(name) && unit.style === "local") result.profile.roots.push(locators.get(id)!);
    }
    for (const unit of units) {
      const components: [string, unknown][] = unit.components ? Object.entries(object(unit.components)) : [[typeof unit["component-name"] === "string" ? unit["component-name"] : "lib", unit]];
      for (const [component, rawComponent] of components) {
        const details = object(rawComponent);
        const scope = /^(test|bench):/.test(component) ? "development" : "runtime";
        for (const dependency of list(details.depends ?? [])) addEdge(text(unit.id), text(dependency), scope);
        for (const dependency of list(details["exe-depends"] ?? [])) addEdge(text(unit.id), text(dependency), "build");
      }
    }
  }
  if (!result.profile.roots.length) throw new Error(`No roots matched ${input.rootNames.join(", ")}; check package names and workspace membership`);
  const matched = new Set(result.profile.roots.map((id) => result.artifacts.find((a) => a.id === result.occurrences.find((n) => n.id === id)!.artifactId)!.name));
  for (const root of input.rootNames) if (!matched.has(root)) missing(`Requested root ${root} is absent from native output.`);
  return result;
}
