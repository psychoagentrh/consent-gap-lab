# Unsigned approval observation spike

## Why this extension exists

The original owner-run Flow reads a synthetic JSON permission label. This extension
reads actual, invented `approve(address,uint256)` transaction calldata and computes
the allowance comparison from its uint256 bytes. Version 1.1.1 includes a separate
comparison against an explicitly supplied, invented expected-spender address.
An amount can match while the spender differs. The public inspector still works
locally without a wallet, credentials or a Cloud job.

## Proof status: historical Cloud results versus current portable source

Two distinct owner-controlled Cloud inputs succeeded with gateway-verified outputs
on October 12. The [redacted evidence page](https://lab.psychoagent.com/unsigned-evidence.html)
and [`unsigned-owner-observations.json`](public/unsigned-owner-observations.json)
publish those bounded inputs and twelve allowlisted outputs, without private job
links. Maximum was observed at `2026-10-12T06:16:21.688Z`; bounded at
`2026-10-12T06:17:12.198Z`. Tested workspace/Flow revision:
`ce6fcacdcc72c73ff6da0ce93fd9da5bd4982823`; its immutable gateway-published
source snapshot is `0e1e9f19839e958c8e6564c92f7d25ca4cfd5c9d`.
This is a manually curated, unsigned publication, not an independently verifiable
UiPath attestation or a live guarantee. The October 6 observations belong to the
original `consent-observation` workflow, not this extension.

**Version 1.1.1 returned two distinct, verified owner-controlled Cloud observations**
on October 15: `spender-match` and `spender-mismatch`. Both amounts were `equal`;
spender comparisons were `equal` and `different`, respectively. Read the
[separate dated spender evidence](https://lab.psychoagent.com/spender-evidence.html)
or [its twelve-output JSON](public/spender-owner-observations.json). Tested
workspace/Flow revision: `e2c6632c06561f184778821b3c9d01fb27909818`;
immutable public source: `055dc58b184778d3553846f4030d3a8f48262c6d`.
These historical owned-fixture HTTP runs are not browser/wallet tests, address
safety verdicts, authenticated intent or evidence about visitor-pasted inputs.
The local evaluator additionally returns schema and no-swap diagnostics; these
are not in the twelve-output Cloud envelope. The October 12 evidence remains
unchanged and does not retroactively prove the newer spender comparison.
Public UiPath execution remains disabled; a visitor action cannot start an owner
Cloud run.

## Owned inputs and useful output

All four cases have a synthetic button claiming “Swap 20 SYN”, an invented token
contract destination and 18 assumed decimals. The local evaluator retains
`approvalIsSwap=false`; this diagnostic is not part of the current Cloud output
envelope. An approval does not prove a swap.

| `approvalCase` | Amount `comparison` | `scopeExceedsButton` | `spenderComparison` | Fixture schema |
| --- | --- | --- | --- | --- |
| `maximum` | `larger` | `true` | `not-provided` | `consent-gap-unsigned-approval-v1` |
| `bounded` | `equal` | `false` | `not-provided` | `consent-gap-unsigned-approval-v1` |
| `spender-match` | `equal` | `false` | `equal` | `consent-gap-unsigned-approval-spender-v2` |
| `spender-mismatch` | `equal` | `false` | `different` | `consent-gap-unsigned-approval-spender-v2` |

The two v2 cases encode spender `0x1111111111111111111111111111111111111111`.
Their supplied `expectedSpender` is respectively that address or
`0x3333333333333333333333333333333333333333`. The comparison comes from address
bytes, not the case name. It accepts plain 0x-prefixed 20-byte hex addresses,
normalizes hex case and does not validate checksums, ownership, chain, identity or
contract behavior. Missing or malformed v2 expectations fail closed, never become
an equality result. V1 cases preserve their historical fixture bytes and omit the
expectation; they return an empty `expectedSpender` and `not-provided`.

The current twelve-output Cloud contract is:

- `approvalCaseObserved`, `spender`, `expectedSpender`, `spenderComparison`;
- `rawAllowance`, `claimedRawAmount`, `comparison`, `scopeExceedsButton`;
- `verdict`, `payloadDigest`, `observedAt`, `method`.

Version 1.1.0's fourteen-output manifest was rejected by the publication gateway.
Version 1.1.1 keeps the independently useful amount/spender fields in a bounded
twelve-output envelope. `fixtureSchema` and `approvalIsSwap` remain local evaluator
diagnostics, not Cloud outputs; schema and unsigned/unsubmitted validation still
run before any result. This change is not evidence of Cloud execution.

`scopeExceedsButton` refers only to the amount. A false value does not mean the
spender matches or the request is safe. Equal addresses are not a safety verdict.
The two new outputs are `expectedSpender` and `spenderComparison`; historical
twelve-output publications remain unchanged rather than acquiring invented fields.

Fixtures are read-only GET/HEAD routes at `/api/unsigned-approvals/` followed by
exactly one of the four cases above. Other cases, extra paths, query inputs and
write methods are rejected. The Flow fetches only
`https://psycho-product.fly.dev/api/unsigned-approvals/` with a vetted case. It has
a 30-second HTTP timeout and zero retries. Visitors cannot submit targets or
trigger Cloud jobs. Case suggestions are editorial feedback, not a run queue.

The fixture contains explicit unsigned/unsubmitted flags and a server-generated
SHA-256 payload digest. The script uses the inspector's strict decoder, checks
owned fixture fields and digest format, and rejects unknown fields or schemas.
It **does not independently verify the digest**. The local HTTP rehearsal
recomputes the digest separately. A digest is not evidence of token identity,
contract behavior, safety, wallet consent or onchain execution.

## Reproduce without credentials

Use the pinned installation steps in [BUILDERS.md](BUILDERS.md). Then, from the
repository root:

```sh
npm ci
npm test
node uipath/build-unsigned-flow.mjs --check
node uipath/rehearse-unsigned-approval.mjs
uip maestro flow validate uipath/ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow --strict-expressions
uip maestro flow pack uipath/ConsentGapSolution/Psycho_UnsignedApproval /tmp/consent-gap-unsigned-pack --name Psycho.UnsignedApproval --version 1.1.1
```

The rehearsal starts an ephemeral loopback fixture service, executes the exact
embedded Flow script and End mappings for all four cases, checks results and
payload digests, and stops the service. It is not a local Maestro runtime or a
Cloud job. Strict validation and packing establish authoring mechanics, not
tenant compatibility or execution. The committed package is
`Psycho.UnsignedApproval.flow.Flow.1.1.1.nupkg`.

`uipath/unsigned-approval-contract.js` is the shared case/output contract.
`uipath/build-unsigned-flow.mjs` deterministically embeds that contract, the strict
decoder and evaluator in the portable Flow; `--check` refuses drift without
rewriting the source. After intentionally changing those inputs, run the generator
without `--check`, retest, strictly validate and pack a new package version. Keep
`uipath/workflows.json` aligned with the real package filename and output contract.

For a real owner-controlled execution, a builder must use their own UiPath tenant,
license and dedicated folder. Import the portable Flow/API Workflow using their
supported tenant tooling, confirm the fixed owned HTTP target, and run the two
spender cases separately. Verify both amount and spender outputs against the table.
Do not put credentials in this repository or fixture service. Publish dated,
redacted outputs tied to the exact immutable source revision before claiming Cloud
execution. This repository does not automate tenant provisioning.

## Limits

No browser capture, wallet extension, signing, broadcast, token metadata lookup or
contract simulation. The button label and expected spender are synthetic fixture
fields, not observed screen text or authenticated intent. Matching amount or
address does not prove that a spender or contract is safe. The UI inspector remains
a teaching/calldata-comparison utility, not a transaction approval recommendation.
Public UiPath execution stays disabled.
