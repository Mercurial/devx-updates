import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Comparison from "@/components/readiness/Comparison";
import Dashboard from "@/components/readiness/Dashboard";
import { readinessAssignments, readinessChanges, readinessImpacts, readinessSnapshot, reviewQueue } from "@/lib/readiness/site";
import type { Impact } from "@/lib/readiness/types";
import { capabilityRows } from "@/lib/readiness/capabilities";
import { investigationProjects, summarizeWork, workReport } from "@/lib/readiness/work";

export const metadata: Metadata = { title: "Dependency coverage and hardfork readiness", description: "Evidence-backed dependency coverage, unresolved work, and upstream impact for Cardano tools." };

export default function ReadinessPage() {
  const snapshot = readinessSnapshot();
  const artifactMap = new Map(snapshot.artifacts.map((a) => [a.id, a]));
  const nodeMap = new Map(snapshot.occurrences.map((n) => [n.id, n]));
  const explain = (impact: Impact) => Object.entries(impact.paths).map(([key, path]) => {
    const [toolId, bucket] = key.split(":");
    const profileId = nodeMap.get(path[0])!.profileId;
    const profile = snapshot.profiles.find((p) => p.id === profileId)!;
    return { toolId, bucket, profileId, release: profile.release, platform: profile.platform, labels: path.map((id) => { const a = artifactMap.get(nodeMap.get(id)!.artifactId)!; return `${a.name}@${a.version ?? "unknown"}`; }) };
  });
  const impacts = readinessImpacts().map((impact) => ({ ...impact, artifact: artifactMap.get(impact.artifactId)!, explainedPaths: explain(impact) }));
  const grouped = investigationProjects(snapshot, readinessImpacts());
  const projects = grouped.map((project) => ({ ...project.impact, artifact: { id: project.id, name: project.name, ecosystem: project.ecosystem, source: project.source, version: project.versions.join(", "), integrity: null }, explainedPaths: explain(project.impact) }));
  const work = workReport(snapshot, readinessAssignments(), grouped);
  // Paths already travel with the impact rows; avoid duplicating the graph payload.
  const workSummary = summarizeWork(work);
  const profileCounts = Object.fromEntries(snapshot.tools.map((t) => [t.id, snapshot.profiles.filter((p) => p.toolId === t.id).length]));
  const reviewed = reviewQueue();
  const changes = readinessChanges();
  return <div className="map-view" style={{ overflow: "visible" }}>
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs uppercase tracking-widest text-muted">Cardano tooling · Evidence snapshot</p><h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Dependency coverage</h1></div><Nav /></div>
      <p className="max-w-3xl text-muted">Trace the dependencies behind each tool, expose missing evidence, and find shared components to investigate first. Every tool stays in the inventory, even when its source or dependencies cannot yet be resolved.</p>
      <div className="rounded-xl border border-status-progress/40 bg-status-progress/5 px-5 py-4"><p className="font-semibold">Hardfork readiness is not yet assessed.</p><p className="mt-1 text-sm text-muted">This view measures dependency evidence. Node 11.2 compatibility and transition tests come later. Unknown coverage is never a pass.</p></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        [snapshot.tools.length, "Tools accounted for", "Full catalog denominator"],
        [snapshot.tools.filter((t) => t.lastSuccess).length, "Source revisions found", "Artifact mapping still needs review"],
        [Object.values(profileCounts).filter(Boolean).length, "Tools with native profiles", `${snapshot.profiles.length} release/configuration profiles`],
        [snapshot.tools.filter((t) => t.resolution === "unresolved").length, "Need native resolution", "Visible in the work queue"],
      ].map(([count, label, detail]) => <div key={label} className="rounded-xl border border-border bg-surface p-4 sm:p-5"><div className="font-display text-3xl font-semibold tabular-nums">{count}</div><div className="mt-2 text-sm font-medium">{label}</div><div className="mt-1 text-xs text-muted">{detail}</div></div>)}</div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted"><span>Snapshot: {snapshot.generatedAt.slice(0, 10)} · {snapshot.semanticDigest.slice(0, 12)}</span><span>{reviewed.filter((r) => r.status === "pending").length} manual review packets pending · Evidence is collected separately from the site build</span></div>
      <Dashboard tools={snapshot.tools} impacts={impacts} projects={projects} profileCounts={profileCounts} asOf={snapshot.generatedAt} capabilities={capabilityRows(snapshot)} work={workSummary} />
      <details className="rounded-xl border border-border bg-surface p-5"><summary className="cursor-pointer font-medium">Snapshot comparison</summary>{changes ? <div className="mt-4"><Comparison changes={changes} /></div> : <p className="mt-3 text-sm text-muted">No comparison has been retained for this snapshot. Generate one with the readiness diff command.</p>}</details>
    </div>
  </div>;
}
