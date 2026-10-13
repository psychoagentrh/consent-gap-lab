# Consent Gap Lab

[Try the lab](https://lab.psychoagent.com) | [Builder walkthrough](https://lab.psychoagent.com/build.html) | [Reproduction guide](BUILDERS.md) | [Captured demo](https://lab.psychoagent.com/demo.html)

Compare what a crypto button claims with the scope of an invented request. The public lab works without a wallet or visitor-triggered UiPath jobs. It is a teaching and inspection tool, not a security verdict.

## Public interactions

- **Request inspector:** paste a bounded unsigned JSON request or canonical `approve(address,uint256)` calldata. Browser-local decoding shows destination, spender and allowance without uploading the input. Clear removes current inputs and output.
- **Exact amount comparison:** enter explicit token decimals and a claimed amount. BigInt arithmetic compares the allowance in raw units and formats the exact difference without floating-point rounding. Matching amounts do not prove a safe contract or an executed swap.
- **Expected-spender comparison:** optionally enter a plain 0x address from a source you independently trust. Case-insensitive byte comparison works without decimals and is separate from amount comparison. No checksum, chain, contract or ownership verification; a match is not a safety verdict. Try “Example: 20 tokens”, enter `0x2222222222222222222222222222222222222222` (invented), and decode: the amount matches but the repeated-1 spender differs. Only explicit summary copy includes the entered address; fixed shared links do not.
- **Shareable invented example:** [maximum allowance versus 20 tokens](https://lab.psychoagent.com/inspect.html?example=maximum-vs-20) loads only a fixed local preset. Copyable summaries are plain text; custom bytes are never encoded into share URLs.
- **Evidence explorer and prediction replay:** compare published, dated owner observations. Replay is local JavaScript, not a new UiPath run.
- **Journey suggestions:** optional bounded editorial feedback, not a Cloud-job queue or a promise to test a target. No visitor interaction directly or indirectly starts a Cloud job.

## Recorded unsigned approval-byte evidence

[Read the October 12 results](https://lab.psychoagent.com/unsigned-evidence.html) or inspect [their redacted JSON](public/unsigned-owner-observations.json). Two owner-controlled UiPath Maestro runs decoded invented unsigned approval requests behind the same synthetic “Swap 20 SYN” button:

| Input | UTC observation | Compared with button | Swap proved? |
| --- | --- | --- | --- |
| maximum | 2026-10-12T06:16:21.688Z | larger | no |
| bounded | 2026-10-12T06:17:12.198Z | equal | no |

Tested workspace/Flow revision: `ce6fcacdcc72c73ff6da0ce93fd9da5bd4982823`. Immutable public source snapshot: `0e1e9f19839e958c8e6564c92f7d25ca4cfd5c9d`. See [the exact Flow](https://github.com/psychoagentrh/consent-gap-lab/blob/0e1e9f19839e958c8e6564c92f7d25ca4cfd5c9d/uipath/ConsentGapSolution/Psycho_UnsignedApproval/Psycho_UnsignedApproval.flow) and [unsigned workflow reproduction instructions](UNSIGNED-APPROVAL.md).

These are manually curated, unsigned publications of twelve allowlisted outputs per run, not independently verifiable UiPath attestations. The Flow checks digest syntax but does not recompute the host-provided payload digest. Local tests recompute fixture digests separately. No browser capture, wallet, signing, broadcast, contract simulation or visitor-pasted input was tested by these runs. Historical results are not live guarantees. Job identifiers, tenant links and private traces are omitted.

### Older JSON-label evidence is a separate family

[October 6 observations](https://lab.psychoagent.com/evidence.html) and [redacted JSON](public/owner-observations.json) demonstrate the older fixed-host fixture-label classifier, not unsigned calldata decoding. Its tested workspace was `d85a1dd7450c74f0ba2c04612d7a834aa0cf209b`; immutable public source was `acad50062fe6b9b3b36ae7a13d356a1209a979d2`.

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

The suites start ephemeral local servers and exercise desktop, mobile and 320px layouts, copy and clear, invalid input recovery, share-link reload/history, no-JavaScript fallback, request privacy, dated evidence and automated accessibility. Use `CONSENT_GAP_BASE_URL` to test a deployment without starting Cloud jobs. Automated accessibility passes are not certification.

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

Local validation and packing require no login and prove package mechanics, not Cloud execution. For the other Flow's commands, package version and twelve-output contract, use UNSIGNED-APPROVAL.md. Cloud reproduction needs your own suitable UiPath tenant and license. Public execution remains disabled; feedback is not execution permission.

## Safety and operating boundaries

All shipped teaching fixtures and transaction addresses are invented. Canonical ABI checks do not prove token identity, spender safety, human consent, real contract behavior or an executed swap. The inspector accepts only a bounded flat transaction object or approval calldata; documented rejection boundaries are in BUILDERS.md. The result is inspectable scope evidence, not a security audit.

Original code is MIT; see LICENSE and ASSET-LICENSES.md. Product decisions, visual design and prior-art comparison are published in PRODUCT.md, DESIGN.md and NOVELTY.md. Deployment runs as an unprivileged user with a read-only public evidence path and no application wallet access.

Independent Psycho experiment. Not affiliated with or endorsed by UiPath. Useful issues should describe a confusing comparison, reproduction problem or boundary failure without credentials, private wallet data or tenant traces.
