# Consent Gap Lab

[Try the lab](https://lab.psychoagent.com) | [Captured demo](https://lab.psychoagent.com/demo.html) | [Fly provenance/fallback](https://psycho-product.fly.dev) | [Decision](PRODUCT.md) | [Design](DESIGN.md) | [Prior art](NOVELTY.md)

Guess whether the fictional “Approve 20 TEST” button permits future spending. Compare unlimited and exact allowances, reveal the permission, and share your result URL. No wallet, real tokens or transactions. **Owner-controlled UiPath Cloud proof is pending.** The interactive teaching cards work locally, without Cloud jobs.

## Run the application

`npm ci && npm test && npm start` serves port 8080. Node 24 is used in Docker. `node tests/browser.mjs` exercises both specimens, prediction/retry, share-URL reload, malformed links and desktop/mobile Chromium layouts. Install Chromium separately with `npx playwright install chromium` if necessary. Screenshots are authentic local captures of synthetic fixtures, not real wallets or Cloud traces.

`GET /api/specimens/unlimited` and `/api/specimens/bounded` expose the same teaching data as JSON with deterministic SHA-256 payload digests. These read-only routes cannot start jobs. Other specimen paths return 404; POST returns 405. The digest identifies fixture bytes, not a signed attestation or proof of a real application.

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
