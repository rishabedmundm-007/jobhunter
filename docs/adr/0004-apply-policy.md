# ADR-0004: Application submission policy

**Date:** 2026-09-10
**Status:** Accepted
**Deciders:** Rishab

## Context

JobHunter can apply to jobs automatically (Playwright, per-ATS adapters) or hand them to the user ready-to-apply. Automation is risky: most enterprise ATS (Workday, Taleo, iCIMS) use CAPTCHAs and bot detection. Greenhouse and Lever forms are structurally predictable but still fragile. Recruiters penalize spray-and-pray. Wrong automation = worse than no automation. Users need full control over what gets submitted.

## Decision

**Review gate by default.** The pipeline generates an ATS-clean, role-specific resume and pre-fills application answers, then presents a "Ready to apply" card on the dashboard. User approves with one click. Auto-submit is **opt-in per ATS family** (e.g., `auto_apply.greenhouse = true`) in user settings, never global. Even with auto-submit enabled, a daily cap (e.g., 5 per day) prevents runaway loops.

## Consequences

Positive:
- Full user control; no silent failures or unintended submissions
- No bot detection or CAPTCHA friction
- Respects recruiter experience
- Compliance-friendly (no automated recruiting seen as spammy)
- Transparent audit trail (user always sees what was sent)

Negative:
- One extra click per application (addresses manual labor concern)
- Requires a dashboard interaction (not fully headless)

Neutral:
- Auto-submit opt-in means enthusiastic power users can still automate their favorite ATS families

## Alternatives considered

- **Fully automatic:** Simpler UI, but risky and likely to upset users when something goes wrong; rejected
- **Manual only:** Safe but defeats the purpose of tooling; not chosen
- **Per-application approval:** Slower than per-ATS toggle; overcomplicated

## Related decisions

ADR-0003 (sources policy constrains which ATS are safe to automate).

## Implementation notes

- Greenhouse and Lever adapters are safe to automate (structured forms, no CAPTCHA)
- Workday/Taleo/iCIMS adapters trigger "manual fallback" (pre-filled answers + resume link for the user to submit)
- C2C emails show as "manual packet" (pre-filled form + resume download)
