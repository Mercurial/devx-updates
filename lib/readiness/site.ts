import { join } from "node:path";
import { existsSync } from "node:fs";
import { calculateImpact, type compareSnapshots } from "./impact";
import { readJson, Store } from "./store";
import type { Snapshot } from "./types";

let cached: Snapshot | undefined;
let impacts: ReturnType<typeof calculateImpact> | undefined;

export function readinessSnapshot() {
  cached ??= new Store(join(process.cwd(), "data/readiness")).load();
  return cached;
}

export function readinessImpacts() {
  impacts ??= calculateImpact(readinessSnapshot());
  return impacts;
}

export function reviewQueue(): { packetId: string; toolIds: string[]; status: string }[] {
  const path = join(process.cwd(), "data/readiness/reviews.json");
  return existsSync(path) ? readJson(path) as ReturnType<typeof reviewQueue> : [];
}

export function readinessChanges(): ReturnType<typeof compareSnapshots> | null {
  const path = join(process.cwd(), "data/readiness/changes.json");
  if (!existsSync(path)) return null;
  const changes = readJson(path) as ReturnType<typeof compareSnapshots>;
  return changes.to === readinessSnapshot().semanticDigest ? changes : null;
}
