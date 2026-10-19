# Dijkstra change register

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

## Checking it

```sh
node --import tsx scripts/readiness/cli.ts check-changes                   # structure and vocabulary
node --import tsx scripts/readiness/cli.ts check-changes --verify-sources  # re-read every quote via gh
```

Every citation records repository, 40-character revision, path, line and an
exact single-line quote. `--verify-sources` fails if any quote is no longer on
its recorded line.
