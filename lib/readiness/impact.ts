import type { Edge, Impact, Snapshot } from "./types";

/** Each walk stays within one resolution profile, even when artifacts are shared. */
export function calculateImpact(snapshot: Snapshot): Impact[] {
  const outgoing = new Map<string, Edge[]>();
  for (const edge of snapshot.edges) {
    if (edge.verification === "rejected") continue;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }
  for (const edges of outgoing.values()) edges.sort((a, b) => a.id.localeCompare(b.id));
  const nodes = new Map(snapshot.occurrences.map((n) => [n.id, n]));
  const results = new Map<string, Impact>();
  for (const profile of snapshot.profiles) {
    const ownArtifacts = new Set(profile.roots.map((id) => nodes.get(id)!.artifactId));
    const queue = profile.roots.map((id) => ({ id, path: [id], scope: "runtime", optional: false, potential: false }));
    const visited = new Set<string>();
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      const key = `${current.id}/${current.scope}/${current.optional}/${current.potential}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const artifactId = nodes.get(current.id)!.artifactId;
      if (!ownArtifacts.has(artifactId) && current.path.length > 1) {
        const impact = results.get(artifactId) ?? { artifactId, required: [], optional: [], build: [], development: [], potential: [], paths: {} };
        const bucket = current.potential ? "potential" : current.scope === "development" ? "development" : current.scope === "build" ? "build" : current.optional ? "optional" : "required";
        if (!impact[bucket].includes(profile.toolId)) impact[bucket].push(profile.toolId);
        const pathKey = `${profile.toolId}:${bucket}:${profile.id}`;
        if (!impact.paths[pathKey]) impact.paths[pathKey] = current.path;
        results.set(artifactId, impact);
      }
      for (const edge of outgoing.get(current.id) ?? []) {
        const scope = current.scope === "development" || edge.scope === "development" ? "development" : current.scope === "build" || edge.scope === "build" ? "build" : "runtime";
        queue.push({ id: edge.to, path: [...current.path, edge.to], scope, optional: current.optional || edge.optional, potential: current.potential || edge.verification !== "verified" });
      }
    }
  }
  for (const impact of results.values()) {
    impact.optional = impact.optional.filter((id) => !impact.required.includes(id));
    for (const key of ["required", "optional", "build", "development", "potential"] as const) impact[key].sort();
  }
  return [...results.values()].sort((a, b) => b.required.length - a.required.length || b.potential.length - a.potential.length || a.artifactId.localeCompare(b.artifactId));
}

export function compareSnapshots(before: Snapshot, after: Snapshot) {
  const change = <T extends { id: string }>(left: T[], right: T[]) => {
    const old = new Set(left.map((v) => v.id)); const next = new Set(right.map((v) => v.id));
    return { added: [...next].filter((id) => !old.has(id)).sort(), removed: [...old].filter((id) => !next.has(id)).sort() };
  };
  return {
    from: before.semanticDigest, to: after.semanticDigest,
    artifacts: change(before.artifacts, after.artifacts), edges: change(before.edges, after.edges),
    coverage: after.tools.filter((tool) => {
      const previous = before.tools.find((t) => t.id === tool.id);
      return !previous || ["artifact", "resolution", "integration", "capability", "revision", "discoveryError"].some((key) => previous[key as keyof typeof previous] !== tool[key as keyof typeof tool]);
    }).map((tool) => ({ toolId: tool.id, artifact: tool.artifact, resolution: tool.resolution, integration: tool.integration, revision: tool.revision, discoveryError: tool.discoveryError })),
  };
}
