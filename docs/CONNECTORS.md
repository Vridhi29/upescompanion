# Connectors

Contracts live in `packages/connectors/src/index.ts`. UPES systems remain the source of truth; connectors only read.

- `MockUpesConnector`: invented data, `source = "mock"`, always labelled in the UI.
- Official connectors do not exist. They need UPES-approved SSO/API access. Do not scrape behind a login, bypass CAPTCHA/MFA, or handle UPES passwords.
- Manual/CSV import is the intended fallback and will implement the same interface.

Sync rules (`apps/api/src/services/sync.ts`, all tested):
1. Retry only retryable `ConnectorError`s, with exponential backoff (3 attempts).
2. Validate every row with Zod; reject bad rows, keep good ones (status `partial`).
3. Empty result while data exists: treated as failed, existing data kept.
4. Totals that go backwards, or data older than stored: row ignored.
5. Every run is logged, with created/updated/unchanged counts and errors.
