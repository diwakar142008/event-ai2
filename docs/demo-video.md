# Demo video — placeholder

**Status: not recorded.** A video file is not included in this repository. The script below is the recording plan, so the demo can be captured without inventing outcomes.

Suggested length: 2–3 minutes. Record with synthetic data only. Do not show `.env`, terminal history containing keys, or real user data.

## Storyboard

| Time | Screen | Action / narration |
|---|---|---|
| 0:00–0:12 | Landing hero | “Eventora AI is an editorial planning studio with real cost intelligence.” Scroll slowly through the hero and category gallery. |
| 0:12–0:30 | `#intelligence` | Change guests to 240, run the estimator, show the estimate and model card. Say: “Trained on a documented synthetic dataset; these are planning ranges, not quotes.” |
| 0:30–0:45 | Sign-up | Create a synthetic account, land on the empty dashboard, open **New event**. |
| 0:45–1:15 | Wizard | Fill the brief, run the pre-save estimate, show the budget-risk label, create the workspace. |
| 1:15–1:45 | Workspace overview | Show the summary, ML estimate, risk triage, recommendations. Click **Generate plan**; show the engine badge (deterministic fallback if no provider is configured). |
| 1:45–2:10 | Plan / timeline | Show budget lines, preparation timeline, run of show, checklist. Toggle one task and add an expense. |
| 2:10–2:25 | Assistant | Ask “Where can I save money without losing the atmosphere?” Show the labelled reply and the “not saved” note. |
| 2:25–2:40 | Recommendations | Switch event, re-rank, read one “why it surfaced” reason, point out the catalogue/not-a-vendor label. |
| 2:40–2:55 | Settings | Show AI status without keys, export link, deletion controls, model readiness. |
| 2:55–3:00 | Close | “Your imagination. Intelligently orchestrated.” |

## Capture setup

- Use a 1440×1000 browser window at 100% zoom, or 390×844 for the mobile segment.
- Seed three or four synthetic events so the dashboard is not empty.
- If demonstrating a real provider, mention that it is configured on the server; never show the key. If no provider is configured, explicitly say the plan is the deterministic fallback.
- Hide the Next.js dev indicator (`devIndicators: false` is already configured in `next.config.ts`).
- Save the video as `docs/demo.mp4` only after recording, and update this page. Until then this is a placeholder, not evidence.
