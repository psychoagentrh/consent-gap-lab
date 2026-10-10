# Consent Gap Lab: try it, inspect it, run your own copy

Start with the [90-second walkthrough](https://lab.psychoagent.com/build.html). There is no wallet connection and no visitor-triggered UiPath Cloud job.

## 1. Try something useful without a tenant

- [Compare the two invented permissions](https://lab.psychoagent.com/?view=compare#comparison). Both buttons say 20 TEST; only one permission caps the spender at that amount.
- [Open the fixed maximum-versus-20 approval example](https://lab.psychoagent.com/inspect.html?example=maximum-vs-20). The local inspector decodes standard ERC-20 `approve(address,uint256)` calldata. It does not identify the chain/token from those bytes, authenticate a spender or predict a later swap.
- [Explore the historical UiPath outputs](https://lab.psychoagent.com/evidence.html). Read each observation time and the exact tested Flow revision. These were owner-controlled HTTP JSON observations of our synthetic fixtures, not browser runs or wallet audits. The outputs do not prove the newer comparison, inspector or this guide.

## 2. Inspect the four-node Flow

Source: [`uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow`](uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow).

| Node | Behavior | Boundary |
| --- | --- | --- |
| Manual trigger | Accepts `specimenCase`: `unlimited` or `bounded`. | The owner supplies a case, not an arbitrary URL. Our gateway separately allowlists these two inputs in [`uipath/workflows.json`](uipath/workflows.json). This manifest is not a generic UiPath tenant security setting; inspect your own input and permissions before running. |
| HTTP GET | Reads `https://psycho-product.fly.dev/api/specimens/` plus that case, with a 30-second action timeout and no retries. | No wallet interaction, browser automation or token transfer. |
| JavaScript | Validates supported specimen fields and the digest's 64-character hexadecimal format, then derives the gap decision. | Does **not** independently recompute or authenticate the fixture digest; the fixture server supplies it. The evidence explorer's separate local comparison is a different interaction. Malformed/unsupported fields fail rather than producing a reassuring result. |
| End | Returns eight scalar outputs: `specimenCaseObserved`, `scopeExceedsButton`, `approvalIsSwap`, `verdict`, `fixtureSchema`, `payloadDigest`, `observedAt`, `method`. | Inspect the real job status and outputs. A successful observation is not a security audit. |

Expected results from the current fixture contract, **not receipts for new runs**:

| `specimenCase` | `scopeExceedsButton` | `verdict` |
| --- | --- | --- |
| `unlimited` | `true` | `Button != permission` |
| `bounded` | `false` | `Approval != swap` |

Both cases return `approvalIsSwap=false`, `fixtureSchema=consent-gap/v1` and `method=HTTP JSON fixture observation, not browser automation`. `payloadDigest` and `observedAt` are observation-specific; read them from each actual run rather than copying an older receipt. The helper function's internal `specimenCase` is mapped to the public Flow output `specimenCaseObserved` by the End node.

## 3. Validate and pack locally, without credentials

Requirements: Node.js 22 or newer, npm and the pinned UiPath CLI `@uipath/cli@1.202.1`. Start from the repository root. The commands below do not publish, log in or start Cloud jobs.

```sh
git clone https://github.com/psychoagentrh/consent-gap-lab.git
cd consent-gap-lab
npm ci
npm test
npm install --global @uipath/cli@1.202.1
uip --version
uip maestro flow validate uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow --strict-expressions
uip maestro flow pack uipath/ConsentGapSolution/ConsentGap /tmp/consent-gap-pack --name Psycho.ConsentGap --version 1.0.0
```

Read the CLI's validation and packing results, including warnings. The pinned CLI reports a nonfatal canonical-layout warning because `Psycho_ConsentGap.flow` differs from its parent directory name `ConsentGap`. The pinned packer resolves the filename from `--name Psycho.ConsentGap` and emits `Psycho.ConsentGap.flow.Flow.1.0.0.nupkg`; do not change the package name independently of that source filename. A valid packed package is not evidence that the Flow ran in Cloud. Do not migrate or repack the published historical package and call it the same revision; record your own source revision and package version.

To try the public app locally:

```sh
npm start
```

Open the local address printed by the server, then `/build.html`. Browser tests are separate from `npm test`; see [README](README.md#run) for their commands and Playwright setup.

## 4. Optional: run in your own UiPath tenant

This phase makes authenticated changes and consumes your tenant's run allowance. It is **not** required to use the public app or validate/pack locally. Use your own authorized workstation, available Maestro/Flow entitlement, and a dedicated test folder with no personal Integration Service connections. Follow the current [UiPath CLI authentication documentation](https://docs.uipath.com/uipath-cli/standalone/latest/user-guide/authentication); never paste a token into an issue, a public demo or a support chat. Folder setup, permissions and usable runtime/licensing are tenant prerequisites, not supplied by this repository.

First inspect help on your pinned CLI. Then publish the reviewed source into your **own** test folder:

```sh
uip maestro flow publish --help
uip maestro flow process list --help
uip maestro flow process run --help
uip maestro flow job status --help
uip maestro flow publish uipath/ConsentGapSolution/ConsentGap /tmp/consent-gap-publish --name Psycho.ConsentGap --version 1.0.0 --folder-path 'ConsentGapLab'
uip maestro flow process list --folder-path 'ConsentGapLab'
```

`ConsentGapLab` is an example folder name. Create/select your own dedicated folder first; don't overwrite an existing package version. Publication uploads the package; it does not by itself prove that a process is deployed/runnable. If no runnable process appears, use your tenant's supported package-to-process deployment/setup path. **Do not guess a process key, release key or folder key.** Copy your returned values after that setup. CLI `releaseActive` and `releaseLatest` flags describe release-level state, not proof that the process is runnable.

Replace the placeholder arguments below with those returned values. The following are two separate owner-controlled runs, not public-user requests. `--validate` performs basic required-field/type checks, not target allowlisting:

```sh
uip maestro flow process run '<YOUR_PROCESS_KEY>' '<YOUR_FOLDER_KEY>' --release-key '<YOUR_RELEASE_KEY>' --validate --inputs '{"specimenCase":"unlimited"}' --wait --timeout 120
uip maestro flow process run '<YOUR_PROCESS_KEY>' '<YOUR_FOLDER_KEY>' --release-key '<YOUR_RELEASE_KEY>' --validate --inputs '{"specimenCase":"bounded"}' --wait --timeout 120
uip maestro flow job status '<YOUR_JOB_KEY>' --folder-key '<YOUR_FOLDER_KEY>' --detailed
```

For **each** returned job key, read its terminal state and all eight outputs and compare with the table above. Save your own UTC observation time, source revision and package version. A client wait timeout is not a canceled job: read back the existing job key before attempting another run. Do not turn visitor submissions or GitHub suggestions into a Cloud job queue.

## Sources and reproduction boundary

Command shapes above were checked against the installed CLI `1.202.1` help and the current primary [Maestro Flow CLI reference](https://docs.uipath.com/uipath-cli/standalone/latest/user-guide/uip-maestro-flow) on 2026-10-10. The documentation was read; the local `npm test`, Flow validation and pack path were exercised for this guide. No new Cloud run or generic third-party tenant setup is claimed. Existing [published observations](public/owner-observations.json) remain dated and tied to their recorded historical revision.

This is an independent UiPath experiment, not UiPath endorsement. Ask a concrete reproduction question or suggest a synthetic editorial case via [issues](https://github.com/psychoagentrh/consent-gap-lab/issues). Suggestions are feedback, not promises to run a target.
