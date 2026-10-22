# Architecture

## Shape

Eventora AI is a two-service application with a same-origin proxy between the browser and the API.

```
Browser (React 19 / Next 16 App Router)
  ├── Public landing + auth pages (server-rendered)
  ├── Protected studio pages (server components, cookie forwarded)
  └── Client mutations → /api/backend/* (Next route handler)
                             │  cookie, CSRF header, Origin
                             ▼
                       FastAPI (uvicorn)
                         ├── middleware: request id, origin, body limit, headers, logging
                         ├── auth dependency: opaque session → user
                         ├── ownership helpers: every private record
                         ├── services: ML inference, AI provider/fallback
                         └── SQLAlchemy 2 → SQLite / PostgreSQL
```

### Why a proxy

- The browser only ever talks to the frontend origin, so session cookies stay on that origin and CORS is not required for normal use.
- `BACKEND_INTERNAL_URL` remains a server-only value; it is never embedded in client JavaScript.
- The route handler forwards `Cookie`, `X-CSRF-Token`, and `Origin`, and returns upstream `Set-Cookie` headers unchanged (host-only, `Path=/`).
- The proxy does not cache. API responses are explicitly `no-store`.

The backend still supports direct CORS access for local tooling and for a split-domain deployment, but only origins listed in `FRONTEND_ORIGINS` are allowed. Wildcards are never used with credentials.

## Frontend

- **Next.js App Router** with React Server Components.
- `app/(studio)/layout.tsx` calls `requireUser()` and redirects unauthenticated visitors to `/sign-in`. Every studio page also loads its data server-side using the forwarded cookie.
- Client components handle interactivity: the event wizard, workspace mutations, assistant chat, recommendation re-ranking, settings actions, and the landing-page cost estimator.
- **Tailwind CSS v4** design tokens live in `app/globals.css` (`@theme inline`). Reusable primitives: `components/ui/*`, `components/studio/ui.tsx`.
- **Recharts** renders the budget-vs-estimate bar chart; **Lucide** supplies icons.
- Fonts are self-hosted (`Frontend/app/fonts`): Fraunces variable and Manrope variable, both OFL. Local fonts avoid third-party font requests and CSP loosening.

### Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Editorial landing, category gallery, process, live ML demo, AI preview, trust, FAQ |
| `/sign-up`, `/sign-in` | Public | Account creation and session sign-in |
| `/forgot-password`, `/reset-password` | Public | Token-based reset |
| `/dashboard` | Authenticated | Aggregates, upcoming events, chart, risk mix, tasks, recent plans |
| `/events/new` | Authenticated | Three-step wizard with validation and pre-save estimate |
| `/events/[id]` | Authenticated owner | Overview, plan, timeline, checklist, budget, notes, assistant |
| `/recommendations` | Authenticated | Event-scoped KNN catalogue ranking |
| `/settings` | Authenticated | Profile, privacy, deletion, AI/model configuration status |

`robots.txt` disallows all private routes and AI pages. Private APIs send `Cache-Control: no-store`.

## Backend

```
backend/app/
  main.py            app factory, middleware, exception handlers, routers
  core/              settings, Argon2/token helpers, DB-backed rate limiter
  auth/deps.py       cookie session → user, CSRF dependency, cookie writers
  database/          engine, session factory, SQLAlchemy models
  api/               auth, events, dashboard, ML, AI, system routes
  ml/                dataset generator, training, inference service, catalogue
  ai/                provider client, hardened prompts, fallback, orchestration
  schemas/           strict Pydantic request/response and plan schemas
  migrations/        Alembic environment and initial revision
```

### Data model

```
users ──< auth_sessions
  │
  ├──< password_reset_tokens
  └──< events ──< plans
        ├──< tasks
        ├──< expenses
        └──< notes

rate_limit_buckets   (database-backed fixed-window counters)
```

- All IDs are 32-character hex UUIDs generated server-side.
- Foreign keys use `ON DELETE CASCADE`; event deletion removes plans, tasks, expenses, and notes.
- Events store `budget_cents` and `predicted_cost_cents` as integers, avoiding floating-point money drift in persistence.
- `GetOwnedEvent` filters by `Event.id AND Event.user_id`; a mismatched owner receives **404**, not 403, to avoid confirming existence.
- Nested resources are fetched with `event_id` plus the verified event, not by task/expense ID alone.

### Error contract

```
{ "error": { "code": "validation_error", "message": "Some fields need attention.",
             "fields": [{ "field": "guest_count", "message": "..." }],
             "request_id": "..." } }
```

- Pydantic validation errors are reduced to field names and safe messages.
- Unhandled exceptions log a stack trace server-side with the request ID and return a generic 500.
- Every response carries `X-Request-ID`; request logs record method, path, status, duration, and request ID — never bodies, prompts, tokens, or cookies.

## ML service

`MLEngine` lazily loads `joblib` pipelines from `ML_ARTIFACTS_DIR` behind a lock. Missing files raise `ModelNotTrained`, mapped to a structured 503. Metrics are read from JSON artifacts; if an artifact is absent, `trained` is false and the metrics payload is null — the API does not fabricate numbers.

The cost estimate is refreshed when planning-relevant event fields change and on create, but estimation failures never block CRUD.

## AI service

1. Build a context object from the owned event only.
2. Wrap user-controlled strings in `<untrusted_event>` blocks, strip angle-bracket role markers, and neutralize common override phrases.
3. Send an immutable system policy plus the wrapped context to an OpenAI-compatible endpoint with a hard timeout and token ceiling.
4. Strip code fences, parse a JSON object, reconcile budget totals, and validate with `EventPlanPayload` (extra fields forbidden).
5. Retry once with a repair instruction on parse/validation failure; otherwise use the deterministic planner, labeling the engine.
6. Persist only validated payloads. Seed checklist tasks exactly once.

The assistant has no tools, no database access, and no ability to mutate records. Chat is stateless: history is supplied by the client, bounded to six turns, and never stored.

## Trade-offs

- **Self-hosted auth instead of a managed provider**: no Supabase credentials existed in this environment. The implementation avoids custom JWTs and uses Argon2id plus opaque hashed sessions. A hosted deployment should migrate to Supabase Auth; ownership checks remain server-side either way.
- **SQLite for local development**: simple and reproducible. PostgreSQL is supported via `DATABASE_URL`; use Alembic for schema changes.
- **Synthetic ML data**: honest and reproducible, but not market evidence. Real transaction data would require licensing and retraining.
- **Fallback-first AI**: the product remains useful without a paid provider, and the UI never pretends a fallback plan came from an LLM.
- **No uploads**: deliberately omitted; adding them requires content validation, private storage, per-user download authorization, and document-parsing timeouts.
