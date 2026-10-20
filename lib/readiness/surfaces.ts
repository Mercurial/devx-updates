import { STATUSES, worstStatus, type BoundaryRegister, type Component } from "./boundary";
import type { ChangeRegister } from "./dijkstra";

/**
 * Surface classification (plan revision R3): which changed surfaces each catalog tool touches, through which
 * channel, and the readiness it inherits. Rules are lexical leads, never a verdict that a tool breaks or not.
 */

export const CHANNELS = ["implements", "dependency", "service", "marker"] as const;
export type Channel = (typeof CHANNELS)[number];
/** Readiness a touched surface inherits: an R2 status, `upstream` (the 11.2 component set itself) or `unassessed`. */
export const READINESS = [...STATUSES, "upstream", "unassessed"] as const;
export type Readiness = (typeof READINESS)[number];

export interface Rule {
  id: string; channel: Exclude<Channel, "implements">; pattern: RegExp;
  /** Boundary component whose R2 surfaces and statuses the hit inherits. */
  component?: string;
  /** Surfaces for rules without a boundary component. */
  surfaces?: string[];
  readiness?: Readiness;
  files?: RegExp;
  /** Component surfaces this artifact does not carry. */
  excludeSurfaces?: string[];
}

const MANIFEST = /(?:^|\/)(?:package\.json|Cargo\.toml|go\.mod|pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|libs\.versions\.toml|[^/]+\.cabal|cabal\.project|package\.yaml|stack\.yaml|pyproject\.toml|requirements[^/]*\.txt|setup\.py|setup\.cfg|Pipfile|[^/]+\.csproj|Directory\.Packages\.props|pubspec\.yaml|spago\.(?:dhall|yaml)|packages\.dhall|elm\.json|build\.sbt|deps\.edn|mix\.exs|Gemfile|deno\.json|flake\.nix|aiken\.toml|composer\.json|CMakeLists\.txt|conanfile\.(?:txt|py)|vcpkg\.json|Package\.swift|Podfile)$/;
const ERA_NAMES = ["byron", "shelley", "allegra", "mary", "alonzo", "babbage", "conway"];

const dep = (component: string, pattern: RegExp): Rule => ({ id: `dependency:${component}`, channel: "dependency", component, pattern, files: MANIFEST });
const upstream = (id: string, pattern: RegExp, surfaces: string[]): Rule => ({ id: `dependency:${id}`, channel: "dependency", surfaces, readiness: "upstream", pattern, files: MANIFEST });
const service = (id: string, pattern: RegExp, target: { component?: string; surfaces?: string[]; readiness?: Readiness }): Rule => ({ id: `service:${id}`, channel: "service", pattern, ...target });
const marker = (id: string, pattern: RegExp, surfaces: string[]): Rule => ({ id: `marker:${id}`, channel: "marker", pattern, surfaces, readiness: "unassessed" });

const PROVIDER = ["era-identity", "transaction-encoding", "protocol-parameters"];
const CLI_COMMANDS = "conway|latest|babbage|alonzo|dijkstra|transaction|query|address|stake-address|stake-pool|governance|key|node|genesis|hash|debug|legacy|compatible|byron|text-view|version|--version";

export const RULES: Rule[] = [
  dep("cardano-serialization-lib-csl", /@emurgo\/cardano-serialization-lib|\bcardano[-_]serialization[-_]lib\b/),
  dep("cardano-multiplatform-lib-cml", /@dcspark\/cardano-multiplatform-lib|\bcardano-multiplatform-lib\b|^\s*cml-(?:chain|core|crypto|multi-era)\b/m),
  // The umbrella crate and pallas-network carry the mini-protocols; codec crates only the ledger surfaces.
  // pallas-crypto, -addresses, -math and -wallet implement nothing Dijkstra changes; pallas-uplc is uplc-turbo's crate.
  dep("pallas", /^\s*pallas(?:-network2?)?\s*=/m),
  { ...dep("pallas", /^\s*pallas-(?:primitives|traverse|codec|hardano|validate|utxorpc|txbuilder|configs|applying)\s*=/m), id: "dependency:pallas-codecs", excludeSurfaces: ["node-to-client-protocol", "consensus-participation"] },
  dep("gouroboros", /github\.com\/blinklabs-io\/gouroboros\b/),
  dep("cardano-js-sdk", /["']@cardano-sdk\/[a-z-]+["']/),
  dep("bloxbean-cardano-client-library", /\bcardano-client-(?:lib|core|backend|quicktx|plutus|transaction-spec|crypto|address|metadata|cip[0-9a-z-]*|supplier|common|function)\b/),
  dep("yaci", /com\.bloxbean\.cardano["']?\s*[:,]\s*(?:name\s*[:=]\s*)?["']?yaci(?:-core|-helper)?\b|<artifactId>yaci(?:-core|-helper)?<\/artifactId>/),
  dep("yaci-store", /\byaci-store(?:-[a-z-]+)?\b/),
  dep("pycardano", /\bpycardano\b/),
  dep("cometa-js", /@biglup\/cometa\b/),
  dep("buildooor", /@harmoniclabs\/buildooor\b/),
  dep("ouroboros-miniprotocols-ts", /@harmoniclabs\/ouroboros-miniprotocols-ts\b/),
  dep("plu-ts", /@harmoniclabs\/plu-ts\b/),
  dep("cardano-data-lite", /\bcardano-data-lite\b/),
  dep("evolution-sdk", /["']@evolution-sdk\/[a-z-]+["']/),
  dep("cardanosharp", /\bCardanoSharp\.Wallet\b/),
  dep("ouroboros-network-js", /@stricahq\/ouroboros-network-js\b/),
  dep("typhonjs", /@stricahq\/typhonjs\b/),
  dep("apollo", /github\.com\/Salvionied\/apollo\b/),
  dep("whisky", /^\s*whisky(?:-[a-z]+)?\s*=|@sidan-lab\/whisky\b/m),
  dep("elm-cardano", /\belm-cardano\/elm-cardano\b|"elm-cardano"/),
  dep("cquisitor-lib", /\bcquisitor(?:-lib)?\b/),
  dep("ledgerjs-hw-app-cardano", /@cardano-foundation\/ledgerjs-hw-app-cardano\b/),
  dep("cardano-hw-interop-lib", /\bcardano-hw-interop-lib\b/),
  dep("amaru", /^\s*amaru-[a-z-]+\s*=/m),
  dep("hydra", /\bhydra-(?:node|cardano-api|tx|plutus|prelude)\b/),
  dep("plutus-plutus-core", /\bplutus-(?:ledger-api|tx|core|tx-plugin)\b/),
  dep("opshin", /\bopshin\b/),
  dep("helios", /@helios-lang\/|@hyperionbt\/helios\b/),
  dep("plutarch", /\bplutarch(?:-[a-z-]+)?\b/),
  dep("scalus", /"org\.scalus"|["']scalus["']\s*:|\bscalus-(?:cardano-ledger|core|plugin|bloxbean-cardano-client-lib)\b/),
  dep("uplc-turbo", /\buplc-turbo\b/),
  dep("plutigo", /github\.com\/blinklabs-io\/plutigo\b/),
  dep("julc", /\bjulc(?:-[a-z-]+)?\b/),
  dep("meshjs-mesh-sdk", /["']@meshsdk\/[a-z-]+["']/),
  dep("lucid-evolution", /["']@lucid-evolution\/[a-z-]+["']/),
  dep("blaze", /["']@blaze-cardano\/[a-z-]+["']/),
  dep("atlas", /\batlas-cardano\b/),
  dep("cardano-transaction-lib-ctl", /\bcardano-transaction-lib\b/),
  dep("kuber", /\bkuber(?:-client|-server)?\b/),
  dep("utxorpc", /\butxorpc(?:-spec|-sdk)?\b|@utxorpc\//),
  dep("mithril", /\bmithril-client\b/),
  { id: "dependency:aiken", channel: "dependency", component: "aiken", pattern: /^\s*name\s*=/m, files: /(?:^|\/)aiken\.toml$/ },
  upstream("cardano-api", /\bcardano-api(?:-classic)?\b(?!-)/, ["cardano-api-haskell", "era-identity", "transaction-encoding"]),
  upstream("cardano-ledger", /\bcardano-ledger-(?:api|core|conway|dijkstra|babbage|alonzo|shelley|binary)\b/, ["era-identity", "transaction-encoding", "transaction-rules", "protocol-parameters"]),
  upstream("ouroboros-consensus", /\bouroboros-consensus(?:-cardano)?\b|\bouroboros-network(?:-protocols)?\b/, ["node-to-client-protocol", "block-encoding", "era-identity"]),

  service("blockfrost", /blockfrost\.io|@blockfrost\/|blockfrost[-_](?:js|python|go|rust|java|dotnet|haskell)\b|\bBlockfrost(?:Provider|API|Api|Client)\b/i, { component: "blockfrost-backend-ryo" }),
  service("koios", /koios\.rest|\bKoios(?:Provider|Client|Api)\b|koios[-_](?:client|python|go|java)\b/i, { component: "koios" }),
  service("maestro", /gomaestro(?:-api)?\.org|\bMaestro(?:Provider|Client)\b|@maestro-org\//i, { surfaces: PROVIDER, readiness: "unassessed" }),
  service("ogmios", /\bogmios\b/i, { component: "ogmios" }),
  service("kupo", /\bkupo\b|\bkupmios\b/i, { component: "kupo" }),
  service("cardano-db-sync", /cardano-db-sync|\bdb-?sync\b|\bdbsync\b|\bma_tx_out\b/i, { component: "cardano-db-sync" }),
  service("cardano-wallet", /\/v2\/(?:wallets|byron-wallets|network\/information)\b|cardano-wallet-js\b|cardano-wallet serve\b/, { component: "cardano-wallet" }),
  service("node-socket", /CARDANO_NODE_SOCKET_PATH|\bnode\.socket\b|--socket-path\b/, { surfaces: ["node-to-client-protocol"], readiness: "upstream" }),
  service("cardano-cli", new RegExp(`\\bcardano-cli\\s+(?:${CLI_COMMANDS})\\b`), { surfaces: ["cardano-cli"], readiness: "upstream" }),
  service("submit-api", /cardano-submit-api|\/api\/submit\/tx\b/, { surfaces: ["transaction-encoding"], readiness: "upstream" }),
  service("utxorpc", /\butxorpc\b|\bdolos\b/i, { component: "utxorpc" }),

  marker("closed-era-list", new RegExp(`\\bconway\\b`, "i"), ["era-identity"]),
  marker("cli-era-command", /\bcardano-cli\s+(?:conway|latest|babbage|alonzo)\b/, ["cardano-cli", "era-identity"]),
  marker("plutus-language-enum", /\bplutus[_-]?(?:script[_-]?)?v3\b|\bPlutusV3\b|\bPlutusScriptV3\b/i, ["plutus-language"]),
  marker("cost-models-or-parameters", /\bcost[_-]?models?\b|\bmax[_-]?tx[_-]?ex(?:ecution)?[_-]?units\b|\bmin[_-]?fee[_-]?ref[_-]?script\b/i, ["protocol-parameters"]),
  marker("raw-cbor-codec", /\b(?:cbor-x|borc|cbor2|cbor-js|ciborium|minicbor|serde_cbor|fxamacker\/cbor|cborg|@harmoniclabs\/cbor|jackson-dataformat-cbor|cbor-redux|cbor-web)\b/i, ["transaction-encoding", "block-encoding"]),
  marker("segregated-block-body", /\binvalid[_-]?transactions\b|\btransaction[_-]?bodies\b|\btransaction[_-]?witness[_-]?sets\b/i, ["block-encoding"]),
  marker("legacy-stake-certificate", /\bstake[_-]?registration\b|\bStakeRegistration\b|\bstake[_-]?deregistration\b|\bStakeDeregistration\b/i, ["transaction-encoding"]),
  marker("script-context", /\bScriptContext\b|\bTxInfo\b|\bscript[_-]context\b/, ["plutus-script-context"]),
  marker("pool-registration", /\bpool[_-]?registration\b|\bPoolRegistration\b|\bpool[_-]?params\b|\bPoolParams\b/i, ["stake-pool-registration"]),
  marker("node-to-client", /\bNodeToClient\b|\bnode[-_ ]to[-_ ]client\b|\bn2c\b|\bLocalStateQuery\b|\blocal[-_ ]?state[-_ ]?query\b/i, ["node-to-client-protocol"]),
];

// Dependency trees, build output and development-assistant or editor configuration describe how a tool is built, not what it does.
const SKIP = /(?:^|\/)(?:node_modules|vendor|dist|build|target|\.git|\.yarn|bower_components|\.next|out|coverage|\.claude[^/]*|\.cursor|\.codex|\.windsurf|\.agents?)\/|(?:^|\/)(?:\.eslintcache|CLAUDE\.md|AGENTS\.md|GEMINI\.md|\.cursorrules|copilot-instructions\.md)$/;
const LOCKS = /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|uv\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock|flake\.lock|cabal\.project\.freeze|gradle\.lockfile|packages\.lock\.json)$/;
const BINARY = /\.(?:png|jpe?g|gif|webp|ico|svg|pdf|woff2?|ttf|otf|eot|zip|gz|tgz|xz|bz2|wasm|so|dylib|dll|a|o|jar|class|bin|mp4|mp3|lock|min\.js|map|plutus|cbor|der|db|sqlite)$/i;
export const SCAN_LIMITS = { bytesPerFile: 1024 * 1024, examplesPerRule: 3, quoteCharacters: 200 } as const;

export interface SourceFile { path: string; content: string }
export interface Example { path: string; line: number; quote: string }
/** `lines` counts code, manifest, test and example lines; `docLines` counts prose, which never establishes exposure. */
export interface Hit { rule: string; files: number; lines: number; docLines: number; examples: Example[] }
export interface Scan { files: number; skipped: number; hits: Hit[] }

const DOCS = /(?:^|\/)(?:docs?|documentation|_backup|archive|website|site)\/|\.(?:md|mdx|markdown|rst|adoc|txt|tex|org)$|(?:^|\/)(?:CHANGELOG|CHANGES|HISTORY|NEWS|README|AUTHORS)(?:\.[^/]*)?$/i;

/** Names declared in package.json dependency sections; other keys (scripts, description) are not dependencies. */
function packageDependencies(content: string): Set<string> | null {
  try {
    const json = JSON.parse(content) as Record<string, unknown>;
    const names = new Set<string>();
    for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "overrides", "resolutions"]) {
      const section = json[key];
      if (section && typeof section === "object") for (const name of Object.keys(section)) names.add(name);
    }
    return names;
  } catch { return null; }
}

const MANIFEST_PROSE = /^\s*(?:#|--|\/\/|\/\*|\*|<!--|;)|^\s*["']?(?:description|summary|synopsis|repository|homepage|documentation|authors?|keywords|license|readme)["']?\s*[=:]/i;

export function scannable(path: string, bytes: number): boolean {
  return !SKIP.test(path) && !LOCKS.test(path) && !BINARY.test(path) && bytes <= SCAN_LIMITS.bytesPerFile;
}

/** Each rule is one global scan per file; line numbers are computed only for hits. */
export function scanSources(files: SourceFile[], self?: string, rules = RULES): Scan {
  const hits = new Map<string, Hit>();
  let scanned = 0, skipped = 0;
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    if (!scannable(file.path, Buffer.byteLength(file.content)) || file.content.includes("\0")) { skipped++; continue; }
    scanned++;
    let starts: number[] | undefined;
    const prose = DOCS.test(file.path);
    const npm = /(?:^|\/)package\.json$/.test(file.path) ? packageDependencies(file.content) : undefined;
    for (const rule of rules) {
      if (rule.files && !rule.files.test(file.path)) continue;
      if (rule.component !== undefined && rule.component === self) continue;
      const global = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
      const lines = new Set<number>();
      for (const match of file.content.matchAll(global)) {
        starts ??= lineStarts(file.content);
        const line = lineAt(starts, match.index!);
        const text = lineText(file.content, starts, line);
        if (rule.id === "marker:closed-era-list" && !closedEraList(text)) continue;
        // Comments and descriptive keys in manifests name packages without depending on them.
        if (rule.channel === "dependency" && MANIFEST_PROSE.test(text)) continue;
        if (npm !== undefined && rule.channel === "dependency" && !(npm && npm.has(/^\s*"([^"]+)"\s*:/.exec(text)?.[1] ?? ""))) continue;
        lines.add(line);
      }
      if (!lines.size) continue;
      const hit = hits.get(rule.id) ?? { rule: rule.id, files: 0, lines: 0, docLines: 0, examples: [] };
      hit.files++;
      if (prose) hit.docLines += lines.size; else hit.lines += lines.size;
      // Prefer code examples; prose examples only fill a rule that has no code hit yet.
      if (prose && hit.lines) { hits.set(rule.id, hit); continue; }
      if (!prose && hit.examples.length && hit.lines === lines.size) hit.examples = [];
      for (const line of [...lines].slice(0, SCAN_LIMITS.examplesPerRule - hit.examples.length)) {
        hit.examples.push({ path: file.path, line, quote: lineText(file.content, starts!, line).trim().slice(0, SCAN_LIMITS.quoteCharacters) });
      }
      hits.set(rule.id, hit);
    }
  }
  return { files: scanned, skipped, hits: [...hits.values()].sort((a, b) => (a.rule < b.rule ? -1 : 1)) };
}

/** A line naming Conway alongside at least two earlier eras reads as a closed era enumeration. */
function closedEraList(line: string): boolean {
  const lower = line.toLowerCase();
  return ERA_NAMES.filter((era) => new RegExp(`\\b${era}\\b`).test(lower)).length >= 3;
}

function lineStarts(content: string): number[] {
  const starts = [0];
  for (let i = content.indexOf("\n"); i !== -1; i = content.indexOf("\n", i + 1)) starts.push(i + 1);
  return starts;
}
function lineAt(starts: number[], index: number): number {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= index) lo = mid; else hi = mid - 1; }
  return lo + 1;
}
function lineText(content: string, starts: number[], line: number): string {
  const end = line < starts.length ? starts[line] - 1 : content.length;
  return content.slice(starts[line - 1], end).replace(/\r$/, "");
}

export interface Constraint { kind: "exact" | "caret" | "tilde" | "pvp" | "minimum"; version: number[] }

const VERSION = /(\d+(?:\.\d+)*)/;
const parts = (v: string) => v.split(".").map(Number);

/**
 * Read the version constraint a manifest line declares, with each ecosystem's default operator:
 * Go modules pin exactly; Cargo and Poetry default to caret; npm, Maven and Gradle to exact; Cabal `^>=` is a PVP major.
 * Unbounded or unversioned references (git, path, workspace, plain Cabal names) return null.
 */
export function readConstraint(quote: string, path: string): Constraint | null {
  if (/(?:^|\/)go\.mod$/.test(path)) {
    const m = /\sv(\d+\.\d+\.\d+)/.exec(quote);
    return m ? { kind: "exact", version: parts(m[1]) } : null;
  }
  if (/\.cabal$|cabal\.project|package\.yaml$/.test(path)) {
    const m = /(\^>=|==|>=|>)\s*(\d+(?:\.\d+)*)/.exec(quote);
    if (!m) return null;
    return { kind: m[1] === "^>=" ? "pvp" : m[1] === "==" ? "exact" : "minimum", version: parts(m[2]) };
  }
  const xml = />\s*(\d+(?:\.\d+)+)\s*</.exec(quote);
  if (xml) return { kind: "exact", version: parts(xml[1]) };
  const m = /(\^|~=|~|==|>=|>|=)?\s*v?(\d+\.\d+(?:\.\d+)*)/.exec(quote);
  if (!m) return null;
  const op = m[1] ?? "";
  const kind = op === "^" ? "caret" : op === "~" || op === "~=" ? "tilde" : op === ">=" || op === ">" ? "minimum"
    : op === "=" || op === "==" ? "exact" : /Cargo\.toml$|pyproject\.toml$/.test(path) ? "caret" : "exact";
  return { kind, version: parts(m[2]) };
}

export function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
}

/** Whether a constraint admits `needed` or a later version. */
export function admits(c: Constraint, needed: number[]): boolean {
  const [major = 0, minor = 0, patch = 0] = c.version;
  if (c.kind === "minimum") return true;
  if (c.kind === "exact") return compareVersions(c.version, needed) >= 0;
  const upper = c.kind === "pvp" ? [major, minor + 1]
    : c.kind === "tilde" ? [major, minor + 1]
    : major > 0 ? [major + 1] : minor > 0 ? [0, minor + 1] : [0, 0, patch + 1];
  return compareVersions(needed, upper) < 0;
}

/** A consumer whose constraint cannot reach the release that added a surface's support has a gap on that surface. */
function inherited(component: Component, surface: string, examples: Example[]): { readiness: Readiness; via: string } {
  const status = worstStatus(component, surface);
  const release = component.assessments.find((a) => a.surfaces.includes(surface) && a.releasedIn)?.releasedIn;
  const needed = release ? VERSION.exec(release.tag)?.[1] : undefined;
  if (needed) for (const e of examples) {
    const c = readConstraint(e.quote, e.path);
    if (c && !admits(c, parts(needed))) return { readiness: "gap", via: `${component.id}@${c.version.join(".")}<${release!.tag}` };
  }
  return { readiness: status, via: component.id };
}

export interface SurfaceExposure { surface: string; channels: { channel: Channel; via: string; readiness: Readiness; lines: number }[]; readiness: Readiness }
/** The 11.2 component set itself: these tools define the target rather than consume it. */
export const UPSTREAM_TOOLS = new Set(["cardano-node", "cardano-cli", "cardano-submit-api", "cardano-testnet"]);
export type Exposure = "implements" | "dependency" | "service" | "marker" | "none-found" | "unknown";
export interface ToolClassification {
  id: string; repo: string | null; revision: string | null;
  scan: { status: "scanned" | "no-public-source" | "checkout-failed"; files: number; skipped: number; note?: string };
  exposure: Exposure; readiness: Readiness; surfaces: SurfaceExposure[]; hits: Hit[];
}

const READINESS_ORDER: Readiness[] = ["gap", "unassessed", "no-evidence", "tracked", "in-progress", "upstream", "released", "verified"];
const worse = (a: Readiness, b: Readiness) => (READINESS_ORDER.indexOf(a) <= READINESS_ORDER.indexOf(b) ? a : b);

/** Combine a tool's own R2 entry with its scan into touched surfaces and inherited readiness. */
export function classifyTool(
  tool: { id: string; repo: string | null; revision: string | null }, scan: Scan | { status: "no-public-source" | "checkout-failed"; note: string },
  boundary: BoundaryRegister, changes: ChangeRegister, rules = RULES,
): ToolClassification {
  const known = new Set(changes.surfaces.map((s) => s.id));
  const components = new Map(boundary.components.map((c) => [c.id, c]));
  const bySurface = new Map<string, SurfaceExposure>();
  const add = (surface: string, channel: Channel, via: string, readiness: Readiness, lines: number) => {
    if (!known.has(surface)) throw new Error(`Rule ${via} names unknown surface ${surface}`);
    const entry = bySurface.get(surface) ?? { surface, channels: [], readiness: "unassessed" as Readiness };
    const coupled = entry.channels.some((c) => c.channel !== "marker");
    entry.channels.push({ channel, via, readiness, lines });
    // Markers show a surface is touched; readiness comes from what the tool is coupled to.
    if (channel !== "marker") entry.readiness = coupled ? worse(entry.readiness, readiness) : readiness;
    bySurface.set(surface, entry);
  };
  const own = components.get(tool.id);
  if (own) for (const s of own.surfaces) add(s, "implements", tool.id, worstStatus(own, s), 0);
  const isUpstream = UPSTREAM_TOOLS.has(tool.id);
  const hits = "hits" in scan ? scan.hits : [];
  const ruleById = new Map(rules.map((r) => [r.id, r]));
  for (const hit of hits) {
    const rule = ruleById.get(hit.rule);
    if (!rule) throw new Error(`Unknown rule ${hit.rule}`);
    if (!hit.lines || isUpstream) continue;
    if (rule.component !== undefined) {
      const component = components.get(rule.component);
      if (!component) throw new Error(`Rule ${rule.id} names unknown component ${rule.component}`);
      for (const s of component.surfaces.filter((x) => !rule.excludeSurfaces?.includes(x))) {
        const { readiness, via } = rule.channel === "dependency" ? inherited(component, s, hit.examples) : { readiness: worstStatus(component, s), via: rule.component };
        add(s, rule.channel, via, readiness, hit.lines);
      }
    } else for (const s of rule.surfaces ?? []) add(s, rule.channel, rule.id, rule.readiness ?? "unassessed", hit.lines);
  }
  if (isUpstream) for (const s of changes.surfaces) add(s.id, "implements", tool.id, "upstream", 0);
  const surfaces = [...bySurface.values()].sort((a, b) => (a.surface < b.surface ? -1 : 1));
  const channels = new Set(surfaces.flatMap((s) => s.channels.map((c) => c.channel)));
  const exposure: Exposure = !("hits" in scan) && !own && !isUpstream ? "unknown"
    : (["implements", "dependency", "service", "marker"] as const).find((c) => channels.has(c)) ?? "none-found";
  const coupled = surfaces.filter((s) => s.channels.some((c) => c.channel !== "marker"));
  const readiness = coupled.reduce<Readiness>((w, s) => worse(w, s.readiness), coupled.length ? "verified" : "unassessed");
  return {
    id: tool.id, repo: tool.repo, revision: tool.revision,
    scan: "hits" in scan ? { status: "scanned", files: scan.files, skipped: scan.skipped } : { status: scan.status, files: 0, skipped: 0, note: scan.note },
    exposure, readiness, surfaces, hits,
  };
}

/** Investigation order: closest coupling first, then worst inherited readiness, then breadth. */
export function rankClassifications(items: ToolClassification[]): ToolClassification[] {
  const tier: Exposure[] = ["implements", "dependency", "service", "unknown", "marker", "none-found"];
  return [...items].sort((a, b) => tier.indexOf(a.exposure) - tier.indexOf(b.exposure)
    || READINESS_ORDER.indexOf(a.readiness) - READINESS_ORDER.indexOf(b.readiness)
    || b.surfaces.length - a.surfaces.length || (a.id < b.id ? -1 : 1));
}
