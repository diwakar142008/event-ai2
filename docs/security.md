# Security

This document records what is implemented, what was actually tested, and what remains risky. It is **not** a claim that the application is fully secure, and no penetration test or certification has been performed.

References used for threat modelling: OWASP Top 10 (2025) and the OWASP API Security Top 10.

## Threat model (summary)

| Asset | Threat | Primary controls |
|---|---|---|
| Account credentials | Credential stuffing, offline cracking | Argon2id (64 MiB, t=3), generic errors, auth rate limits, constant-time comparisons, reset invalidates sessions |
| Session cookies | Theft via XSS or CSRF | HttpOnly, SameSite=Lax, Secure in production, CSRF double-submit, Origin allowlist, CSP |
| Private event data | IDOR / enumeration | Owner-scoped ORM queries, 404 for foreign IDs, authenticated layout, `no-store` |
| AI provider key | Client bundle or log leakage | Server-only settings, no `NEXT_PUBLIC_` secret, settings shows status only, no prompt/key logging |
| AI prompt / plan | Prompt injection, unsafe output | Untrusted-data wrapping, immutable system policy, strict Pydantic schema with extra fields forbidden, no tools, fallback |
| Compute | Resource exhaustion | Body-size cap, rate limits, AI timeout and token ceiling, pagination caps, bounded prompt/history |
| Database | SQL injection, unsafe queries | SQLAlchemy parameter binding, no raw SQL with user input, least-privilege URL in production |
| Error surfaces | Stack traces, SQL, secrets | Custom exception handlers, request IDs, generic messages, server-only structured logs |

## Implemented controls

### Secrets
- All credentials are read from environment variables (`pydantic-settings`) or a `.env` file excluded from Git.
- `.env.example` contains placeholders only.
- No model-provider key is returned by any endpoint. `GET /api/ai/status` returns provider/model/limits and a boolean.
- The frontend has no secret-bearing environment variable. `NEXT_PUBLIC_SITE_URL` is a public canonical URL only.
- The test suite scans frontend source for `AI_API_KEY`, OpenAI-style keys, service-role names, and `NEXT_PUBLIC_AI_*`.

### Authentication and authorization
- Argon2id via `argon2-cffi`; plaintext passwords are never stored or logged.
- Sessions are 64-byte random tokens stored as SHA-256 hashes; no custom JWT implementation.
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when production or `COOKIE_SECURE=true`.
- CSRF: a separate random token is stored hashed in the session and delivered in a readable cookie; mutations require `X-CSRF-Token`. Origin is also checked on every mutating `/api/*` request.
- Sign-out deletes the session; password reset deletes all sessions; account deletion removes all owned rows.
- Ownership is checked on every read, update, and delete of events and nested records. AI plan/chat requests verify the event owner before use.
- No endpoint accepts a client-supplied `user_id` as identity; `user_id` is rejected by `extra="forbid"`.

### Input validation and injection
- Strict Pydantic schemas with `extra="forbid"`.
- Bounded strings (names 120, notes 2,000, prompts 1,500, chat history 6 turns), bounded guest counts (1–5,000), budgets, durations (1–24 h), and a date window.
- Non-finite numbers are rejected by typed fields; raw `NaN` input returns 422.
- SQLAlchemy parameterized queries throughout; no string-built SQL.
- User text is rendered by React as text (no `dangerouslySetInnerHTML`). The API returns JSON, so stored XSS payloads remain data.
- Open redirects are avoided: no redirect endpoint accepts a destination URL.
- Request bodies are capped at `MAX_REQUEST_BYTES` (512 KB default) by ASGI middleware, including chunked bodies.

### Rate limiting and resource protection
- Fixed-window counters persisted in the database, shared across workers (SQLite locally, PostgreSQL in production).
- Separate buckets for auth, password reset, CRUD, AI (per user and per IP), and ML.
- The limiter fails **closed** for expensive routes if its storage fails.
- `Retry-After` is returned with 429.
- AI calls have a 30-second timeout, 2,600 output-token ceiling, 12,000-character prompt cap, and one repair retry.
- Collections are paginated with a server cap of 50 rows; dashboard queries are bounded.

### Browser security
- FastAPI responses: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, `CORP`, `CSP default-src 'none'; frame-ancestors 'none'`, HSTS in production, `no-store` for private APIs.
- Next.js headers: CSP, frame denial, referrer policy, permissions policy, HSTS in production, `poweredByHeader: false`.
- CORS allows only explicitly configured origins with credentials; no `*`.
- `SameSite=Lax` plus Origin and CSRF checks protect cookie-authenticated mutations.
- `robots.txt` excludes private routes; no private content is server-rendered into indexable public pages.

### AI-specific
- User notes, prompts, and revision requests are labeled untrusted data; role markers are stripped and common override phrases neutralized before sending.
- The immutable system prompt states that user content cannot override safety rules.
- No tools are exposed to the model; it cannot execute code, SQL, shell commands, or change records.
- Output must parse as a JSON object and pass `EventPlanPayload` (extra fields forbidden). Invalid output triggers one repair attempt, then fallback.
- Budget totals are reconciled with a warning when they diverge more than 5% from the saved budget.
- Chat replies are returned as plain text; no HTML rendering. Transcripts are not persisted or logged.
- Event context is limited to planning fields; unnecessary personal data is not sent.

### Error handling and logging
- Generic client messages with `error.code` and `request_id`.
- No stack traces, file paths, SQL, or secrets in responses.
- Logs contain method, path, status, duration, request ID, and server-side exception traces only; not bodies, cookies, prompts, or keys.
- Database, ML, and AI failures map to safe 500/503 responses; estimates failing never break event persistence.

### Dependencies
- Backend dependencies pinned in `backend/requirements.txt`; frontend dependencies and lockfile committed.
- No lifecycle scripts from unknown packages were executed; Playwright used for local screenshots only and is not a project dependency.
- Dependency audits run on 2026-10-21: `npm audit --omit=dev` → **0 vulnerabilities**; `pip-audit -r backend/requirements.txt` → **no known vulnerabilities**. Re-run both before every release; do not disable checks to make a build pass.

### Privacy
- Data collected is limited to account email/name and planning content.
- Users can export account data, export a full event, delete all event data, or delete the account.
- No analytics, trackers, or third-party embeds are present.
- AI processing is optional; the fallback is local. The provider receives only event planning fields and the current message/history.
- No real user data is used for training; ML training data is synthetic.

## Tests actually performed

`backend/tests/` (53 tests, all passing) covers:

- Auth flow, cookie flags, weak passwords, duplicate emails, session invalidation.
- CSRF missing/invalid, disallowed/missing Origin.
- Cross-account access to events, tasks, expenses, notes, plans, and AI generation.
- Invalid enums, ranges, oversized fields/bodies, unexpected fields, `NaN`.
- SQL-injection and XSS payloads stored as literal data; parameterized search.
- Rate limiting and `Retry-After`.
- CORS allow/deny and security headers.
- Password reset and account deletion.
- Database failure masking (generic 500, no SQL).
- ML metrics, cost inference, recommendations, risk extremes, invalid input, missing artifacts (503).
- AI fallback, task seeding without duplication, prompt injection neutralization, invalid JSON retries, schema violations, provider failure, rate limits, status without key leakage.
- Frontend source secret scan.

Performed manually in this workspace:

- Full browser flow with Playwright: landing, ML estimator, sign-up/sign-in, dashboard, workspace tabs, recommendations, settings, wizard, mobile views.
- Zero browser console errors or page errors; no horizontal overflow at 1440 px and 390 px; zero unlabeled form controls in the captured wizard.
- End-to-end HTTP smoke run (2026-10-22) against a freshly installed backend and frontend, through the same-origin proxy: sign-up, `/auth/me`, create event (ML estimate and risk computed), paginated list, event fetch, `/api/ml/metrics`, cost prediction, recommendations, budget risk, fallback plan generation, AI chat, dashboard aggregates, task create/complete, expense create/update, and all protected pages returning 200 with a session.
- Same run: a second account received `404` for GET, PUT, and DELETE on the first account's event; a foreign `Origin` was rejected with `403`; a signed-out `/dashboard` request returned `307` to `/sign-in`; CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` headers were present on the landing page.

**Not performed:** penetration testing, load testing, SAST/DAST, real-provider integration test (no key configured), email delivery test (no provider configured), cross-browser matrix beyond Chromium.

## Residual risks

1. **Self-hosted auth** is maintained in this codebase. A subtle auth bug would be our responsibility. Migrate to Supabase Auth for hosted multi-user production, or budget for ongoing review.
2. **CSP permits inline scripts** for Next.js hydration. A nonce- or hash-based CSP is the next hardening step; `unsafe-eval` is limited to development.
3. **Rate limiting is fixed-window** and DB-backed. It is shared across workers but not a substitute for edge/WAF protection. Distributed denial-of-service is out of scope.
4. **Development reset-token echo** is enabled by default outside production. Set `AUTH_DEV_RESET_ECHO=false` and configure email delivery before any shared deployment.
5. **SQLite** has limited concurrency and no row-level security. Use PostgreSQL with least-privilege credentials in production.
6. **Synthetic ML data** limits the truthfulness of estimates. No security impact, but a product-risk caveat.
7. **AI provider data handling** depends on the provider and account settings. Review its retention/training policy and obtain consent where required.
8. **Default development secret** must be replaced in production; startup logs a warning but does not block boot.
9. **No email verification** exists, so addresses are not proven. Add verification if accounts become public.
10. **Dependency advisories** were audited cleanly on 2026-10-21, but that is a point-in-time result; new advisories appear continuously.

## Production checklist

- [ ] `APP_ENV=production`, strong unique `APP_SECRET`, HTTPS everywhere.
- [ ] Exact HTTPS `FRONTEND_ORIGINS`; no localhost or preview hosts.
- [ ] PostgreSQL with least-privilege credentials; run `alembic upgrade head`; automated backups.
- [ ] `AUTH_DEV_RESET_ECHO=false` and working email delivery, or managed auth.
- [ ] `AI_API_KEY` in a secret manager; provider timeout/token limits reviewed; data-processing terms accepted.
- [ ] Reverse proxy forwards the real client IP (`FORWARDED_ALLOW_IPS`) and terminates TLS.
- [ ] Edge rate limits/WAF in front of auth and AI routes.
- [ ] Re-run `pip-audit`, `npm audit`, and a container/dependency scan on the release commit; fix high/critical issues.
- [ ] Back up and test restore; define data retention and deletion SLAs.
- [ ] Add monitoring/alerts for 5xx rates, rate-limit storage failures, AI provider errors, and auth anomalies.
- [ ] Complete a real penetration test before handling sensitive customer data.
