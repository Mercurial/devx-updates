import type { Snapshot } from "./types";

export function toolSubgraph(snapshot: Snapshot, toolIds: string[]) {
  const selected = new Set(toolIds);
  const tools = snapshot.tools.filter((t) => selected.has(t.id));
  if (!tools.length || selected.size !== tools.length) throw new Error("Select known tools");
  const profiles = snapshot.profiles.filter((p) => selected.has(p.toolId));
  const profileIds = new Set(profiles.map((p) => p.id));
  const occurrences = snapshot.occurrences.filter((n) => profileIds.has(n.profileId));
  const nodeIds = new Set(occurrences.map((n) => n.id));
  const artifactIds = new Set(occurrences.map((n) => n.artifactId));
  const edges = snapshot.edges.filter((e) => nodeIds.has(e.from));
  const evidenceIds = new Set([...tools.flatMap((t) => t.evidenceIds), ...profiles.flatMap((p) => p.evidenceIds), ...occurrences.flatMap((n) => n.evidenceIds), ...edges.flatMap((e) => e.evidenceIds)]);
  return { tools, profiles, occurrences, artifacts: snapshot.artifacts.filter((a) => artifactIds.has(a.id)), edges, evidence: snapshot.evidence.filter((e) => evidenceIds.has(e.id)) };
}
