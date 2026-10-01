# Capability comparison (2026-09-30)

Primary references to recheck before implementing the UiPath journey: [AgentHack winners](https://forum.uipath.com/t/here-are-the-uipath-agenthack-2026-winners/5766658), [Gauntlet](https://devpost.com/software/gauntlet-go-safe-or-go-home), [SpectreAI](https://devpost.com/software/zeroday), [FlakeWarden](https://devpost.com/software/flakewarden), [Synpress](https://github.com/synpress-io/synpress), [Well Tested](https://www.welltested.io/), [AgentTrial](https://agenttrial.tangvu.dev/), [UiPath Maestro Flow CLI](https://docs.uipath.com/uipath-cli/standalone/latest/user-guide/uip-maestro-flow). These are capability summaries, not a claim of first-ever invention.

| Prior work | Existing capability | Proposed difference here |
|---|---|---|
| Gauntlet (AgentHack grand prize) | Adversarial agent fights, evolving attacks, regression cases and human-reviewed remediation | Make a single crypto permission mismatch understandable to a wallet user, rather than adversarially harden a general agent. |
| SpectreAI (AgentHack Maestro BPMN) | Maestro-coordinated bug investigation and draft code patches from Slack reports | Explain consent scope to public users, not patch reported defects. |
| FlakeWarden (AgentHack Test Cloud) | Flaky-test scoring, grounded classification and human approval | Compare an apparent action with authorized scope; no flaky-test diagnosis. |
| Synpress | Wallet/browser testing, cached MetaMask and local Anvil | Public comparison of language versus permissions rather than developer wallet test automation. |
| Well Tested | Browser journey planning, screenshots, shareable proof and recurring health | Focus on one semantic consent gap, with user prediction and redacted dated evidence, rather than generic journey coverage. |
| AgentTrial | Sealed trials, deterministic assertions and receipts for agent claims | A wallet-user education interaction focused on what token approval permits, not general agent verification. |

Current delivery only implements the synthetic interaction, not the proposed UiPath evidence mechanism. A generic runner with screenshots would not differentiate it. Consult current source again when implementing the real journey; descriptions can change.
