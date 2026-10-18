import { digest } from "./core";
import { resolveNative } from "./adapters";
import { addEvidence, mergeResolution, Store } from "./store";
import type { CollectAdapter, NativeInput, Snapshot } from "./types";

export interface CollectionRequest {
  toolId: string;
  adapter: CollectAdapter;
  roots: string[];
  path?: string;
  platform: string;
  pythonVersion?: string;
  patterns?: string[];
  tags?: string[];
}

export interface CollectOptions extends CollectionRequest {
  stateDir: string;
  refresh?: boolean;
}

export interface CollectionSelection extends Omit<CollectionRequest, "toolId" | "path"> {
  revision: string;
  path: string;
  resolverContext: string;
}

export const collectionKey = (selection: CollectionSelection) => digest({ ...selection, collectorVersion: ["pnpm-lock", "go-packages", "uv-tree"].includes(selection.adapter) ? 3 : 2 });

export function reuseCollection(snapshot: Snapshot, store: Store, options: CollectOptions, selection: CollectionSelection): boolean {
  if (options.refresh) return false;
  const key = collectionKey(selection);
  const request = snapshot.collections?.find((c) => c.key === key && c.toolId === options.toolId);
  const profile = request && snapshot.profiles.find((p) => p.id === request.profileId);
  if (!profile) return false;
  if (selection.adapter === "go-packages" && profile.coverage !== "complete") return false;
  // A cache hit must still have its retained input bytes, not just a graph reference.
  for (const id of profile.evidenceIds) {
    const evidence = snapshot.evidence.find((e) => e.id === id);
    if (!evidence) return false;
    try { store.readEvidence(evidence); } catch { return false; }
  }
  console.log(`Reused ${options.toolId} native collection ${key.slice(0, 12)}`);
  return true;
}

export function publishCollection(snapshot: Snapshot, store: Store, selection: CollectionSelection, profile: NativeInput, raw: unknown, supporting: string[], sourceUrl: string) {
  const tool = snapshot.tools.find((t) => t.id === profile.toolId)!;
  const native = store.evidence(raw, `${profile.adapter} for ${tool.id} ${profile.release}`, sourceUrl);
  const configuration = store.evidence(profile, "Native collection profile and command", sourceUrl);
  const result = resolveNative(raw, profile, { native: native.id, configuration: configuration.id, supporting });
  addEvidence(snapshot, native); addEvidence(snapshot, configuration);
  mergeResolution(snapshot, result);
  const request = store.evidence({ selection, profileId: result.profile.id }, `Collection request for ${tool.id}`);
  addEvidence(snapshot, request); tool.evidenceIds.push(request.id);
  const key = collectionKey(selection);
  snapshot.collections = (snapshot.collections ?? []).filter((c) => c.toolId !== tool.id || (c.key !== key && c.profileId !== result.profile.id));
  snapshot.collections.push({ key, toolId: tool.id, profileId: result.profile.id, evidenceId: request.id });
  tool.gaps = tool.gaps.filter((g) => g.code !== `native-collection-failed:${profile.adapter}`);
  store.save(snapshot);
  console.log(`Collected ${tool.id}: ${result.occurrences.length} occurrences, ${result.edges.length} edges, ${result.profile.coverage} profile`);
  return result;
}
