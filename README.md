# Consent Gap Lab

[Try the lab](https://lab.psychoagent.com) | [Captured demo](https://lab.psychoagent.com/demo.html) | [Fly provenance/fallback](https://psycho-product.fly.dev) | [Decision](PRODUCT.md) | [Design](DESIGN.md) | [Prior art](NOVELTY.md)

Guess whether the fictional “Approve 20 TEST” button permits future spending, or [skip the guess and compare both permissions](https://lab.psychoagent.com/?view=compare#comparison). The side-by-side cards expose identical button copy, different allowance limits, and the fact that neither approval executes a swap. Share the comparison URL or your prediction result. No wallet, real tokens or transactions. **Two owner-controlled UiPath Maestro runs observed the owned JSON fixtures on 2026-10-06.** [Read their deliberately redacted outputs](https://lab.psychoagent.com/evidence.html); this is historical HTTP JSON observation, not browser automation. The public teaching cards and local approval decoder do not depend on Cloud jobs and are not proved by these older runs.

## Run the application

`npm ci && npm test && npm start` serves port 8080. Node 24 is used in Docker. `node tests/browser.mjs` exercises both specimens, prediction/retry, comparison/direct-link reload, clipboard success and failure, keyboard focus, malformed links and desktop/mobile Chromium layouts. `CAPTURE_COMPARE_DEMO=1 node tests/browser.mjs` refreshes the authentic comparison captures under `public/demo/`. Install Chromium separately with `npx playwright install chromium` if necessary. Screenshots are authentic local captures of synthetic fixtures, not real wallets or Cloud traces.

`GET /api/specimens/unlimited` and `/api/specimens/bounded` expose the same teaching data as JSON with deterministic SHA-256 payload digests. These read-only routes cannot start jobs. Other specimen paths return 404; POST returns 405. The digest identifies fixture bytes, not a signed attestation or proof of a real application.

## Local approval request inspector

[Decode locally](https://lab.psychoagent.com/inspect.html): paste only the hex transaction `data` for the standard ERC-20 `approve(address,uint256)` layout, or choose an invented example. The inspector displays the spender and exact raw uint256 allowance, distinguishing maximum, bounded and zero requests. Optional caller-supplied decimals (0–36) format an amount without looking up or guessing token metadata. A bounded amount is not a safe-spender verdict; a zero request is not proof of successful revocation.

No wallet, RPC, Cloud job, upload, app persistence or calldata-bearing URL. CSP denies network connections and form submissions on this page, including when JavaScript is unavailable; form fields also have no serialization names. Copying a summary is an explicit clipboard action containing the decoded spender and amount; the app does not publish it. The decoder refuses unsupported selectors, non-canonical address padding, malformed length, extra bytes, signatures and transaction JSON. Permit/Permit2, NFT permission interpretation and multicalls are outside scope. **ERC-721's per-token `approve(address,uint256)` has identical encoding: the second value is a token ID, not an ERC-20 allowance. The decoder cannot distinguish these standards without external verification.** Other contracts can also give the bytes different behavior; the destination contract, token standard, chain, sender, existing allowance, decimals and receipt are not verified.

`node tests/inspector-browser.mjs` tests desktop/mobile decoding, precision, refusals, stale-result clearing, keyboard/error recovery, clipboard success/denial and no interaction requests. `CAPTURE_INSPECT_DEMO=1 node tests/inspector-browser.mjs` captures only the invented 20-token example; never use visitor data for public screenshots. Encoding references: [ERC-20](https://eips.ethereum.org/EIPS/eip-20), [ERC-721's identical approval signature](https://eips.ethereum.org/EIPS/eip-721) and [Solidity ABI](https://docs.soliditylang.org/en/latest/abi-spec.html). The `0x095ea7b3` selector is the first four bytes of Keccak-256 of `approve(address,uint256)`.

Optionally enter the amount shown by the button plus token decimals you supply. The inspector compares it to the decoded request and shows **larger / equal / smaller** with an exact difference. It uses integer math, including tiny fractions and full uint256 values, and refuses precision loss, signs, exponents, commas and overflow. A blank amount leaves the original decoder unchanged. Button text and decimals are not authenticated; matching or smaller values are **not** a safety verdict, evidence of honesty or a completed purchase. The invented maximum example compares a max-uint256 request against an entered 20-token amount; the zero example uses 0.

`node tests/approval-comparison-browser.mjs` covers the comparison at desktop/mobile widths, precision/overflow refusal, stale-state clearing, keyboard recovery, clipboard caveats, no network/persistence/URLs and JS-disabled privacy. `CAPTURE_AMOUNT_DEMO=1 node tests/approval-comparison-browser.mjs` updates the public inspector captures using only invented maximum-vs-20 data. The older `CAPTURE_INSPECT_DEMO` capture mode still produces the bounded example; do not use it to overwrite the gallery without also updating its description. Neither local comparison nor browser test is UiPath Cloud evidence.

## Dated owner observations

`/evidence.html` displays both allowlisted owner-run outputs and compares each published SHA-256 with the current local teaching fixture. Switch inputs or share `/evidence.html?case=bounded`. This loads a static, deliberately redacted JSON publication once; input switching and digest calculation stay in the browser. No visitor-triggered jobs. A digest match identifies teaching bytes, not an authenticated job, wallet safety verdict or refreshed Cloud test. Changed bytes produce a warning. Failed HTTP/schema/JSON loading fails visibly and offers retry; the raw artifact remains linked for JS-disabled visitors.

Observed times are 2026-10-06T09:06:48.685Z (unlimited) and 2026-10-06T09:49:01.425Z (bounded), both at tested workspace/Flow revision `d85a1ddc7bb9cd1cc6a13b4d5db95474228f1fe9`. Public source snapshot `acad500cabe86be373481fe66e505f432ae906db` is the gateway-published mapping for that tested revision and contains the same unchanged Flow. `/owner-observations.json` is manually curated from gateway-verified receipts: bounded input and eight allowlisted outputs only, without tenant identifiers, private operation/job IDs, credentials or raw traces. It is unsigned published evidence, not an independently verifiable UiPath attestation. Newer app behavior is covered separately by local/live browser tests, not these historical Cloud receipts.

`npm run test:browser` covers inspector, entered-amount comparison, prediction/comparison, evidence and automated accessibility/reflow; `CAPTURE_EVIDENCE_DEMO=1 node tests/evidence-browser.mjs` captures the public evidence UI at desktop/mobile widths. These are screenshots of the publication, not UiPath tenant traces.

## Automated accessibility regression

`npm run test:accessibility` runs pinned axe-core/Playwright checks across 15 interaction and recovery states at 1280, 390 and 320 CSS pixels (45 local audits), plus a document horizontal-overflow assertion. It is included in the standard `npm run test:browser` command. Use `CONSENT_GAP_BASE_URL=https://lab.psychoagent.com npm run test:accessibility` to check a deployed copy; live mode covers the 13 non-fault states at each width (39 audits) and does not inject HTTP failures. The Fly fallback can be checked the same way. An optional `ACCESSIBILITY_REPORT=/absolute/private/path.json` saves detailed findings outside the public repository.

The selected WCAG A/AA and best-practice rule tags provide an automated regression, **not a WCAG conformance certification, screen-reader test or human visual review**. Axe's incomplete checks are retained in the report rather than rewritten as passes. A supplemental check reads Chromium's computed styles for every directly text-bearing hero element and bounds the current single-color-to-transparent gradient over its opaque root. Each background channel stays between the root and opaque gradient stop; monotone WCAG luminance yields a conservative contrast floor. All hero text must meet 4.5:1, including large headings. New gradients, opacity, extra backdrops and unsupported rendering effects are refused rather than guessed. Local-only bad-color and unsupported-gradient controls prove the check can fail. This narrowly answers the gradient-text uncertainty; other incomplete checks (including the decorative, aria-hidden swap arrow) remain recorded for review. This suite neither runs nor proves the UiPath Flow and creates no Cloud evidence.

## Portable UiPath Flow

Source: `uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow`. Manual start → managed HTTP GET of the owned JSON specimen → strict evaluator → end outputs. Input `specimenCase` is restricted by the gateway manifest to `unlimited` or `bounded`. No arbitrary URLs, credentials or wallet actions. HTTP errors and invalid data fault the run; they are not replaced with fabricated observations.

Pinned CLI: `@uipath/cli` 1.202.1. Set `UIPATH_CLI_DISABLE_AUTOINSTALL=true`, `UIPATH_CLI_DISABLE_VERSION_SYNC=true`, and `UIPATH_CLI_DISABLE_TOOL_LINE_CHECK=true` before local authoring. No login is needed for validation/packing:

```sh
uip --version
uip maestro flow validate uipath/ConsentGapSolution/ConsentGap/Psycho_ConsentGap.flow --strict-expressions
uip maestro flow pack uipath/ConsentGapSolution/ConsentGap uipath/packages --name Psycho.ConsentGap --version 1.0.0 --author Psycho
```

The pin requires the sanitized package-name filename `Psycho_ConsentGap.flow`, then emits `Psycho.ConsentGap.flow.Flow.1.0.0.nupkg`. Validation has a nonfatal canonical-layout warning because the parent is named ConsentGap. The actual packed file is committed and declared in `uipath/workflows.json`. A builder can import/run their own copy in their own licensed tenant; adjust the owned fixture host when reproducing. Do not put tokens in source or command lines. [Official Flow documentation](https://docs.uipath.com/uipath-cli/standalone/latest/user-guide/uip-maestro-flow).

Outputs: observed case, whether scope exceeds the button, `approvalIsSwap=false`, verdict, schema, payload digest, observation timestamp, and method. **This spike observes HTTP JSON, not a browser, wallet dialog or real swap.** Offline validation, packing and executing the embedded script in local tests do not prove Cloud behavior. Timestamp/revision-bound redacted receipts must precede a powered claim.

## Feedback

[Suggest a synthetic or opt-in case](https://github.com/psychoagentrh/consent-gap-lab/issues), correct wording or report an accessibility defect. Suggestions are editorial input, never an automatic job queue or promise to run one. Visitor-triggered Cloud execution remains disabled. Independent experiment, not affiliated with or endorsed by UiPath.
