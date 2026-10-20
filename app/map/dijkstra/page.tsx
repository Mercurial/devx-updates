import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import { citationUrl, componentStatus, dijkstraSite } from "@/lib/readiness/dijkstra-site";
import type { Lead } from "@/lib/readiness/leads";

export const metadata: Metadata = {
  title: "Dijkstra hardfork readiness",
  description: "Which Cardano tools the Dijkstra hardfork breaks, through which dependency, and what each upstream fix unlocks.",
};

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] leading-tight text-muted">{children}</span>
);
const ToolLink = ({ id }: { id: string }) => <Link href={`/map/readiness/${id}`} className="font-medium">{id}</Link>;

function Evidence({ lead }: { lead: Lead }) {
  return <ul className="mt-1 space-y-1">{lead.evidence.map((c) => (
    <li key={`${c.path}:${c.line}`} className="text-xs">
      <a href={citationUrl(c)} target="_blank" rel="noreferrer" className="break-all">{c.path}:{c.line}</a>
      <code className="mt-0.5 block overflow-x-auto whitespace-pre text-muted">{c.quote}</code>
    </li>
  ))}</ul>;
}

export default function DijkstraPage() {
  const site = dijkstraSite();
  const { unlocks, leads, changes, classification } = site;
  const confirmed = leads.leads.filter((l) => l.decision === "confirmed");
  const confirmedTools = [...new Set(confirmed.map((l) => l.tool))].sort();
  const touched = [...classification.tools.values()].filter((t) => t.surfaces.some((s) => s.channels.some((c) => c.scope === "shipped"))).length;
  const others = leads.leads.filter((l) => l.decision !== "confirmed");
  return <div className="map-view" style={{ overflow: "visible" }}>
    <div className="mx-auto max-w-7xl space-y-9 px-4 py-7 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted">Cardano tooling · Protocol version 12 · Node 11.2</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Dijkstra hardfork readiness</h1>
        </div>
        <Nav />
      </div>
      <p className="max-w-3xl text-muted">
        Which tools the Dijkstra hardfork breaks, through which dependency, and what each upstream fix unlocks. Every
        decision quotes the shipped code it rests on, read at a pinned revision. Nothing here has been run against a
        node yet: devnet verification is the next step, and a tool without a confirmed gap is not a pass.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([
        [confirmedTools.length, "Tools with a confirmed gap", `${confirmed.reduce((n, l) => n + l.surfaces.length, 0)} confirmed tool/dependency/surface decisions`],
        [unlocks.bumpReady.length, "Only need to raise a pin", "A release with the support already exists"],
        [touched, "Tools touching a changed surface", `of ${classification.tools.size} catalog tools, through shipped code or services`],
        [changes.changes.length, "Cited changes", `${changes.surfaces.length} surfaces, ${changes.unchanged.length} areas checked unchanged`],
      ] as const).map(([count, label, detail]) => (
        <div key={label} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="font-display text-3xl font-semibold tabular-nums">{count}</div>
          <div className="mt-2 text-sm font-medium">{label}</div>
          <div className="mt-1 text-xs text-muted">{detail}</div>
        </div>
      ))}</div>

      <section aria-labelledby="unlocks" className="scroll-mt-24">
        <h2 id="unlocks" className="font-display text-2xl font-semibold">What a fix unlocks</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Components whose own gap blocks other tools. A tool is unlocked once every upstream blocker it has is fixed;
          unlocked components then count as fixed for their own consumers. Downstream tools have a shipped link that
          has not been confirmed as a gap.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{unlocks.components.map((c) => (
          <article key={c.component} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-semibold"><ToolLink id={c.component} /></h3>
              <span className="text-xs text-muted">R2 status: {componentStatus(site, c.component) ?? "not a boundary component"}</span>
            </div>
            {c.ownGap.length > 0 && <p className="mt-2 flex flex-wrap items-center gap-1 text-xs"><span className="text-status-blocked">Own gap:</span>{c.ownGap.map((s) => <Chip key={s}>{s}</Chip>)}</p>}
            <h4 className="mt-4 text-sm font-medium">Unlocks {c.unlocks.length} {c.unlocks.length === 1 ? "tool" : "tools"}</h4>
            <ul className="mt-2 space-y-1 text-sm">{c.unlocks.map((u) => (
              <li key={u.tool}>
                <ToolLink id={u.tool} />
                {u.depth > 1 && <span className="text-xs text-muted"> via {u.path.slice(1, -1).join(" → ")}</span>}
                {u.bumps.length > 0 && <span className="text-xs text-muted"> · then raise {u.bumps.join(", ")}</span>}
              </li>
            ))}</ul>
            {c.partial.length > 0 && <p className="mt-3 text-sm text-muted">Also needed by {c.partial.map((p, i) => <span key={p.tool}>{i > 0 && ", "}<ToolLink id={p.tool} /> (still waits on {p.stillBlockedBy.join(", ")})</span>)}</p>}
            {c.downstream.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted">{c.downstream.length} downstream {c.downstream.length === 1 ? "tool" : "tools"} with an unconfirmed link</summary>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{c.downstream.map((d) => <li key={d.tool}><ToolLink id={d.tool} /> <span className="text-xs text-muted">via {d.via}</span></li>)}</ul>
            </details>}
          </article>
        ))}</div>
      </section>

      <section aria-labelledby="bump-ready" className="scroll-mt-24">
        <h2 id="bump-ready" className="font-display text-2xl font-semibold">Only need to raise a pin</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Every confirmed gap comes from a dependency pinned below the first release with the support. For a boundary
          component the bump can be a port to the 11.2 component set.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Tool</th><th className="px-4 py-3">Pinned below the first fixed release</th><th className="px-4 py-3">Own R2 status</th></tr></thead>
            <tbody>{unlocks.bumpReady.map((b) => (
              <tr key={b.tool} className="border-t border-border align-top">
                <td className="px-4 py-3"><ToolLink id={b.tool} /></td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{b.pins.map((p) => <Chip key={p}>{p}</Chip>)}</div></td>
                <td className="px-4 py-3 text-muted">{b.ownStatus ?? "not a boundary component"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="confirmed" className="scroll-mt-24">
        <h2 id="confirmed" className="font-display text-2xl font-semibold">Confirmed gaps and their evidence</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          A shipped path uses the gapped capability, so the tool fails or misbehaves after the hardfork until the
          dependency moves. Quotes link to the exact line at the revision that was read.
        </p>
        <div className="mt-4 space-y-3">{confirmedTools.map((tool) => (
          <details key={tool} className="rounded-xl border border-border bg-surface p-4">
            <summary className="cursor-pointer"><ToolLink id={tool} /> <span className="text-sm text-muted">· {confirmed.filter((l) => l.tool === tool).map((l) => l.via).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</span></summary>
            <div className="mt-3 space-y-4">{confirmed.filter((l) => l.tool === tool).map((l) => (
              <div key={`${l.via}:${l.surfaces.join()}`}>
                <p className="flex flex-wrap items-center gap-1 text-sm"><span className="font-medium">{l.via}</span>{l.surfaces.map((s) => <Chip key={s}>{s}</Chip>)}</p>
                <p className="mt-1 text-sm text-muted">{l.summary}</p>
                <Evidence lead={l} />
              </div>
            ))}</div>
          </details>
        ))}</div>
        <details className="mt-4 rounded-xl border border-border bg-surface p-4">
          <summary className="cursor-pointer font-medium">Not reached or undetermined ({others.length} decisions)</summary>
          <ul className="mt-3 space-y-3">{others.map((l) => (
            <li key={`${l.tool}:${l.via}:${l.surfaces.join()}`} className="text-sm">
              <ToolLink id={l.tool} /> <span className="text-muted">· {l.via} · {l.decision}</span>
              <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">{l.surfaces.map((s) => <Chip key={s}>{s}</Chip>)}</span>
              <p className="mt-1 text-muted">{l.summary}</p>
              {l.evidence.length > 0 && <Evidence lead={l} />}
            </li>
          ))}</ul>
        </details>
      </section>

      <section aria-labelledby="changes" className="scroll-mt-24">
        <h2 id="changes" className="font-display text-2xl font-semibold">What Dijkstra changes</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Read at the node 11.2 integration branch and the component versions it selects. Activation is either the
          node upgrade itself, the fork to protocol version 12, or a later intra-era step.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{changes.changes.map((c) => (
          <article key={c.id} className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold">{c.title}</h3>
            <p className="mt-1 flex flex-wrap gap-1"><Chip>{c.activation}</Chip><Chip>{c.compatibility}</Chip>{c.surfaces.map((s) => <Chip key={s}>{s}</Chip>)}</p>
            <p className="mt-2 text-sm text-muted">{c.summary}</p>
            <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted">{c.citations.length} citations</summary>
              <ul className="mt-2 space-y-1">{c.citations.map((q) => <li key={`${q.repo}:${q.path}:${q.line}`}><a href={citationUrl(q)} target="_blank" rel="noreferrer" className="break-all">{q.repo} {q.path}:{q.line}</a></li>)}</ul>
            </details>
          </article>
        ))}</div>
        <h3 className="mt-6 text-lg font-semibold">Checked and unchanged</h3>
        <ul className="mt-2 space-y-2 text-sm">{changes.unchanged.map((u) => <li key={u.id}><span className="font-medium">{u.title}.</span> <span className="text-muted">{u.summary}</span></li>)}</ul>
      </section>

      <p className="text-xs text-muted">
        Classification {classification.generatedAt.slice(0, 10)} · boundary register {site.boundary.retrieved} · leads reviewed {leads.reviewed}.
        Registers: content/readiness/dijkstra.
      </p>
    </div>
  </div>;
}
