# Readiness collection operations

The collection pipeline writes local snapshots. The website reads committed data. All tools remain hardfork-unassessed until target-specific tests are implemented.

## Quick start

```sh
npm run readiness -- help
npm run readiness -- inventory
npm run readiness -- discover
npm run readiness -- report
npm run readiness -- validate
```

`discover` uses authenticated `gh` access to public repositories. Successful jobs are reused from `.readiness/discovery.json`; failed or interrupted jobs are retried. `--refresh` checks releases again. `--tools id,id` and `--limit N` bound a run. The limit counts distinct repository references, not tools.

For a fresh checkout, existing snapshots and evidence remain usable without network access. Discovery cache state is local. A refreshed discovery identifies source releases, not proven published-package or deployed-service identity. GitHub's latest release can belong to a different package in a monorepo; that mapping remains a coverage gap.

```sh
npm run readiness -- show --tool oura
npm run readiness -- candidates
```

`candidates` lists npm, pnpm, Cargo, Go, and uv collection starting points, including nested workspaces. Use `--tools id,id` to narrow the output. Each candidate lists configuration requirements; package hints still need verification against pinned manifests. Unsupported ecosystems remain in the coverage backlog.

## Collect a native profile

The checked pilot commands are:

```sh
npm run readiness -- collect --tool ouroboros-miniprotocols-ts --adapter npm-lock --roots @harmoniclabs/ouroboros-miniprotocols-ts --platform all-lockfile-targets
npm run readiness -- collect --tool meshjs-mesh-sdk --adapter npm-lock --roots @meshsdk/core --platform all-lockfile-targets
npm run readiness -- collect --tool oura --adapter cargo-metadata --roots oura --platform x86_64-unknown-linux-gnu
npm run readiness -- collect --tool dolos --adapter cargo-metadata --roots dolos --platform x86_64-unknown-linux-gnu
npm run readiness -- collect --tool gouroboros --adapter go-packages --roots github.com/blinklabs-io/gouroboros --platform linux/amd64
npm run readiness -- collect --tool lucid-evolution --adapter pnpm-lock --roots @lucid-evolution/lucid --platform all-lockfile-targets
npm run readiness -- collect --tool opshin --adapter uv-tree --roots opshin --platform x86_64-unknown-linux-gnu --python-version 3.13
```

npm collection reads a committed v2/v3 lockfile, including workspace links and hoisted dependencies. It does not run install scripts or assert which optional dependencies ship on a platform. Missing selections and platform applicability are explicit gaps.

Cargo collection checks out the pinned revision in `.readiness/sources/`, then runs `cargo metadata --locked --format-version 1 --filter-platform <target>`. It retains the command, toolchain, metadata, lockfile, and root manifest. Cargo must be installed. A missing/outdated lock or failed resolver produces a retryable resolution gap. Default features are used; custom feature profiles can be imported separately.

Results are reused for unchanged requests. Cargo cache keys include the toolchain and configuration/environment fingerprints; changed resolver inputs invalidate reuse. Use `--refresh` to deliberately rerun a collector. Source checkouts and job caches are disposable; retained evidence is not.

pnpm collection reads committed v9 lock snapshots and importer manifests without installing dependencies. Workspace links, aliases, and peer-specific selections retain their resolution contexts. Patched/local packages and installed-platform pruning remain explicit gaps. Nested locks use `--path path/to/pnpm-lock.yaml`.

Go collection runs `go list -e -deps -json -mod=readonly` for runtime and test graphs. It uses explicit `GOOS/GOARCH`, disables cgo and workspace overlays, and prevents automatic toolchain downloads. Select packages with `--packages ./...` and tags with `--tags tag,tag`; defaults cover every package in the selected module. Replacements preserve their actual source identity. Missing packages and native errors produce partial coverage. This is package-import coverage for the declared configuration, not a module-lock interpretation of `go.sum`.

uv collection requires a committed `uv.lock` and uses offline, locked JSON tree output with explicit Python/platform selection. It captures extras and development groups separately. User uv environment overrides and external configuration discovery are disabled. Build-backend dependencies and installed wheel/sdist selection remain gaps. The JSON format is a preview API; the scheduled collector pins uv 0.12.22 and rejects unknown schema versions. Nested projects use `--path path/to/pyproject.toml`.

All collectors verify retained evidence before reusing a cached profile. Go patterns/tags and Python versions are part of the collection request identity. New source checkouts refuse to overwrite local changes.

`npm run readiness -- refresh-native` refreshes all registered `collect` requests against the currently discovered source revisions. Unchanged inputs reuse retained profiles. One failed profile does not stop the others; failures remain gaps and the command exits unsuccessfully. Imported custom profiles are not converted into executable commands automatically.

For bounded runs, use `refresh-native --tools lucid-evolution,opshin --limit 2`.
The limit counts distinct registered requests after filtering and deduplication
across historical revisions; multiple configurations for one tool count separately.
Requests run in stable tool-ID order. Unknown tools and tools without registrations
are rejected before collection. Each request logs its position before starting and
saves successful output immediately, so retrying a stopped batch can reuse it.
Toolchain probes have 30-second deadlines, Git operations two minutes, GitHub
requests one minute, and native resolution commands five minutes. These are
per-command limits, not a total batch deadline. Expired commands are force-killed
and collection errors retain diagnostics.

Run validation, replay, report generation, and the site build separately. On Linux,
`timeout -k 5s 120s node --import tsx scripts/readiness/cli.ts replay` provides an
outer deadline and a kill grace period. The Node loader also works in restricted
environments that disallow the `tsx` CLI's IPC socket. Replay logs each profile;
a timeout is an unfinished check, never a successful validation.

### Resumable catalog batches

`collect-batch` adds explicitly selected requests before their first successful
collection. Store the reviewed selection in a JSON file:

```json
{
  "schemaVersion": 1,
  "requests": [{
    "toolId": "cardano-peer-connect",
    "revision": "6fce1afe581da1009a81fe119ec83357150abab9",
    "adapter": "npm-lock",
    "roots": ["@fabianbormann/cardano-peer-connect"],
    "platform": "all-lockfile-targets"
  }]
}
```

```sh
npm run readiness -- collect-batch --input content/readiness/catalog-batch.json --limit 2
```

`data/readiness/collection-queue.json` retains pending, running, succeeded, failed,
and deferred jobs, their pinned requests, attempts, errors, and successful profile
IDs. The existing store writer lock covers queue and snapshot writes. Every
transition is saved atomically; a killed run's running jobs become pending on the
next selected run. The native cache recovers a profile saved just before interruption.
New pending work runs before failed retries so a repeatedly failing request cannot
starve the rest of a limited batch. Requests outside `--tools` remain queued.

A successful job is skipped only while its profile and evidence bytes are retained.
`--refresh` reruns selected successes and bypasses the native cache. Use it when
deliberately changing toolchains or resolver inputs; ordinary batch resumption
reuses the completed pinned capture. `refresh-native` remains the command for
registered profiles against newly discovered releases and current resolver inputs.
If discovery has moved beyond a batch's pinned revision, that job is deferred;
verify and update the input file rather than silently collecting a different source.
Outstanding selected failures and deferred requests cause a nonzero exit status,
including failures left unattempted by the current limit. A bounded run may leave
pending jobs without failing; inspect its summary and rerun to continue. Collection
success means evidence was captured, not complete coverage or hardfork readiness.

The checked catalog batch includes source-only/monorepo release caveats in
`content/readiness/README.md`. Scheduled refresh handles successful registrations;
unregistered batch failures require an explicit batch retry.

### Import other native output

```sh
npm run readiness -- import-native --profile profile.json --input native-output.json
```

Example profile:

```json
{
  "toolId": "kupo",
  "release": "<assessed-release>",
  "revision": "<40-character-commit>",
  "platform": "x86_64-linux",
  "features": ["default"],
  "command": "cabal build all --dry-run",
  "toolchain": "<cabal-and-ghc-versions>",
  "origin": "source-reconstruction",
  "adapter": "cabal-plan",
  "rootNames": ["kupo"]
}
```

Replace placeholders with observed values. For Cabal, import `dist-newstyle/cache/plan.json` from the declared build configuration. Preserve index states, project flags, and release/build provenance as source evidence. `release-build` is reserved for an actual release build's output; reconstructing source locally is not equivalent.

Supported adapters are `npm-lock`, `pnpm-lock`, `cargo-metadata`, `cabal-plan`, `go-packages`, and `uv-tree`. Cabal remains import-only. Yarn, older pnpm lock formats, Python projects without uv locks, and other unsupported build systems remain visible coverage work. No synthetic resolution is substituted.

## Manual review handoff

First capture specific source files needed for cited findings, then export a packet:

```sh
npm run readiness -- capture-source --tool oura --path README.md
npm run readiness -- export-review --tools oura --output .readiness/reviews/oura
```

The packet contains selected tools, profiles, graph records, evidence hashes, decompressed evidence, a result template, and the [task briefs](./DEPENDENCY-REVIEW-TASKS.md). Run discovery and challenge tasks manually. Capture additional sources and export a new packet if the first review needs evidence outside its packet.

The implemented interchange format is JSON. Import supports relationship and gap findings; identity/capability questions can be retained as gaps until their specialized workflows are added. A tool needs a native profile before a relationship can be attached to a consumer occurrence. Review tasks for other tools can still return evidence gaps.

Relationship finding shape, inside the exported result template's `findings` array:

```json
{
  "id": "finding-001",
  "toolId": "oura",
  "kind": "relationship",
  "from": "<consumer-occurrence-id-from-packet>",
  "target": {
    "ecosystem": "service",
    "name": "<service-name>",
    "version": null,
    "source": "<documented-interface-or-source-URL>",
    "integrity": null
  },
  "type": "service",
  "scope": "runtime",
  "optional": true,
  "condition": "<configuration-enabling-this-integration>",
  "rationale": "<what-the-evidence-establishes>",
  "citations": [{
    "evidenceId": "<evidence-id-from-packet>",
    "pointer": "/content",
    "quote": "<exact-source-excerpt>"
  }]
}
```

Types: `service`, `protocol`, `bundled`, `code-generation`. Scopes: `runtime`, `build`, `development`. Unknown target version/integrity remain `null`. JSON pointers refer to retained evidence documents; excerpts must match. Package edges come from native adapters.

Gap findings use `id`, `toolId`, `kind: "gap"`, `area`, `rationale`, `nextAction`, and `citations` (which may be empty). Areas: `artifact`, `resolution`, `integration`, `capability`, `discovery`.

```sh
npm run readiness -- import-review --packet .readiness/reviews/oura/packet.json --input result.json
```

Findings default to suggested. A separate decision document can record checked evidence:

```json
{
  "decisions": [{
    "findingId": "finding-001",
    "verification": "verified",
    "method": "source-review",
    "rationale": "<specific-evidence-check-and-applicability>"
  }]
}
```

Pass it with `--decisions decisions.json`. Methods: `source-review`, `maintainer-confirmation`, `native-check`. Verification states: `verified`, `suggested`, `disputed`, `rejected`. Changing an existing relationship decision also requires its `previousVerification`. Neither task completion nor agreement between passes establishes compatibility.

Results from stale input packets are rejected. Unrelated tools' updates do not invalidate a packet. Reimporting an identical submission is idempotent. Pending packet IDs are recorded in `data/readiness/reviews.json`.

## Evidence, replay, and comparisons

```sh
npm run readiness -- replay
npm run readiness -- diff --before previous-snapshot.json --output changes.json
npm run readiness -- diff --before-ref <git-ref> --output data/readiness/changes.json
npm run test:readiness
```

- `snapshot.json` is the canonical snapshot manifest and coverage state. Its
  `storageVersion: 1` envelope references immutable `snapshots/<table>/<sha256>.json`
  chunks for artifacts, occurrences, and edges. The logical graph still uses
  schema version 1. `Store.load()` validates every referenced chunk and reconstructs
  the same graph before checking its semantic digest.
- `evidence/*.json.gz` retains content-addressed inputs with checksums. Keep these files with every published snapshot; do not prune referenced evidence.
- `report.json` contains coverage gaps and an ecosystem backlog.
- `impact.json` contains distinct downstream tools and explanatory paths per scope/profile.
- `projects.json` unions downstream tools across package versions within known source namespaces. Forks and ambiguous sources stay separate.
- `changes.json`, when generated for the current snapshot, supplies the website's snapshot comparison.
- `replay` reconstructs native graph records from retained evidence, without network access.
- Native output and configuration evidence have explicit roles. `rebuild-native` upgrades native graph records after an adapter change using retained evidence, and marks affected review packets for revalidation. It refuses to overwrite graphs containing manual relationships or decisions that need reconciliation.
- Semantic digests exclude operational timestamps. Resolver inputs, command/toolchain, profile, and native output remain part of profile identity.
- Required exposure takes precedence over optional exposure within a profile. A tool may still appear in both columns when it has different exposure in different profiles; project totals union tools rather than summing version counts.
- A single-writer lock prevents concurrent collection commands from overwriting each other. Interrupted same-host locks are recovered when their process no longer exists.

Profiles are historical, release-specific records. Refreshing discovery does not silently change old graphs or declare the newest release resolved. Collect a new profile for the new release. Tool-level resolution stays partial until supported configuration coverage has been established; a complete native profile does not establish complete tool coverage.

### Snapshot storage and backups

New saves use ordinary JSON chunks capped at 2 MiB. Occurrences and edges are
grouped by profile; artifacts are distributed across stable hash buckets. Evidence
lists are stored once per chunk and referenced by a local integer. Each decoded
record receives its own evidence array, preserving independent review updates.
Records remain complete JSON objects, one per line, for readable diffs.

Chunks are content-addressed and written before atomically replacing the manifest.
A failed save leaves the previous manifest usable. Existing chunks must match their
expected bytes; corruption is rejected. Old chunks and evidence are not pruned
automatically, so readers and retained manifests can still use their original
references. Superseded chunks can accumulate after graph corrections; any future
cleanup must account for retained manifests, not just the current snapshot.

```sh
npm run readiness -- compact-storage
npm run readiness -- export-snapshot --output /tmp/readiness-before.json
npm run readiness -- diff --before /tmp/readiness-before.json
npm run readiness -- diff --before-ref HEAD
```

`compact-storage` migrates storage without changing operational timestamps or the
semantic digest. Legacy self-contained snapshots remain readable. `export-snapshot`
writes a self-contained logical snapshot for comparisons and portable graph
backups; evidence files must still accompany backups intended for native replay.
Copying `snapshot.json` alone no longer copies the graph: either export it or copy
the manifest together with its referenced `snapshots/` files. Git comparisons read
the manifest and all chunks from one resolved commit. The CI baseline uses the
self-contained export, and uploaded review artifacts include the chunk directory.

## Scheduled collection

`.github/workflows/readiness.yml` refreshes discovery and registered native profiles weekly and on manual dispatch. It validates data and uploads a review artifact with a snapshot comparison, including resolution failures. It has read-only repository permission and does not commit, push, or create pull requests. Accepted snapshots and evidence are committed separately after review.

Adding a new native profile and launching review passes remain explicit tasks. Download review artifacts within their 90-day retention window; merged evidence is retained in git.
