import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import type { Graph } from "../../lib/map-types";
import { canonical, finalize, inventory, object, text } from "../../lib/readiness/core";
import { parseNativeInput, resolveNative } from "../../lib/readiness/adapters";
import { discover, github } from "../../lib/readiness/discovery";
import { collect, refreshNative } from "../../lib/readiness/collect";
import { aggregateProjects, calculateImpact, compareSnapshots } from "../../lib/readiness/impact";
import { acquireLock, addEvidence, mergeResolution, readJson, Store, writeJson } from "../../lib/readiness/store";
import { exportPacket, importReview, reconcileReviewQueue, type ReviewQueueEntry } from "../../lib/readiness/review";
import { nativeEvidence, rebuildNative } from "../../lib/readiness/rebuild";
import { COLLECT_ADAPTERS, NATIVE_ADAPTERS, type CollectAdapter } from "../../lib/readiness/types";
import { collectionCandidates } from "../../lib/readiness/candidates";
import { collectBatch } from "../../lib/readiness/batch";

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  directory: { type: "string", default: "data/readiness" },
  state: { type: "string", default: ".readiness" },
  catalog: { type: "string", default: "data/cardano-graph.json" },
  tools: { type: "string" }, limit: { type: "string" }, refresh: { type: "boolean" },
  profile: { type: "string" }, input: { type: "string" }, output: { type: "string" }, before: { type: "string" },
  tool: { type: "string" }, adapter: { type: "string" }, roots: { type: "string" }, path: { type: "string" }, platform: { type: "string" },
  packet: { type: "string" }, decisions: { type: "string" },
  "before-ref": { type: "string" },
  "python-version": { type: "string" }, packages: { type: "string" }, tags: { type: "string" },
} });

const store = new Store(resolve(values.directory!));
function required(key: "profile" | "input" | "output" | "before") {
  const value = values[key]; if (!value) throw new Error(`--${key} is required`); return value;
}

async function main() {
  const command = positionals[0] ?? "help";
  if (command === "help") {
    console.log(`Readiness collection (all output remains local)

inventory       Create or reconcile coverage for every catalog tool
discover        Discover pinned source and manifests via gh (resumes by default)
                --tools id,id --limit N --refresh
import-native   --profile profile.json --input native-output.json
collect         --tool id --adapter <collector> --roots package,package
                --platform target [--path manifest-path] [--refresh]
                uv-tree: --python-version 3.13; go-packages: --packages ./... --tags tag,tag
refresh-native  Refresh registered collection profiles against discovered source revisions
                --tools id,id --limit N --refresh (limit counts distinct requests)
collect-batch   --input batch.json [--tools id,id] [--limit N] [--refresh]
                Persist pinned requests and resume unfinished native collections
report          Emit coverage and impact reports in the data directory
show            --tool id (coverage, manifests, and profiles)
candidates      List supported collection starting points, including nested workspaces [--tools id,id]
validate        Validate snapshot, references, semantic digest, and evidence checksums
replay          Reconstruct native profiles from retained evidence and compare graph records
rebuild-native  Upgrade native graph records using retained inputs (no network)
capture-source  --tool id --path source-file (retain pinned source for citations)
export-review   --tools id,id --output .readiness/reviews/name
import-review   --packet packet.json --input result.json [--decisions decisions.json]
diff            --before old-snapshot.json | --before-ref git-ref [--output changes.json]

Common options: --directory data/readiness --state .readiness --catalog data/cardano-graph.json
Native adapters: ${NATIVE_ADAPTERS.join(", ")}.
Runnable collectors: ${COLLECT_ADAPTERS.join(", ")}.`);
    return;
  }
  if (command === "inventory") {
    const catalog = readJson(values.catalog!) as Graph;
    const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const next = inventory(catalog, revision);
    if (existsSync(join(store.directory, "snapshot.json"))) {
      const previous = store.load();
      // Removed roots need explicit archival rather than silently orphaning their graph.
      if (previous.tools.some((t) => !next.tools.some((n) => n.id === t.id))) throw new Error("Catalog removed tools; archive the previous snapshot and reconcile removals explicitly.");
      for (const tool of next.tools) {
        const existing = previous.tools.find((t) => t.id === tool.id);
        if (existing) {
          const changedSource = existing.catalogRepo !== undefined && existing.catalogRepo !== tool.catalogRepo;
          Object.assign(tool, existing, { name: tool.name, maintainer: tool.maintainer, catalogRepo: tool.catalogRepo, registryHint: tool.registryHint, packageHint: tool.packageHint, ...(changedSource ? { repo: tool.repo } : {}) });
        }
      }
      Object.assign(next, { profiles: previous.profiles, artifacts: previous.artifacts, occurrences: previous.occurrences, edges: previous.edges, evidence: previous.evidence, decisions: previous.decisions, ...(previous.collections ? { collections: previous.collections } : {}) });
      if (previous.catalogDigest === next.catalogDigest) next.catalogRevision = previous.catalogRevision;
    }
    store.save(next);
    console.log(`Accounted for ${next.tools.length} tools; catalog ${next.catalogDigest.slice(0, 12)}`);
    return;
  }
  const snapshot = store.load();
  if (command === "discover") {
    const limit = values.limit === undefined ? undefined : Number(values.limit);
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error("--limit must be a positive integer");
    await discover(snapshot, store, { stateDir: values.state!, toolIds: values.tools?.split(","), limit, refresh: values.refresh });
  } else if (command === "collect") {
    if (!values.tool || !values.roots || !values.platform || !(COLLECT_ADAPTERS as readonly unknown[]).includes(values.adapter)) throw new Error(`collect requires --tool, --adapter (${COLLECT_ADAPTERS.join(", ")}), --roots, and --platform`);
    await collect(snapshot, store, { toolId: values.tool, adapter: values.adapter as CollectAdapter, roots: values.roots.split(","), path: values.path, platform: values.platform, stateDir: values.state!, refresh: values.refresh, pythonVersion: values["python-version"], patterns: values.packages?.split(","), tags: values.tags?.split(",") });
  } else if (command === "collect-batch") {
    const summary = await collectBatch(snapshot, store, readJson(required("input")), { stateDir: values.state!, refresh: values.refresh, toolIds: values.tools?.split(","), limit: values.limit === undefined ? undefined : Number(values.limit) });
    console.log(JSON.stringify(summary));
    if (summary.failed || summary.deferred) process.exitCode = 1;
  } else if (command === "refresh-native") {
    const summary = await refreshNative(snapshot, store, values.state!, values.refresh, { toolIds: values.tools?.split(","), limit: values.limit === undefined ? undefined : Number(values.limit) });
    console.log(JSON.stringify(summary));
    if (summary.failed) process.exitCode = 1;
  } else if (command === "import-native") {
    const input = parseNativeInput(readJson(required("profile")));
    const raw = readJson(required("input"));
    const nativeEvidence = store.evidence(raw, `${input.adapter} for ${input.toolId} ${input.release}`);
    const profileEvidence = store.evidence(input, "Native collection profile and command");
    const result = resolveNative(raw, input, { native: nativeEvidence.id, configuration: profileEvidence.id });
    addEvidence(snapshot, nativeEvidence); addEvidence(snapshot, profileEvidence);
    mergeResolution(snapshot, result); store.save(snapshot);
    console.log(`Imported ${result.occurrences.length} occurrences and ${result.edges.length} edges; profile coverage ${result.profile.coverage}`);
  } else if (command === "report") {
    finalize(snapshot);
    const reviewPath = join(store.directory, "reviews.json");
    if (existsSync(reviewPath)) writeJson(reviewPath, reconcileReviewQueue(snapshot, readJson(reviewPath) as ReviewQueueEntry[]));
    const report = {
      snapshot: snapshot.semanticDigest,
      tools: snapshot.tools.length,
      discovered: snapshot.tools.filter((t) => t.lastSuccess).length,
      withProfiles: new Set(snapshot.profiles.map((p) => p.toolId)).size,
      profiles: snapshot.profiles.length,
      completeProfiles: snapshot.profiles.filter((p) => p.coverage === "complete").length,
      unresolvedTools: snapshot.tools.filter((t) => t.resolution === "unresolved").length,
      gaps: snapshot.tools.flatMap((tool) => tool.gaps.map((g) => ({ toolId: tool.id, ...g }))),
      ecosystemBacklog: Object.fromEntries(["npm", "cargo", "cabal", "go", "python", "nix", "container", "other"].map((ecosystem) => [ecosystem, snapshot.tools.filter((t) => t.ecosystems.includes(ecosystem as typeof t.ecosystems[number])).length])),
    };
    writeJson(join(store.directory, "report.json"), report);
    const impacts = calculateImpact(snapshot);
    writeJson(join(store.directory, "impact.json"), impacts);
    writeJson(join(store.directory, "projects.json"), aggregateProjects(snapshot, impacts));
    console.log(JSON.stringify({ ...report, gaps: report.gaps.length }, null, 2));
  } else if (command === "candidates") {
    console.log(JSON.stringify(collectionCandidates(snapshot, values.tools?.split(",")), null, 2));
  } else if (command === "capture-source") {
    const tool = snapshot.tools.find((t) => t.id === values.tool);
    const path = values.path;
    if (!tool?.revision || !tool.repo || !path || path.split("/").some((p) => !p || p === "." || p === "..")) throw new Error("Select a discovered --tool and a relative --path");
    const blob = object(await github(`repos/${tool.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${tool.revision}`));
    if (blob.encoding !== "base64") throw new Error("Expected a source file with base64 content");
    const evidence = store.evidence({ repo: tool.repo, revision: tool.revision, path, content: Buffer.from(text(blob.content), "base64").toString("utf8") }, `Source ${tool.id}/${path}`, `https://github.com/${tool.repo}/blob/${tool.revision}/${path}`);
    addEvidence(snapshot, evidence); tool.evidenceIds.push(evidence.id); store.save(snapshot);
    console.log(`Captured ${evidence.id}; cite /content with an exact excerpt`);
  } else if (command === "export-review") {
    if (!values.tools) throw new Error("--tools is required");
    const packet = exportPacket(snapshot, store, values.tools.split(","), required("output"));
    console.log(`Exported ${packet.packetId}; manual tasks and result template are in ${values.output}`);
  } else if (command === "import-review") {
    if (!values.packet) throw new Error("--packet is required");
    const packet = readJson(values.packet);
    const next = importReview(snapshot, store, packet, readJson(required("input")), values.decisions ? readJson(values.decisions) : undefined);
    store.save(next);
    const path = join(store.directory, "reviews.json");
    if (existsSync(path)) {
      const index = readJson(path) as { packetId: string; status: string }[];
      const entry = index.find((r) => r.packetId === object(packet).packetId);
      if (entry) entry.status = values.decisions ? "decisions-recorded" : "findings-returned";
      writeJson(path, index);
    }
    console.log(`Imported review; compatibility remains unassessed`);
  } else if (command === "show") {
    const tool = snapshot.tools.find((t) => t.id === values.tool);
    if (!tool) throw new Error("Select a known --tool");
    console.log(JSON.stringify({ tool, profiles: snapshot.profiles.filter((p) => p.toolId === tool.id) }, null, 2));
  } else if (command === "validate") {
    store.verify(snapshot); console.log(`Validated ${snapshot.tools.length} tools, ${snapshot.profiles.length} profiles, ${snapshot.evidence.length} evidence objects.`);
  } else if (command === "replay") {
    const records = {
      artifacts: new Map(snapshot.artifacts.map((record) => [record.id, record])),
      occurrences: new Map(snapshot.occurrences.map((record) => [record.id, record])),
      edges: new Map(snapshot.edges.map((record) => [record.id, record])),
    };
    for (const profile of snapshot.profiles) {
      console.error(`Replaying ${profile.toolId} ${profile.id}`);
      const roles = nativeEvidence(profile);
      const evidence = (id: string) => store.readEvidence(snapshot.evidence.find((e) => e.id === id)!);
      const replayed = resolveNative(evidence(roles.native), parseNativeInput(evidence(roles.configuration)), roles);
      if (canonical(replayed.profile) !== canonical(profile)) throw new Error(`Profile replay mismatch ${profile.id}`);
      for (const key of ["artifacts", "occurrences", "edges"] as const) for (const record of replayed[key]) {
        if (canonical(records[key].get(record.id)) !== canonical(record)) throw new Error(`Replay mismatch ${record.id}`);
      }
    }
    console.log(`Replayed ${snapshot.profiles.length} native profiles with identical graph records.`);
  } else if (command === "rebuild-native") {
    const next = rebuildNative(snapshot, store);
    store.save(next);
    const path = join(store.directory, "reviews.json");
    if (existsSync(path)) {
      writeJson(path, reconcileReviewQueue(next, readJson(path) as ReviewQueueEntry[]));
    }
    console.log("Rebuilt native graphs from retained evidence. Export fresh review packets for changed contexts.");
  } else if (command === "diff") {
    const before = values["before-ref"] ? JSON.parse(execFileSync("git", ["show", `${values["before-ref"]}:data/readiness/snapshot.json`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })) as typeof snapshot : readJson(required("before")) as typeof snapshot;
    const changes = compareSnapshots(before, snapshot);
    if (values.output) writeJson(values.output, changes); else console.log(JSON.stringify(changes, null, 2));
  } else throw new Error(`Unknown command ${command}; use help`);
}

async function run() {
  const readOnly = ["help", "show", "candidates", "validate", "replay", "diff"].includes(positionals[0] ?? "help");
  const release = readOnly ? () => {} : acquireLock(store.directory);
  try { await main(); } finally { release(); }
}

run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
