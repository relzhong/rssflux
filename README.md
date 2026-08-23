# RSSFlux

A modern, responsive RSS reader client for [Miniflux](https://github.com/miniflux/v2) with a dedicated **Fastify + TypeScript BFF** (Backend-for-Frontend), React 19, TailwindCSS v4, and PostgreSQL.

---

## 🌟 Architecture & Highlights

```text
Browser (React 19 / Vite SPA)
  │
  │ HTTPS / Session Cookie (HttpOnly, SameSite=Lax)
  ▼
Fastify BFF (TypeScript, Port 3000)
  ├── 🛡️ Single-User Auth & Anti-Brute-Force (SVG CAPTCHA + Rate Limiting)
  ├── 🔒 Secure Miniflux Proxy (Credentials strictly stored on server)
  ├── 🤖 AI TL;DR Engine (OpenAI-compatible LLM summaries with dedup locking)
  └── 🐘 PostgreSQL Storage (Session state, CAPTCHA challenges, article summaries)
```

- 🛡️ **Zero Client-Side Credentials**: Miniflux API Tokens, upstream URLs, and AI API Keys are managed entirely on the server backend and never exposed to browser storage or network payloads.
- 🧩 **Anti-Bot & Brute-Force Defense**: Built-in self-hosted SVG CAPTCHA (single-use, 5-minute TTL, SHA-256 hashed in PostgreSQL) and IP-based rate limiting (5 attempts/min).
- 🔄 **Cross-Device AI TL;DR Sync**: AI summaries are cached and indexed in PostgreSQL (`article_summary`) using content hash deduplication. Compatible with external automation pipelines like [Windmill](https://www.windmill.dev/).
- ⚡ **High Performance SPA + BFF**: Fast React 19 frontend with offline-first IndexedDB cache, served directly by Fastify with graceful fallback.

---

## ✨ Features

- 🚀 Fast and responsive UI built with HeroUI and TailwindCSS v4
- 🤖 Built-in AI article summarization with instant caching and multi-device sync
- 🔄 Automatic background feed sync with customizable intervals
- 📱 Mobile-friendly with PWA support and safe area padding
- 🌙 Light/Dark modes with accent color palettes
- 🌍 Multilingual support (English, Simplified Chinese, Turkish, French)
- 👀 Mark as read on scroll
- 🎯 Rich reading experience:
  - Custom font and typography controls
  - Touch-friendly image gallery & zoom
  - Code syntax highlighting
  - Save articles to third-party services (Wallabag, Pocket, etc.)
- ⌨️ Full keyboard shortcuts navigation
- 📊 Comprehensive feed management (OPML import/export, categories, search)

---

## 🚀 Deployment

### Option 1: Docker Compose (Full Stack with Miniflux) — Recommended

Copy [`compose.yml`](./compose.yml) to your server, customize the environment variables, and run:

```bash
docker compose up -d
```

Example `compose.yml`:

```yaml
services:
  miniflux:
    image: miniflux/miniflux:latest
    container_name: miniflux
    ports:
      - "8080:8080"
    depends_on:
      db:
        condition: service_healthy
    environment:
      - DATABASE_URL=postgres://miniflux:secret@db/miniflux?sslmode=disable
      - RUN_MIGRATIONS=1
      - CREATE_ADMIN=1
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=change-me
      - API_KEY=your-miniflux-api-token
    restart: unless-stopped

  db:
    image: postgres:17-alpine
    container_name: miniflux-db
    environment:
      - POSTGRES_USER=miniflux
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=miniflux
    volumes:
      - miniflux-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "miniflux"]
      interval: 10s
      start_period: 10s
    restart: unless-stopped

  rssflux:
    image: docker.io/relzhong/rssflux:latest
    container_name: rssflux
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
      miniflux:
        condition: service_healthy
    environment:
      - PORT=3000
      - NODE_ENV=production
      - DATABASE_URL=postgres://miniflux:secret@db/miniflux?sslmode=disable
      - AUTH_USERNAME=admin
      - AUTH_PASSWORD=your-super-secret-password
      - SESSION_SECRET=a-long-random-string-at-least-32-characters
      - MINIFLUX_URL=http://miniflux:8080
      - MINIFLUX_API_TOKEN=your-miniflux-api-token
      - AI_BASE_URL=https://api.openai.com/v1
      - AI_API_KEY=sk-your-ai-api-key
      - AI_MODEL=gpt-4o-mini
    restart: unless-stopped

volumes:
  miniflux-db:
```

### Option 2: Standalone Docker Container

```bash
docker run -d \
  --name rssflux \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@postgres:5432/rssflux" \
  -e AUTH_USERNAME="admin" \
  -e AUTH_PASSWORD="your-password" \
  -e SESSION_SECRET="your-32-char-random-secret" \
  -e MINIFLUX_URL="http://miniflux-host:8080" \
  -e MINIFLUX_API_TOKEN="your-miniflux-token" \
  -e AI_BASE_URL="https://api.openai.com/v1" \
  -e AI_API_KEY="sk-..." \
  --restart unless-stopped \
  rssflux:latest
```

---

## 📝 Environment Variables

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | No | `3000` | Port for the Fastify BFF web server |
| `NODE_ENV` | No | `development` | Runtime environment (`production` / `development`) |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) |
| `AUTH_USERNAME` | **Yes** | — | Admin username for single-user authentication |
| `AUTH_PASSWORD` | **Yes** | — | Admin password for single-user authentication |
| `SESSION_SECRET` | **Yes** | — | Secret key used to sign session cookies (min 32 chars) |
| `MINIFLUX_URL` | **Yes** | — | Upstream Miniflux base URL (e.g. `http://miniflux:8080`) |
| `MINIFLUX_API_TOKEN` | **Yes** | — | Upstream Miniflux API Token |
| `AI_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible API base URL |
| `AI_API_KEY` | No | `""` | API key for LLM summarization |
| `AI_MODEL` | No | `gpt-4o-mini` | AI model identifier (e.g. `gpt-4o-mini`, `deepseek-chat`) |
| `AI_PROMPT` | No | Built-in | System prompt for article summarization |
| `INTERNAL_API_KEY` | **Yes (Prod)** | — | Bearer token secret for internal batch summary API |
| `SUMMARY_AI_MIN_CHARS` | No | `500` | Minimum article characters to trigger AI summary (shorter uses extractive) |
| `SESSION_TTL_DAYS` | No | `30` | Session expiration in days |
| `TRUST_PROXY` | No | `true` | Enable proxy headers trust behind reverse proxies (Traefik/Nginx/Caddy) |

---

## 🤖 Internal Batch Summary API (for Windmill / Automation)

External orchestrators (such as [Windmill](https://www.windmill.dev/)) can batch-generate or preheat AI summaries by calling the `/internal` endpoints using `Bearer` token authentication.

### 1. Health Check
```bash
curl -H "Authorization: Bearer ${INTERNAL_API_KEY}" \
  http://localhost:3000/internal/health
# Response: {"ok":true}
```

### 2. Batch Summary Generation
```bash
curl -X POST http://localhost:3000/internal/summaries/generate \
  -H "Authorization: Bearer ${INTERNAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "entryIds": [101, 102, 103],
    "force": false
  }'
```

**Response:**
```json
{
  "results": [
    { "entryId": 101, "status": "ready", "cached": true },
    { "entryId": 102, "status": "ready", "cached": false },
    { "entryId": 103, "status": "failed", "error": "Article 103 not found" }
  ]
}
```

---

## 🔗 Stable Article Deep Links

Nextflux supports direct entry deep linking (e.g. for Notion integration, notifications, or bookmarks):
- `https://your-domain.com/entry/:entryId` (or `https://your-domain.com/article/:entryId`)

- **Unauthenticated**: Redirects cleanly to `/login`, preserving original navigation state.
- **Authenticated**: Directly opens and displays the corresponding Miniflux entry.
---

## 🛠️ Local Development

### Prerequisites
- Node.js >= 20 (Node 24 recommended)
- PostgreSQL database instance

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment variables
cp .env.example .env

# 3. Start development server
npm run dev

# 4. Run tests
npm test

# 5. Run linting
npm run lint

# 6. Build production bundles
npm run build
```

---

## 📱 Mobile Support

RSSFlux is fully responsive and supports PWA installation with standalone viewports. While it works smoothly on mobile browsers, a dedicated native reader app may also be paired with your Miniflux server (e.g. [Reeder](https://reederapp.com/), [Unread](https://www.goldenhillsoftware.com/unread/), or [Capy Reader](https://capyreader.com/)).

---

## 📄 License

MIT License.

## 🙏 Attribution & Acknowledgments

- Built on top of [Nextflux](https://github.com/electh/nextflux) by [@electh](https://github.com/electh). Special thanks to the original author and contributors!
- 🇹🇷 Turkish Translation: [@TaylanTatli](https://github.com/TaylanTatli)
- 🇫🇷 French Translation: [@quent1-fr](https://github.com/quent1-fr)
