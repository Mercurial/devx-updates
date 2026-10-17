import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Graph } from "../map-types";
import { finalize, inventory, validate } from "./core";
import { parseNativeInput, resolveNative } from "./adapters";
import { aggregateProjects, calculateImpact, compareSnapshots } from "./impact";
import { detectManifests, repositoryReference } from "./discovery";
import { addEvidence, mergeResolution, Store } from "./store";
import type { NativeInput } from "./types";

const catalog = { nodes: [{ id: "one", name: "One", repo: "owner/one", team: "Team" }, { id: "two", name: "Two", repo: null, team: "Team" }] } as Graph;
const base: NativeInput = { toolId: "one", release: "1.0.0", revision: "a".repeat(40), platform: "linux-x64", features: [], command: "npm install --package-lock-only --ignore-scripts", toolchain: "npm 10", origin: "source-reconstruction", adapter: "npm-lock", rootNames: ["app"] };
const lock = {
  name: "app", lockfileVersion: 3,
  packages: {
    "": { name: "app", version: "1.0.0", dependencies: { left: "1", right: "1" }, optionalDependencies: { optional: "1" }, devDependencies: { test: "1" } },
    "node_modules/left": { version: "1.0.0", resolved: "https://registry.npmjs.org/left/-/left-1.0.0.tgz", dependencies: { shared: "1" } },
    "node_modules/right": { version: "1.0.0", dependencies: { shared: "1" } },
    "node_modules/shared": { version: "1.0.0", resolved: "https://registry.npmjs.org/shared/-/shared-1.0.0.tgz", integrity: "sha512-test", dependencies: { left: "1" } },
    "node_modules/optional": { version: "1.0.0", dependencies: { shared: "1" } },
    "node_modules/test": { version: "1.0.0", dependencies: { helper: "1" } },
    "node_modules/helper": { version: "1.0.0" },
  },
};

function setup() {
  const directory = mkdtempSync(join(tmpdir(), "readiness-test-"));
  const store = new Store(directory);
  const snapshot = inventory(catalog, "revision", "2026-10-17T00:00:00Z");
  const evidence = store.evidence(lock, "Native lock"); addEvidence(snapshot, evidence);
  return { directory, store, snapshot, evidence };
}

test("inventory accounts for source-unavailable tools without treating absence as readiness", () => {
  const snapshot = inventory(catalog, "revision");
  assert.equal(snapshot.tools.length, 2);
  assert.equal(snapshot.tools[1].readiness, "unassessed");
  assert.equal(snapshot.tools[1].resolution, "unresolved");
  assert.match(snapshot.tools[1].gaps.find((g) => g.area === "artifact")!.reason, /No repository/);
  assert.throws(() => inventory({ nodes: [catalog.nodes[0], catalog.nodes[0]] } as Graph, "revision"), /Duplicate/);
});

test("diamond paths and cycles count tools once, required reach takes precedence over optional", () => {
  const { directory, snapshot, evidence } = setup();
  try {
    for (const toolId of ["one", "two"]) mergeResolution(snapshot, resolveNative(lock, { ...base, toolId }, [evidence.id]));
    finalize(snapshot);
    const shared = snapshot.artifacts.find((a) => a.name === "shared")!;
    assert.equal(snapshot.artifacts.filter((a) => a.name === "shared").length, 1);
    const impact = calculateImpact(snapshot).find((i) => i.artifactId === shared.id)!;
    assert.deepEqual(impact.required, ["one", "two"]);
    assert.deepEqual(impact.optional, []);
    const helper = snapshot.artifacts.find((a) => a.name === "helper")!;
    assert.deepEqual(calculateImpact(snapshot).find((i) => i.artifactId === helper.id)!.development, ["one", "two"]);
  } finally { rmSync(directory, { recursive: true }); }
});

test("separate consumer contexts do not leak upstream outgoing dependencies", () => {
  const { directory, snapshot, evidence } = setup();
  try {
    mergeResolution(snapshot, resolveNative(lock, base, [evidence.id]));
    const other = structuredClone(lock);
    other.packages["node_modules/shared"].dependencies = { left: "2" };
    other.packages["node_modules/left"].version = "2.0.0";
    other.packages["node_modules/left"].resolved = "https://registry.npmjs.org/left/-/left-2.0.0.tgz";
    mergeResolution(snapshot, resolveNative(other, { ...base, toolId: "two", features: ["alternate"] }, [evidence.id]));
    const v2 = snapshot.artifacts.find((a) => a.name === "left" && a.version === "2.0.0")!;
    assert.deepEqual(calculateImpact(snapshot).find((i) => i.artifactId === v2.id)!.required, ["two"]);
    assert.equal(snapshot.artifacts.filter((a) => a.name === "shared").length, 1);
  } finally { rmSync(directory, { recursive: true }); }
});

test("suggested edges affect potential reach only", () => {
  const { directory, snapshot, evidence } = setup();
  try {
    const result = resolveNative(lock, base, [evidence.id]);
    result.edges.forEach((e) => { if (e.from === result.profile.roots[0]) e.verification = "suggested"; });
    mergeResolution(snapshot, result);
    const impacts = calculateImpact(snapshot);
    assert.ok(impacts.every((i) => i.required.length === 0));
    assert.ok(impacts.some((i) => i.potential.includes("one")));
  } finally { rmSync(directory, { recursive: true }); }
});

test("npm workspace links resolve in consumer context and missing dependencies create gaps", () => {
  const result = resolveNative({ name: "workspace", lockfileVersion: 3, packages: {
    "": { name: "workspace", version: "1", dependencies: { child: "*", absent: "1" } },
    "node_modules/child": { link: true, resolved: "packages/child" },
    "packages/child": { name: "child", version: "1", dependencies: { hoisted: "1" } },
    "node_modules/hoisted": { version: "1" },
  } }, { ...base, rootNames: ["workspace"] }, ["test"]);
  assert.equal(result.occurrences.length, 3);
  assert.equal(result.edges.length, 2);
  assert.equal(result.profile.coverage, "partial");
  assert.ok(result.gaps.some((g) => g.reason.includes("absent")));
});

test("Cargo metadata preserves target conditions and build/test kinds", () => {
  const result = resolveNative({ workspace_root: "/src", workspace_members: ["app"], packages: [
    { id: "app", name: "app", version: "1", source: null, manifest_path: "/src/Cargo.toml" },
    { id: "dep", name: "dep", version: "2", source: "registry+https://example.org", manifest_path: "/cache/dep/Cargo.toml" },
  ], resolve: { nodes: [{ id: "app", deps: [{ pkg: "dep", dep_kinds: [{ kind: "build", target: null }, { kind: "dev", target: "cfg(unix)" }] }] }, { id: "dep", deps: [] }] } }, { ...base, adapter: "cargo-metadata", command: "cargo metadata --locked --filter-platform x86_64-unknown-linux-gnu" }, ["test"]);
  assert.equal(result.edges[0].scope, "build");
  assert.equal(result.edges[1].scope, "development");
  assert.equal(result.edges[1].optional, true);
  assert.equal(result.profile.coverage, "complete");
  assert.throws(() => resolveNative({ packages: [], workspace_members: [], resolve: null }, { ...base, adapter: "cargo-metadata" }, ["test"]), /resolve/);
});

test("Cabal plans retain pre-existing units and executable build dependencies", () => {
  const result = resolveNative({ "compiler-id": "ghc-9.6.6", "install-plan": [
    { id: "app", "pkg-name": "app", "pkg-version": "1", style: "local", components: { lib: { depends: ["base"], "exe-depends": ["generator"] } } },
    { id: "base", "pkg-name": "base", "pkg-version": "4.18", type: "pre-existing", depends: [] },
    { id: "generator", "pkg-name": "generator", "pkg-version": "1", style: "global", depends: ["base"] },
  ] }, { ...base, adapter: "cabal-plan" }, ["test"]);
  assert.equal(result.occurrences.length, 3);
  assert.equal(result.edges.filter((e) => e.scope === "build").length, 1);
  assert.equal(result.profile.roots.length, 1);
});

test("snapshot replay ignores timestamps and evidence survives round trips", () => {
  const { directory, store, snapshot, evidence } = setup();
  try {
    mergeResolution(snapshot, resolveNative(lock, base, [evidence.id]));
    store.save(snapshot); const before = snapshot.semanticDigest;
    snapshot.generatedAt = "later"; snapshot.tools[0].lastAttempt = "later";
    store.save(snapshot);
    assert.equal(snapshot.semanticDigest, before);
    assert.deepEqual(store.readEvidence(evidence), lock);
    assert.equal(store.load().semanticDigest, before);
    store.verify(snapshot);
    assert.throws(() => store.readEvidence({ ...evidence, path: "../secret" }), /Invalid evidence path/);
  } finally { rmSync(directory, { recursive: true }); }
});

test("imports reject ambiguous revisions, unknown roots, and cross-profile edges", () => {
  assert.throws(() => parseNativeInput({ ...base, revision: "main" }), /immutable/);
  assert.throws(() => resolveNative(lock, { ...base, rootNames: ["missing"] }, ["test"]), /No roots/);
  const { directory, snapshot, evidence } = setup();
  try {
    mergeResolution(snapshot, resolveNative(lock, base, [evidence.id]));
    mergeResolution(snapshot, resolveNative(lock, { ...base, toolId: "two" }, [evidence.id]));
    snapshot.edges[0].to = snapshot.profiles[1].roots[0];
    assert.throws(() => validate(snapshot), /cross resolution/);
  } finally { rmSync(directory, { recursive: true }); }
});

test("manifest discovery includes nested workspaces and unsupported ecosystems", () => {
  const found = detectManifests(["packages/a/package.json", "Cargo.toml", "haskell/a.cabal", "flake.lock", "aiken.toml", ".github/workflows/release.yml", "README.md"]);
  assert.deepEqual(found.ecosystems, ["cabal", "cargo", "nix", "npm", "other"]);
  assert.equal(found.manifests.length, 5);
  assert.equal(found.reviewFiles.length, 2);
});

test("repository normalization accepts GitHub URLs without guessing repositories for hosted services", () => {
  assert.equal(repositoryReference("github.com/ODATANO/ODATANO"), "ODATANO/ODATANO");
  assert.equal(repositoryReference("https://github.com/owner/repo.git"), "owner/repo");
  assert.equal(repositoryReference("github.com/MeshJS"), null);
  assert.equal(repositoryReference("docs.txpipe.io/balius"), null);
});

test("project reach unions versions instead of summing them, and snapshot diffs include changed verification", () => {
  const { directory, snapshot, evidence } = setup();
  try {
    mergeResolution(snapshot, resolveNative(lock, base, [evidence.id]));
    const other = structuredClone(lock);
    other.packages["node_modules/left"].version = "2.0.0";
    other.packages["node_modules/left"].resolved = "https://registry.npmjs.org/left/-/left-2.0.0.tgz";
    mergeResolution(snapshot, resolveNative(other, { ...base, release: "2.0.0" }, [evidence.id]));
    const project = aggregateProjects(snapshot).find((p) => p.name === "left")!;
    assert.equal(project.artifactIds.length, 2);
    assert.deepEqual(project.impact.required, ["one"]);
    const before = structuredClone(snapshot);
    snapshot.edges[0].verification = "disputed";
    assert.deepEqual(compareSnapshots(before, snapshot).edges.changed, [snapshot.edges[0].id]);
  } finally { rmSync(directory, { recursive: true }); }
});
