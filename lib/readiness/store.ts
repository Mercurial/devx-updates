import { mkdirSync, readFileSync, renameSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { canonical, digest, finalize, validate } from "./core";
import type { Evidence, Resolution, Snapshot } from "./types";

export function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(temp, path);
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export class Store {
  constructor(readonly directory: string) {}

  load(): Snapshot {
    const snapshot = readJson(join(this.directory, "snapshot.json")) as Snapshot;
    validate(snapshot);
    const expected = snapshot.semanticDigest;
    if (finalize(snapshot).semanticDigest !== expected) throw new Error("Snapshot semantic digest mismatch");
    return snapshot;
  }

  save(snapshot: Snapshot) {
    finalize(snapshot);
    writeJson(join(this.directory, "snapshot.json"), snapshot);
  }

  evidence(value: unknown, description: string, sourceUrl?: string): Evidence {
    const content = canonical(value);
    const hash = digest(content);
    const relative = `evidence/${hash}.json.gz`;
    const path = join(this.directory, relative);
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path)) writeFileSync(path, gzipSync(content));
    return { id: `evidence:${hash}`, digest: hash, path: relative, description, ...(sourceUrl ? { sourceUrl } : {}) };
  }

  readEvidence(evidence: Evidence): unknown {
    if (!/^[a-f0-9]{64}$/.test(evidence.digest) || evidence.path !== `evidence/${evidence.digest}.json.gz`) throw new Error("Invalid evidence path");
    const content = gunzipSync(readFileSync(join(this.directory, evidence.path))).toString("utf8");
    if (digest(content) !== evidence.digest) throw new Error(`Evidence checksum mismatch: ${evidence.id}`);
    return JSON.parse(content);
  }

  verify(snapshot: Snapshot) {
    for (const evidence of snapshot.evidence) this.readEvidence(evidence);
  }
}

export function addEvidence(snapshot: Snapshot, evidence: Evidence) {
  if (!snapshot.evidence.some((e) => e.id === evidence.id)) snapshot.evidence.push(evidence);
}

export function mergeResolution(snapshot: Snapshot, result: Resolution) {
  const tool = snapshot.tools.find((t) => t.id === result.profile.toolId);
  if (!tool) throw new Error(`Unknown catalog tool: ${result.profile.toolId}`);
  if (snapshot.profiles.some((p) => p.id === result.profile.id)) return;
  snapshot.profiles.push(result.profile);
  for (const artifact of result.artifacts) if (!snapshot.artifacts.some((a) => a.id === artifact.id)) snapshot.artifacts.push(artifact);
  snapshot.occurrences.push(...result.occurrences);
  snapshot.edges.push(...result.edges);
  tool.resolution = "partial";
  tool.gaps = tool.gaps.filter((g) => g.reason !== "No native dependency resolution has been imported.");
  tool.gaps.push(...result.gaps);
  tool.evidenceIds.push(...result.profile.evidenceIds);
}
