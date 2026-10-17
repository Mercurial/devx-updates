import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import type { Graph } from "../../lib/map-types";
import { canonical, finalize, inventory } from "../../lib/readiness/core";
import { parseNativeInput, resolveNative } from "../../lib/readiness/adapters";
import { discover } from "../../lib/readiness/discovery";
import { collect } from "../../lib/readiness/collect";
import { calculateImpact, compareSnapshots } from "../../lib/readiness/impact";
import { addEvidence, mergeResolution, readJson, Store, writeJson } from "../../lib/readiness/store";

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  directory: { type: "string", default: "data/readiness" },
  state: { type: "string", default: ".readiness" },
  catalog: { type: "string", default: "data/cardano-graph.json" },
  tools: { type: "string" }, limit: { type: "string" }, refresh: { type: "boolean" },
  profile: { type: "string" }, input: { type: "string" }, output: { type: "string" }, before: { type: "string" },
  tool: { type: "string" }, adapter: { type: "string" }, roots: { type: "string" }, path: { type: "string" }, platform: { type: "string" },
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
collect         --tool id --adapter npm-lock|cargo-metadata --roots package,package
                --platform target [--path manifest-path] [--refresh]
report          Emit coverage and impact reports in the data directory
show            --tool id (coverage, manifests, and profiles)
candidates      List discovered root npm locks and Cargo lockfiles for pilot collection
validate        Validate snapshot, references, semantic digest, and evidence checksums
replay          Reconstruct native profiles from retained evidence and compare graph records
diff            --before old-snapshot.json [--output changes.json]

Common options: --directory data/readiness --state .readiness --catalog data/cardano-graph.json
Native adapters: npm-lock (v2/v3), cargo-metadata, cabal-plan.`);
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
        if (existing) Object.assign(tool, existing, { name: tool.name, maintainer: tool.maintainer });
      }
      Object.assign(next, { profiles: previous.profiles, artifacts: previous.artifacts, occurrences: previous.occurrences, edges: previous.edges, evidence: previous.evidence, decisions: previous.decisions });
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
    if (!values.tool || !values.roots || !values.platform || !["npm-lock", "cargo-metadata"].includes(values.adapter ?? "")) throw new Error("collect requires --tool, --adapter npm-lock|cargo-metadata, --roots, and --platform");
    await collect(snapshot, store, { toolId: values.tool, adapter: values.adapter as "npm-lock" | "cargo-metadata", roots: values.roots.split(","), path: values.path, platform: values.platform, stateDir: values.state!, refresh: values.refresh });
  } else if (command === "import-native") {
    const input = parseNativeInput(readJson(required("profile")));
    const raw = readJson(required("input"));
    const nativeEvidence = store.evidence(raw, `${input.adapter} for ${input.toolId} ${input.release}`);
    const profileEvidence = store.evidence(input, "Native collection profile and command");
    const result = resolveNative(raw, input, [nativeEvidence.id, profileEvidence.id]);
    addEvidence(snapshot, nativeEvidence); addEvidence(snapshot, profileEvidence);
    mergeResolution(snapshot, result); store.save(snapshot);
    console.log(`Imported ${result.occurrences.length} occurrences and ${result.edges.length} edges; profile coverage ${result.profile.coverage}`);
  } else if (command === "report") {
    finalize(snapshot);
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
    writeJson(join(store.directory, "impact.json"), calculateImpact(snapshot));
    console.log(JSON.stringify({ ...report, gaps: report.gaps.length }, null, 2));
  } else if (command === "candidates") {
    console.log(JSON.stringify(snapshot.tools.filter((t) => t.manifests.includes("package-lock.json") || t.manifests.includes("Cargo.lock")).map((t) => ({ id: t.id, packageHint: t.packageHint, release: t.release, locks: t.manifests.filter((p) => ["package-lock.json", "Cargo.lock"].includes(p)) })), null, 2));
  } else if (command === "show") {
    const tool = snapshot.tools.find((t) => t.id === values.tool);
    if (!tool) throw new Error("Select a known --tool");
    console.log(JSON.stringify({ tool, profiles: snapshot.profiles.filter((p) => p.toolId === tool.id) }, null, 2));
  } else if (command === "validate") {
    store.verify(snapshot); console.log(`Validated ${snapshot.tools.length} tools, ${snapshot.profiles.length} profiles, ${snapshot.evidence.length} evidence objects.`);
  } else if (command === "replay") {
    for (const profile of snapshot.profiles) {
      const evidence = profile.evidenceIds.map((id) => snapshot.evidence.find((e) => e.id === id)!);
      const replayed = resolveNative(store.readEvidence(evidence[0]), parseNativeInput(store.readEvidence(evidence[1])), profile.evidenceIds);
      if (canonical(replayed.profile) !== canonical(profile)) throw new Error(`Profile replay mismatch ${profile.id}`);
      for (const key of ["artifacts", "occurrences", "edges"] as const) for (const record of replayed[key]) {
        if (canonical(snapshot[key].find((r) => r.id === record.id)) !== canonical(record)) throw new Error(`Replay mismatch ${record.id}`);
      }
    }
    console.log(`Replayed ${snapshot.profiles.length} native profiles with identical graph records.`);
  } else if (command === "diff") {
    const before = readJson(required("before")) as typeof snapshot;
    const changes = compareSnapshots(before, snapshot);
    if (values.output) writeJson(values.output, changes); else console.log(JSON.stringify(changes, null, 2));
  } else throw new Error(`Unknown command ${command}; use help`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
