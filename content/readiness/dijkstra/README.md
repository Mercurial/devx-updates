# Dijkstra change, boundary and classification registers

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
   Only gouroboros's vendored CDDL matches the target.
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
  PVP major, lower bounds never count).
- **service**: code calls Blockfrost, Koios, Maestro, Ogmios, Kupo, db-sync,
  UTxO RPC/Dolos, the cardano-wallet API, a node socket, cardano-cli commands
  or the submit API.
- **marker**: closed era lists, PlutusV3 enums, cost models, raw CBOR codecs,
  segregated block-body fields, legacy stake certificates, script context,
  pool registration or node-to-client code. Markers show a surface is touched
  but never set readiness.

Prose (docs, READMEs, changelogs) and comments in manifests never establish
exposure. Every hit records path, line and a quote at the scanned revision.

| Exposure | Tools |
| --- | --- |
| implements | 65 |
| dependency | 93 |
| service | 42 |
| marker only | 9 |
| none found | 18 |
| no public source | 42 |

Changed surfaces touched through coupling (implements, dependency or service):
transaction encoding 181, era identity 178, protocol parameters 178,
PlutusV4/language 166, block encoding 142, node-to-client 135, transaction
rules 135, stake-pool registration 125, script context 75, cardano-cli 52,
consensus participation 29, cardano-api 28. The most used services are
Blockfrost (80), node sockets (75), Ogmios (65), cardano-cli (52), Koios (38),
db-sync (35) and Kupo (32).

What it adds to R2:

1. **35 tools outside the boundary inherit a gap.** Node-to-client: Daedalus
   and cardano-wallet-js through cardano-wallet; Gerolamo through
   ouroboros-miniprotocols-ts; Bursa, cardano-node-api, cardano-up, txtop,
   Chrysalis and the IBC incubator through gouroboros below v0.213.0. PlutusV4:
   19 tools through CSL (Yoroi, GovTool, Catalyst Voices, cardano-signer,
   cardano-hw-cli, Marlowe and others). Protocol parameters: Lace, Daedalus,
   Nami and Hyperledger Identus through cardano-js-sdk.
2. **Pinned versions matter more than the component's status.** gouroboros is
   released, but six Go tools pin versions without V23; Pallas has offered V23
   since v0.35.1, but Scrolls, Mumak and Gastronomy pin older umbrella crates.
3. **42 catalog entries have no public source** (hosted wallets, explorers,
   API providers such as Blockfrost, Maestro, NOWNodes and GetBlock). Their
   exposure can only come from documented services or maintainers (R5).

The scan is lexical. A dependency proves coupling to a component, not use of a
changed feature; a service hit can be a test or an example. Use the recorded
quotes to confirm before contacting maintainers.

## Checking it

```sh
node --import tsx scripts/readiness/cli.ts check-changes                   # structure and vocabulary
node --import tsx scripts/readiness/cli.ts check-changes --verify-sources  # re-read every quote via gh
node --import tsx scripts/readiness/cli.ts check-boundary [--verify-sources] # boundary register, worst status per component
node --import tsx scripts/readiness/cli.ts classify-surfaces                  # rescan every catalog tool (resumable)
```

Every citation records repository, 40-character revision, path, line and an
exact single-line quote. `--verify-sources` fails if any quote is no longer on
its recorded line.
