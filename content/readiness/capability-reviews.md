# Higher-level capability review handoff

Four task-brief-v2 packets are prepared in `.readiness/reviews/capabilities/`.
The [retained index](./capability-reviews.json) records exact packet IDs, source
revisions, profile IDs and the 13 additional captured files. Every packet remains
pending; no discovery/challenge task has been launched and no capability claims
have been imported. This is evidence preparation for plan sections 6.3 and 7.

| Consumer | Review questions and explicit boundary |
| --- | --- |
| Lace mobile | Trace mobile module wiring into signing and submission APIs. Establish which behavior is enabled in the selected mobile profile. Shared SDK entry points alone do not prove mobile wiring; ask for additional source where needed. Browser extension, native device behavior and hosted deployments remain separate. |
| GovTool frontend | Trace voting form, wallet context and vote request behavior. Separate governance actions, signing delegated to connected wallets, and backend service calls. Frontend manifest 2.0.29 is retained at repository tag v2.0.36; do not equate those releases or infer backend coverage. |
| TyphonJS | Inspect exported transaction APIs, builder and serialization paths. Preserve library context; do not infer a deployed Typhon wallet. Both historical parser captures describe the same pinned v4.0.0 source; use the official-parser profile ending `5958bba13a88b8790661b312` for new findings and retain the first capture as history. |
| Cometa | Trace public exports, transaction builder and wallet wrappers into native/WASM boundaries. Separate direct JavaScript behavior, bindings and external providers. No runtime npm dependencies does not imply no native runtime. Source/build correspondence remains unverified. |

These questions guide review; the packet's retained tool/profile/evidence context
defines importable scope. A selected file list is a starting point, not a claim
that every production behavior is covered. Return missing source as gaps. If more
evidence is captured, export a new packet and use its new ID; do not edit the
existing packet's evidence or reuse findings against changed inputs silently.

To reproduce a packet from the committed snapshot (no network required):

```sh
node --import tsx scripts/readiness/cli.ts export-review --tools lace --output .readiness/reviews/capabilities/lace
node --import tsx scripts/readiness/cli.ts export-review --tools govtool --output .readiness/reviews/capabilities/govtool
node --import tsx scripts/readiness/cli.ts export-review --tools typhonjs --output .readiness/reviews/capabilities/typhonjs
node --import tsx scripts/readiness/cli.ts export-review --tools cometa-js --output .readiness/reviews/capabilities/cometa-js
```

The owner can launch discovery with the template in
[`DEPENDENCY-REVIEW-TASKS.md`](../../docs/DEPENDENCY-REVIEW-TASKS.md#discovery),
substituting the packet directory and a separate result directory. Provide this
handoff alongside the packet. Launch the independent challenge pass after a
discovery result returns; neither pass edits canonical data. The actual import
format is JSON (`result-template.json` plus `CAPABILITIES.md`), even where the
conceptual task brief illustrates YAML. Verification still requires a separate
source, maintainer or native evidence decision.

All tools remain hardfork-unassessed. The next operational step is the owner-run
review handoff, followed by checked result import and explicit remaining gaps.
