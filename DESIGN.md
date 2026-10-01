# Design notes

Audience: a wallet user asked to approve a token, plus a UiPath builder inspecting a reproducible test fixture. Hero sets the question; neutral specimen A/B buttons switch between fictional approvals without revealing scope before the prediction; the visitor commits a prediction, reads scope and caveat, then copies a URL carrying case and answer. There is no wallet connect or submit-to-server path. Selection and reveal remain usable without Cloud runs.

Visual vocabulary: dark laboratory, acid-green cues, high-contrast specimen panels. Accessible button controls, announced result, responsive single-column mobile layout. No pictorial claim of an actual wallet screenshot. Static Node server serves only local files; CSP restricts resources. /healthz is the deployment readiness check, not a proof of journey functionality.

Evidence policy: local synthetic simulation is labelled throughout. The portable .flow currently starts and stops without inspecting a UI. A later source-bound UiPath observation must follow an owner-controlled run, two distinct repeatable inputs and a deliberately redacted public artifact before any powered claim. The UX should expose stale observation dates rather than imply live verification.
