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

## Higher-level workflow batch

`workflow-batch.json` prioritizes missing user workflows over collector convenience,
as agreed in `docs/HARDFORK-READINESS-PLAN.md`. The existing batch already includes
transaction SDKs and wallet connectors; this batch adds a wallet application,
governance application, another transaction framework, Hydra workflows, and a
multi-DEX consumer. This is a coverage selection, not an adoption ranking.

| Tool / workflow | Selected production root | Pinned source/configuration caveat |
| --- | --- | --- |
| Lace / mobile wallet, signing and sending | `lace-mobile` in `apps/lace-mobile` | `lace-mobile@2.4.0` matches manifest and npm v3 workspace-lock version 2.4.0. Browser-extension, installed iOS/Android native dependencies, hardware devices, and hosted provider configurations remain outside this profile. |
| GovTool / governance actions and wallet interaction | `@govtool/frontend` in `govtool/frontend` | Repository release v2.0.36 contains frontend manifest/lock version 2.0.29; retain both identities. npm v3 frontend scope only; the Haskell backend, metadata service, deployment flags, container inventory, and postinstall patches are unresolved boundaries. |
| Evolution SDK / transaction construction | `@evolution-sdk/evolution` in `packages/evolution` | Manifest version 0.6.0 at `@evolution-sdk/devnet@3.0.21`; the tag belongs to devnet and does not establish the SDK's published release. pnpm v9 lock, pnpm 9.0.0 declared. Provider integrations and direct chain-sensitive implementation need review. |
| Hydra SDK / Head interaction and transaction construction | `@hydra-sdk/core`, `@hydra-sdk/transaction`, `@hydra-sdk/bridge` | Core tag/manifest 1.5.0; transaction 1.2.3 and bridge 2.0.2 share that source revision without independently verified release mappings. pnpm v9 lock produced under declared pnpm 10.5.2. Hydra node deployments, network configuration, and WASM build correspondence remain unresolved. |
| Dexter / multi-DEX swaps and pool queries | `@indigo-labs/dexter` | Manifest/npm v3 lock version 5.4.9 on discovered default-branch source; no stable GitHub release identified. DEX contracts, hosted provider deployments, and enabled integrations require separate evidence. |

All five profiles use the all-lockfile-targets scope. Package closures do not
establish installed platform selection, published artifacts, runtime integration
coverage, or hardfork compatibility. No install or project build scripts run.
Missing and ambiguous workspace identities remain resolution gaps. Unsupported
production roots such as Blaze's main SDK remain queued for adapter work; its
nested WASM Cargo manifest must not stand in for whole-SDK coverage.

Run `node --import tsx scripts/readiness/cli.ts collect-batch --input
content/readiness/workflow-batch.json --limit 2` to advance the batch, or select
one request with `--tools lace --limit 1`. Validate and replay separately before
regenerating reports and committing the milestone.

## Yarn wallet and SDK batch

`yarn-batch.json` extends production coverage into an unsupported package manager
instead of substituting incidental npm/Cargo manifests. These roots add web and
full-node desktop wallets, wallet-oriented transaction construction, native/WASM
bindings, and an SDK using several chain-data providers.

| Tool / workflow | Selected production root | Pinned source/configuration caveat |
| --- | --- | --- |
| AdaLite / web wallet and server | `adalite-app`, `adalite-server` | Repository/root package 7.0.2, application manifest has no version, server manifest 6.18.1. Yarn 4.17.1 / lock metadata 10. Collection is blocked by conflicting lock identity: `js-tokens` declares `0.0.0-use.local` but resolves to `npm:4.0.0`. No profile is accepted; the request remains retryable pending corrected, verified source. Root build orchestration, deployed backend/providers and hardware-wallet behavior remain unassessed. |
| Daedalus / full-node desktop wallet | `daedalus` | Source tag and manifest 11.5.0; declared Yarn 1.22.21, Classic v1 lock. JavaScript closure only: Nix inputs, bundled cardano-node/cardano-wallet, Electron/native rebuild output and platform installers need separate collection. |
| TyphonJS / wallet transaction construction | `@stricahq/typhonjs` | Source tag/manifest 4.0.0; Yarn 4.13.0 / lock metadata 8. Published package correspondence and direct transaction/serialization behavior need evidence. This is the library profile, not a Typhon wallet deployment. |
| Cometa / native-backed transaction SDK | `@biglup/cometa` | Source tag/manifest 1.2.0; Classic v1 lock, producing Yarn version unspecified. The manifest has no runtime npm dependencies; README/build scripts describe compiled, compressed and inlined libcardano-c WASM. The native runtime is an unresolved bundled-artifact boundary, not a dependency-free compatibility pass. |
| Cardano Web3 / query and transaction SDK | `cardano-web3-js` | Source tag/manifest 2.3.4; Classic v1 lock, producing Yarn version unspecified. Declared Koios/Kupo/Ogmios clients and cardano-wasm-libs are captured; actual provider deployments and WASM artifact correspondence need separate review. |

All captures retain exact source, manifest and lock evidence without installing
dependencies. Classic declarations and modern workspace manifest scopes remain
distinct; missing selectors, optional platform conditions, peer bindings, opaque
sources and release correspondence remain visible gaps. Modern Yarn registry
locators retain their registry identity and cache checksums are not tarball hashes.

Run `node --import tsx scripts/readiness/cli.ts collect-batch --input
content/readiness/yarn-batch.json --limit 2`, or select individual tools with
`--tools`. Successful requests register for scheduled native refresh; other work
stays pending or retryable. The operation remains local until separately reviewed
publication.

## Additional wallets and contract workflows

`wallet-batch.json` selects five more higher-level consumers at already discovered
immutable revisions. Every request explicitly names its npm lock and production
package paths. `rootPaths` are relative to that lock (`.` means its root); names
and paths must both match. This disambiguates Cardano Connect with Wallet's React
package from the same-named monorepo orchestration root. Unselected lock records
remain retained, but are not added as production roots.

| Consumer | Selected package paths | Source/configuration caveat |
| --- | --- | --- |
| Nami | `.` / `nami-wallet` | Default-branch source, no stable release identified. Manifest 3.9.6, npm lock 3.9.5; dependency declarations agree. Manifest declares Yarn 1.22.21, while README documents npm installation. The committed npm graph is one source reconstruction; the authoritative release lock, browser bundle, vendored signing WASM and provider deployment remain unresolved. |
| Yoroi mobile | `.` / `yoroi-v2`, relative to `mobile/package-lock.json` | Source tag v7.0.5 and mobile manifest 7.0.5, lock root 7.0.4; dependency declarations agree. Expo/native iOS and Android output, patches, hardware wallets and runtime providers need separate evidence. Repository scripts and other applications are not selected roots. |
| Veridian Wallet | `.` / `veridian-wallet` | Source tag, manifest and lock agree on 1.2.2. Capacitor native builds, KERIA, witnesses and deployed services remain outside the npm graph; the sample dApp is not an application root. |
| Marlowe TS SDK | `packages/runtime/lifecycle`, `packages/wallet`, `packages/language/core/v1` | Selected `@marlowe.io` packages and source tag are 0.4.0-beta; retain prerelease identity. Root declares npm 9.3.1. Marlowe Runtime/backend deployments and wallet configuration need review; documentation, examples and testing packages are not selected roots. |
| Cardano Connect with Wallet | `core`, `react` | Source tag `cardano-connect-with-wallet-v0.2.22`; core manifest 0.2.12 vs lock 0.2.11, React manifest 0.2.22 vs lock 0.2.21. Dependency declarations agree in both. Preserve lock versions and release discrepancies; injected wallets, peer connections and enabled browser/mobile integrations need separate review. |

All five use npm v3 locks and `all-lockfile-targets`. No package installation or
consumer build scripts run. These partial profiles do not prove shipped artifact
identity, enabled capabilities or hardfork compatibility. Manifest/lock version
differences remain explicit gaps instead of being silently corrected.

```sh
node --import tsx scripts/readiness/cli.ts collect-batch --input content/readiness/wallet-batch.json --limit 2
```

Use `--tools` to bound an individual run; validate and replay before reports and
publication. Existing manually launched reviews remain separate; the owner guide
is [Run the prepared reviews](../../docs/RUN-PREPARED-REVIEWS.md).
