import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Graph } from "../map-types";
import { inventory } from "./core";
import { Store } from "./store";
import { collectionCandidates } from "./candidates";
import { collectionKey, publishCollection, reuseCollection, type CollectionSelection } from "./collection";
import type { NativeInput } from "./types";

test("collection cache requires retained bytes and distinguishes Python and Go configurations", (t) => {
  t.mock.method(console, "log", () => {});
  const directory = mkdtempSync(join(tmpdir(), "readiness-collection-"));
  try {
    const store = new Store(directory);
    const snapshot = inventory({ nodes: [{ id: "tool", name: "Tool", repo: "owner/repo", team: "Team" }] } as Graph, "catalog");
    const selection: CollectionSelection = { revision: "a".repeat(40), adapter: "npm-lock", roots: ["app"], path: "package-lock.json", platform: "all-lockfile-targets", resolverContext: "committed-lockfile" };
    const profile: NativeInput = { toolId: "tool", release: "v1", ...selection, features: [], command: "read lock", toolchain: "npm v3", origin: "source-reconstruction", rootNames: selection.roots };
    const options = { ...selection, toolId: "tool", stateDir: directory };
    publishCollection(snapshot, store, selection, profile, { lockfileVersion: 3, packages: { "": { name: "app", version: "1.0.0" } } }, [], "https://github.com/owner/repo");
    assert.equal(reuseCollection(snapshot, store, options, selection), true);
    assert.equal(reuseCollection(snapshot, store, { ...options, refresh: true }, selection), false);
    assert.notEqual(collectionKey({ ...selection, pythonVersion: "3.13" }), collectionKey({ ...selection, pythonVersion: "3.14" }));
    assert.notEqual(collectionKey({ ...selection, patterns: ["./cmd/tool"], tags: [] }), collectionKey({ ...selection, patterns: ["./cmd/tool"], tags: ["integration"] }));
    const native = snapshot.evidence.find((e) => e.id === snapshot.profiles[0].nativeEvidenceId)!;
    unlinkSync(join(directory, native.path));
    assert.equal(reuseCollection(snapshot, store, options, selection), false, "a cached graph cannot conceal missing evidence");
  } finally { rmSync(directory, { recursive: true }); }
});

test("collection candidates include nested native inputs without guessing package identities", () => {
  const snapshot = inventory({ nodes: [{ id: "tool", name: "Tool", team: "Team" }] } as Graph, "catalog");
  snapshot.tools[0].manifests = ["sdk/pnpm-lock.yaml", "native/Cargo.lock", "native/Cargo.toml", "python/pyproject.toml", "python/uv.lock", "go/go.mod", "docs/package-lock.json", "unsupported/yarn.lock", "orphan/Cargo.lock"];
  const [tool] = collectionCandidates(snapshot);
  assert.equal(tool.candidates.length, 5);
  assert.ok(tool.candidates.some((c) => c.adapter === "uv-tree" && c.path === "python/pyproject.toml"));
  assert.ok(tool.candidates.some((c) => c.adapter === "cargo-metadata" && c.path === "native/Cargo.toml"));
  assert.equal(tool.packageHint, null);
  assert.throws(() => collectionCandidates(snapshot, ["missing"]), /Unknown tool/);
});
