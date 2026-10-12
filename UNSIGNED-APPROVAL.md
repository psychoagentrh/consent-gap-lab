# Unsigned approval observation spike

## Why this extension exists

The original owner-run Flow reads a synthetic JSON permission label. This extension
reads actual, invented `approve(address,uint256)` transaction calldata and computes
the allowance comparison from its uint256 bytes. It is a narrower and more useful
reproduction target for Maestro builders. The public inspector still works locally
without a wallet, credentials or a Cloud job.

**Status:** portable source, pinned CLI validation and local HTTP/script rehearsal.
These are not UiPath Cloud execution evidence. The October 6 observations belong to
the original `consent-observation` workflow, not this extension. See the dated
evidence page for the exact historical revision and limitations.

## Owned inputs and useful output

- `approvalCase=maximum`: a button claiming “Swap 20 SYN” with invented maximum
  approval calldata. Expected byte comparison: `larger`, `scopeExceedsButton=true`.
- `approvalCase=bounded`: the same button with invented allowance of 20 tokens,
  assuming 18 decimals. Expected comparison: `equal`, `scopeExceedsButton=false`.
- Both cases return `approvalIsSwap=false`. An approval does not prove a swap.

Fixtures are read-only GET/HEAD routes at `/api/unsigned-approvals/maximum` and
`/api/unsigned-approvals/bounded`. Other cases, extra paths, query inputs and write
methods are rejected. Visitors cannot submit targets or trigger Cloud jobs.
The Flow fetches only `https://psycho-product.fly.dev/api/unsigned-approvals/`
with one of those two cases. It has a 30-second HTTP timeout and zero retries.

The fixture contains a synthetic token destination, calldata, a button amount,
explicit unsigned/unsubmitted flags, and a server-generated SHA-256 payload digest.
The script decodes bytes with the same strict decoder as the inspector. It validates
owned fixture fields and digest format; it **does not independently verify the digest**.
The local HTTP rehearsal recomputes the digest. A digest is not evidence of token
identity, contract behavior, safety, wallet consent or onchain execution.

## Reproduce without credentials

Use the pinned installation steps in [BUILDERS.md](BUILDERS.md). Then, from the
repository root:

```sh
npm ci
npm test
node uipath/rehearse-unsigned-approval.mjs
uip maestro flow validate uipath/ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow --strict-expressions
uip maestro flow pack uipath/ConsentGapSolution/Psycho_UnsignedApproval /tmp/consent-gap-unsigned-pack --name Psycho.UnsignedApproval --version 1.0.1
```

The rehearsal starts an ephemeral loopback fixture service, executes the exact
embedded Flow script for both cases, checks results and payload digests, and stops
the service. It is not a local Maestro runtime or a Cloud job. Strict validation
and packing establish authoring mechanics, not tenant compatibility or execution.
The committed package is `Psycho.UnsignedApproval.flow.Flow.1.0.1.nupkg`.

For a real owner-controlled execution, a builder must use their own UiPath tenant,
license and dedicated folder. Import the portable Flow/API Workflow using their
supported tenant tooling, confirm the fixed owned HTTP target, and run the two
bounded inputs. Do not put credentials in this repository or fixture service.
Publish dated, redacted outputs tied to the exact immutable source revision before
claiming Cloud execution. This repository does not automate tenant provisioning.

## Limits

No browser capture, wallet extension, signing, broadcast, token metadata lookup or
contract simulation. The button label is a synthetic fixture field, not observed
screen text. Matching amount does not prove that a spender or contract is safe.
The UI inspector remains a teaching/calldata-comparison utility, not a transaction
approval recommendation. Public UiPath execution stays disabled.
