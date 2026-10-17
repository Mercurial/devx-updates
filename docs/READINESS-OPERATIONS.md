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

`candidates` lists root npm locks and Cargo locks as collection starting points. It is not the full ecosystem backlog; nested manifests remain visible in each tool's record.

## Collect a native profile

The checked pilot commands are:

```sh
npm run readiness -- collect --tool ouroboros-miniprotocols-ts --adapter npm-lock --roots @harmoniclabs/ouroboros-miniprotocols-ts --platform all-lockfile-targets
npm run readiness -- collect --tool meshjs-mesh-sdk --adapter npm-lock --roots @meshsdk/core --platform all-lockfile-targets
npm run readiness -- collect --tool oura --adapter cargo-metadata --roots oura --platform x86_64-unknown-linux-gnu
npm run readiness -- collect --tool dolos --adapter cargo-metadata --roots dolos --platform x86_64-unknown-linux-gnu
```

npm collection reads a committed v2/v3 lockfile, including workspace links and hoisted dependencies. It does not run install scripts or assert which optional dependencies ship on a platform. Missing selections and platform applicability are explicit gaps.

Cargo collection checks out the pinned revision in `.readiness/sources/`, then runs `cargo metadata --locked --format-version 1 --filter-platform <target>`. It retains the command, toolchain, metadata, lockfile, and root manifest. Cargo must be installed. A missing/outdated lock or failed resolver produces a retryable resolution gap. Default features are used; custom feature profiles can be imported separately.

Results are reused for unchanged requests. Use `--refresh` to deliberately rerun a collector, for example after changing the local toolchain. Source checkouts and job caches are disposable; retained evidence is not.

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

Supported adapters are `npm-lock`, `cargo-metadata`, and `cabal-plan`. Unsupported ecosystems, Yarn/pnpm-only projects, and custom build systems remain visible coverage work. No synthetic resolution is substituted.

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
npm run test:readiness
```

- `snapshot.json` is the canonical graph and coverage state.
- `evidence/*.json.gz` retains content-addressed inputs with checksums. Keep these files with every published snapshot; do not prune referenced evidence.
- `report.json` contains coverage gaps and an ecosystem backlog.
- `impact.json` contains distinct downstream tools and explanatory paths per scope/profile.
- `replay` reconstructs native graph records from retained evidence, without network access.
- Semantic digests exclude operational timestamps. Resolver inputs, command/toolchain, profile, and native output remain part of profile identity.
- A single-writer lock prevents concurrent collection commands from overwriting each other. Interrupted same-host locks are recovered when their process no longer exists.

Profiles are historical, release-specific records. Refreshing discovery does not silently change old graphs or declare the newest release resolved. Collect a new profile for the new release. Tool-level resolution stays partial until supported configuration coverage has been established; a complete native profile does not establish complete tool coverage.

## Scheduled collection

`.github/workflows/readiness.yml` refreshes discovery weekly and on manual dispatch. It validates data and uploads a review artifact with a snapshot comparison. It has read-only repository permission and does not commit, push, or create pull requests. Accepted snapshots and evidence are committed separately after review.

Scheduled jobs currently refresh source discovery only. Native collection and review passes are explicit tasks. Download review artifacts within their 90-day retention window; merged evidence is retained in git.
