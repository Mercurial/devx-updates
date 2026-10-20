import { join } from "node:path";
import { parseBoundaryRegister, worstStatus, type BoundaryRegister } from "./boundary";
import { parseChangeRegister, type ChangeRegister, type Citation } from "./dijkstra";
import { parseLeadRegister, type Lead, type LeadRegister } from "./leads";
import { readJson } from "./store";
import type { ClassificationRegister } from "./surface-collect";
import type { ToolClassification } from "./surfaces";
import { unlockReport, type UnlockReport } from "./unlocks";

/**
 * Build-time view of the Dijkstra registers for the static site (ADR-1, ADR-2): everything is read from
 * content/readiness/dijkstra and validated with the same parsers the CLI uses, so a malformed register fails the build.
 */
export interface DijkstraSite {
  changes: ChangeRegister; boundary: BoundaryRegister; leads: LeadRegister; unlocks: UnlockReport;
  classification: { generatedAt: string; summary: Record<string, number>; tools: Map<string, ToolClassification> };
}

let cached: DijkstraSite | undefined;

export function dijkstraSite(): DijkstraSite {
  if (cached) return cached;
  const dir = join(process.cwd(), "content/readiness/dijkstra");
  const changes = parseChangeRegister(readJson(join(dir, "changes.json")));
  const boundary = parseBoundaryRegister(readJson(join(dir, "boundary.json")), changes);
  const leads = parseLeadRegister(readJson(join(dir, "leads.json")), changes);
  const register = readJson(join(dir, "classification.json")) as ClassificationRegister;
  // Derived at build time from the committed registers, so the page never disagrees with them.
  const unlocks = unlockReport(register.tools, leads, boundary);
  cached = {
    changes, boundary, leads, unlocks,
    classification: { generatedAt: register.generatedAt, summary: register.summary, tools: new Map(register.tools.map((t) => [t.id, t])) },
  };
  return cached;
}

export const citationUrl = (c: Citation) => `https://github.com/${c.repo}/blob/${c.revision}/${c.path}#L${c.line}`;

/** A tool's lead decisions, confirmed first. */
export function toolLeads(site: DijkstraSite, id: string): Lead[] {
  const order = { confirmed: 0, undetermined: 1, "not-reached": 2 } as const;
  return site.leads.leads.filter((l) => l.tool === id).sort((a, b) => order[a.decision] - order[b.decision] || (a.via < b.via ? -1 : 1));
}

export function componentStatus(site: DijkstraSite, id: string) {
  const component = site.boundary.components.find((c) => c.id === id);
  return component ? worstStatus(component) : undefined;
}
