# Selected catalog collections

`catalog-batch.json` records explicit source/configuration choices for a bounded
phase-3 rollout. Revisions come from the existing discovery snapshot. Package
names and lock formats were checked in manifests at those exact revisions.
These are source reconstructions; none establishes the contents of published
artifacts, deployed configurations, or hardfork compatibility.

| Tool | Selected production root | Source/configuration caveat |
| --- | --- | --- |
| Cardano Peer Connect | `@fabianbormann/cardano-peer-connect` | v1.2.21 matches root manifest/lock version 1.2.21; npm v3 lock, all lockfile targets |
| Helios | `@helios-lang/compiler` | Manifest version 0.17.33 on the discovered default branch; no stable GitHub release identified; pnpm v9 lock |
| Minswap SDK | `@minswap/sdk` | v0.5.0 matches root manifest 0.5.0; pnpm v9 lock and pnpm 9.10.0 declared in package manifest |
| Weld | `@ada-anvil/weld` in `core` | Core manifest/lock version 0.7.0 at the plugin release `@ada-anvil/weld-plugin-hodei@0.0.10`; not a verified release mapping for core; npm v3 workspace lock |
| Dingo | `github.com/blinklabs-io/dingo` | v0.84.0; Linux/amd64, cgo disabled, all module packages and tests; go.mod requires Go 1.26.8 and recommends toolchain 1.26.9; the collector prohibits automatic toolchain downloads |

JavaScript locks include development and optional selections; they do not prove
installed platform applicability. Runtime services, protocol boundaries, native
bundles, and capability reviews remain unresolved. Collection failures are kept
in `data/readiness/collection-queue.json` and the tool's resolution gaps.

Run `npm run readiness -- collect-batch --input content/readiness/catalog-batch.json
--limit 2` to advance a small batch. Use `--tools id,id` for an individual retry.
If source discovery changes a selected revision, verify the new manifests before
updating the request. See `docs/READINESS-OPERATIONS.md` for resume semantics.
