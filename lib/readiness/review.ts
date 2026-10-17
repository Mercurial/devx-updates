import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { artifact, canonical, digest, finalize, gap, list, object, text } from "./core";
import { addEvidence, readJson, Store, writeJson } from "./store";
import type { Edge, Snapshot, Verification } from "./types";

export function reviewPacket(snapshot: Snapshot, toolIds: string[]) {
  const tools = snapshot.tools.filter((t) => toolIds.includes(t.id)).map(({ lastAttempt, lastSuccess, ...tool }) => {
    void lastAttempt; void lastSuccess; return tool;
  });
  if (!tools.length || new Set(toolIds).size !== tools.length) throw new Error("Select unique known tools for review");
  const profiles = snapshot.profiles.filter((p) => toolIds.includes(p.toolId));
  const profileIds = new Set(profiles.map((p) => p.id));
  const occurrences = snapshot.occurrences.filter((n) => profileIds.has(n.profileId));
  const nodeIds = new Set(occurrences.map((n) => n.id));
  const artifactIds = new Set(occurrences.map((n) => n.artifactId));
  const edges = snapshot.edges.filter((e) => nodeIds.has(e.from));
  const evidenceIds = new Set([...tools.flatMap((t) => t.evidenceIds), ...profiles.flatMap((p) => p.evidenceIds), ...edges.flatMap((e) => e.evidenceIds)]);
  const evidence = snapshot.evidence.filter((e) => evidenceIds.has(e.id));
  const context = { tools, profiles, occurrences, artifacts: snapshot.artifacts.filter((a) => artifactIds.has(a.id)), edges, evidence };
  const inputDigest = digest(context);
  return { schemaVersion: 1, taskBriefVersion: 1, packetId: `packet:${inputDigest}`, inputDigest, toolIds: [...toolIds].sort(), context };
}

export function exportPacket(snapshot: Snapshot, store: Store, toolIds: string[], output: string) {
  const packet = reviewPacket(snapshot, toolIds);
  mkdirSync(output, { recursive: true });
  writeJson(join(output, "packet.json"), packet);
  for (const evidence of packet.context.evidence) writeJson(join(output, "evidence", `${evidence.digest}.json`), store.readEvidence(evidence));
  writeJson(join(output, "result-template.json"), { packetId: packet.packetId, inputDigest: packet.inputDigest, completion: "partial", inspectedAreas: [], unreviewedAreas: ["Fill in remaining coverage"], findings: [] });
  writeFileSync(join(output, "TASKS.md"), readFileSync("docs/DEPENDENCY-REVIEW-TASKS.md", "utf8"));
  const indexPath = join(store.directory, "reviews.json");
  const index = existsSync(indexPath) ? readJson(indexPath) as { packetId: string; toolIds: string[]; status: string }[] : [];
  if (!index.some((r) => r.packetId === packet.packetId)) index.push({ packetId: packet.packetId, toolIds: packet.toolIds, status: "pending" });
  writeJson(indexPath, index);
  return packet;
}

export function checkCitation(raw: unknown, snapshot: Snapshot, store: Store, allowed: Set<string>): string {
  const citation = object(raw, "citation");
  const evidenceId = text(citation.evidenceId);
  if (!allowed.has(evidenceId)) throw new Error("Citation is outside the review packet");
  const evidence = snapshot.evidence.find((e) => e.id === evidenceId);
  if (!evidence) throw new Error("Unknown citation evidence");
  let value = store.readEvidence(evidence);
  const pointer = citation.pointer;
  if (typeof pointer !== "string" || (pointer !== "" && !pointer.startsWith("/"))) throw new Error("Citation requires a JSON pointer");
  if (pointer) for (const encoded of pointer.slice(1).split("/")) {
    const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) throw new Error(`Citation pointer does not exist: ${pointer}`);
    value = (value as Record<string, unknown>)[key];
  }
  const quote = text(citation.quote, "citation quote");
  if (!(typeof value === "string" ? value : canonical(value)).includes(quote)) throw new Error("Citation quote does not match retained evidence");
  return evidenceId;
}

/** Validate on a copy: a partially invalid result cannot mutate the canonical graph. */
export function importReview(snapshot: Snapshot, store: Store, rawPacket: unknown, rawResult: unknown, rawDecisions?: unknown): Snapshot {
  const packet = object(rawPacket, "packet");
  const result = object(rawResult, "result");
  const toolIds = list(packet.toolIds).map((id) => text(id));
  const resultId = `evidence:${digest(canonical({ result: rawResult, decisions: rawDecisions ?? null }))}`;
  if (snapshot.evidence.some((e) => e.id === resultId)) return snapshot;
  const current = reviewPacket(snapshot, toolIds);
  if (packet.packetId !== current.packetId || packet.inputDigest !== current.inputDigest || result.packetId !== current.packetId || result.inputDigest !== current.inputDigest) throw new Error("Stale or mismatched review packet; export current inputs and revalidate findings");
  if (!["complete", "partial"].includes(result.completion as string)) throw new Error("Result needs a completion state");
  list(result.inspectedAreas).forEach((v) => text(v)); list(result.unreviewedAreas).forEach((v) => text(v));
  const allowed = new Set(current.context.evidence.map((e) => e.id));
  const decisions = rawDecisions ? list(object(rawDecisions).decisions).map((d) => object(d)) : [];
  const findings = list(result.findings).map((f) => object(f));
  const ids = findings.map((f) => text(f.id));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate finding IDs");
  if (decisions.some((d) => !ids.includes(text(d.findingId)))) throw new Error("Decision refers to an unknown finding");
  if (new Set(decisions.map((d) => d.findingId)).size !== decisions.length) throw new Error("Duplicate decisions");
  const next = structuredClone(snapshot);
  const submission = store.evidence({ result: rawResult, decisions: rawDecisions ?? null }, `Review submission ${current.packetId}`);
  addEvidence(next, submission);
  for (const finding of findings) {
    const id = text(finding.id);
    const toolId = text(finding.toolId);
    if (!toolIds.includes(toolId)) throw new Error("Finding tool is outside packet scope");
    const tool = next.tools.find((t) => t.id === toolId)!;
    const rationale = text(finding.rationale);
    const citations = list(finding.citations).map((c) => checkCitation(c, snapshot, store, allowed));
    const evidenceIds = [...new Set([...citations, submission.id])].sort();
    const decision = decisions.find((d) => d.findingId === id);
    const verification = decision ? text(decision.verification) as Verification : "suggested";
    if (!["verified", "suggested", "disputed", "rejected"].includes(verification)) throw new Error("Invalid review verification");
    if (decision) {
      text(decision.rationale); text(decision.method);
      if (!["source-review", "maintainer-confirmation", "native-check"].includes(decision.method as string)) throw new Error("Record the evidence verification method, not agreement between review passes");
    }
    if (finding.kind === "gap") {
      const area = text(finding.area);
      if (!["artifact", "resolution", "integration", "capability", "discovery"].includes(area)) throw new Error("Invalid gap area");
      const item = gap(area as typeof tool.gaps[number]["area"], rationale, text(finding.nextAction));
      if (!tool.gaps.some((g) => g.id === item.id)) tool.gaps.push(item);
      tool.evidenceIds.push(submission.id);
      continue;
    }
    if (finding.kind !== "relationship") throw new Error("Import supports relationship and gap findings; record other unresolved questions as gaps");
    if (!citations.length) throw new Error("A relationship requires at least one checked citation");
    const from = text(finding.from);
    const consumer = next.occurrences.find((n) => n.id === from);
    const profile = next.profiles.find((p) => p.id === consumer?.profileId);
    if (!consumer || profile?.toolId !== toolId) throw new Error("Consumer occurrence is outside the tool/profile scope");
    const target = object(finding.target);
    const targetArtifact = artifact({ ecosystem: text(target.ecosystem), name: text(target.name), version: target.version === null ? null : text(target.version), source: text(target.source), integrity: target.integrity === null ? null : text(target.integrity) });
    const locator = `review:${targetArtifact.id}`;
    const targetId = `occurrence:${digest({ profileId: profile.id, locator })}`;
    if (!next.artifacts.some((a) => a.id === targetArtifact.id)) next.artifacts.push(targetArtifact);
    if (!next.occurrences.some((n) => n.id === targetId)) next.occurrences.push({ id: targetId, artifactId: targetArtifact.id, profileId: profile.id, locator, evidenceIds });
    const type = text(finding.type);
    if (!["service", "protocol", "bundled", "code-generation"].includes(type)) throw new Error("Use native resolution for package edges; review imports cover integration edges");
    const scope = text(finding.scope);
    if (!["runtime", "build", "development"].includes(scope) || typeof finding.optional !== "boolean") throw new Error("Invalid scope or optionality");
    const fields = { from, to: targetId, type: type as Edge["type"], scope: scope as Edge["scope"], optional: finding.optional, condition: finding.condition === null ? null : text(finding.condition), constraint: null };
    const edgeId = `edge:${digest(fields)}`;
    const existing = next.edges.find((e) => e.id === edgeId);
    if (existing && existing.verification !== verification) {
      if (!decision || decision.previousVerification !== existing.verification) throw new Error("Changing a prior decision requires explicit previousVerification");
      existing.verification = verification;
      existing.evidenceIds = [...new Set([...existing.evidenceIds, ...evidenceIds])].sort();
    }
    if (!existing) next.edges.push({ id: edgeId, ...fields, verification, evidenceIds });
    next.decisions.push({ id: `decision:${digest({ packetId: current.packetId, finding: id, submission: submission.id })}`, packetId: current.packetId, edgeId, verification, rationale: decision ? text(decision.rationale) : rationale, method: decision ? text(decision.method) : "unreviewed-suggestion", evidenceIds });
    const frontier = gap("integration", `${targetArtifact.name}: dependency implementation/deployment remains an opaque boundary.`, "Resolve the dependency or document the interface and deployed version.", profile.id);
    if (verification !== "rejected" && !tool.gaps.some((g) => g.id === frontier.id)) tool.gaps.push(frontier);
    tool.integration = "partial";
    tool.evidenceIds.push(submission.id);
  }
  return finalize(next);
}
