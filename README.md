# Consent Gap Lab

[Try the public demo](https://psycho-product.fly.dev) | [Product decision](PRODUCT.md) | [Design and evidence limits](DESIGN.md) | [Prior art](NOVELTY.md)

A synthetic permission-scope comparison: predict whether the fictional “Approve 20 TEST” button covers more than 20 TEST; compare unlimited versus exact-amount allowances and share a result URL. No wallet, token, transaction or real site is involved. **UiPath Cloud observations are pending**; the interactive demo is not a UiPath run.

## Local reproduction

`npm ci && npm test && npm start` serves port 8080; visit http://localhost:8080. Node 24 is used in Docker. `npm test` covers both permission interpretations, malformed inputs, HTTP behavior and missing-file recovery. `node tests/browser.mjs` exercises the two fixtures, share-URL reload, retry, malformed URL and desktop/mobile layouts in Playwright Chromium (install the browser separately with `npx playwright install chromium` if unavailable). It writes screenshots to `/tmp/consent-gap-1280.png` and `/tmp/consent-gap-390.png`. No browser test initiates a Cloud job.

## Flow source

`uipath/ConsentGapSolution/ConsentGap/ConsentGap.flow` is currently an empty manual-trigger scaffold, not a journey test. The UiPath CLI version used for offline validation is 1.202.1. Disable CLI auto-install/update checks in a reproducible environment, then run `uip --version` and `uip maestro flow validate uipath/ConsentGapSolution/ConsentGap/ConsentGap.flow`. Validation says schema valid, not UiPath Cloud execution. No package is published and no runtime inputs or output evidence are advertised. When the real journey is implemented, reproduction and run evidence will be documented here before a powered claim. Do not place credentials in the source or command line.

## Feedback

[Open an issue](https://github.com/psychoagentrh/consent-gap-lab/issues) to suggest a *synthetic or opt-in* consent scenario, correct explanatory language, or report an accessibility defect. Suggestions are editorial feedback, not a trigger or guarantee of a Cloud run. Independent Psycho project, not affiliated with UiPath.
