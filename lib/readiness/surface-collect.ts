import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { digest } from "./core";
import { repositoryReference } from "./discovery";
import { execute } from "./source";
import type { BoundaryRegister } from "./boundary";
import type { ChangeRegister } from "./dijkstra";
import { classifyTool, rankClassifications, RULES, scannable, scanSources, type Scan, type ToolClassification } from "./surfaces";

/** Rule identity: cached scans are reused only while the rule set is unchanged. */
export const SCANNER_VERSION = 6;
export const RULES_DIGEST = digest([SCANNER_VERSION, ...RULES.map((r) => [r.id, r.pattern.source, r.pattern.flags, r.files?.source ?? null, r.component ?? null, r.surfaces ?? null, r.readiness ?? null, r.excludeSurfaces ?? null])]);

const git = (cwd: string, args: string[], timeout = 300000) =>
  execute("git", args, { cwd, timeout, killSignal: "SIGKILL", maxBuffer: 256 * 1024 * 1024 });

async function defaultHead(repo: string, stateDir: string): Promise<string> {
  const head = (await git(stateDir, ["ls-remote", `https://github.com/${repo}.git`, "HEAD"], 60000)).stdout.split(/\s/)[0];
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error(`No default-branch head for ${repo}`);
  return head;
}

/** Shallow, blob-limited checkout; scanning skips larger files anyway. */
async function checkout(repo: string, revision: string, stateDir: string): Promise<string> {
  const directory = resolve(stateDir, "surface-sources", revision);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  await git(directory, ["init", "-q"]);
  await git(directory, ["remote", "add", "origin", `https://github.com/${repo}.git`]);
  await git(directory, ["fetch", "-q", "--depth=1", `--filter=blob:limit=${1024 * 1024}`, "origin", revision]);
  await git(directory, ["checkout", "-q", "--detach", revision]);
  return directory;
}

async function scanCheckout(directory: string, self: string): Promise<Scan> {
  const paths = (await git(directory, ["ls-files", "-z"])).stdout.split("\0").filter(Boolean);
  const files = [];
  let skipped = 0;
  for (const path of paths) {
    const full = join(directory, path);
    let size: number;
    try { const stat = statSync(full); if (!stat.isFile()) { skipped++; continue; } size = stat.size; } catch { skipped++; continue; }
    if (!scannable(path, size)) { skipped++; continue; }
    files.push({ path, content: readFileSync(full, "utf8") });
  }
  const scan = scanSources(files, self);
  return { ...scan, skipped: scan.skipped + skipped };
}

export interface ClassificationRegister {
  schemaVersion: 1; generatedAt: string; rulesDigest: string; changeTarget: unknown; boundaryRetrieved: string;
  summary: Record<string, number>; tools: ToolClassification[];
}

export async function classifyCatalog(
  tools: { id: string; repo: string | null }[], boundary: BoundaryRegister, changes: ChangeRegister,
  options: { stateDir: string; concurrency?: number; log?: (line: string) => void },
): Promise<ClassificationRegister> {
  const cacheDir = resolve(options.stateDir, "surface-scans");
  mkdirSync(cacheDir, { recursive: true });
  const byRepo = new Map<string, { id: string; repo: string | null }[]>();
  const results: ToolClassification[] = [];
  for (const tool of tools) {
    const repo = tool.repo ? repositoryReference(tool.repo) : null;
    if (!repo) {
      results.push(classifyTool({ id: tool.id, repo: tool.repo, revision: null }, { status: "no-public-source", note: "The catalog names no GitHub repository; classify through its documented services." }, boundary, changes));
      continue;
    }
    byRepo.set(repo, [...(byRepo.get(repo) ?? []), tool]);
  }
  const queue = [...byRepo.entries()];
  const work = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [repo, members] = next;
      let revision: string;
      try { revision = await defaultHead(repo, options.stateDir); } catch (error) {
        for (const tool of members) results.push(classifyTool({ id: tool.id, repo, revision: null }, { status: "checkout-failed", note: (error as Error).message.split("\n")[0] }, boundary, changes));
        continue;
      }
      let directory: string | undefined;
      try {
        for (const tool of members) {
          const cache = join(cacheDir, `${revision}-${tool.id}-${RULES_DIGEST.slice(0, 16)}.json`);
          let scan: Scan;
          if (existsSync(cache)) scan = JSON.parse(readFileSync(cache, "utf8")) as Scan;
          else {
            directory ??= await checkout(repo, revision, options.stateDir);
            scan = await scanCheckout(directory, tool.id);
            writeFileSync(cache, JSON.stringify(scan));
          }
          results.push(classifyTool({ id: tool.id, repo, revision }, scan, boundary, changes));
          options.log?.(`${tool.id} ${revision.slice(0, 10)} files=${scan.files} hits=${scan.hits.length}`);
        }
      } catch (error) {
        for (const tool of members.filter((m) => !results.some((r) => r.id === m.id))) {
          results.push(classifyTool({ id: tool.id, repo, revision }, { status: "checkout-failed", note: (error as Error).message.split("\n")[0] }, boundary, changes));
        }
      } finally {
        // Scans are cached per revision; the checkout is only needed while scanning.
        if (directory) rmSync(directory, { recursive: true, force: true });
      }
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? 6 }, work));
  const ranked = rankClassifications(results);
  const summary: Record<string, number> = {};
  for (const t of ranked) summary[t.exposure] = (summary[t.exposure] ?? 0) + 1;
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), rulesDigest: RULES_DIGEST, changeTarget: changes.target,
    boundaryRetrieved: boundary.retrieved, summary, tools: ranked,
  };
}
