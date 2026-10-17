"use client";

import Link from "next/link";
import { useState } from "react";
import type { Artifact, Impact, Tool } from "@/lib/readiness/types";
import Download from "./Download";

export interface ImpactRow extends Impact {
  artifact: Artifact;
  explainedPaths: { toolId: string; bucket: string; labels: string[] }[];
}

const inputStyle = "rounded-lg border border-border bg-surface px-3 py-2 text-sm";
const th = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted";
const td = "px-4 py-3 align-top text-sm";

export default function Dashboard({ tools, impacts, projects, profileCounts, asOf }: { tools: Tool[]; impacts: ImpactRow[]; projects: ImpactRow[]; profileCounts: Record<string, number>; asOf: string }) {
  const [view, setView] = useState("coverage");
  const [search, setSearch] = useState("");
  const [ecosystem, setEcosystem] = useState("");
  const [coverage, setCoverage] = useState("");
  const [page, setPage] = useState(0);
  const [groupVersions, setGroupVersions] = useState(false);
  const names = Object.fromEntries(tools.map((t) => [t.id, t.name]));
  const stale = (t: Tool) => !t.lastSuccess || Date.parse(asOf) - Date.parse(t.lastSuccess) > 14 * 86400000;
  const matching = tools.filter((t) => {
    const q = search.toLowerCase();
    return `${t.name} ${t.id} ${t.maintainer} ${t.repo ?? ""}`.toLowerCase().includes(q)
      && (!ecosystem || t.ecosystems.includes(ecosystem as typeof t.ecosystems[number]))
      && (!coverage || (coverage === "profiles" ? !!profileCounts[t.id] : coverage === "errors" ? !!t.discoveryError : coverage === "stale" ? stale(t) : t.resolution === coverage));
  }).sort((a, b) => a.name.localeCompare(b.name));
  const impactRows = (groupVersions ? projects : impacts).filter((i) => `${i.artifact.name} ${i.artifact.version} ${i.artifact.ecosystem}`.toLowerCase().includes(search.toLowerCase()) && (!ecosystem || i.artifact.ecosystem === ecosystem));
  const gaps = matching.flatMap((t) => t.gaps.map((gap) => ({ toolId: t.id, name: t.name, maintainer: t.maintainer, ...gap })));
  const length = view === "impact" ? impactRows.length : view === "queue" ? gaps.length : matching.length;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(length / 40) - 1));
  const start = currentPage * 40;
  const exportData = view === "impact" ? impactRows : view === "queue" ? gaps : matching;

  function reset() { setPage(0); }
  return <section className="space-y-5" aria-label="Readiness explorer">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" aria-label="Report view">
        {[["coverage", "Tool coverage"], ["impact", "Upstream impact"], ["queue", "Work queue"]].map(([id, label]) => <button key={id} aria-pressed={view === id} onClick={() => { setView(id); setSearch(""); setEcosystem(""); setCoverage(""); reset(); }} className={`rounded-lg border px-4 py-2 text-sm font-medium ${view === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface"}`}>{label}</button>)}
      </div>
      <Download filename={`readiness-${view}.json`} data={exportData} label="Export filtered results" />
    </div>
    {view === "impact" && <p className="max-w-4xl text-sm text-muted">Counts are distinct cataloged tools in collected profiles, not ecosystem adoption. Required, optional, build, and test exposure are separate. Potential reach includes suggested or disputed edges. Expand a component to inspect paths; a high count is not a failure finding.</p>}
    {view === "queue" && <p className="text-sm text-muted">Unresolved evidence and next actions for every tool. Missing coverage is never treated as compatible.</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs text-muted">{view === "impact" ? "Search component" : "Search tool or maintainer"}<input value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} placeholder={view === "impact" ? "e.g. pallas, serialization" : "e.g. Oura, TxPipe"} className={inputStyle} /></label>
      <label className="flex flex-col gap-1 text-xs text-muted">Ecosystem<select value={ecosystem} onChange={(e) => { setEcosystem(e.target.value); reset(); }} className={inputStyle}><option value="">All ecosystems</option>{["npm", "cargo", "cabal", "go", "python", "nix", "container", "other"].map((e) => <option key={e}>{e}</option>)}</select></label>
      {view !== "impact" && <label className="flex flex-col gap-1 text-xs text-muted">Coverage filter<select value={coverage} onChange={(e) => { setCoverage(e.target.value); reset(); }} className={inputStyle}><option value="">All tools</option><option value="profiles">Has native profiles</option><option value="unresolved">Needs native resolution</option><option value="errors">Discovery failed</option><option value="stale">No recent discovery (14 days)</option></select></label>}
      {view === "impact" && <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={groupVersions} onChange={(e) => { setGroupVersions(e.target.checked); reset(); }} />Group package versions</label>}
    </div>
    <p className="text-sm text-muted" role="status">{length.toLocaleString()} {view === "impact" ? "components" : view === "queue" ? "open gaps" : "tools"} shown · Full catalog: {tools.length} tools</p>
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      {view === "coverage" && <table className="w-full min-w-[790px]"><caption className="sr-only">Dependency coverage, separate from hardfork readiness</caption><thead className="bg-surface-2"><tr>{["Tool / maintainer", "Source release", "Native profiles", "Integration review", "Readiness"].map((label) => <th key={label} className={th}>{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{matching.slice(start, start + 40).map((tool) => <tr key={tool.id}>
        <td className={td}><Link className="font-semibold" href={`/map/readiness/${tool.id}`}>{tool.name}</Link><div className="mt-1 text-xs text-muted">{tool.maintainer}</div><div className="mt-1 text-xs text-muted">{tool.ecosystems.join(" · ") || "Ecosystem unknown"}</div></td>
        <td className={td}><span className="break-all">{tool.release ?? "Unresolved"}</span><div className="mt-1 text-xs text-muted">{tool.discoveryError ? "Latest discovery failed" : tool.lastSuccess ? `Checked ${tool.lastSuccess.slice(0, 10)}` : "Not yet identified"}</div>{stale(tool) && <span className="text-xs text-status-progress">Needs discovery</span>}</td>
        <td className={td}>{profileCounts[tool.id] ? <><span className="font-semibold">{profileCounts[tool.id]} collected</span><div className="text-xs text-muted">Tool coverage: {tool.resolution}</div></> : <span className="text-status-progress">Unresolved</span>}</td>
        <td className={td}>{tool.integration}<div className="text-xs text-muted">{tool.gaps.length} open gaps</div></td><td className={td}><span className="rounded-full bg-surface-2 px-2 py-1 text-xs">Unassessed</span></td>
      </tr>)}</tbody></table>}
      {view === "impact" && <table className="w-full min-w-[790px]"><caption className="sr-only">Upstream component impact by dependency scope</caption><thead className="bg-surface-2"><tr>{["Component / version", "Required", "Optional", "Build", "Test/dev", "Potential"].map((label) => <th key={label} className={th}>{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{impactRows.slice(start, start + 40).map((impact) => <tr key={impact.artifactId}>
        <td className={`${td} max-w-xl`}><details><summary className="cursor-pointer font-semibold">{impact.artifact.name} <span className="font-normal text-muted">{impact.artifact.version ?? "version unknown"}</span></summary><p className="my-2 text-xs text-muted">{impact.artifact.ecosystem} · Evidence applies to these collected profiles.</p><ul className="space-y-3">{impact.explainedPaths.map((path, i) => <li key={i}><Link href={`/map/readiness/${path.toolId}#dependencies`}>{names[path.toolId]}</Link><span className="ml-2 text-xs text-muted">{path.bucket}</span><div className="mt-1 break-words text-xs text-muted">{path.labels.join(" → ")}</div></li>)}</ul></details></td>
        {[impact.required, impact.optional, impact.build, impact.development, impact.potential].map((ids, i) => <td key={i} className={`${td} tabular-nums`}>{ids.length}</td>)}
      </tr>)}</tbody></table>}
      {view === "queue" && <table className="w-full min-w-[700px]"><caption className="sr-only">Coverage investigation work queue</caption><thead className="bg-surface-2"><tr>{["Tool", "Area", "Evidence gap", "Next action"].map((label) => <th key={label} className={th}>{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{gaps.slice(start, start + 40).map((g) => <tr key={`${g.toolId}:${g.id}`}><td className={td}><Link href={`/map/readiness/${g.toolId}`}>{g.name}</Link><div className="text-xs text-muted">{g.maintainer}</div></td><td className={td}>{g.area}</td><td className={`${td} max-w-xl break-words`}>{g.reason}</td><td className={`${td} max-w-sm`}>{g.nextAction}</td></tr>)}</tbody></table>}
      {length === 0 && <div className="p-10 text-center text-muted">No results match these filters. Try another search or ecosystem.</div>}
    </div>
    <div className="flex items-center justify-between gap-3 text-sm text-muted"><span>Page {currentPage + 1} of {Math.max(1, Math.ceil(length / 40))}</span><div className="flex gap-2"><button disabled={currentPage === 0} className={`${inputStyle} disabled:opacity-40`} onClick={() => setPage(currentPage - 1)}>Previous</button><button disabled={start + 40 >= length} className={`${inputStyle} disabled:opacity-40`} onClick={() => setPage(currentPage + 1)}>Next</button></div></div>
  </section>;
}
