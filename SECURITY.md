# Security policy

Eventora AI is a demonstration application. It has not undergone a penetration test or a security certification. The detailed threat model, implemented controls, performed tests, and residual risks are in [docs/security.md](docs/security.md).

## Reporting a vulnerability

Do not open a public issue containing an exploit, secret, or personal data. Contact the repository maintainer privately (the contact address is configured in the repository profile) with:

- the affected route or component,
- reproduction steps using synthetic accounts,
- impact and any suggested mitigation,
- whether the issue is already public.

Do not test against other users' data, production systems, or accounts you do not own. Use synthetic accounts and a local deployment.

## Supported versions

Only the current `main` branch is supported. There are no maintained release branches.

## Secret handling

- Never commit `.env`, provider keys, database passwords, or session secrets.
- `.env.example` contains placeholders only.
- If a credential is exposed, revoke and rotate it immediately. Removing it from the latest commit is not sufficient; it must be considered compromised.
- The backend never returns provider keys. Settings displays only configuration status.

## Before deploying publicly

Follow the production checklist in [docs/security.md](docs/security.md#production-checklist). At minimum: HTTPS, strong `APP_SECRET`, exact `FRONTEND_ORIGINS`, `AUTH_DEV_RESET_ECHO=false`, PostgreSQL with least privilege, migrations, dependency audits, and an independent security review.
