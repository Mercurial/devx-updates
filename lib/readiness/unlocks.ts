import { worstStatus, type BoundaryRegister, type Status } from "./boundary";
import { gapLeads, type LeadRegister } from "./leads";
import type { ToolClassification } from "./surfaces";
import { pinStep, type PinStep } from "./upgrades";

/**
 * Unlock analysis (plan revision R3/R4): which tools a fix in one component clears, directly and through other
 * components, derived from the classification (who depends on what), the lead decisions (which gaps are reached)
 * and the boundary register (which components have gaps of their own).
 *
 * A confirmed gap is one of three blockers:
 * - `upstream-fix`: the component behind it has no release with the support; it must ship one.
 * - `own-bump`: a release with the support exists; the tool only has to raise its pin.
 * - `own-gap`: a boundary component's own code lacks the support (R2 `gap`); only its maintainers can clear it.
 */
export type BlockerKind = "upstream-fix" | "own-bump" | "own-gap";
export interface Blocker { via: string; kind: BlockerKind; surfaces: string[]; pin?: string }
/**
 * `cleared` lists dependencies whose gap was read as not reached; `unread` lists inherited gaps nobody has decided yet,
 * which may turn into further blockers.
 */
export interface ToolBlockers {
  tool: string; boundary: boolean; blockers: Blocker[]; undetermined: { via: string; surfaces: string[] }[]; cleared: string[];
  unread: { via: string; surfaces: string[] }[];
}

export function toolBlockers(tools: ToolClassification[], leads: LeadRegister, boundary: BoundaryRegister): ToolBlockers[] {
  const components = new Map(boundary.components.map((c) => [c.id, c]));
  const out: ToolBlockers[] = [];
  for (const tool of tools) {
    const own = components.get(tool.id);
    const blockers: Blocker[] = [];
    if (own) {
      const surfaces = own.assessments.filter((a) => a.status === "gap").flatMap((a) => a.surfaces);
      if (surfaces.length) blockers.push({ via: tool.id, kind: "own-gap", surfaces });
    }
    const undetermined: ToolBlockers["undetermined"] = [];
    const cleared = new Set<string>();
    for (const lead of leads.leads.filter((l) => l.tool === tool.id)) {
      if (lead.decision === "not-reached") { cleared.add(lead.via); continue; }
      if (lead.decision === "undetermined") { undetermined.push({ via: lead.via, surfaces: lead.surfaces }); continue; }
      for (const surface of lead.surfaces) {
        const channel = tool.surfaces.find((s) => s.surface === surface)?.channels.find((c) => c.via.split("@")[0] === lead.via && c.readiness === "gap");
        // A pinned gap (`via@version<first`) means a release with the support already exists.
        const pin = channel?.via.includes("@") ? channel.via : undefined;
        const kind: BlockerKind = pin ? "own-bump" : "upstream-fix";
        const existing = blockers.find((b) => b.via === lead.via && b.kind === kind);
        if (existing) existing.surfaces.push(surface);
        else blockers.push({ via: lead.via, kind, surfaces: [surface], ...(pin && { pin }) });
      }
    }
    const decided = new Set(leads.leads.filter((l) => l.tool === tool.id).flatMap((l) => l.surfaces.map((s) => `${l.via}\0${s}`)));
    const unread = [...gapLeads(tool)].map(([via, surfaces]) => ({ via, surfaces: surfaces.filter((s) => !decided.has(`${via}\0${s}`)) })).filter((u) => u.surfaces.length);
    if (blockers.length || undetermined.length || cleared.size || unread.length) out.push({ tool: tool.id, boundary: Boolean(own), blockers, undetermined, cleared: [...cleared].sort(), unread });
  }
  return out.sort((a, b) => (a.tool < b.tool ? -1 : 1));
}

export interface Unlock { tool: string; depth: number; path: string[]; bumps: string[] }
export interface ComponentUnlocks {
  component: string;
  /** Tools whose every upstream blocker is cleared once this component (and what it unblocks) ships the support. */
  unlocks: Unlock[];
  /** Tools this component blocks that still wait on something else afterwards. */
  partial: { tool: string; stillBlockedBy: string[] }[];
  /**
   * Tools with a shipped dependency or service link to the component or to a component it unlocked, without a
   * confirmed gap through it: they may need the same release, which only reading or R4 can settle.
   */
  downstream: { tool: string; via: string }[];
}

const upstream = (t: ToolBlockers) => t.blockers.filter((b) => b.kind !== "own-bump");

/**
 * Fix `component` and follow the consequences: a tool is unlocked when all its upstream-fix blockers come through
 * fixed components and it has no gap of its own; an unlocked boundary component is then treated as fixed for its own
 * consumers. Own-bump blockers stay listed as the pins each unlocked tool still has to raise.
 */
export function unlocksOf(component: string | string[], all: ToolBlockers[], tools: ToolClassification[] = []): ComponentUnlocks {
  const fixes = typeof component === "string" ? [component] : component;
  const fixed = new Map<string, string[]>(fixes.map((c) => [c, [c]]));
  const unlocks: Unlock[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const t of all) {
      if (fixed.has(t.tool)) continue;
      const needs = upstream(t);
      if (!needs.length || needs.some((b) => b.kind === "own-gap" || !fixed.has(b.via))) continue;
      const via = needs.map((b) => b.via).sort((a, b) => fixed.get(a)!.length - fixed.get(b)!.length).pop()!;
      const path = [...fixed.get(via)!, t.tool];
      fixed.set(t.tool, path);
      unlocks.push({ tool: t.tool, depth: path.length - 1, path, bumps: t.blockers.filter((b) => b.kind === "own-bump").map((b) => b.pin!) });
      changed = true;
    }
  }
  const partial = all
    .filter((t) => !fixed.has(t.tool) && upstream(t).some((b) => fixed.has(b.via)))
    .map((t) => ({ tool: t.tool, stillBlockedBy: [...new Set(upstream(t).filter((b) => !fixed.has(b.via) || b.kind === "own-gap").map((b) => (b.kind === "own-gap" ? `${b.via} (own gap)` : b.via)))] }));
  const counted = new Set([...fixed.keys(), ...partial.map((p) => p.tool)]);
  const cleared = new Map(all.map((t) => [t.tool, new Set(t.cleared)]));
  const downstream = tools.filter((t) => !counted.has(t.id)).flatMap((t) => {
    const link = t.surfaces.flatMap((s) => s.channels).find((c) => {
      const via = c.via.split("@")[0];
      return c.scope === "shipped" && (c.channel === "dependency" || c.channel === "service") && fixed.has(via) && !cleared.get(t.id)?.has(via);
    });
    return link ? [{ tool: t.id, via: link.via.split("@")[0] }] : [];
  }).sort((a, b) => (a.tool < b.tool ? -1 : 1));
  return { component: fixes.join("+"), unlocks: unlocks.sort((a, b) => a.depth - b.depth || (a.tool < b.tool ? -1 : 1)), partial, downstream };
}

export interface UnlockReport {
  schemaVersion: 1; generatedAt: string;
  /**
   * Tools whose every confirmed gap has a released upstream fix, so the next move is theirs: upgrade the dependency
   * (`steps`, and whether that crosses a breaking version) and handle the era in their own code (upgrades.json).
   * `ownStatus` is a boundary component's worst R2 status; `unread` lists inherited gaps not yet decided.
   */
  bumpReady: { tool: string; pins: string[]; steps: PinStep[]; ownStatus?: Status; unread: string[] }[];
  /** Components whose fix unlocks at least one tool, most unlocks first. */
  components: (ComponentUnlocks & { ownGap: string[] })[];
  blockers: ToolBlockers[];
}

/** `pvp` names the packages versioned by the Haskell PVP (the target component set), for breaking-step detection. */
export function unlockReport(tools: ToolClassification[], leads: LeadRegister, boundary: BoundaryRegister, pvp: ReadonlySet<string> = new Set()): UnlockReport {
  const blockers = toolBlockers(tools, leads, boundary);
  const bumpReady = blockers.filter((t) => t.blockers.length && !upstream(t).length).map((t) => {
    const own = boundary.components.find((c) => c.id === t.tool);
    const pins = t.blockers.map((b) => b.pin!);
    return {
      tool: t.tool, pins, steps: pins.map((p) => pinStep(p, pvp)).filter((s): s is PinStep => s !== undefined),
      ...(own && { ownStatus: worstStatus(own) }), unread: t.unread.map((u) => u.via),
    };
  });
  const candidates = [...new Set(blockers.flatMap((t) => upstream(t).map((b) => b.via)))].sort();
  const components = candidates
    .map((id) => ({ ...unlocksOf(id, blockers, tools), ownGap: boundary.components.find((c) => c.id === id)?.assessments.filter((a) => a.status === "gap").flatMap((a) => a.surfaces) ?? [] }))
    .filter((c) => c.unlocks.length || c.partial.length)
    .sort((a, b) => b.unlocks.length - a.unlocks.length || b.partial.length - a.partial.length || (a.component < b.component ? -1 : 1));
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), bumpReady, components, blockers };
}
