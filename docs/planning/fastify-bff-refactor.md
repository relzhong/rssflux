# Nextflux Fastify BFF Refactor Spec

## Problem Statement

Nextflux (RSSFlux) currently operates as a client-only Single Page Application (SPA). Users must input their sensitive Miniflux server URL, credentials (username/password or API token), and AI model API keys (`aiApiKey`, `aiBaseUrl`, `aiModel`, `aiPrompt`) directly in browser settings, which are stored in unencrypted browser storage (`localStorage` / `IndexedDB`).

When deploying Nextflux publicly:
1. Anyone who visits the deployed instance can use it as an open web client to connect to arbitrary Miniflux backends or expose client-side networking.
2. AI API keys, base URLs, and Miniflux credentials are held in client-side storage, creating security exposure risks.
3. AI article summaries (TL;DR) are stored only in local client state, making them unavailable across multiple devices, sessions, or backend batch-processing pipelines (such as Windmill automations).
4. Unauthenticated public access to the client instance cannot be gated by single-instance master credentials.

## Solution

Transform Nextflux into a Backend-for-Frontend (BFF) architecture using **Fastify**, **TypeScript**, and **PostgreSQL**:
1. Fastify acts as the single unified web server, serving the pre-built React/Vite SPA static assets and providing a protected `/api/*` BFF layer.
2. All upstream credentials (`MINIFLUX_URL`, `MINIFLUX_API_TOKEN`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AUTH_USERNAME`, `AUTH_PASSWORD`) are loaded strictly from server environment variables and never leaked to the browser.
3. Completely remove frontend AI credential configurations and Miniflux server/token inputs from UI settings, stores, and local storage.
4. A single-user authentication system protects all application routes and Miniflux proxy endpoints with server-managed sessions stored in PostgreSQL, HttpOnly session cookies, rate-limited login endpoints, and self-hosted SVG CAPTCHA challenges backed by PostgreSQL.
5. Miniflux API interactions are proxied through `/api/miniflux/*` strictly pointing to the configured Miniflux backend, preventing arbitrary SSRF attacks.
6. AI article summaries are managed via `/api/summary/*` endpoints and persisted in a shared PostgreSQL `article_summary` table with content hash deduplication, enabling multi-device synchronization and headless integration with external background workers.

---

## User Stories

1. As a reader, I want to access my Nextflux instance via a secure single-user login page, so that unauthorized visitors cannot access my feed reader.
2. As a reader, I want to see a visual CAPTCHA challenge on the login form, so that automated bots cannot brute-force my credentials.
3. As a reader, I want to refresh the CAPTCHA image with a single click if it is difficult to read, so that I can easily complete the challenge.
4. As a system owner, I want login attempts to be rate-limited per IP, so that brute-force attacks against my instance are prevented.
5. As a system owner, I want failed login attempts to return a generic error message, so that username and CAPTCHA state cannot be enumerated.
6. As a reader, I want my authenticated session to persist via a secure, HttpOnly cookie, so that I stay logged in across browser sessions without exposing session tokens to JavaScript.
7. As a reader, I want to log out from any device, so that my server session is immediately revoked in PostgreSQL and rendered invalid.
8. As a reader, I want to navigate to the application root and automatically reach the reading dashboard if I already have an active session, so that I do not need to re-login unnecessarily.
9. As a reader, I want unauthenticated requests to be redirected to the login page without loading any feed data or private information, so that my reading privacy is guaranteed.
10. As a reader, I want my Miniflux feeds, categories, and articles to load automatically without configuring server URLs or API tokens in the browser, so that onboarding is seamless and zero-configuration.
11. As a reader, I want all Miniflux actions (marking articles read, starring, refreshing, subscribing) to execute reliably through the BFF proxy, so that my reading workflow functions identically to the standalone client.
12. As a system owner, I want Miniflux API tokens and upstream URLs to remain strictly on the backend, so that client-side inspect tools never see upstream secrets.
13. As a reader, I want to open settings and find that all sensitive AI API key / server configurations are removed from the frontend UI, so that I don't need to manually configure API credentials.
14. As a reader, I want to open an article and immediately view an existing AI TL;DR summary if one was previously generated or prepared by background workers, so that I can quickly understand the article's core points.
15. As a reader, I want to click a "Generate AI Summary" button on articles that do not have a summary yet, so that the BFF generates a summary on demand.
16. As a reader, I want generated summaries to be saved to PostgreSQL, so that when I open the same article on another computer or phone, the summary is instantly available without re-generating or consuming AI tokens.
17. As a reader, I want articles whose content has not changed to reuse the stored summary, so that redundant LLM API calls and costs are avoided.
18. As a reader, I want articles whose content has been updated upstream to regenerate a fresh summary when requested, so that the summary accurately reflects the latest article revision.
19. As a system owner, I want external automation tools (like Windmill) to share the PostgreSQL summary table, so that batch summaries generated in background pipelines appear natively in the Nextflux reader.
20. As an operator, I want the server to fail fast during startup if essential environment variables are missing, so that misconfigured instances do not run in an insecure or broken state.
21. As an operator, I want all database migrations to execute deterministically on startup, so that upgrading the database schema requires zero manual intervention.
22. As an operator, I want health check endpoints to report application status without authentication, so that container orchestrators can monitor availability.
23. As an operator, I want the application packaged as a lightweight, multi-stage Docker container running as a non-root user, so that deployment is secure and minimal.

---

## Implementation Decisions

### 1. Architecture & Server Layout
- **Fastify + TypeScript Backend**:
  - `server/index.ts`: Application entry point, plugin registration, and server lifecycle.
  - `server/config.ts`: Environment variable validation (fail-fast startup).
  - `server/db/index.ts`: PostgreSQL pool and migration executor.
  - `server/db/migrations/`: SQL migration files (`001_initial.sql`).
  - `server/plugins/auth.ts`: Authentication hooks, cookie parsing, session verification.
  - `server/routes/auth.ts`: Captcha challenge generation, login, logout, and session check.
  - `server/routes/miniflux.ts`: Fixed upstream Miniflux proxy (`/api/miniflux/*` -> `${MINIFLUX_URL}/v1/*`).
  - `server/routes/summary.ts`: Article summary query and on-demand generation.
  - `server/routes/health.ts`: Health check endpoint.
  - `server/services/miniflux.ts`: Miniflux backend communication.
  - `server/services/ai.ts`: LLM integration, prompt formatting, HTML text cleaning, thinking-tag filtering.
  - `server/services/summary.ts`: Summary persistence, deduplication, and locking.

### 2. Database Schema & Migrations
- `001_initial.sql`:
  - `auth_captcha`:
    - `id` (UUID PRIMARY KEY)
    - `answer_hash` (TEXT NOT NULL)
    - `expires_at` (TIMESTAMPTZ NOT NULL)
    - `used_at` (TIMESTAMPTZ)
    - `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
  - `auth_session`:
    - `id` (UUID PRIMARY KEY)
    - `expires_at` (TIMESTAMPTZ NOT NULL)
    - `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
    - `last_seen_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
  - `article_summary`:
    - `entry_id` (BIGINT PRIMARY KEY)
    - `title` (TEXT)
    - `url` (TEXT)
    - `content_hash` (TEXT)
    - `tldr` (TEXT)
    - `summary` (TEXT)
    - `model` (TEXT)
    - `generated_at` (TIMESTAMPTZ NOT NULL DEFAULT now())
    - `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT now())

### 3. Frontend Cleansing
- **Remove Frontend Miniflux Credentials**:
  - `authStore.js` / `miniflux.js`: Point base URL to `/api/miniflux`. Remove all client-side token/password management.
  - `LoginPage.jsx`: Redesign to simple Single-User Login (Username, Password, CAPTCHA, Refresh button).
- **Remove Frontend AI Credentials**:
  - `settingsStore.js`: Remove `aiApiKey`, `aiBaseUrl`, `aiModel`, and related settings.
  - `Settings/AI.jsx`: Remove AI credential inputs (or replace with server AI status indicator/read-only prompt config if applicable, or remove entire sensitive config panel).
  - `api/openai.js`: Redirect AI summarization calls to `/api/summary/:entryId/generate` and `/api/summary/:entryId`.
  - `AISummary.jsx`: Query `/api/summary/:entryId` and call BFF generate endpoint.

---

## Testing Decisions

- Test with `fastify.inject()` for complete end-to-end integration without starting external HTTP ports.
- Mock Miniflux API responses and OpenAI LLM completions in test suite.
- Validate:
  - Captcha lifecycle (creation, expiry, reuse rejection, case-insensitivity).
  - Auth flow (login, rate-limiting, session creation, logout revocation, 401 unauthenticated guard).
  - Miniflux proxy host protection (no arbitrary URL forwarding, token injection).
  - Summary deduplication (content hash match, cache hits, concurrent dedupe lock).

---

## Out of Scope

- Multi-user authentication & user registration.
- OAuth / OIDC providers.
- External Redis dependency.
- Background batch ingestion/summarization worker (handled by external Windmill workflows).
