# Dijkstra change, boundary, classification and lead registers

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

## Not yet covered

- Node-to-node changes (new Leios mini-protocols) and their effect on relays and
  alternative node implementations.
- Local-state-query result encodings and Dijkstra genesis configuration, which
  are needed for devnet setup (R4).
- JSON representations in cardano-api/cli beyond the era commands.

## Boundary register (`boundary.json`)

`boundary.json` records the 61 catalog components that implement a changed
surface directly, observed at their default-branch heads on 2026-10-19, with a
status for each surface group: `gap` (cited code cannot work against the
target), `no-evidence` (nothing found; never a pass), `tracked`, `in-progress`,
`released` and `verified` (R4). A component counts as its worst status. Source
evidence is pinned like the change register; issue and pull-request evidence
records URL, state and date.

| Worst status | Components |
| --- | --- |
| gap | cardano-wallet, Adder, ouroboros-miniprotocols-ts (node-to-client); Hydra (stops at the fork); CSL (no PlutusV4); cardano-js-sdk and cardano-c (protocol parameters); Scalus (V4 evaluation) |
| no-evidence | 37 components, including CML, cardano-client-lib, PyCardano, Oura, Dolos, Mithril, cncli, Koios, Blockfrost RYO, Aiken, OpShin, Helios, Plutarch, Mesh, Lucid Evolution and both hardware-wallet libraries |
| tracked | Apollo |
| in-progress | Pallas, Yaci, Amaru, Dingo, Ogmios, Kupo, db-sync, yaci-store, UTxO RPC, Blaze, Kuber, Yaci DevKit |
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
  pool registration or node-to-client code. Markers show a surface is touched
  but never set readiness.

Prose (docs, READMEs, changelogs) and comments in manifests never establish
exposure. Tests, examples, benchmarks, demos, playgrounds and workshops are
**auxiliary**: their hits are kept with `scope: "auxiliary"` but never set
readiness, and a tool coupled only there has exposure `auxiliary`. Every hit
records path, line and a quote at the scanned revision; dependency hits also
keep up to twelve versioned manifest lines (`pins`) for the constraint checks.
Each scanned tool records whether its repository is archived and when it was
last pushed.

| Exposure | Tools |
| --- | --- |
| implements | 65 |
| dependency | 87 |
| service | 44 |
| auxiliary only | 4 |
| marker only | 9 |
| none found | 18 |
| no public source | 42 |

Changed surfaces touched through shipped coupling (implements, dependency or
service): transaction encoding 176, era identity 173, protocol parameters 173,
PlutusV4/language 159, block encoding 139, node-to-client 131, transaction
rules 130, stake-pool registration 119, script context 69, cardano-cli 43,
consensus participation 28, cardano-api 26. The most used services are
Blockfrost (67), Ogmios (62), node sockets (61), cardano-cli (43), Koios (37),
db-sync (34) and Kupo (31).

Readiness of the 204 tools outside the boundary: 35 gap, 21 in-progress,
11 upstream, 2 released, 55 no-evidence, 80 unassessed. Nine catalog
repositories are archived, among them cardano-node-api, cardano-rosetta-legacy
and Nami.

The scan is lexical: a dependency proves coupling to a component, not use of a
changed feature. Every inherited gap is therefore read in shipped code and
decided in `leads.json`.

## Lead confirmation (`leads.json`)

`leads.json` decides, for each of the 35 tools outside the boundary that
inherit a gap, whether shipped code actually reaches it, per tool, dependency
and surface (114 decisions in 56 entries, each quoting the lines it rests on):

- `confirmed`: a shipped path uses the gapped capability, so the tool fails or
  misbehaves after the hardfork until the dependency moves (46 surfaces).
- `not-reached`: shipped code uses the dependency only outside the gap
  (50 surfaces).
- `undetermined`: reading cannot decide; R4 execution or the maintainer must
  (18 surfaces).

**21 tools have a confirmed gap:**

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

`check-leads` also lists 26 dependency gaps between boundary components (for
example Mesh, Evolution SDK and yaci-store through Scalus, Blaze and Mesh
through cardano-js-sdk, cf-ledger-sync through yaci, Scrolls and Amaru through
Pallas).

Version gaps are judged against `firstReleases` in `boundary.json`: the earliest
tag on each release line whose source contains every cited quote (yaci has V23
from v0.3.10 and v0.4.2, Pallas from v0.35.1 and v1.0.0, gouroboros's
target-identical CDDL from v0.213.0, plutigo's V4 context from v0.8.0). Judging
pins against the release R2 happened to observe flagged Dingo, yaci-devkit,
Apollo and several plutigo pins that already had the support, and produced a
wrong cardano-node-api lead (it evaluates PlutusV4 at line 1233 of
`internal/utxorpc/submit.go`). After a boundary edit, `classify-surfaces
--reclassify` recomputes from the recorded revisions and cached scans without
fetching. These are R2 propagation and are assessed with the
components themselves.

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
