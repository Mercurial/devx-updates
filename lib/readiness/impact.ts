import type { Edge, Impact, Snapshot } from "./types";
import { canonical, digest } from "./core";

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
    const requiredInProfile = new Set<string>();
    const optionalInProfile = new Set<string>();
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
        if (bucket === "required") requiredInProfile.add(artifactId);
        if (bucket === "optional") optionalInProfile.add(artifactId);
        else if (!impact[bucket].includes(profile.toolId)) impact[bucket].push(profile.toolId);
        const pathKey = `${profile.toolId}:${bucket}:${profile.id}`;
        if (!impact.paths[pathKey]) impact.paths[pathKey] = current.path;
        results.set(artifactId, impact);
      }
      for (const edge of outgoing.get(current.id) ?? []) {
        const scope = current.scope === "development" || edge.scope === "development" ? "development" : current.scope === "build" || edge.scope === "build" ? "build" : "runtime";
        queue.push({ id: edge.to, path: [...current.path, edge.to], scope, optional: current.optional || edge.optional, potential: current.potential || edge.verification !== "verified" });
      }
    }
    for (const artifactId of optionalInProfile) {
      const impact = results.get(artifactId)!;
      if (requiredInProfile.has(artifactId)) delete impact.paths[`${profile.toolId}:optional:${profile.id}`];
      else if (!impact.optional.includes(profile.toolId)) impact.optional.push(profile.toolId);
    }
  }
  for (const impact of results.values()) {
    for (const key of ["required", "optional", "build", "development", "potential"] as const) impact[key].sort();
  }
  return [...results.values()].sort((a, b) => b.required.length - a.required.length || b.potential.length - a.potential.length || a.artifactId.localeCompare(b.artifactId));
}

export function compareSnapshots(before: Snapshot, after: Snapshot) {
  const coverageValue = (tool: Snapshot["tools"][number], key: keyof Snapshot["tools"][number]) => key === "gaps" ? tool.gaps.map(({ area, reason, nextAction, profileId }) => canonical({ area, reason, nextAction, profileId })).sort() : tool[key];
  const change = <T extends { id: string }>(left: T[], right: T[]) => {
    const old = new Set(left.map((v) => v.id)); const next = new Set(right.map((v) => v.id));
    const previous = new Map(left.map((v) => [v.id, canonical(v)]));
    return { added: [...next].filter((id) => !old.has(id)).sort(), removed: [...old].filter((id) => !next.has(id)).sort(), changed: right.filter((v) => previous.has(v.id) && previous.get(v.id) !== canonical(v)).map((v) => v.id).sort() };
  };
  return {
    from: before.semanticDigest, to: after.semanticDigest,
    artifacts: change(before.artifacts, after.artifacts), edges: change(before.edges, after.edges), profiles: change(before.profiles, after.profiles),
    coverage: after.tools.filter((tool) => {
      const previous = before.tools.find((t) => t.id === tool.id);
      return !previous || ["artifact", "resolution", "integration", "capability", "revision", "discoveryError", "gaps"].some((key) => canonical(coverageValue(previous, key as keyof typeof previous)) !== canonical(coverageValue(tool, key as keyof typeof tool)));
    }).map((tool) => ({ toolId: tool.id, artifact: tool.artifact, resolution: tool.resolution, integration: tool.integration, revision: tool.revision, discoveryError: tool.discoveryError })),
  };
}

export function aggregateProjects(snapshot: Snapshot, impacts = calculateImpact(snapshot)) {
  const artifacts = new Map(snapshot.artifacts.map((a) => [a.id, a]));
  const groups = new Map<string, { id: string; name: string; ecosystem: string; source: string; artifactIds: string[]; versions: string[]; impact: Impact }>();
  for (const impact of impacts) {
    const artifact = artifacts.get(impact.artifactId)!;
    // Only collapse version-bearing sources where the package namespace is known.
    const source = artifact.ecosystem === "npm" && artifact.source.startsWith("https://registry.npmjs.org/") ? "https://registry.npmjs.org" : artifact.source.startsWith("git+") ? artifact.source.split("#")[0] : artifact.source;
    const id = `project:${digest({ ecosystem: artifact.ecosystem, name: artifact.name, source })}`;
    const group = groups.get(id) ?? { id, name: artifact.name, ecosystem: artifact.ecosystem, source, artifactIds: [], versions: [], impact: { artifactId: id, required: [], optional: [], build: [], development: [], potential: [], paths: {} } };
    group.artifactIds.push(artifact.id);
    if (!group.versions.includes(artifact.version ?? "unknown")) group.versions.push(artifact.version ?? "unknown");
    for (const bucket of ["required", "optional", "build", "development", "potential"] as const) group.impact[bucket] = [...new Set([...group.impact[bucket], ...impact[bucket]])].sort();
    for (const [key, path] of Object.entries(impact.paths)) group.impact.paths[`${key}:${artifact.id}`] = path;
    groups.set(id, group);
  }
  for (const group of groups.values()) {
    const requiredProfiles = new Set<string>();
    const optionalProfiles: { key: string; context: string; toolId: string }[] = [];
    for (const key of Object.keys(group.impact.paths)) {
      const [toolId, bucket, ...parts] = key.split(":");
      const context = `${toolId}:${parts.slice(0, -2).join(":")}`;
      if (bucket === "required") requiredProfiles.add(context);
      if (bucket === "optional") optionalProfiles.push({ key, context, toolId });
    }
    group.impact.optional = [...new Set(optionalProfiles.filter((p) => !requiredProfiles.has(p.context)).map((p) => p.toolId))].sort();
    for (const p of optionalProfiles) if (requiredProfiles.has(p.context)) delete group.impact.paths[p.key];
    group.versions.sort();
  }
  return [...groups.values()].sort((a, b) => b.impact.required.length - a.impact.required.length || a.name.localeCompare(b.name));
}
