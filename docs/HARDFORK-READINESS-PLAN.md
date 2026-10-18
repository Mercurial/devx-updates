# Dependency mapping and hardfork readiness

Status: operational collection and reporting are implemented; catalog-wide dependency coverage is still being expanded. The completed checkpoint through `933f819` was pushed to `origin/hardfork-readiness` at the owner's request. New work remains local until another push is requested.

## Implementation progress

This checklist records delivered behavior and verification, not just code started.

- [x] Planning baseline and manually launched review task briefs.
- [x] Phase 1: validated catalog inventory, coverage records, release discovery, and ecosystem detection.
- [x] Phase 2: native-resolution import, evidence retention, context-aware graph, impact calculation, and pilot verification.
- [ ] Phase 3: catalog-wide discovery, explicit unresolved frontiers, manual packet export, and validated review import.
- [x] Phase 4: static coverage, tool detail, impact, filters, and exports, verified in a browser.
- [x] Phase 5: resumable refresh, snapshot comparisons, freshness reporting, and scheduled collection for registered profiles.
- [ ] Phase 6: target-specific compatibility testing. Gated on the selected hardfork environment and change analysis.

### Implementation log

- Planning baseline: documented features, assumptions, architecture, phased acceptance criteria, and manual review assignments. Existing invitation-script edits are outside this work.
- Inventory and graph foundation: all 269 catalog entries have coverage records; the first run discovered source revisions/manifests for 226 entries. Website/organization-only entries and failed lookups remain explicit gaps. Ecosystem detection covers nested workspaces, including unsupported build systems.
- Native pilot: imported pinned npm locks for Ouroboros Miniprotocols TS and Mesh, and executed locked, platform-filtered Cargo metadata for Oura and Dolos. Mesh exercises a monorepo root. Package artifacts are shared while occurrence edges retain consumer/profile context. npm lock coverage is deliberately partial because it does not establish an installed platform selection.
- Cabal plan import is implemented and fixture-tested; a real Haskell pilot remains follow-up work because Cabal is unavailable in the current environment. Other ecosystems are detected and queued rather than treated as resolved.
- Evidence storage decision: retain content-addressed compressed JSON evidence in `data/readiness/evidence/`, alongside the normalized snapshot. Local resumable state and source checkouts live in ignored `.readiness/`. This initial implementation uses repository retention rather than an external artifact store.
- Foundation verification: 10 behavior tests cover closure/context separation, workspace links, missing dependencies, cycles, diamond paths, evidence replay, optional/build/test scope, and suggested reach. Type checking and scoped lint pass. CLI `replay` reconstructs native graph records from retained inputs.
- Review and refresh milestone: packet export, pinned source capture, checked JSON citations, transactional result import, decision history, and stale-input rejection are implemented. The Oura discovery packet is prepared locally. Manual review findings remain pending until returned; no review service is invoked.
- Discovery now normalizes GitHub URLs and records repository redirects as identity questions. A follow-up run discovers 227 tools; 42 retain unresolved source/discovery coverage. Original catalog references are preserved.
- Operations: a single-writer lock protects snapshot updates. The weekly read-only workflow refreshes discovery, validates/replays retained evidence, and uploads a review artifact with a comparison. Native-profile refresh is still explicitly invoked. `docs/READINESS-OPERATIONS.md` documents the commands and current adapter boundaries.
- Verification expanded to 15 passing behavior tests, including citation rejection, stale packets, suggestion promotion, idempotent review import, and writer exclusion. Catalog-wide native resolution, capability classification, and returned manual integration reviews remain open work within phase 3.
- Dashboard milestone: `/map/readiness/` and 269 statically generated tool pages expose coverage, next actions, release/configuration graphs, evidence references, scope-specific reach, version-grouped project reach, snapshot comparisons, and filtered/tool JSON exports. Unknown compatibility remains explicit throughout.
- Browser verification: Chromium desktop/mobile checks passed for filtering, empty results, profile selection, impact paths, version grouping, work queue navigation, dependency expansion, exports, base-path links, horizontal layout, and console errors. Light/dark screenshots were inspected. The static build passes both at root and with `/devx-updates` as the base path.
- Verification now includes 16 passing behavior tests. New/changed readiness code passes lint and type checking. Repository-wide lint reports 12 pre-existing errors and one warning in the map table, graph, site header, and Markdown renderer. Collection checkouts are excluded from project lint/type checking.
- Review corrections: incomplete Cargo resolution-node sets now produce partial coverage; feature-optional and renamed/library-target dependencies retain their conditions; required exposure suppresses optional exposure only within the same profile. Real native profiles were rebuilt from retained inputs and replayed after the corrections.
- Evidence and review hardening: native output/configuration roles and collection request keys are explicit, operational gaps have stable codes, and the website and review packets share one subgraph selector. Pending packets whose evidence context changes are marked for revalidation. Native rebuild refuses to overwrite manual graph decisions.
- Recurring native refresh now runs registered npm/Cargo requests after source discovery. Cargo cache keys include compiler versions and configuration/environment fingerprints; unchanged requests were verified to reuse all four pilot results. Failures retain evidence and are surfaced without stopping other profile attempts. Source discovery checkpoints its queue and writes the shared snapshot atomically at batch completion.
- Final local verification uses the repository's locked dependencies, including Next.js 16.3.4: 23 behavior tests pass, type checking and scoped lint pass, all four native profiles replay identically, and 471 retained evidence objects validate. The production static build exports 311 routes with the `/devx-updates` base path. Desktop/mobile browser flows and console checks pass on the locked version.

### Standards review

No documented-standard breaches were found. Three maintainability findings were addressed: explicit evidence roles/collection identity, stable operational gap codes, and shared tool-subgraph selection. Follow-up review confirmed all three refinements.

### Specification review

Three correctness findings were fixed and regression-tested: missing Cargo resolution nodes, feature-optional dependency classification, and cross-profile exposure precedence. Follow-up review found no new blocking correctness issues in those fixes. Broader coverage gaps remain tracked below.

### Active continuation: expanded native collection

- [x] Recover interrupted pnpm, Go, and uv work; validate retained snapshot and replay the five existing native profiles, including Gouroboros.
- [x] Finish adapter edge cases, evidence/cache handling, expanded collection candidates, and recurring toolchain setup.
- [x] Verify pnpm and uv against real pinned catalog sources and expand the registered native profiles.
- [x] Regenerate coverage/impact/comparison reports, review implementation, and commit verified milestones locally.

Recovery checkpoint: the six new adapter tests and TypeScript checks pass. The interrupted snapshot contains 269 tools, five profiles, and 476 valid retained evidence objects. Go 1.26.8 and uv 0.12.22 are available; Cabal is still unavailable. This continuation implements the offline collection and retained-data boundaries in ADR-1 and ADR-2.

Expanded collector milestone: pnpm v9, Go package/test graphs, and uv JSON trees now share evidence-checked collection registration and refresh. Candidate discovery includes nested workspaces. Nine focused tests cover peer contexts, aliases, nested source identity, replacements, test scope, extras, missing selections, and cache evidence. Type checking and readiness lint pass. Real OpShin and Lucid Evolution collections succeeded; all seven registered profiles reuse cached evidence and replay identically. Report regeneration and final review follow in the next checkpoint.

Review checkpoint: specification review identified cross-manager npm identity splits, nested local-package collisions, non-retryable Go loading failures, incomplete Go environment cache keys, corrupt evidence surviving recollection, and machine-local paths in collection identity. Standards review identified missing retained command diagnostics; maintainability feedback also covered checkout duplication and repeated request fields. Corrections and regression checks are in progress before evidence publication.

Review correction checkpoint: public npm registry tarballs now share identities across npm/pnpm; custom registries and nested local sources remain distinct. Go retries incomplete package graphs, fingerprints effective persisted configuration, and records execution diagnostics. Recollection rejects corrupt retained bytes explicitly. New Go/uv output normalizes checkout/toolchain/cache paths before retention, and failure diagnostics remain inspectable as evidence. Cargo now shares pinned checkout handling, and collection request fields share a type. All 12 focused tests, TypeScript, and readiness lint pass. Historical profiles retain their original evidence; collector upgrades create new versioned inputs.

Execution checkpoints: keep collection runs bounded to selected profiles, save each successful profile immediately, run validation separately from long report/build steps, and commit each verified milestone. Record any timeout as an unfinished check and retry that step alone rather than restarting the pipeline.

Recovery verification (2026-10-18): the interrupted run's retained data validates and all 10 historical native profiles replay identically. The snapshot accounts for 269 tools, seven tools with profiles, 516 evidence objects, 7,392 occurrences, and 32,328 edges. Pinned Lucid Evolution/pnpm and OpShin/uv collections are retained alongside the upgraded Go inputs; historical profiles remain available. Coverage, impact, project reach, and comparison reports were regenerated. All tools remain hardfork-unassessed; 262 tools still need native profiles.

### Active continuation: bounded execution and verification

- [x] Recover, validate, replay, and save the expanded native-data checkpoint.
- [x] Add selected-tool/limited native refresh with visible per-request progress and bounded toolchain probes.
- [x] Remove repeated graph work from reporting/replay; verify on the expanded snapshot.
- [x] Run focused checks, the full readiness suite, static build, and standards/spec review; record results and commit locally.

Execution note: the sandbox blocks the `tsx` CLI's IPC socket. Use `node --import tsx scripts/readiness/cli.ts ...` for local checks; on this Node 24 environment, `node --import tsx --test --test-isolation=none lib/readiness/*.test.ts` reports the individual behavior tests without subprocess isolation. Run each expensive check separately under a timeout with a kill grace period; this avoids restarting completed collection work after a stalled check.

Bounded execution checkpoint (ADR-1/ADR-2): native refresh now accepts `--tools` and `--limit`, validates selection before collecting, deduplicates historical requests, and logs each request before it starts. Toolchain probes have 30-second limits; timed-out external commands are force-killed. Reporting reuses one impact calculation, and replay indexes retained records instead of repeatedly scanning the graph. All 36 behavior tests, TypeScript, and readiness lint pass. A selected Mesh refresh reused exactly one cached request; all 10 historical profiles replay identically. Regenerated coverage/impact/project reports are byte-for-byte unchanged. The comparison baseline is the last pre-recovery commit (`167603f`). The production build passes and exports 311 routes with `/devx-updates` as the base path; generated Lucid Evolution, OpShin, and Gouroboros pages retain base-path links and unassessed status.

Review completion: independent standards review found no actionable issues; specification review found no blocking issues and reran the focused collection tests. One nonblocking validation limitation remains: the new tests exercise bounded selection and failure continuation, but do not simulate a native command being force-killed at its timeout. Local milestone commits: `bc2258d` retains the expanded native evidence; `fab2e0f` implements bounded refresh and streamlined verification. Nothing was pushed. The continuation checklist is complete; catalog rollout and target-specific testing remain open below.

### Remaining rollout work

- Complete phase 3 coverage: expand beyond the npm/Cargo pilot, run a real Cabal plan, add adapters for the detected unsupported ecosystems, and return manual integration/capability reviews. These are visible coverage gaps, not passing assessments.
- Extend registered profiles as supported release/platform/feature policies are verified. Registered npm, pnpm, Cargo, Go, and uv requests refresh automatically; custom imported profiles require their ecosystem collector or explicit reimport. Start subsequent collection work with `candidates --tools ...`, select pinned manifests and configurations, and commit validated batches. Publication remains a separate reviewed change.
- Phase 6 remains gated on hardfork-specific change analysis and the target test environment.

### Active continuation: catalog collection batches

- [x] Add a persisted native work queue for explicitly selected, revision-pinned requests, including retryable failures and interrupted jobs (section 6.4; ADR-1/ADR-2).
- [x] Verify production roots and configurations for a small catalog batch, collect supported sources, and retain explicit gaps for unsupported inputs.
- [x] Validate/replay retained evidence, regenerate reports and comparison, run tests/build and implementation review, and commit milestones locally.

Initial candidate inspection: Helios, Minswap SDK, Cardano Peer Connect, Weld, and Dingo have supported manifest candidates. Package names, lock formats, and release scope must be checked before requests are admitted. Helios currently has default-branch evidence only; Weld's discovered release belongs to a monorepo plugin, so neither may be presented as a verified stable package release. Cabal/GHC are still unavailable; a real Cabal pilot remains open.

Batch implementation checkpoint: `collect-batch` persists pending/running/succeeded/failed/deferred jobs in `data/readiness/collection-queue.json`. Requests include immutable revisions; changed discovery defers them for renewed source review. Successful jobs require retained profile evidence before reuse, interrupted work resumes, and pending work precedes retries so repeated failures cannot starve a limited batch. Eight focused batch/cache tests, TypeScript, and readiness lint pass. The five requests in `content/readiness/catalog-batch.json` now have checked pinned package identities and supported lock formats; source/release/configuration caveats are documented alongside them. Real collection and final review follow.

Collection/review checkpoint: Cardano Peer Connect, Helios, Minswap SDK, and Weld were captured in two bounded batches; each saved its profile before the next request. Dingo runs separately. Specification review found that outstanding selected failures could be hidden by a later limited invocation; summary counts now reflect all selected failed jobs and keep pending jobs separate. The regression test covers that exact sequence. Standards review's shared-cache-policy refinement is implemented: native cache hits and batch resumption use the same evidence-retention and Go completeness checks. Eight focused tests and TypeScript pass after these corrections.

Expanded catalog checkpoint: all five selected requests succeeded, including Dingo with Go 1.26.8. The snapshot now has 12 tools with profiles (up from seven), 15 historical profiles, 539 verified evidence objects, 12,404 occurrences, and 70,029 edges. All 15 profiles replay identically; rerunning the completed batch attempts zero requests. All 39 behavior tests, TypeScript, and readiness lint pass. Coverage, impact, project, and comparison reports are regenerated against `933f819`. Follow-up standards/specification reviews confirm both findings resolved. The production build passes and exports 311 routes at `/devx-updates`; pinned roots and queue/profile references were independently checked for all five tools. All 269 tools remain hardfork-unassessed and 257 still have no native profile. Implementation checkpoints `b78c42f` and `859f769` remain local; the verified data is committed separately.

Next rollout priority: the normalized snapshot is now approximately 79.9 MiB for 12 covered tools. Before another large collection batch, compact or partition normalized storage while preserving reviewability, semantic identity, evidence replay, and static-site access. Keep this separate from the successfully verified collector work; do not silently prune historical profiles or dependencies to reduce size. Cabal collection, unsupported ecosystems, and returned integration/capability reviews remain open.

### Active continuation: partitioned snapshot storage

- [x] Measure storage and select a representation that preserves the canonical graph.
- [x] Implement readable, checksum-verified graph chunks with shared evidence lists, atomic manifest publication, and legacy snapshot loading.
- [x] Support self-contained snapshot export, comparisons against legacy/partitioned files and Git revisions, and CI baselines.
- [x] Migrate the retained snapshot, prove identical semantic digest/reports/review inputs, validate/replay/build, review, and commit locally.

Storage measurement: compact JSON alone is 67.9 MiB; repeated evidence lists account for approximately 36.5 MiB across edges and occurrences, with only 15 distinct lists. The chosen ADR-1/ADR-2 implementation keeps ordinary JSON, moves artifacts/occurrences/edges into content-addressed chunks, and interns evidence lists within each chunk. Profile-local graph partitioning avoids rewriting unrelated historical profiles. The existing in-memory schema and semantic digest remain unchanged. Immutable chunks are written before the atomic manifest replacement; no automatic pruning of old chunks or evidence is included.

Storage implementation checkpoint: new saves emit an atomic `snapshot.json` manifest and JSON chunks capped at 2 MiB. Legacy files remain readable; exports reconstruct self-contained graphs; Git comparisons pin one commit before reading the manifest and chunks. CI now exports its comparison baseline rather than copying only the manifest. Four focused storage tests pass, covering graph/report/review identity, manual decisions, non-aliased evidence lists, deterministic bounded chunks, unchanged unrelated profile chunks, checksum/path/count/index rejection, missing files, and prior-manifest recovery after failed writes. TypeScript and readiness lint pass. Migration and real-data equivalence checks follow.

Migration checkpoint: retained snapshot storage shrank from 79.9 MiB to 32.2 MiB (59.7% less), including a 1.13 MiB manifest and 55 chunks; the largest chunk is 1.76 MiB. No records or historical profiles were removed. The semantic digest and full exported graph, including timestamps, are unchanged; review packet IDs match for all 12 profiled tools. All 539 evidence objects validate, all 15 profiles replay identically, and all 43 behavior tests pass. Coverage/impact/project/comparison reports and review/batch queues are byte-for-byte unchanged. Git comparisons against both the prior monolithic checkpoint and the committed partitioned form show zero changes; a second compaction produces no file changes. Independent standards/specification reviews found no actionable issues. The production static build passes and exports all 311 routes with `/devx-updates` as the base path. Implementation `5fab9f5` and migration `546c09d` are committed locally; nothing was pushed.

Next: resume phase-3 coverage in small, explicitly selected catalog batches using the new storage. Keep failed native requests retryable and record source/release caveats. A real Cabal pilot still requires a suitable Cabal/GHC environment; unsupported ecosystems and manually returned integration/capability findings remain the other open coverage tracks. Compatibility testing remains gated on a selected hardfork target and environment.

### Active continuation: higher-level workflow coverage

Priority agreed with the owner: start subsequent batches with higher-level SDKs,
transaction builders, wallets, wallet integrations, and applications. Select roots
by user-facing workflow relevance, gaps in existing workflow coverage, and
evidence of downstream exposure. Collector support is a feasibility check or
tie-breaker, not the primary ranking. Do not substitute documentation, examples,
or test manifests for a tool's production root just because they are supported.

Collect each consumer's selected dependency closure so shared lower-level
components and actual selected versions emerge from consumer evidence. Use
verified reach to prioritize subsequent upstream investigation; retain separately
built services, hosted providers, native bundles, and unsupported production
ecosystems as explicit integration or resolution gaps. Catalog usage hints alone
do not establish adoption or verified reach. Aiken and Amaru remain useful roots,
but their available collectors do not put them ahead of missing user workflows.

- [x] Verify a small batch of higher-level production roots and pinned configurations; document workflow rationale and release caveats.
- [x] Collect the selected requests in bounded runs, preserving retryable failures and evidence for unresolved boundaries.
- [x] Validate/replay retained inputs, regenerate reports/comparison, run checks and review, and commit the verified milestone locally (ADR-1/ADR-2).

Selected batch: Lace mobile, GovTool frontend, Evolution SDK, Hydra SDK's core/
transaction/bridge packages, and Dexter. `content/readiness/workflow-batch.json`
pins the requests; its companion README records workflow rationale, exact package
versions, and release/configuration caveats. Large Lace/GovTool locks required
immutable GitHub blob retrieval. Lace also exposed unnamed npm workspaces: new,
versioned captures resolve unique package-link names while historical inputs keep
their original replay behavior. Missing/ambiguous identities remain gaps. Focused
checks pass; retained-data validation and review follow collection.

Collection checkpoint: all five selected tools succeeded in bounded batches. The
snapshot now contains 17 tools with profiles, 20 historical profiles, 594 verified
evidence objects, 26,612 occurrences, and 107,684 edges. All 20 profiles replay
identically. A completed-batch rerun attempts zero requests; all five registered
native refreshes reuse their retained captures. Thirteen additional pinned source
files support explicit release and workflow-boundary notes. Every new profile is
partial and source-reconstructed; all 269 tools remain hardfork-unassessed and
252 tools still have no native profile.

Verification checkpoint: all 47 behavior tests, TypeScript, and readiness lint
pass. Reports and comparison are regenerated against pre-batch commit `0cd5670`:
five profiles, 8,847 artifacts and 37,655 edges added, with no historical graph
records removed or changed. Independent standards review found no actionable
issues; specification review checked both implementation and retained source/root
identities and found no blocking issues. Implementation checkpoint `0d7274b` is
local. Active snapshot storage is 52.9 MiB; never-committed intermediate chunks
were moved into ignored local recovery state while all manifest-referenced and
previously committed chunks were retained.

Static export checkpoint: `NEXT_PUBLIC_BASE_PATH=/devx-updates npm run build --
--webpack` passes and exports 311 routes. Generated pages for all five new tools
contain their selected roots, explicit scope gaps, current snapshot digest,
unassessed status, and base-path links; dashboard totals/comparison match the
retained snapshot. Default Turbopack builds failed because the execution environment
denied the compiler worker's local port, including after an elevated retry. The
documented Webpack option verified the static export; no build/deployment
configuration was changed. This is an environment-specific default-build
validation limitation, not a successful Turbopack check. No new browser interaction
check was run for this data/collector-only change. Verified milestone is committed
locally; nothing was pushed.

Next: continue selecting higher-level workflow gaps, including unsupported
production ecosystems, and prepare evidence for owner-launched integration and
capability reviews of the collected consumers. Use their observed shared upstream
dependencies to prioritize investigation. Cabal/GHC collection and the selected
hardfork target/environment remain separate open prerequisites.

### Active continuation: Yarn-based wallet and SDK workflows

The next coverage boundary is Yarn production inputs: AdaLite (web wallet),
Daedalus (full-node desktop wallet), TyphonJS (wallet transaction SDK), Cometa
(SDK with native/WASM bindings), and Cardano Web3 (provider-backed SDK). Source
inspection found Classic v1 locks and modern metadata versions 8/10. This batch
implements offline collection and retained evidence under ADR-1/ADR-2; it does
not install consumer dependencies or execute project build scripts.

- [x] Add evidence-backed Classic/modern Yarn capture, normalization, candidates, and recurring registration with explicit unsupported inputs.
- [x] Verify and attempt the five pinned production requests in bounded batches; retain failures and source/release/native/service boundary gaps.
- [x] Validate/replay evidence, regenerate reports/comparison, check static export, review, and commit locally.

Lock records will be treated as declared dependency selections. Peer bindings,
hoisting, installed-platform pruning, patches and shipped artifact correspondence
remain unresolved unless separately evidenced. Modern Yarn cache checksums are
not npm tarball integrity hashes. Unknown lock versions and ambiguous selections
must fail or remain explicit gaps rather than becoming guessed verified edges.

Source checkpoint: official Yarn parsers are pinned for Classic and modern input.
AdaLite's configuration requires the modern parser's own YAML semantics; after
parsing, its lock is rejected because `js-tokens@npm:4.0.0` declares version
`0.0.0-use.local`. This is a retained, retryable source-data failure, not a
successful profile. Corrected source and renewed revision review are required.
Other selected consumers continue independently.

Collection/review checkpoint: Daedalus, TyphonJS, Cometa and Cardano Web3 now
have partial source profiles; AdaLite remains failed and retryable. Four registered
refreshes reuse retained evidence; rerunning those four completed requests attempts
zero collections. Fourteen additional pinned source files and authored scope
records document the lock conflict, release mappings and native/service boundaries.
The first TyphonJS capture remains historical alongside its official-parser capture.
Specification review found a stale workspace manifest could disagree with its
locked selection; conflicting or absent workspace selections now produce gaps
without inferred edges, with a regression test. Neither real TyphonJS capture had
this mismatch. Standards review's optional parser-provenance refinement is also
implemented: cache context and toolchain labels share the exact package pins.

Verification checkpoint: all 55 behavior tests, TypeScript and readiness lint pass.
All 25 native profiles replay identically and 644 retained evidence objects validate.
Coverage grows from 17 to 21 tools with profiles; 248 tools still have no profile.
The snapshot contains 33,747 occurrences and 122,672 edges. Reports/comparison
are regenerated against `214c7fc`: five historical profiles, 3,636 artifacts and
14,988 edges added, with no historical graph records removed or changed. All 269
tools remain hardfork-unassessed. Follow-up standards and specification reviews
confirm the fixes and retained source/root identities, with no remaining findings.
Implementation commits `6c72716` and `ad6f5ce` are local. Active snapshot storage
is 61.4 MiB; never-committed intermediate chunks and unreferenced failed-import
blobs were moved into ignored recovery state. All manifest-referenced evidence,
graph chunks and previously committed files remain retained.

Static export checkpoint: `NEXT_PUBLIC_BASE_PATH=/devx-updates npm run build --
--webpack` passes with 311 routes. The five affected tool pages contain the current
digest, unassessed status, explicit scope gaps, production roots or AdaLite's
failure, and base-path links. Dashboard snapshot/comparison identifiers match.
This uses the documented Webpack fallback for the execution environment's
previously observed Turbopack port restriction; it is not a new successful
Turbopack or browser-interaction check. Verified data and plan are committed
locally; nothing was pushed.

Next: continue prioritizing higher-level workflow gaps and prepare collected
consumer evidence for owner-launched integration/capability reviews. Daedalus's
Nix/native binaries and Cometa's bundled WASM are visible follow-up boundaries.
AdaLite needs corrected source and renewed pin review before another meaningful
collection attempt. Target-specific compatibility testing remains separately gated.

### Active continuation: capability review workflow

The next milestone closes the gap between package coverage and the higher-level
behaviors needed for later hardfork analysis (sections 6.3, 7 and 8). Implement
structured capability findings across manual import, evidence/decision history,
reports, filters and tool details. This follows ADR-1/ADR-2: collection and review
remain offline, with the site reading retained data at build time.

- [x] Add profile-scoped capability findings, checked source citations, explicit verification decisions, history, stale-source handling and replayable storage.
- [x] Expose capability findings and filters in static reports, tool pages, snapshot comparisons and JSON exports.
- [x] Prepare pinned source packets for Lace mobile, GovTool frontend, TyphonJS and Cometa; retain pending owner-launched reviews without inventing findings.
- [x] Validate behavior, review implementation, check static export/browser flows, and commit the milestone locally.

Capability vocabulary covers transaction construction, serialization, script
compilation/evaluation, synchronization/decoding, query, submission, signing,
wallet integration and governance. Findings default to suggested; exact citations
do not establish semantic truth. Only explicit evidence decisions verify claims.
Coverage stays partial, historical profiles retain their source identity, and
readiness stays unassessed. Target-specific compatibility remains out of scope.

Implementation checkpoint: structured capability findings require a native profile
and checked source citation at that profile's revision. Scope and conditions form
part of their identity; suggested/verified/disputed/rejected states retain explicit
decision history. Changed source is labeled historical rather than carrying claims
forward. Import remains transactional and idempotent; retained submissions replay
from their original packet state. Native rebuild refuses to discard capability
decisions. Existing snapshots without capability fields retain their digest.

Handoff checkpoint: four version-2 packets for Lace mobile, GovTool frontend,
TyphonJS and Cometa are pending. Thirteen additional source files are retained at
their exact revisions. `content/readiness/capability-reviews.json` records packet,
profile and evidence IDs; its companion Markdown provides scope questions and
offline regeneration commands. No manual discovery/challenge review was launched
and no capability claims were imported. Version-1 packets require re-export;
their old context is retained for history.

Verification checkpoint: all 59 readiness tests pass; TypeScript and scoped lint
pass. All 25 native profiles replay identically, and 657 evidence objects validate.
The new retained-submission replay test verifies capability import independently
from native graph replay. Reports and comparison against `e736e14` contain zero
artifact/edge/profile/capability changes: this milestone adds the review workflow
and its source evidence, not compatibility conclusions. Coverage remains 21 tools
with profiles, 248 without profiles, and all 269 hardfork-unassessed. Standards
review's named-index clarification and specification review's rejection of string
`"null"` conditions are fixed and confirmed. Implementation commits `a423d44` and
`5ef5e06` remain local.

Static/browser checkpoint: the `/devx-updates` production export passes with 311
routes using the documented Webpack fallback. Chromium checks pass against the
real static pages and isolated populated capability fixtures: desktop/mobile
filters, verification/source/scope distinctions, filtered downloads, decision
history, evidence anchors, pending-review empty states, base-path navigation,
document overflow and console errors. Screenshots were inspected. Fixture claims
were never inserted into retained catalog data. The real four consumer pages show
unassessed status, current snapshot identity and no returned capability findings.
Verified evidence, packet index, reports and handoff are committed locally; nothing
was pushed. Default Turbopack remains subject to the previously recorded local
port restriction and was not revalidated in this milestone.

Next: the owner can launch the prepared discovery/challenge reviews using
`content/readiness/capability-reviews.md`. Checked returned results can now enter
the pipeline as structured behavior findings and integration edges. Catalog-wide
collection, Cabal/native-artifact boundaries and the hardfork target/environment
remain separate open work; phase 3 is not complete merely because this workflow is.

## 1. Objective

Identify tools that may stop working after the next Cardano hardfork early enough to help their maintainers ship fixes. Explain each finding, identify the upstream components involved, and prioritize work that benefits the greatest number of affected tools.

The first deliverable is an evidence-backed, release-aware dependency and integration graph for every tool in this repository's catalog. Investigation of node 11.2 changes and compatibility testing follows later.

The governing rule is: **unknown is actionable work, never an implicit pass.**

Success means:

- Every cataloged tool has a coverage record, including tools that cannot be resolved.
- Dependency traversal is reproducible for a declared release and configuration.
- Shared artifacts are inspected once where their identity and context permit reuse.
- Every relationship has evidence, a scope, and a verification status.
- Maintainers can see which downstream tools depend on their components.
- Later readiness findings explain the affected capability, dependency path, and available remedy.

## 2. Starting point and scope

`data/cardano-graph.json` is the seed inventory. Its current metadata reports 269 tools and 248 relationships. These figures are a starting snapshot, not a permanent denominator. Each run records the exact catalog revision and computes its own counts.

The catalog includes repository, package, release, team, and relationship information. Treat these as discovery hints until verified. Existing relationships include `depends`, `backend`, `connects`, `compiles`, and `successor`; they do not all represent dependencies. In particular, succession must not contribute to dependency reach.

The existing `/map/table` and `/map/analysis` pages are natural entry points for future coverage and impact views.

### Initial scope

- Account for every cataloged tool, including archived, experimental, and source-unavailable tools.
- Discover its distribution artifacts, source revisions, package ecosystems, and maintainers.
- Resolve package dependencies and investigate service, protocol, build, and bundled dependencies.
- Record chain-facing capabilities without yet judging their compatibility with node 11.2.
- Produce coverage reports, dependency paths, reverse-dependency counts, and investigation queues.
- Provide written tasks and evidence packets for manually launched LLM discovery and review where deterministic extraction is insufficient.

### Later scope

- Map the target hardfork's changes to capabilities and components.
- Test a baseline, the upgrade transition, and post-fork operation.
- Track confirmed incompatibilities, fixes, released upgrades, and downstream retesting.

### Boundaries

- The initial catalog is the set of tools being assessed, not a claim to cover the entire ecosystem.
- Newly discovered dependencies enter the graph even if they are absent from the catalog. Promoting them to cataloged tools is a separate curation decision.
- A complete package resolution is not proof of complete integration discovery or hardfork compatibility.
- The project does not need a runtime graph database or live website backend for its first implementation.

## 3. Assumptions and decisions to confirm

| Topic | Proposed default | Consequence or open question |
|---|---|---|
| Release scope | Assess the latest stable release at snapshot time | Add older supported or widely deployed versions explicitly; confirm which ones matter with maintainers |
| Prospective fixes | Track development revisions and release candidates separately | A source fix does not mean users have an installable fix |
| Source of truth | Published artifacts and release build evidence, when available | A repository checkout or newly generated lockfile may differ from what shipped |
| Configuration scope | Start with documented production defaults and supported configurations | Platform, feature, and provider coverage must be explicit; no claim to explore every possible combination |
| Hosted services | Record endpoint/API contract and deployed version when discoverable | Unknown implementation or deployment versions remain coverage gaps |
| Access | Public evidence initially | Unavailable source or private deployment details require a documented gap or maintainer-supplied evidence |
| Tool identity | Preserve catalog IDs; verify repository and package aliases | Repository moves and monorepos must not create duplicate tools or collapse distinct artifacts |
| Refresh | Manual runs first, then scheduled and release-triggered refreshes | Agree on cadence after measuring cost and runtime |
| Maintainer contact | Use verified catalog contact information and corrections | Contact availability and response times are not guaranteed |
| LLM review | The project owner manually launches discovery and challenge passes using written task briefs | The pipeline exports evidence packets and imports results; no LLM API integration or launch orchestration is required |
| Hardfork target | Bind future assessments to exact node build, network configuration, and activation conditions | A node version alone does not define the full compatibility target |

Do not describe a tool as safe merely because it is inactive, has no resolved package dependencies, or does not connect directly to a node.

## 4. What the product looks like

### 4.1 Coverage dashboard

A table with one row per cataloged tool and drill-down by release/configuration:

- Tool, maintainer, assessed release, and artifact/source identity.
- Package-resolution coverage and integration-review coverage shown separately.
- Supported and assessed configurations, with exclusions and gaps.
- Chain-facing capabilities and providers.
- Direct dependencies and distinct downstream tools.
- Evidence freshness, last successful run, and latest attempted run.
- Next action, owner when assigned, and linked maintainer issue when available.

Filters include ecosystem, maintainer, capability, coverage gap, stale evidence, and impact. The denominator remains the full snapshot inventory, even when a filter hides entries.

### 4.2 Tool detail

Show a dependency-tree view backed by the shared graph. Users can expand package dependencies, switch configurations, inspect integration edges, and open the exact evidence for each relationship.

Display required, optional, build-time, and development dependencies distinctly. Show unresolved frontiers where traversal stopped and explain why. A tool with no dependencies needs supporting evidence, not an empty result from a failed collector.

### 4.3 Upstream impact view

For a component or release, show:

- Distinct cataloged tools that depend on it directly and transitively.
- Required exposure separately from optional or configuration-dependent exposure.
- A dependency path explaining each affected tool's inclusion.
- Version-specific reach and a deduplicated project-level summary.
- Whether the path is verified or contains a suggested relationship.

Provide tables and exports as well as a graph visualization. A large graph alone is not an actionable report.

### 4.4 Work queues

- **Coverage queue:** missing artifacts, unsupported ecosystems, resolution failures, unreviewed integrations, and stale evidence.
- **Investigation queue:** chain-facing components with high reach or material uncertainty.
- **Remediation queue, later:** confirmed failures, affected tools, maintainer issues, available fixes, released versions, and retest requirements.

An upstream finding can be grouped into one maintainer work item with many affected consumers. Preserve consumer-specific upgrade and retest tasks.

### 4.5 Snapshot comparison

Show new or removed dependencies, changed versions, new integration evidence, newly unresolved tools, and reach changes between snapshots. Explain whether a change came from a new release, configuration, collector version, or evidence correction.

## 5. Data model

Keep these concepts separate:

| Entity | Meaning |
|---|---|
| Tool | A user-facing catalog entry with a stable ID |
| Tool release | A particular published release or explicitly selected source revision |
| Artifact | A package, binary, container, source tree, or other identifiable distribution unit |
| Resolution profile | A declared platform, toolchain, feature, workspace, and configuration context |
| Dependency occurrence | An artifact as selected in a particular resolution context |
| Service/interface | A runtime service or protocol contract, potentially with an unknown implementation version |
| Relationship | A directed, typed edge from consumer to dependency or interface |
| Capability | Behavior such as transaction construction, chain decoding, or submission |
| Evidence | A source artifact, file location, command result, documentation excerpt, or maintainer statement |
| Gap | A known unanswered question, failed operation, or unsupported part of the scope |
| Snapshot | An immutable normalized result with catalog revision and collection provenance |
| Assessment, later | A compatibility finding for a release, profile, capability, and target environment |

A tool can have several artifacts; a repository can contain several tools. Package-to-repository and artifact-to-tool mappings are explicit, evidenced associations rather than name matching.

### Identity and reuse

An artifact identity includes ecosystem, canonical package name, version, source, and integrity hash or immutable revision where available. Unknown identity fields must not be replaced with invented precision.

A resolution cache key also includes the relevant root inputs, manifest/lock hashes, workspace configuration, registry/index state, resolver and collector versions, platform, toolchain, feature flags, patches, overrides, and peer bindings.

- Reuse fetching and static artifact inspection by exact artifact identity.
- Reuse resolved outgoing edges only when their relevant resolution inputs match.
- Keep all consumer edges when sharing work.
- Keep different versions, forks, and configurations distinguishable.
- Detect cycles and use strongly connected components where needed for ordering and reach calculations.

### Relationship fields

Record consumer, target, relationship type, dependency scope, condition/profile, declared constraint, resolved selection, and evidence references.

Useful types include package dependency, build/code-generation dependency, service/backend dependency, protocol interaction, and bundled/vendored dependency. Optionality is a separate condition, not a reason to discard an edge. Development/test scope is retained but excluded from production-runtime counts by default.

Relationship verification states:

- `verified`: supported by a native resolution result or checked, applicable source/documentation/maintainer evidence.
- `suggested`: plausible, cited relationship awaiting verification.
- `disputed`: conflicting evidence remains unresolved.
- `rejected`: reviewed and not applicable; retained in the decision history.

Also retain evidence origin and verification method. A numerical confidence score must not substitute for verification.

## 6. Collection and traversal pipeline

```text
Catalog snapshot
  -> release and artifact discovery
  -> manifest, workspace, and configuration discovery
  -> native package resolution
  -> normalized artifact/occurrence graph
  -> integration and capability discovery
  -> optional manually launched two-pass review
  -> evidence verification and gap reconciliation
  -> coverage, impact, and snapshot validation
  -> reviewed published snapshot
```

### 6.1 Discover the assessment roots

Resolve repository redirects and aliases. Identify published releases, artifact digests, source revisions, workspaces, and supported production entry points. Preserve uncertainties between a published release and its presumed source.

Assess each cataloged tool independently as a root. Shared repositories and artifacts can reuse discovery work without losing separate tool coverage records.

### 6.2 Resolve in the consumer's context

Use each ecosystem's native resolver or build plan. A dependency's own repository lockfile describes its development environment, not necessarily the dependencies selected by its consumer.

Extract the root's complete selected package closure. Follow newly discovered integration or separately built artifact boundaries as additional scoped work items. Do not replace a consumer's dependency selection with an independent resolution from an upstream checkout.

| Ecosystem | Expected evidence and important context |
|---|---|
| npm, pnpm, Yarn | Native lock/resolution data, workspace links, peer bindings, optional/platform selection, and package-manager version |
| Rust | `Cargo.lock`, Cargo metadata, selected features/targets, patches, and workspace configuration |
| Haskell | Cabal build plan, compiler/flags, package index state, CHaP or other repositories, source overrides; Stack configuration where applicable |
| Go | Selected module graph, replacements, build tags, and toolchain; `go.sum` alone is not a lockfile |
| Python | Locked resolution or installation report, interpreter/platform, extras, markers, and indexes |
| Nix and containers | Pinned inputs, derivation/build evidence, image digests, and available package inventories; input locks alone do not enumerate every shipped package |
| Other ecosystems | Detect immediately, register a coverage gap, and add collectors according to actual catalog needs |

Distinguish observed release-build resolution from reconstructed source resolution. For missing locks, capture the generated resolution and registry inputs, but do not claim it represents a previously shipped artifact.

Prefer metadata-only operations. When resolution requires running project build logic, use disposable workers without publishing credentials. Capture commands, environment identifiers, exit status, and diagnostics as evidence.

### 6.3 Find non-package dependencies and capabilities

Inspect build scripts, container definitions, CI configuration, source imports and calls, generated bindings, downloaded binaries, documentation, and maintainer evidence.

Look for node interfaces, hosted providers, indexers, wallet integrations, embedded WASM, vendored code, and code generators. Distinguish supported integrations from integrations enabled in a particular deployment.

Record direct implementations of chain-sensitive behavior too. Initial capability vocabulary includes transaction construction, serialization/deserialization, script compilation/evaluation, chain synchronization/decoding, query, submission, wallet signing/integration, and governance operations. Extend this vocabulary as evidence requires.

### 6.4 Traverse to a documented stopping point

Use a persistent work queue with pending, running, succeeded, failed, and deferred states. Failed work remains retryable; it is not treated as successfully visited. Coalesce concurrent work with identical cache keys.

Each discovered dependency is either resolved, a justified leaf, an explicit opaque boundary, or an unresolved frontier. Unsupported resolvers, unavailable source, inaccessible artifacts, and time/resource limits must produce gaps.

Complete native package closures regardless of whether packages appear Cardano-related. Apply risk-based prioritization to deeper integration review without silently pruning low-priority dependencies from coverage.

### 6.5 Normalize and preserve evidence

Produce stable IDs, canonical ordering, schema versions, and a semantic snapshot digest. Keep run timestamps and operational metadata separate from the semantic digest so unchanged captured inputs yield the same normalized graph.

Store compact normalized snapshots and evidence indexes in the repository. Store bulky locks, logs, archives, and build plans in content-addressed artifact storage with a retention policy and checksums. Decide the storage location before the first full run; expiring CI logs alone are insufficient for replay.

## 7. Manually launched two-pass review

LLMs supplement deterministic collectors by examining evidence that is difficult to normalize, especially runtime integrations, vendored code, release mappings, and undocumented configuration. They do not replace package resolution or establish compatibility by inference alone.

The project owner decides when to run each pass and launches it using [the review task briefs](./DEPENDENCY-REVIEW-TASKS.md). Implementation scope is limited to producing review packets, validating/importing submitted results, and recording evidence decisions. There is no LLM API client, provider integration, automatic launch, or paid-review scheduler to build.

### Pass one: discover missing relationships

Input: a pinned source/evidence bundle, the current normalized subgraph, known gaps, and a structured extraction schema.

Output:

- Candidate relationships with exact file/line or document references.
- Candidate artifact aliases, capability tags, and integration conditions.
- Contradictions and questions for maintainers.
- Explicit statements of insufficient evidence.

### Pass two: challenge the proposed graph

Use a fresh review context over the original evidence, existing graph, and first-pass proposals. Check for missed dependencies, incorrect aliases, optional integrations labeled as mandatory, example/test code mistaken for runtime behavior, unsupported version claims, and missed bundled artifacts.

Agreement between two passes is not verification. Both passes may make the same mistake.

### Admission and reproducibility

- Require structured output validated against the schema.
- Check that cited evidence exists at the pinned revision and supports the claimed scope.
- Promote suggestions only through a deterministic check or explicit evidence review; ambiguous cases remain suggested or disputed.
- Show verified reach separately from potential reach through suggested edges. Surface high-impact suggestions promptly in the investigation queue.
- Treat repository prose as source material, not as instructions for the review process.
- Record task-brief/schema version, packet ID, input hashes, submitted output, and review decisions as provenance.
- Reuse accepted review results for unchanged evidence and scope; flag changed inputs for the project owner to consider rerunning.
- Use one discovery pass and one challenge pass by default. Further investigation is a separately scoped task, not an automatic loop.
- Incomplete or unreturned tasks remain pending and visible in the coverage queue.

LLM generation itself is not guaranteed to be deterministic. Reproducibility means replaying submitted outputs and accepted decisions into the same graph. The collection pipeline remains usable when no manual review has been launched or returned.

The published graph is a versioned evidence snapshot, not a permanently final graph. New releases and corrections produce new snapshots.

## 8. Coverage, impact, and prioritization

### Coverage is multidimensional

For each release/profile, record artifact identification, package resolution, integration review, and capability review separately using `complete`, `partial`, `unresolved`, or `not-applicable`, with a reason and evidence.

`complete` means complete against the declared scope and checklist. It does not claim knowledge of all private deployments or every possible runtime configuration. `not-applicable` requires justification. Unknown supported configurations remain visible as gaps rather than disappearing outside the denominator.

Readiness is a separate, initially unassessed field. Later states can include `unassessed`, `potentially-affected`, `confirmed-blocked`, and `verified-compatible`, scoped to the tested capability/profile/target. Aggregate tool summaries must expose mixed or incomplete results.

### Impact calculation

For a component, reverse-traverse eligible dependency edges and count distinct cataloged tool IDs. Exclude the component's own catalog identity from its downstream-tool count. Deduplicate multiple paths, multiple artifacts of the same tool, and cycles.

Compute required production, optional/configuration-dependent, build-time, and development/test reach separately. A required path takes precedence over an optional path for the same tool within a profile. Project-level reach is the union of tools across component versions, not the sum of version counts.

Store at least one explanatory path per included tool and preserve the graph for further path inspection. Reach is measured only against the declared catalog and graph coverage; it is not ecosystem market share.

### Prioritization

For catalog rollout, prioritize higher-level consumers that add coverage of
transaction construction, wallet signing/integration, submission, query, and
application workflows. Their selected closures expose shared upstream components
in consumer context. Use supported collectors as a feasibility check or tie-breaker;
unsupported high-priority tools remain visible work rather than silently falling
behind easy-to-collect lower-level roots. Keep the selection rationale explicit.

Initially rank investigation using chain-facing capability, verified downstream reach, potential reach, and evidence gaps. Show these factors rather than hiding them in an unexplained score. High reach is not a failure finding, and missing evidence is not low risk.

Later add confirmed severity, affected workflows, available release fixes, deployment/adoption evidence, maintainer lead time, and proximity to activation. An upstream failure marks consumers potentially affected until its applicability to their required behavior is established.

## 9. Architecture and repository integration

Use a collection pipeline separate from the website build. The website reads committed, validated snapshots without contacting package registries or running resolvers.

This follows existing decisions in `docs/ARCHITECTURE.md`:

- **ADR-1:** keep the site fully static; collection runs offline or in CI.
- **ADR-2:** keep normalized product data and reviewable changes in the repository.
- **ADR-3:** evidence supports authored deliverable status; readiness evidence does not overwrite initiative progress.
- **ADR-4:** retain a curated root catalog. Transitive discovery expands the dependency graph, not the activity gatherer's repository list. Document this scoped extension before implementation.
- **ADR-8 and ADR-9:** publish snapshot changes through reviewed changes and the existing deployment flow. Scheduled discovery must not depend on weekly editorial timing.
- **ADR-10:** public evidence remains the default. Manually launched reviews require no new LLM credentials or service integration in the collection pipeline.

Proposed module boundaries:

| Module | Responsibility |
|---|---|
| Catalog/release discovery | Identify roots, aliases, releases, and artifacts |
| Resolver adapters | Produce native resolution evidence and normalized occurrences |
| Evidence store | Retain immutable inputs and collection provenance |
| Graph engine | Merge identities, preserve contexts, traverse, calculate reach, and compare snapshots |
| Integration review | Extract non-package relationships, export manual task packets, and import suggestions/decisions |
| Reporting | Produce coverage tables, investigation queues, and static-site projections |
| Compatibility harness, later | Run scoped scenarios and attach test evidence |

Proposed paths, subject to implementation review:

```text
docs/HARDFORK-READINESS-PLAN.md
scripts/readiness/                 collection entry points and orchestration
lib/readiness/                     schemas, graph operations, adapters, reporting
data/readiness/                    normalized snapshots, indexes, and decisions
content/readiness/                 curated profiles, overrides, and assessments
```

Initially keep the existing tooling map intact and link records by catalog ID. Avoid replacing its descriptive relationships with resolved package edges until the new graph has validated coverage and consumers are migrated deliberately.

## 10. Development plan

Deliver vertical slices with acceptance gates. Do not wait for all ecosystem collectors to exist before exposing missing coverage or high-impact findings.

### Phase 1: inventory and contracts

Deliver:

- Schema and terminology for roots, artifacts, profiles, edges, evidence, gaps, and snapshots.
- Inventory/discovery command that accounts for every catalog entry and detects ecosystems/workspaces.
- Release-selection policy, initial configuration profiles, and verified identity overrides.
- Baseline coverage report and collector backlog based on discovered ecosystems.

Acceptance:

- Every catalog ID is accounted for exactly once at tool level.
- Missing repositories, ambiguous releases, and unsupported ecosystems appear as explicit gaps.
- Original catalog entries remain traceable and count totals reconcile.
- Confirm initial supported-version policy, artifact storage, and operational ownership.

### Phase 2: end-to-end native-resolution pilot

Choose a small, representative set based on phase-one discovery: shared dependencies, multiple versions, a monorepo, and more than one ecosystem. Prefer coverage of JavaScript/TypeScript, Rust, and Haskell if the inventory confirms their relevance.

Deliver:

- Initial native adapters, immutable evidence capture, persistent queue, and cache.
- Complete package closure for declared pilot profiles.
- Normalized snapshot, per-tool dependency paths, and reverse-reach report.

Acceptance:

- Cross-check each pilot graph against native resolver/build output.
- Replay captured inputs to obtain the same semantic graph digest.
- Shared artifact work is reused while distinct profiles and versions retain correct edges.
- An interrupted run resumes; failed tasks remain visible and retryable.

### Phase 3: catalog-wide coverage and integration discovery

Deliver:

- Adapters prioritized by catalog coverage and chain-facing relevance.
- Scanning for service, protocol, build, vendored, and downloaded-artifact dependencies.
- Capability inventory, maintainer mappings, documented opaque boundaries, and coverage queue.
- Written discovery and challenge tasks, evidence-packet export, result import/validation, and decision history for manually launched reviews.

Acceptance:

- Every catalog entry has a current coverage result, even when unresolved.
- Every discovered target is resolved, a justified leaf/boundary, or an explicit frontier.
- Suggested or disputed edges cannot silently enter verified impact counts.
- The pipeline and reports work before any manual review has been returned.
- Native output and representative integration findings receive evidence-based spot checks.

### Phase 4: impact reporting and site views

Deliver:

- Coverage dashboard, tool detail, upstream impact, and investigation queues.
- Filters, evidence links, exports, and snapshot comparisons.
- Maintainer work-item summaries with version-specific paths and suggested next actions.

Acceptance:

- Required, optional, build-time, and suggested exposure are distinguishable.
- Reach counts distinct tools correctly across diamond paths, multiple versions, and cycles.
- Every displayed inclusion can be explained with a path and evidence.
- The static build uses only committed inputs, and new views are checked in a real browser.

### Phase 5: recurring operations

Deliver:

- Scheduled collection, explicit refresh/retry commands, and release-change detection.
- Reviewable snapshot diffs, freshness reporting, cache invalidation, and artifact retention.
- Collector runtime/storage measurements, pending manual review packets, and ownership of unresolved work.

Acceptance:

- An unchanged evidence bundle reuses artifact inspection and accepted manual findings rather than creating duplicate review work.
- A changed release or relevant resolver input invalidates the appropriate work.
- A failed refresh exposes the failure and age of the last successful result.
- Published snapshots can be reconstructed from retained evidence and decisions.

### Phase 6: hardfork assessment and remediation

Begin detailed design when the target changes and test environment are ready. Coverage gaps should continue to be closed in parallel with compatibility assessment.

Deliver:

- Change-to-capability mapping for the selected hardfork target.
- Baseline, transition, and post-fork scenarios per relevant release/profile.
- Evidence distinguishing pre-existing failures from target-specific failures.
- Confirmed and potential impact paths, maintainer issue references, released-fix tracking, and downstream retests.

Acceptance:

- Compatibility claims identify exact artifacts, profiles, workflows, target configuration, and test evidence.
- A successful build or node startup alone cannot establish readiness.
- Unrelated or unknown capabilities are not marked compatible by association.
- A source fix, published fix, consumer upgrade, and verified downstream result remain distinct milestones.

Phase order: 1 -> 2 -> 3 -> 4 -> 5, with phase 6 enabled by useful graph coverage and an available target. Initial impact reports arrive in phase 2; actionable findings do not wait for the final dashboard. Set calendar estimates after the pilot measures resolver complexity and catalog coverage.

## 11. Verification strategy

Use representative fixtures and recorded native outputs to verify behavior, rather than tests that simply mirror the implementation.

Required cases include:

- Two tools sharing one exact artifact and a third selecting another version.
- The same version resolving differently under features, peer bindings, patches, or platform conditions.
- A consumer's selected closure differing from an upstream development lockfile.
- Monorepo workspaces, source dependencies, aliases, and registry replacements.
- Diamond paths and cycles without double-counted downstream tools.
- Optional, build-only, and test-only paths remaining distinguishable.
- Missing source, failed resolution, unsupported ecosystem, and truncated work producing gaps.
- Suggested edges with invalid citations or conflicting evidence remaining unverified.
- Changed inputs invalidating cached work; unchanged captured inputs replaying identically.
- Later, baseline failures and target-specific failures receiving different findings.

Track progress with coverage and evidence metrics: tools accounted for, releases identified, package closures resolved, integrations reviewed, unresolved frontiers, stale assessments, and high-impact work items with an owner. Avoid presenting dependency counts or collector success rates as readiness percentages.

## 12. First implementation milestone

The first useful deliverable is a reproducible command that reads the current catalog, emits a coverage record for every tool, resolves a representative cross-ecosystem pilot, and reports which upstream components have the most distinct downstream cataloged tools.

That milestone establishes the schema, evidence discipline, deduplication behavior, and real collector effort. It provides an actionable investigation queue before investing in the full dashboard or hardfork-specific test harness.
