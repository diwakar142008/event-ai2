# Eventora AI demo recording

The Playwright demo is a real browser walkthrough of the app. It records the
homepage estimator, normal account signup, event brief, trained cost estimate,
generated plan, budget allocation, timeline, checklist, budget workspace, and
assistant. It uses a new synthetic account and event on every run.

The script is restricted to `localhost`, `127.0.0.1`, or `::1` on port `3001`.
Start the demo backend with its own SQLite database before running it; do not
point it at the app on port `3000`, a shared database, or a hosted environment.
Signup and event creation use the normal UI flow. No credentials are saved or
printed.
The demo disables external AI-provider calls, so plan and assistant results use
the app's explicitly labelled deterministic fallback. ML predictions require
the trained artifacts in `backend/ml_artifacts/`; train them if they are absent.

## Run locally (Windows PowerShell)

Requirements: the repository's Python 3.12 virtual environment, Node.js,
frontend dependencies, backend dependencies, and trained model artifacts.

1. In **Terminal 1**, start FastAPI against a dedicated demo database:

   ```powershell
   Set-Location .\project2\event-ai2\backend
   $env:APP_ENV = "development"
   $env:APP_SECRET = "eventora-local-demo-only-secret"
   $env:DATABASE_URL = "sqlite:///./eventora-demo.db"
   $env:FRONTEND_ORIGINS = "http://127.0.0.1:3001"
   $env:OAUTH_FRONTEND_URL = "http://127.0.0.1:3001"
   $env:AI_PROVIDER = "none"
   $env:AI_API_KEY = ""
   ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
   ```

   If the model files are missing, train them once from the repository root:

   ```powershell
   Set-Location .\project2\event-ai2
   .\.venv\Scripts\python.exe backend\scripts\train_models.py
   ```

2. In **Terminal 2**, start the frontend on the demo-only port:

   ```powershell
   Set-Location .\project2\event-ai2\frontend
   $env:BACKEND_INTERNAL_URL = "http://127.0.0.1:8001"
   $env:NEXT_DIST_DIR = ".next-demo"
   npm run dev:demo
   ```

3. In **Terminal 3**, install Playwright's Chromium browser once if necessary,
   then run the recorded walkthrough:

   ```powershell
   Set-Location .\project2\event-ai2\frontend
   npx playwright install chromium
   npm run demo
   ```

   Playwright records WebM video automatically. The file is written to
   `project2\event-ai2\artifacts\demo\eventora-demo-<timestamp>.webm`.
   Use `DEMO_HEADLESS=1` to run headlessly, `DEMO_OUTPUT_DIR` to change the
   output folder, or `CHROME_EXECUTABLE` to use an installed Chrome binary.
   The script waits for real UI results, reports browser/API errors, and exits
   non-zero if a step fails. A partial WebM is retained for diagnosis.

The demo database is `backend\eventora-demo.db` (plus SQLite WAL files) and is
ignored by Git. Each run creates another randomly named demo user in this
database. To start from a clean slate, stop the backend first and remove only
that demo database and its `-wal`/`-shm` companions. Never clean the normal
`eventora.db` or point the demo at it.

## Run event CRUD browser regression

With the same isolated backend and frontend running, use `npm run test:e2e` from
`frontend`. The test creates a synthetic account, creates and edits one event,
then deletes only that event through its authenticated API. It is restricted to
`localhost`/`127.0.0.1` on port `3001`; it does not clean up the synthetic
account. Keep the dedicated demo database isolated from normal or hosted data.
Install Playwright's Chromium browser once with `npx playwright install chromium`
if needed.

## Two-minute narration

| Approx. time | Narration |
|---|---|
| 0:00–0:12 | “Eventora AI brings the details of a celebration into one planning studio. Let’s start with a sample cost estimate.” |
| 0:12–0:25 | “The cost model is a trained Random Forest using a documented synthetic dataset. This is a planning guide, not a vendor quote.” |
| 0:25–0:48 | “I’ll create a private demo workspace and set up a 180-guest garden celebration in Portland. The brief captures the occasion, date, location, guest count, budget, and style.” |
| 0:48–1:02 | “Before saving, the app runs its cost and budget-risk models on the brief. The estimate is an actual model response; no vendor is contacted.” |
| 1:02–1:20 | “The saved workspace turns that brief into a structured plan. This run uses Eventora’s labelled deterministic fallback, not a connected language-model provider.” |
| 1:20–1:38 | “The plan allocates the budget and lays out preparation milestones and an event-day flow. The checklist tracks practical work in one place.” |
| 1:38–1:52 | “The budget workspace compares the plan with recorded spending. The assistant can discuss this event’s plan, while clearly stating it cannot check availability or book suppliers.” |
| 1:52–2:00 | “Eventora AI: your imagination, intelligently orchestrated. Estimates and recommendations are planning guidance, not confirmed market prices.” |

Allow the browser steps to finish naturally; the actual recording may run longer
than two minutes on a slower machine. Trim pauses and transitions during editing
to reach the target without speeding up loading or implying a result appeared
before it did.

## Export or record MP4

Playwright's built-in recording format is WebM. If FFmpeg is installed, convert
the completed recording to MP4:

```powershell
Set-Location .\project2\event-ai2
$recording = Get-ChildItem .\artifacts\demo\eventora-demo-*.webm |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
ffmpeg -i $recording.FullName `
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart `
  .\artifacts\demo\eventora-demo.mp4
```

Check the resulting MP4 in a media player before sharing it. To record manually
instead, use OBS Studio: add **Window Capture** for the 1440×900 Chromium window,
set the canvas/output to 1920×1080 or 1440×900 at 30 fps, record to MKV, then
use **File → Remux Recordings** to export MP4. Keep the demo server on its
isolated database and confirm no real account data or secrets are visible
before publishing.

Playwright captures browser video without narration audio. Record the narration
with OBS microphone input or add it as a voiceover in a video editor; the
included narration script is a guide, not an audio track.

## Verification status

The Playwright script records the current app UI and validates the expected
model, plan, budget, timeline, checklist, and assistant results. It does not
claim that an MP4 exists: the recording is only produced when `npm run demo`
finishes, and conversion to MP4 is a separate step.
