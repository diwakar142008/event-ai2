# Deployment

## Current status

The application runs locally in this workspace: FastAPI on `127.0.0.1:8000`, Next.js on port 3000. **Nothing has been deployed to a public host**, and no external service (LLM, auth provider, database, email) is connected. The sections below are the setup path, not a claim of completed deployment.

Freebuff Sites can host a Next.js frontend (including API route handlers) but **cannot host a Python/FastAPI service**. A hosted deployment therefore needs a separate backend host, or a rewrite of the API. The documented architecture assumes two hosts.

---

## Local development

```bash
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"  # APP_SECRET

python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python backend/scripts/train_models.py

cd backend
PYTHONPATH=. ../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm ci
BACKEND_INTERNAL_URL=http://127.0.0.1:8000 NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run dev
```

Open `http://localhost:3000`. Use `http://localhost:3000` rather than `127.0.0.1` unless you add the latter to `FRONTEND_ORIGINS`; Origin validation applies to mutations.

Tests and build:

```bash
cd backend && PYTHONPATH=. ../.venv/bin/python -m pytest
cd frontend && npm run typecheck && npm run build
```

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `APP_ENV` | backend | `development`, `test`, or `production` |
| `APP_SECRET` | backend | IP pseudonymisation; must be a strong random value in production |
| `DATABASE_URL` | backend | `sqlite:///...` locally or `postgresql+psycopg://...` |
| `AUTO_CREATE_TABLES` | backend | `true` locally/tests; `false` with migrations in production |
| `FRONTEND_ORIGINS` | backend | Exact comma-separated origins allowed for CORS and mutation Origin checks |
| `SESSION_TTL_DAYS` | backend | Session lifetime (default 7) |
| `COOKIE_SECURE` | backend | Override secure-cookie inference |
| `AUTH_DEV_RESET_ECHO` | backend | Development-only reset token echo; **false** in production |
| `MAX_REQUEST_BYTES` | backend | Body-size ceiling |
| `RATE_LIMIT_*` | backend | Auth/AI/ML per-window limits |
| `ML_ARTIFACTS_DIR` | backend | Directory containing trained joblib/JSON artifacts |
| `AI_PROVIDER` | backend | `none` or `openai` |
| `AI_API_KEY` | backend secret | Provider credential; never expose to the browser |
| `AI_BASE_URL`, `AI_MODEL` | backend | OpenAI-compatible endpoint and model |
| `AI_TIMEOUT_SECONDS`, `AI_MAX_OUTPUT_TOKENS` | backend | Cost/abuse limits |
| `BACKEND_INTERNAL_URL` | frontend server | FastAPI base URL used by server components and the proxy |
| `NEXT_PUBLIC_SITE_URL` | frontend | Canonical public origin for metadata (no secrets) |

Do not pass any secret to `NEXT_PUBLIC_*`; those values are inlined into browser bundles.

---

## Backend hosting

Any Python host that runs an ASGI server works (Render, Railway, Fly.io, a VM with systemd, ECS, etc.).

Build/start (example):

```bash
pip install -r backend/requirements.txt
python backend/scripts/train_models.py          # or bake artifacts into the image
cd backend && PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --proxy-headers --forwarded-allow-ips="<trusted proxy CIDR>"
```

Guidance:

- Run behind a trusted reverse proxy that terminates HTTPS. Only trust forwarded headers from that proxy; otherwise rate limits can be spoofed.
- Set `APP_ENV=production` (disables `/docs` and enables secure cookies and HSTS).
- Persist `ML_ARTIFACTS_DIR` or bake artifacts into the image. Training is deterministic and takes seconds; the Random Forest file is about 9 MB.
- Set `FRONTEND_ORIGINS` to the exact HTTPS frontend origin(s). Include `www` only if it is a separate origin.
- Set `AUTO_CREATE_TABLES=false`, run migrations, and use a least-privilege DB user.
- Add edge/WAF rate limits in front of auth and AI routes; the built-in limiter is shared via the database but is not DDoS protection.
- Record request IDs in your log aggregator; do not enable body logging.

## Frontend hosting

Build with Node 20+:

```bash
cd frontend
npm ci
BACKEND_INTERNAL_URL=https://api.example.com NEXT_PUBLIC_SITE_URL=https://eventora.example.com npm run build
npm start   # or deploy the Next build to your platform
```

The server must be able to reach the backend over HTTPS. The browser never needs the backend URL. If you deploy the Next app to Freebuff Sites, use `sites_prepare_next`/Sites tooling and set the backend URL through the platform's environment variables; the FastAPI service must still live elsewhere. A purely static export will not work because protected pages and the API proxy require a server runtime.

## Database

Local default: SQLite file. Production: PostgreSQL.

1. `psycopg[binary]==3.3.6` is pinned in `requirements.txt` as the PostgreSQL driver.
2. Set `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/eventora`.
3. Run migrations:

```bash
cd backend
DATABASE_URL=... PYTHONPATH=. alembic upgrade head
```

4. Use a dedicated role with only `CONNECT`, `USAGE`, and table DML/DDL privileges required for migrations.
5. Enable automated backups and test a restore.

The API's ownership filters are the primary access control. If you additionally adopt Supabase Auth + Postgres RLS:

- Map application `users.id` (32-char hex) to `auth.users.id` (UUID) or change the schema to UUIDs.
- Enable RLS on `events`, `plans`, `tasks`, `expenses`, `notes`, and `auth_sessions`/`password_reset_tokens`.
- Policies should use `auth.uid()` and join child rows through `events.user_id`; for example, `tasks` policies need `EXISTS (SELECT 1 FROM events WHERE events.id = tasks.event_id AND events.user_id = auth.uid())`.
- Never ship the Supabase service-role key to the browser or to the Next client bundle.
- Test with two real accounts, including direct REST attempts at another user's event ID.

## Authentication

The current profile is self-hosted:

- Argon2id password hashing, opaque hashed sessions, HttpOnly cookies, CSRF double-submit.
- Password reset tokens are stored hashed and expire in 30 minutes; all sessions are revoked on reset.
- Development can echo the reset token because no email provider is configured. In production set `AUTH_DEV_RESET_ECHO=false` and wire transactional email delivery (or move to managed auth).

Managed-auth upgrade path (recommended for a public multi-user launch):

1. Create a Supabase project and enable email/password auth plus email verification.
2. Add `@supabase/ssr` to the frontend and implement the documented cookie-based server client.
3. Verify the Supabase JWT in FastAPI (JWKS), map `sub` to a local `users` row, and keep the same ownership filters.
4. Remove the custom session endpoints or leave them disabled.
5. Enable RLS as defense-in-depth, and keep server-side ownership checks regardless.

## Generative AI

```dotenv
AI_PROVIDER=openai
AI_API_KEY=<secret>
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

- Store the key in the host's secret manager, never in Git or a frontend variable.
- Review the provider's data retention and training policy; obtain consent where required.
- Keep timeouts and token ceilings conservative; adjust only with cost monitoring.
- If the provider is unset or fails, the deterministic planner runs and is labeled in the UI.
- Test with a small prompt before enabling for users; provider integration was not tested here because no key was configured.

## CORS, cookies, HTTPS

- Serve both frontend and backend over HTTPS.
- `FRONTEND_ORIGINS` must match the browser origin exactly (scheme, host, port). No wildcard.
- With the same-origin proxy, browsers send cookies to the frontend host and the proxy forwards them.
- If you bypass the proxy and call the API cross-site, cookies need `SameSite=None; Secure`, and CSRF/Origin handling still applies. Prefer the proxy.
- HSTS is emitted in production by both services. Confirm TLS termination before enabling preload.

## Migrations and schema changes

```bash
cd backend
PYTHONPATH=. DATABASE_URL=... alembic revision --autogenerate -m "describe change"
PYTHONPATH=. DATABASE_URL=... alembic upgrade head
```

Review autogenerated migrations, especially for SQLite batch mode. Back up before applying to production.

## ML training in deployment

- Run `python backend/scripts/train_models.py` at image build time or as a release step.
- Persist artifacts if training at runtime; otherwise bake them into the image.
- `/api/ml/metrics` exposes `trained` flags so you can verify the deployment.
- Retraining on real, licensed data requires re-evaluating the methodology and updating the documented metrics.

## Operational checklist

- [ ] Health check on `/health` returns 200 and expected `models_trained` flags.
- [ ] Production `/docs` and `/openapi.json` are disabled.
- [ ] `APP_SECRET` is unique and strong; `AUTH_DEV_RESET_ECHO=false`.
- [ ] Origin allowlist contains only real HTTPS origins.
- [ ] Cookies observed as `Secure; HttpOnly; SameSite=Lax`.
- [ ] Backend only reachable through the proxy/private network where possible.
- [ ] Database backups and restore drill completed.
- [ ] Logs exclude bodies, prompts, cookies, and keys.
- [ ] Rate limits verified; edge WAF configured.
- [ ] Dependency audits (`npm audit`, `pip-audit`) reviewed.
- [ ] AI provider key present and a real generation tested, or AI deliberately disabled.
- [ ] Account and data deletion tested with synthetic accounts.
- [ ] Privacy notice and data-retention policy published.
