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

2026-10-06 extension: a local, strict ERC-20 approval calldata decoder lets visitors apply the synthetic lesson to their own request without wallet access, metadata guesses or uploads. ABI decoding is established functionality and not a novelty claim. The contribution here is the consent-specific teaching interaction plus practical follow-through. The narrow dated observation proof was completed later that day (see below). No competitor absence or first-ever claim is inferred.

2026-10-06 proof update: two distinct historical owner runs now have verified HTTP JSON outputs at tested Flow revision d85a1ddc7bb9cd1cc6a13b4d5db95474228f1fe9. The public evidence explorer exposes observed times, redacted output, source and local fixture-digest comparison. It does not claim browser automation, wallet auditing, cryptographically authenticated Cloud receipts or proof of newer local features.

Current delivery implements the synthetic interaction, local decoder and narrow dated UiPath JSON observation evidence. A generic runner with screenshots would not differentiate it. Consult current source again when implementing a real opt-in UI journey; descriptions can change.
