import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBoundaryRegister } from "./boundary";
import { parseChangeRegister } from "./dijkstra";
import { admits, classifyTool, rankClassifications, readConstraint, RULES, scanSources } from "./surfaces";

const changes = parseChangeRegister(JSON.parse(readFileSync("content/readiness/dijkstra/changes.json", "utf8")));
const boundary = parseBoundaryRegister(JSON.parse(readFileSync("content/readiness/dijkstra/boundary.json", "utf8")), changes);
const hit = (scan: ReturnType<typeof scanSources>, rule: string) => scan.hits.find((h) => h.rule === rule);

test("rules reference only known surfaces and boundary components", () => {
  const surfaces = new Set(changes.surfaces.map((s) => s.id)), components = new Set(boundary.components.map((c) => c.id));
  for (const rule of RULES) {
    if (rule.component !== undefined) assert.ok(components.has(rule.component), `${rule.id} names a boundary component`);
    for (const s of rule.surfaces ?? []) assert.ok(surfaces.has(s), `${rule.id} names surface ${s}`);
    assert.ok(rule.component !== undefined || rule.surfaces?.length, `${rule.id} maps to surfaces`);
  }
});

test("scanning finds dependencies only in dependency positions and separates prose from code", () => {
  const scan = scanSources([
    { path: "package.json", content: JSON.stringify({ description: "helpers for @cardano-sdk/core", scripts: { "test:scalus": "x" }, dependencies: { "@cardano-sdk/core": "0.47.1" } }, null, 2) },
    { path: "src/provider.ts", content: "import { BlockfrostProvider } from 'x';\nconst eras = ['shelley', 'alonzo', 'babbage', 'conway'];\nconst era = 'conway';\n" },
    { path: "README.md", content: "Query through the KoiosProvider.\n" },
    { path: "node_modules/x/index.js", content: "ogmios" },
    { path: ".cursor/rules/providers.md", content: "use the KupmiosProvider" },
    { path: "Cargo.toml", content: '[dependencies]\npallas-primitives = "1.4.0"\n' },
  ], "self-tool");
  assert.equal(scan.files, 4);
  assert.equal(scan.skipped, 2);
  const sdk = hit(scan, "dependency:cardano-js-sdk")!;
  assert.equal(sdk.lines, 1, "the description and script keys are not dependencies");
  assert.match(sdk.examples[0].quote, /"@cardano-sdk\/core": "0.47.1"/);
  assert.equal(hit(scan, "dependency:scalus"), undefined);
  assert.equal(hit(scan, "dependency:pallas-codecs")!.examples[0].line, 2);
  assert.equal(hit(scan, "marker:closed-era-list")!.lines, 1, "a lone era name is not a closed list");
  assert.deepEqual([hit(scan, "service:koios")!.lines, hit(scan, "service:koios")!.docLines], [0, 1]);
  assert.equal(hit(scan, "service:ogmios"), undefined, "vendored directories are skipped");
  assert.equal(hit(scan, "service:kupo"), undefined, "editor and assistant configuration is skipped");
  assert.equal(scanSources([{ path: "Cargo.toml", content: 'pallas = "1"' }], "pallas").hits.length, 0, "a component does not depend on itself");
  const prose = scanSources([
    { path: "Cargo.toml", content: 'description = "Wrapper around the cardano-serialization-lib"\n# pallas = "0.1"\n' },
    { path: "run.sh", content: "# accepts cardano-cli style JSON\ncardano-cli latest transaction build\n" },
  ]);
  assert.deepEqual(prose.hits.map((h) => `${h.rule}:${h.lines}`), ["marker:cli-era-command:1", "service:cardano-cli:1"], "manifest comments and passing CLI mentions are not coupling");
});

test("classification inherits R2 readiness through coupling, not through markers or prose", () => {
  const scan = scanSources([
    { path: "go.mod", content: "require github.com/blinklabs-io/gouroboros v0.209.0\n" },
    { path: "src/main.go", content: "const sock = os.Getenv(\"CARDANO_NODE_SOCKET_PATH\")\n// PlutusV3 only\n" },
    { path: "docs/usage.md", content: "Point it at Ogmios.\n" },
  ]);
  const tool = classifyTool({ id: "example", repo: "o/r", revision: "a".repeat(40) }, scan, boundary, changes);
  assert.equal(tool.exposure, "dependency");
  const n2c = tool.surfaces.find((s) => s.surface === "node-to-client-protocol")!;
  assert.deepEqual(n2c.channels.map((c) => c.via).sort(), ["gouroboros@0.209.0<v0.213.0", "service:node-socket"], "pinned below the release that added V23");
  assert.equal(n2c.readiness, "gap");
  assert.equal(tool.surfaces.some((s) => s.channels.some((c) => c.via === "ogmios")), false, "documentation mentions are not coupling");
  const current = classifyTool({ id: "current", repo: "o/c", revision: "f".repeat(40) }, scanSources([{ path: "go.mod", content: "require github.com/blinklabs-io/gouroboros v0.213.7\n" }]), boundary, changes);
  assert.equal(current.surfaces.find((s) => s.surface === "node-to-client-protocol")!.readiness, "released");
  const reaches = (quote: string, path: string, needed: string) => { const c = readConstraint(quote, path); return c && admits(c, needed.split(".").map(Number)); };
  assert.equal(reaches('pallas = { git = "https://github.com/txpipe/pallas" }', "Cargo.toml", "0.35.1"), null, "git references carry no version");
  assert.equal(reaches('pallas-traverse = "0.35.0"', "Cargo.toml", "0.35.1"), true, "Cargo defaults to caret");
  assert.equal(reaches('pallas = "=0.35.0"', "Cargo.toml", "0.35.1"), false);
  assert.equal(reaches('"@cardano-sdk/core": "^0.46.10",', "package.json", "0.47.0"), false, "a 0.x caret stays within the minor");
  assert.equal(reaches(", plutus-ledger-api ^>=1.65", "a.cabal", "1.71.0.0"), false, "a PVP major stops at the next minor");
  assert.equal(reaches(", plutus-tx >= 1.5.0", "a.cabal", "1.71.0.0"), true, "lower bounds are not pins");
  assert.equal(reaches('"pycardano>=0.9.0",', "pyproject.toml", "1.0"), true);
  assert.equal(reaches("<version.ccl>0.4.3</version.ccl>", "pom.xml", "0.7"), false);
  const codecs = classifyTool({ id: "codec-user", repo: "o/u", revision: "1".repeat(40) }, scanSources([{ path: "Cargo.toml", content: 'pallas-primitives = "0.32"\n' }]), boundary, changes);
  assert.equal(codecs.surfaces.some((s) => s.surface === "node-to-client-protocol"), false, "codec crates do not carry the mini-protocols");
  assert.equal(scanSources([{ path: "Cargo.toml", content: 'pallas-crypto = "0.30"\npallas-addresses = "0.30"\n' }]).hits.length, 0, "crates outside the changed surfaces");
  const plutus = tool.surfaces.find((s) => s.surface === "plutus-language")!;
  assert.deepEqual(plutus.channels.map((c) => [c.channel, c.via, c.readiness]), [
    ["dependency", "gouroboros@0.209.0<v0.213.7", "gap"], ["marker", "marker:plutus-language-enum", "unassessed"],
  ]);
  assert.equal(plutus.readiness, "gap", "the marker does not override the dependency's readiness");

  const markersOnly = classifyTool({ id: "m", repo: "o/m", revision: "b".repeat(40) }, scanSources([{ path: "a.ts", content: "PlutusV3" }]), boundary, changes);
  assert.deepEqual([markersOnly.exposure, markersOnly.readiness], ["marker", "unassessed"]);
  const none = classifyTool({ id: "n", repo: "o/n", revision: "c".repeat(40) }, scanSources([{ path: "a.ts", content: "x" }]), boundary, changes);
  assert.equal(none.exposure, "none-found");
  const hidden = classifyTool({ id: "eternl", repo: "eternl.io", revision: null }, { status: "no-public-source", note: "website" }, boundary, changes);
  assert.deepEqual([hidden.exposure, hidden.readiness], ["unknown", "unassessed"]);
  const own = classifyTool({ id: "cardano-wallet", repo: "x/y", revision: "d".repeat(40) }, scanSources([]), boundary, changes);
  assert.equal(own.exposure, "implements");
  assert.equal(own.surfaces.find((s) => s.surface === "node-to-client-protocol")!.readiness, "gap");
  const upstream = classifyTool({ id: "cardano-cli", repo: "IntersectMBO/cardano-cli", revision: "e".repeat(40) }, scanSources([]), boundary, changes);
  assert.deepEqual([upstream.exposure, upstream.readiness, upstream.surfaces.length], ["implements", "upstream", changes.surfaces.length]);

  const ranked = rankClassifications([none, markersOnly, hidden, tool, own]).map((t) => t.id);
  assert.deepEqual(ranked, ["cardano-wallet", "example", "eternl", "m", "n"]);
});
