> **Dormant — October 17, 2026.** Product development and UiPath execution are
> paused by the operator. Public Fly hosting and the product builder are scaled
> to **zero machines**; the demo is unavailable. Source, packages and the private
> development workspace are retained for a possible explicitly approved restart.
> Psycho's active work is research and posting to X.

# Consent Gap Lab

[Try the lab](https://lab.psychoagent.com) | [Builder walkthrough](https://lab.psychoagent.com/build.html) | [Reproduction guide](BUILDERS.md) | [Captured demo](https://lab.psychoagent.com/demo.html)

Compare what a crypto button claims with the scope of an invented request. The public lab works without a wallet or visitor-triggered UiPath jobs. It is a teaching and inspection tool, not a security verdict.

## Public interactions

- **Request inspector:** paste a bounded unsigned JSON request or canonical `approve(address,uint256)` calldata. Browser-local decoding shows destination, spender and allowance without uploading the input. Clear removes current inputs and output.
- **Exact amount comparison:** enter explicit token decimals and a claimed amount. BigInt arithmetic compares the allowance in raw units and formats the exact difference without floating-point rounding. Matching amounts do not prove a safe contract or an executed swap.
- **Expected-spender comparison:** optionally enter a plain 0x address from a source you independently trust. Case-insensitive byte comparison works without decimals and is separate from amount comparison. No checksum, chain, contract or ownership verification; a match is not a safety verdict. Try “Example: 20 tokens”, enter `0x2222222222222222222222222222222222222222` (invented), and decode: the amount matches but the repeated-1 spender differs. Only explicit summary copy includes the entered address; fixed shared links do not.
- **Authentic spender demo:** [follow the three-step walkthrough](https://lab.psychoagent.com/demo.html#spender-mismatch), compare unedited desktop/mobile result-panel captures, and inspect their timestamps, source revisions, fixed inputs and SHA-256 image hashes in [the capture record](public/demo/spender-capture.json). This is a local UI demonstration, separate from the dated UiPath proof below. `npm run capture:demo` replaces these files with a new capture from your local checkout; use `DEMO_OUTPUT_DIR=/tmp/consent-gap-demo npm run capture:demo` to reproduce them without replacing published evidence. The record includes the checkout revision and whether local changes were present. This is not a Cloud run and is not part of acceptance tests.
- **Shareable invented example:** [maximum allowance versus 20 tokens](https://lab.psychoagent.com/inspect.html?example=maximum-vs-20) loads only a fixed local preset. Copyable summaries are plain text; custom bytes are never encoded into share URLs.
- **Evidence explorer and prediction replay:** compare published, dated owner observations. Replay is local JavaScript, not a new UiPath run.
- **Journey suggestions:** optional bounded editorial feedback, not a Cloud-job queue or a promise to test a target. No visitor interaction directly or indirectly starts a Cloud job.

## Recorded spender-comparison evidence

[Read the October 15 spender results](https://lab.psychoagent.com/spender-evidence.html)
or inspect [their redacted JSON](public/spender-owner-observations.json). Two
owner-controlled UiPath Maestro runs returned `comparison=equal` for the same
20-token amount. `spender-match` returned `spenderComparison=equal` at
`2026-10-15T18:43:34.676Z`; `spender-mismatch` returned `different` at
`2026-10-15T18:49:28.601Z`. Both requests encode the same invented spender; only
the supplied synthetic expectation changes. Equal addresses are not a safety verdict.

Tested workspace/Flow revision: `e2c6632c06561f184778821b3c9d01fb27909818`.
Immutable public source: `055dc58b184778d3553846f4030d3a8f48262c6d`.
Package: `1.1.1`. [Inspect/reproduce the source](UNSIGNED-APPROVAL.md).
This is a manually curated, unsigned publication of twelve allowlisted outputs,
not an independently verifiable UiPath attestation. The Flow validates digest
format; local re-evaluation recomputes it separately. No browser/wallet automation,
signing, swap, visitor-input test or authenticated user intent is proved.
[Try the separate three-step local lesson](https://lab.psychoagent.com/demo.html#spender-mismatch).
The October 12 publication below is unchanged.

## Recorded unsigned approval-byte evidence

[Read the October 12 results](https://lab.psychoagent.com/unsigned-evidence.html) or inspect [their redacted JSON](public/unsigned-owner-observations.json). Two owner-controlled UiPath Maestro runs decoded invented unsigned approval requests behind the same synthetic “Swap 20 SYN” button:

| Input | UTC observation | Compared with button | Swap proved? |
| --- | --- | --- | --- |
| maximum | 2026-10-12T06:16:21.688Z | larger | no |
| bounded | 2026-10-12T06:17:12.198Z | equal | no |

Tested workspace/Flow revision: `ce6fcacdcc72c73ff6da0ce93fd9da5bd4982823`. Immutable public source snapshot: `0e1e9f19839e958c8e6564c92f7d25ca4cfd5c9d`. See [the exact Flow](https://github.com/psychoagentrh/consent-gap-lab/blob/0e1e9f19839e958c8e6564c92f7d25ca4cfd5c9d/uipath/ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow) and [unsigned workflow reproduction instructions](UNSIGNED-APPROVAL.md).

These are manually curated, unsigned publications of twelve allowlisted outputs per run, not independently verifiable UiPath attestations. The Flow checks digest syntax but does not recompute the host-provided payload digest. Local tests recompute fixture digests separately. No browser capture, wallet, signing, broadcast, contract simulation or visitor-pasted input was tested by these runs. Historical results are not live guarantees. Job identifiers, tenant links and private traces are omitted.

### Older JSON-label evidence is a separate family

[October 6 observations](https://lab.psychoagent.com/evidence.html) and [redacted JSON](public/owner-observations.json) demonstrate the older fixed-host fixture-label classifier, not unsigned calldata decoding. Its tested workspace was `d85a1ddc7bb9cd1cc6a13b4d5db95474228f1fe9`; immutable public source was `acad500cabe86be373481fe66e505f432ae906db`.

Correction (October 16): the two October 6 revision IDs above were previously copied incorrectly in this README. They now match the published observation record; the observations themselves have not changed.

The JSON-label Flow performs a manual trigger, fixed-host HTTP GET, bounded deterministic script classification and explicit End outputs. It is real Maestro execution, but not browser automation or a signed wallet action. `uipath/workflows.json` defines the bounded owner inputs and output allowlists for both workflows.

## Run the application

Requires Node 20+ and npm.

```sh
npm ci
npm test
npm start
```

The server binds `0.0.0.0:8080` by default. Open `http://localhost:8080`; health is `GET /healthz`. `PORT=8081 npm start` selects another port. No wallet, tenant access or application secret is needed for public interactions.

```sh
npx playwright install chromium
npm run test:browser
```

The Chromium suites start ephemeral local servers and exercise desktop, mobile and 320px layouts, copy and clear, invalid input recovery, share-link reload/history, no-JavaScript fallback, request privacy, dated evidence and automated accessibility. Use `CONSENT_GAP_BASE_URL` to test a deployment without starting Cloud jobs. Automated accessibility passes are not certification.

### Cross-engine compatibility

```sh
npx playwright install chromium firefox webkit
npm run test:cross-engine
```

This separate check covers Chromium, Firefox and WebKit at 1280, 390 and 320px: the spender walkthrough, independent amount/address results, error recovery, clipboard-denial fallback, keyboard submit/clear, the fixed share lesson and evidence disclosure with JavaScript disabled. It checks horizontal overflow, page errors, failed/off-origin requests and request-free local input handling. Selected engines must be installed; failures do not silently skip coverage. This is not a physical-device, native clipboard-permission, accessibility or UiPath Cloud test.

Reports and screenshots go to an OS temporary directory or `TEST_REPORT_DIR=/tmp/my-consent-gap-report`, never `public/`. `CONSENT_GAP_BASE_URL=https://lab.psychoagent.com` tests the deployment. Reports distinguish checkout revision/dirty state from tested URL; a remote result does not prove matching deployed source. `CONSENT_GAP_BROWSER=firefox` explicitly narrows coverage to one engine; all three viewport widths still run.

Unit tests also check README revision IDs against each published evidence family, rejecting changed/wrong-family IDs. This prevents documentation drift, not independent attestation of a UiPath run.

## Inspect and reproduce the UiPath Flows

[BUILDERS.md](BUILDERS.md) gives beginner steps, output expectations and limitations. [UNSIGNED-APPROVAL.md](UNSIGNED-APPROVAL.md) covers the unsigned-byte workflow. Flow source and committed packages are under `uipath/`; packages use the `Psycho.` prefix.

Install both pinned tools with registry access and a writable global npm prefix. Installing only the CLI leaves Maestro unavailable when automatic installation is disabled. The credential-free product image already contains this pair.

```sh
npm install --global @uipath/cli@1.202.1 @uipath/maestro-tool@1.202.1
export UIPATH_CLI_DISABLE_AUTOINSTALL=true
export UIPATH_CLI_DISABLE_VERSION_SYNC=true
export UIPATH_CLI_DISABLE_TOOL_LINE_CHECK=true
uip --version
uip maestro flow validate uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow --strict-expressions
uip maestro flow pack uipath/ConsentGapSolution/ConsentGap /tmp/consent-gap-pack --name Psycho.ConsentGap --version 1.0.0
```

Local validation and packing require no login and prove package mechanics, not Cloud execution. For the unsigned Flow's four-case rehearsal, version 1.1.1 package and twelve-output Cloud contract, use [UNSIGNED-APPROVAL.md](UNSIGNED-APPROVAL.md). The [October 15 owner-run spender evidence](https://lab.psychoagent.com/spender-evidence.html) records two verified HTTP-fixture inputs for that version, not proof of the browser inspector or a wallet journey. The October 12 Cloud observations above retain their original twelve outputs and source revision. Cloud reproduction needs your own suitable UiPath tenant and license. Public execution remains disabled.

## Safety and operating boundaries

All shipped teaching fixtures and transaction addresses are invented. Canonical ABI checks do not prove token identity, spender safety, human consent, real contract behavior or an executed swap. The inspector accepts only a bounded flat transaction object or approval calldata; documented rejection boundaries are in BUILDERS.md. The result is inspectable scope evidence, not a security audit.

Original code is MIT; see LICENSE and ASSET-LICENSES.md. Product decisions, visual design and prior-art comparison are published in PRODUCT.md, DESIGN.md and NOVELTY.md. Deployment runs as an unprivileged user with a read-only public evidence path and no application wallet access.

Independent Psycho experiment. Not affiliated with or endorsed by UiPath. Useful issues should describe a confusing comparison, reproduction problem or boundary failure without credentials, private wallet data or tenant traces.
