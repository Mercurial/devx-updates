import { test } from "node:test";
import assert from "node:assert/strict";
import type { BoundaryRegister } from "./boundary";
import type { LeadRegister } from "./leads";
import type { ToolClassification } from "./surfaces";
import { toolBlockers, unlockReport, unlocksOf } from "./unlocks";

const revision = "a".repeat(40);
const component = (id: string, gap: string[] = [], status = "gap") => ({
  id, repo: `o/${id}`, roles: [], surfaces: [], observed: { branch: "main", revision, date: "2026-10-20", release: null }, dependsOn: [],
  assessments: gap.length ? [{ surfaces: gap, status, summary: "s", evidence: [] }] : [],
});
const boundary = { schemaVersion: 1, retrieved: "2026-10-20", method: [], components: [component("scalus", ["plutus-script-context"]), component("mesh"), component("sdk", ["protocol-parameters"]), component("gouroboros", ["block-encoding"], "in-progress")] } as unknown as BoundaryRegister;
// Each tool lists [surface, via] gap channels; a pinned via carries `@version<first`.
const tool = (id: string, gaps: [string, string][]): ToolClassification => ({
  id, repo: `o/${id}`, revision, scan: { status: "scanned", files: 1, skipped: 0 }, exposure: "dependency", readiness: "gap", hits: [],
  surfaces: gaps.map(([surface, via]) => ({ surface, readiness: "gap", channels: [{ channel: "dependency", via, readiness: "gap", lines: 1, scope: "shipped" }] })),
});
const tools = [
  tool("scalus", []), tool("mesh", [["plutus-script-context", "scalus"]]), tool("dapp", [["plutus-script-context", "mesh"]]),
  tool("wallet", [["plutus-script-context", "scalus"], ["protocol-parameters", "sdk"]]),
  tool("cli", [["node-to-client-protocol", "gouroboros@0.209.0<v0.213.0"]]),
  tool("indexer", [["plutus-script-context", "scalus"], ["node-to-client-protocol", "gouroboros@0.209.0<v0.213.0"]]),
  tool("quiet", [["plutus-script-context", "scalus"]]),
];
const lead = (t: string, via: string, surface: string, decision = "confirmed") => ({ tool: t, revision, via, surfaces: [surface], decision, summary: "s", evidence: [] });
const leads = { schemaVersion: 1, reviewed: "2026-10-20", method: [], leads: [
  lead("mesh", "scalus", "plutus-script-context"), lead("dapp", "mesh", "plutus-script-context"),
  lead("wallet", "scalus", "plutus-script-context"), lead("wallet", "sdk", "protocol-parameters"),
  lead("cli", "gouroboros", "node-to-client-protocol"),
  lead("indexer", "scalus", "plutus-script-context"), lead("indexer", "gouroboros", "node-to-client-protocol"),
  lead("quiet", "scalus", "plutus-script-context", "not-reached"),
] } as unknown as LeadRegister;

test("blockers separate upstream fixes, own pins and own gaps", () => {
  const byTool = new Map(toolBlockers(tools, leads, boundary).map((t) => [t.tool, t.blockers.map((b) => `${b.kind}:${b.via}`)]));
  assert.deepEqual(byTool.get("scalus"), ["own-gap:scalus"]);
  assert.deepEqual(byTool.get("cli"), ["own-bump:gouroboros"]);
  assert.deepEqual(byTool.get("wallet"), ["upstream-fix:scalus", "upstream-fix:sdk"]);
  assert.deepEqual(byTool.get("quiet"), [], "a not-reached gap blocks nothing");
});

test("a fix unlocks direct consumers, then consumers of what it unblocked, and lists the rest as partial", () => {
  const consumer = tool("mesh-dapp", []);
  consumer.surfaces = [{ surface: "transaction-encoding", readiness: "no-evidence", channels: [{ channel: "dependency", via: "mesh", readiness: "no-evidence", lines: 1, scope: "shipped" }] }];
  const scalus = unlocksOf("scalus", toolBlockers(tools, leads, boundary), [...tools, consumer]);
  assert.deepEqual(scalus.downstream, [{ tool: "mesh-dapp", via: "mesh" }], "consumers of what a fix unblocks are listed, unconfirmed");
  assert.deepEqual(scalus.unlocks.map((u) => [u.tool, u.path.join(">"), u.bumps]), [
    ["indexer", "scalus>indexer", ["gouroboros@0.209.0<v0.213.0"]], ["mesh", "scalus>mesh", []], ["dapp", "scalus>mesh>dapp", []],
  ]);
  assert.deepEqual(scalus.partial, [{ tool: "wallet", stillBlockedBy: ["sdk"] }]);
  const report = unlockReport(tools, leads, boundary);
  assert.deepEqual(report.bumpReady, [{ tool: "cli", pins: ["gouroboros@0.209.0<v0.213.0"] }]);
  const ported = unlockReport([tool("gouroboros", [["block-encoding", "ouroboros-consensus@3.0.1<5.1.0.1"]])], { ...leads, leads: [lead("gouroboros", "ouroboros-consensus", "block-encoding")] } as unknown as LeadRegister, boundary);
  assert.deepEqual(ported.bumpReady, [{ tool: "gouroboros", pins: ["ouroboros-consensus@3.0.1<5.1.0.1"], ownStatus: "in-progress" }], "a boundary component's bump carries its own status");
  assert.deepEqual(report.components.map((c) => [c.component, c.unlocks.length, c.ownGap]), [["scalus", 3, ["plutus-script-context"]], ["mesh", 1, []], ["sdk", 0, ["protocol-parameters"]]]);
});
