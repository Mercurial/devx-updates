import type { CapabilityFinding, Profile, Snapshot, Tool } from "./types";

export interface CapabilityRow extends CapabilityFinding {
  release: string;
  revision: string;
  platform: string;
  features: string[];
  current: boolean;
}

/** Findings apply to the recorded profile, never implicitly to a newer release. */
export function capabilityRows(snapshot: Pick<Snapshot, "capabilities" | "profiles" | "tools">): CapabilityRow[] {
  const profiles = new Map<string, Profile>(snapshot.profiles.map((p) => [p.id, p]));
  const tools = new Map<string, Tool>(snapshot.tools.map((t) => [t.id, t]));
  return (snapshot.capabilities ?? []).map((finding) => {
    const profile = profiles.get(finding.profileId)!;
    return { ...finding, release: profile.release, revision: profile.revision, platform: profile.platform, features: profile.features, current: tools.get(finding.toolId)?.revision === profile.revision };
  });
}
