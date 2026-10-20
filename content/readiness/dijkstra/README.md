# Dijkstra change, boundary, classification and lead registers, and the unlock report

`changes.json` lists what the Dijkstra hard fork (protocol version 12) changes,
which **surface** each change touches, when it takes effect, and the exact source
lines it rests on. It is the input for the boundary register (R2) and the
classification of catalog tools (R3) in the
[plan revision](../../../docs/HARDFORK-READINESS-PLAN.md#plan-revision-2026-10-19-change-first-assessment).

## What it is pinned to

cardano-node 11.2 has no tag yet. Components are taken from the open integration
branch ([#6677](https://github.com/IntersectMBO/cardano-node/pull/6677),
`34ae34db`; [#6736](https://github.com/IntersectMBO/cardano-node/pull/6736)
stacks on it with identical pins). For each package the register records the
newest CHaP version available at the branch's index-state
(`cardano-haskell-packages 2026-10-09T14:30:01Z`) and the upstream commit CHaP
built it from. These versions satisfy the branch's bounds, but no build plan was
solved; re-check them when 11.2 is tagged.

| Component | Version | Source commit |
| --- | --- | --- |
| cardano-ledger-dijkstra / -conway | 0.4.0.0 / 1.24.0.0 | `54e24ba4` |
| ouroboros-consensus | 5.1.0.1 | `4ab9e250` |
| ouroboros-network | 1.3.0.0 | `2fb69829` |
| plutus-ledger-api | 1.71.0.0 | `261766ad` |
| cardano-api | 11.8.0.0 | `b0afab8b` |
| cardano-cli | 11.3.0.0 | `b8bbda76` |

The baseline is node 11.1.3 (ouroboros-consensus 4.2.1.0, `82ecba32`). Feature
scope and activation follow the Hard Fork Working Group's
[Dijkstra scope](https://github.com/IntersectMBO/cardano-node/issues/6634), retrieved 2026-10-19.

## Changes by surface

| Surface | Changes | Typical tools exposed |
| --- | --- | --- |
| node-to-client-protocol | `n2c-only-v23` | Local chain-sync/query/submit clients and libraries |
| era-identity | `era-dijkstra` | Anything with a closed era list |
| block-encoding | `block-body-non-segregated`, `header-version-info`, `leios-peras-consensus` | Chain followers, indexers, explorers |
| transaction-encoding | `mempool-tx-is-valid`, `nested-transactions`, `guards`, `account-enhancements`, `removed-encodings`, `mempool-cross-era` | Serialization libraries, transaction builders, wallets |
| transaction-rules | `nested-transactions`, `account-enhancements`, `plutus-legacy-mode`, `withdrawal-drep-requirement` | Builders, wallets, dApps |
| plutus-language / plutus-script-context | `plutus-v4`, `guards` | Script languages, evaluators, cost-model handling |
| protocol-parameters | `protocol-parameters`, `plutus-v4` | Query clients, fee calculators, governance tools |
| stake-pool-registration | `pool-bls-key` | Pool explorers/registries, SPO tooling |
| cardano-cli / cardano-api-haskell | `cli-dijkstra` | Operator scripts, Haskell consumers |
| consensus-participation | `leios-peras-consensus` | Block producers |
| node-configuration | `dijkstra-genesis-config` | Configuration and genesis generators, devnet tools, SPO tooling |

`query-pparams-encoding` also touches protocol-parameters and node-to-client:
local-state-query answers for current and future protocol parameters grow from
Conway's 31 positional fields to 54.

## Findings that need attention first

1. **Node-to-client V23 only (`n2c-only-v23`).** 11.2's consensus drops V16–V22.
   Clients that cannot negotiate V23 disconnect as soon as a node upgrades,
   *before* the fork activates. This is the earliest break in the timeline.
2. **Every block decoder breaks at the fork.** The block body is no longer
   segregated, `invalid_transactions` is gone, and the header replaces
   `protocol_version`.
3. **Conway-built transactions can fail after the fork.** Consensus re-decodes
   older-era transactions as Dijkstra (`mempool-cross-era`), and Dijkstra drops
   certificate types 0/1 and array-encoded redeemers (`removed-encodings`). At
   the pinned commit, `cardano-cli latest` still builds Conway transactions.
   Which real transactions survive must be confirmed on a devnet (R4).
4. **Closed enums.** New native-script type 6, redeemer tag 6, script/language
   tag for PlutusV4, body keys 23–27, witness key 8, parameter keys 34–56.

## Checked and unchanged

`unchanged` in `changes.json` cites areas read at the target and found unchanged:

- **Node-to-node versions** (`node-to-node-versions`): node 11.2 offers V14–V16
  with V15 as latest released, exactly like node 11.1. Peras diffusion is behind
  consensus feature flags and the node starts with none, so relays and
  alternative node implementations see no node-to-node change at the upgrade.
- **Local-state-query set** (`query-set`): only Shelley query version 15 inside
  V23, as before. Answers change shape with the era instead
  (`query-pparams-encoding`).

## Devnet setup (R4)

`dijkstra-genesis-config` is what a Dijkstra devnet needs: the node reads
`DijkstraGenesisFile` and `TestDijkstraHardForkAtEpoch` only with
`ExperimentalHardForksEnabled: true`, which also makes it forge protocol
version 12. cardano-testnet's default configuration leaves that flag off since
PR 6541, so a `--dijkstra-era` testnet must set it explicitly. The genesis file
holds the 24 upgrade parameters, including the PlutusV4 cost model as an array.

## Not yet covered

- JSON representations in cardano-api/cli beyond the era commands.

## Boundary register (`boundary.json`)

`boundary.json` records the 61 catalog components that implement a changed
surface directly, observed at their default-branch heads on 2026-10-19 (Koios,
Blockfrost RYO, Ogmios, Kupo, db-sync and Kuber re-observed on 2026-10-20), with
a status for each surface group: `gap` (cited code cannot work against the
target), `no-evidence` (nothing found; never a pass), `tracked`, `in-progress`,
`released` and `verified` (R4). `in-progress` needs visible work toward the
target definitions (a branch, an open pull request or unreleased code); a
release built only against superseded Dijkstra definitions, with no such work,
is a `gap`. A component counts as its worst status. Source
evidence is pinned like the change register; issue and pull-request evidence
records URL, state and date.

| Worst status | Components |
| --- | --- |
| gap | cardano-wallet, Adder, ouroboros-miniprotocols-ts (node-to-client); Hydra (stops at the fork); CSL (no PlutusV4); cardano-js-sdk and cardano-c (protocol parameters); Scalus (V4 evaluation); Ogmios, Kupo, db-sync and Kuber (released only against superseded definitions, no work toward 11.2); Koios and Blockfrost RYO (era tables end at protocol 11, Conway-only parameters) |
| no-evidence | 35 components, including CML, cardano-client-lib, PyCardano, Oura, Dolos, Mithril, cncli, Aiken, OpShin, Helios, Plutarch, Mesh, Lucid Evolution and both hardware-wallet libraries |
| tracked | Apollo |
| in-progress | Pallas, Yaci, Amaru, Dingo, yaci-store, UTxO RPC, Blaze, Yaci DevKit |
| released | Gouroboros, Plutus, plutigo |

What it shows:

1. **Node-to-client breaks are concrete and early.** cardano-wallet proposes
   only V16–V22, ouroboros-miniprotocols-ts defaults to V16–V19, and Adder pins
   gouroboros v0.209.0 (V21 at most). gouroboros added V23 only in v0.213.0
   (2026-10-14), so every Go consumer below it is exposed; Pallas has offered
   V23 since v0.35.1.
2. **"Supports Dijkstra" usually means an earlier Dijkstra.** cardano-ledger-dijkstra
   0.2.0.1 (Ogmios 7.0.0, Kupo 2.12, db-sync main) and 0.3.0.0 (cardano-wallet)
   still have the segregated block body and the old header; Pallas 1.4.0 and
   cardano-c main lack the newest parameter keys and the PlutusV4 witness key.
   Only gouroboros's vendored CDDL (v0.213.0 and later) matches the target.
3. **Most of the boundary has nothing yet.** CSL, CML, cardano-client-lib,
   PyCardano, Aiken and the other script compilers show no Dijkstra work, and
   the chain followers built on Pallas (Oura, Dolos, Mithril) wait for a Pallas
   release with Dijkstra traversal.

## Classification of all catalog tools (`classification.json`)

`classification.json` records, for every one of the 269 catalog tools, which
changed surfaces it touches, through which channel, and the readiness it
inherits. Each tool's repository was scanned at its default-branch head:

- **implements**: the tool is a boundary component (R2) or the 11.2 component
  set itself (cardano-node, cardano-cli, cardano-submit-api, cardano-testnet).
- **dependency**: a manifest depends on a boundary component or on the Haskell
  ledger/consensus/API packages. When R2 names the release that added a
  surface's support, a version constraint that cannot reach that release is a
  `gap` (Go pins exactly, Cargo and Poetry default to caret, Cabal `^>=` is a
  PVP major, lower bounds never count). Haskell pins of cardano-api,
  cardano-ledger, ouroboros-consensus/-network and plutus-ledger-api are
  compared the same way with the 11.2 component-set versions above.
- **service**: code calls Blockfrost, Koios, Maestro, Ogmios, Kupo, db-sync,
  UTxO RPC/Dolos, the cardano-wallet API, a node socket, cardano-cli commands
  or the submit API.
- **marker**: closed era lists, PlutusV3 enums, cost models, raw CBOR codecs,
  segregated block-body fields, legacy stake certificates, script context,
  pool registration, node-to-client code or node configuration and genesis
  files (35 tools, among them Guild Operators, Yaci DevKit, Hydra, Mithril,
  Dandelion and Plutip). Markers show a surface is touched
  but never set readiness.

Prose (docs, READMEs, changelogs) and comments in manifests never establish
exposure. Tests, examples, benchmarks, demos, playgrounds and workshops are
**auxiliary**: their hits are kept with `scope: "auxiliary"` but never set
readiness, and a tool coupled only there has exposure `auxiliary`. So are
development-only manifest declarations: a published npm library's
`devDependencies` (applications bundle theirs and keep them shipped), Cargo
`dev-dependencies`, Cabal `test-suite`/`benchmark` stanzas, Gradle test
configurations and Maven test scope. Every hit
records path, line and a quote at the scanned revision; dependency hits also
keep up to twelve versioned manifest lines (`pins`) for the constraint checks.
Each scanned tool records whether its repository is archived and when it was
last pushed.

| Exposure | Tools |
| --- | --- |
| implements | 65 |
| dependency | 86 |
| service | 45 |
| auxiliary only | 4 |
| marker only | 9 |
| none found | 18 |
| no public source | 42 |

Changed surfaces touched through shipped coupling (implements, dependency or
service): transaction encoding 176, era identity 173, protocol parameters 173,
PlutusV4/language 159, block encoding 138, node-to-client 131, transaction
rules 128, stake-pool registration 117, script context 68, cardano-cli 43,
consensus participation 28, cardano-api 26. The most used services are
Blockfrost (66), Ogmios (62), node sockets (61), cardano-cli (43), Koios (37),
db-sync (34) and Kupo (31).

Readiness of the 204 tools outside the boundary: 35 gap, 21 in-progress,
11 upstream, 2 released, 55 no-evidence, 80 unassessed. Nine catalog
repositories are archived, among them cardano-node-api, cardano-rosetta-legacy
and Nami.

The scan is lexical: a dependency proves coupling to a component, not use of a
changed feature. Every inherited gap is therefore read in shipped code and
decided in `leads.json`.

## Lead confirmation (`leads.json`)

`leads.json` decides, for every tool that inherits a gap (35 outside the
boundary and 23 boundary components inheriting from other components), whether
shipped code actually reaches it, per tool, dependency and surface
(170 decisions in 86 entries, each quoting the lines it rests on):

- `confirmed`: a shipped path uses the gapped capability, so the tool fails or
  misbehaves after the hardfork until the dependency moves (90 surfaces).
- `not-reached`: shipped code uses the dependency only outside the gap
  (65 surfaces).
- `undetermined`: reading cannot decide; R4 execution or the maintainer must
  (15 surfaces).

**21 tools outside the boundary have a confirmed gap:**

| Through | Tools | What breaks |
| --- | --- | --- |
| gouroboros below v0.213.0 | txtop, cardano-node-api (archived), Bursa, IBC incubator | txtop and cardano-node-api open node-to-client connections without V23; all four decode transactions or blocks with pre-target ledger types |
| ouroboros-miniprotocols-ts | Gerolamo | its own node-to-client responder offers only V16–V19, so 11.2 clients cannot connect |
| cardano-wallet | Daedalus, cardano-wallet-js | both run on the wallet's REST API, whose backend cannot connect to 11.2 |
| CSL (no PlutusV4) | Yoroi, cardano-dev-wallet, cardano-hw-cli, Hydra SDK, Masumi, cardano-rosetta-legacy (archived), csl-mobile-bridge | decode transactions or witnesses they did not build; csl-mobile-bridge re-exports the API |
| cardano-js-sdk (parameter keys stop at 37) | Lace, Nami (archived) | decode transactions with parameter updates for keys 38–56 |
| Scalus (no V4 evaluation) | Yano | evaluates scripts through Scalus |
| cardano-api below 11.8 | Marlowe, Marconi, sc-tools, Midgard | follow the node or build and submit transactions fixed to the Conway era |

What reading changed:

1. **Most CSL coupling is not reached.** Blockfrost-js, GovTool,
   cardano-signer, catalyst-core, cardano-mcp, cardano-wallet-js and the halo2
   submitter use CSL for addresses, keys, metadata or their own PlutusV3
   transactions. PlutusV4 is additive, so only tools that decode foreign
   transactions break.
2. **Pallas and plutigo pins rarely matter.** Gastronomy and Mumak never use
   `pallas::network`; plutigo below v0.8.0 appears only as an indirect Go
   requirement (txtop, the IBC incubator). cardano-up uses gouroboros only for
   network names.
3. **Haskell pins split in two.** Pins below the target cardano-api break
   tools that follow the node or submit transactions (Marlowe, Marconi,
   sc-tools, Midgard). Plutus pins below 1.71 do not break existing scripts,
   and offline emulators and local clusters (CLB, Plutip) keep running but
   cannot exercise Dijkstra.

Scanner corrections from this pass: auxiliary scope (Chrysalis's gouroboros
benchmark, Catalyst Voices's wallet tester and Hyperledger Identus's workshops
no longer count as shipped), the plutus-ledger-api rule is limited to Haskell
manifests (Plutip's Rust crate of the same name was misattributed), and
upstream Haskell pins are compared with the component set.

**16 boundary components have a confirmed gap through another component:**
Evolution SDK, Lucid Evolution, Mesh and yaci-store through Scalus
evaluation; Blaze (re-exports the serialization) and Mesh (governance
proposals) through cardano-js-sdk; Whisky and Cquisitor through CSL
transaction decoding; Adder and Scrolls through node-to-client libraries
without V23 (gouroboros v0.209.0, Pallas 0.30.1); cf-ledger-sync through
yaci 0.3.4.1 on its optional node-socket path; and Ogmios, Kupo, Kuber, Atlas,
Hydra and cardano-wallet through Haskell pins below the 11.2 component set.
Amaru's Pallas pin is not reached (node-to-node only), and consensus 3.0.1 and
4.2.1.0 already offer node-to-client V23.

Version gaps are judged against `firstReleases` in `boundary.json`: the earliest
tag on each release line whose source contains every cited quote (yaci has V23
from v0.3.10 and v0.4.2, Pallas from v0.35.1 and v1.0.0, gouroboros's
target-identical CDDL from v0.213.0, plutigo's V4 context from v0.8.0). Judging
pins against the release R2 happened to observe flagged Dingo, yaci-devkit,
Apollo and several plutigo pins that already had the support, and produced a
wrong cardano-node-api lead (it evaluates PlutusV4 at line 1233 of
`internal/utxorpc/submit.go`). After a boundary edit, `classify-surfaces
--reclassify` recomputes at the recorded revisions, reusing cached scans and
rescanning at the same revision when the rules changed.

### Service-layer reading (2026-10-20)

Moving Ogmios, Kupo, db-sync, Koios and Blockfrost RYO to `gap` added 221
inherited links across 117 tools; every one is now decided (`leads.json` has
393 entries, 913 tool/dependency/surface decisions, all quotes re-read with
`--verify-sources`). Service links are decided per capability the tool uses:

| Service | Reached when shipped code… | Tools confirmed |
| --- | --- | --- |
| Ogmios | follows the chain (block, transaction, era), submits (transaction, era), evaluates (Plutus, transaction) or reads parameters | 37 |
| Kupo | reads any indexed data; Kupo cannot index Dijkstra blocks, so matches stop at the fork | 21 |
| db-sync | reads chain tables (block, transaction, era); parameters and pools only through `epoch_param` and pool tables | 13 |
| Koios | reads era fields (`/tip`, block and epoch info) or `/epoch_params` / `/cli_protocol_params` | 22 |
| Blockfrost RYO | calls `/network/eras` (throws on protocol 12) or the epoch parameter endpoints | 41 |

97 tools now have a confirmed gap (70 outside the boundary, 27 boundary
components). Typical not-reached cases: tools that implement these APIs
themselves (Dingo, Dolos, Yaci Store, Yano, Gerolamo), providers used only for
UTxOs and submission, and services named only in comments, fixtures or
deployment examples. Undetermined: CAB and CTL relay through code outside the
repository, and koios-python exposes a generic Ogmios passthrough. Atlas also
parses provider era histories as exactly seven eras, so its Ogmios and
Blockfrost providers fail once the history includes Dijkstra.

## Unlock report (`unlocks.json`)

`unlocks` turns the three registers into the dependency view: what a fix in
one component unlocks. Each confirmed gap is one of three blockers:
`upstream-fix` (the component behind it has no release with the support),
`own-bump` (a release exists; the tool only raises its pin) or `own-gap` (a
boundary component's own R2 gap). A tool is unlocked when all its upstream
blockers come through fixed components and it has no gap of its own; an
unlocked boundary component then counts as fixed for its own consumers, so
chains such as Scalus → Mesh → dApps are followed. `downstream` lists tools
with an unconfirmed shipped link to anything unlocked.

Most SDKs wait on several services at once (Kupo for UTxOs, Ogmios for
submission, Blockfrost or Koios for parameters), so single fixes understate the
effect. `fixOrder` adds, at each step, the component that unlocks the most
tools on top of the earlier steps:

| Step | Fix | Tools unlocked (running total) |
| --- | --- | --- |
| 1 | Blockfrost RYO | 14 |
| 2 | Ogmios | 27 |
| 3 | Kupo | 39 |
| 4 | Koios | 52 |
| 5 | db-sync | 61 |
| 6 | CSL | 70 |
| 7 | Scalus | 74 |
| 8 | cardano-js-sdk | 78 |
| 9 | cardano-wallet | 80 |
| 10 | ouroboros-miniprotocols-ts | 81 |

The service layer alone (steps 1–5) unlocks 61 tools; Adder and Hydra stay
blocked by their own gaps.

**6 tools have a released upstream fix**, so the next move is theirs: txtop,
Bursa and cardano-node-api (gouroboros v0.213.0); cf-ledger-sync (yaci
v0.3.10); Marlowe and Marconi (cardano-api 11.8). The IBC incubator, Scrolls,
sc-tools, Midgard and Atlas left this list once their service links were read:
they also wait on Ogmios, Kupo or Blockfrost.

Raising the pin is only the minimum. The unlock report derives each step's
distance (`steps`): ten of the eleven cross a breaking release (a 0.x minor
under semver, A.B under the Haskell PVP); only cf-ledger-sync stays on its
yaci line. `upgrades.json` records, with quoted lines at the classified
revision, whether the tool's own code handles the new era:

| Own era handling | Tools |
| --- | --- |
| own-work (names eras and stops before Dijkstra) | Atlas, Marconi, Marlowe, sc-tools, Midgard (Conway-typed builders and queries), cf-ledger-sync (era enum and genesis transitions end at Conway), IBC incubator (Babbage header decoding) |
| prepared (already has Dijkstra cases) | Bursa |
| generic (only era-generic library entry points) | txtop, Scrolls |
| undetermined | cardano-node-api (UTxO results decoded as Babbage outputs) |


```sh
node --import tsx scripts/readiness/cli.ts check-upgrades [--verify-sources]  # every bump-ready tool read, none stale
```

## On the site

`/map/dijkstra` renders these registers at build time: what each fix unlocks,
the tools whose upstream fix is released (upgrade distance and own era
handling), inherited gaps not read yet and links waiting on a component
verdict (both grouped by component), every confirmed gap with its quoted lines,
and the cited changes. Each tool page under `/map/readiness/<id>` has a Dijkstra section with
its exposure, blockers, upgrade, what it waits on and lead decisions. A malformed register fails the build.

## Checking it

```sh
node --import tsx scripts/readiness/cli.ts check-changes                   # structure and vocabulary
node --import tsx scripts/readiness/cli.ts check-changes --verify-sources  # re-read every quote via gh
node --import tsx scripts/readiness/cli.ts check-boundary [--verify-sources] # boundary register, worst status per component
node --import tsx scripts/readiness/cli.ts classify-surfaces                  # rescan every catalog tool (resumable)
node --import tsx scripts/readiness/cli.ts classify-surfaces --reclassify     # recompute after a register edit, no fetching
node --import tsx scripts/readiness/cli.ts check-leads [--verify-sources]     # every shipped gap decided, none stale
```

Every citation records repository, 40-character revision, path, line and an
exact single-line quote. `--verify-sources` fails if any quote is no longer on
its recorded line.
