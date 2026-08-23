---
root: false
targets:
  - '*'
globs:
  - Dockerfile
  - compose.yml
  - Caddyfile
  - package.json
  - .github/**
---

# Development and Deployment Instructions

## Local Development Workflow

### Commands
- **Install Dependencies:** `npm install` (or `bun install`)
- **Start Dev Server:** `npm run dev` (starts Vite dev server at `http://localhost:5173`)
- **Lint Code:** `npm run lint` (runs ESLint on all project files)
- **Production Build:** `npm run build` (builds bundled assets into `dist/`)
- **Preview Build:** `npm run preview` (locally previews production build)

### Synchronizing Rulesync
- When modifying rules or skills in `.rulesync/`, run:
  ```bash
  rulesync generate
  ```
- To verify rulesync configuration health:
  ```bash
  rulesync doctor
  ```

## Deployment Targets

### 1. Docker Container
- Multi-stage build configured in `Dockerfile`:
  - **Stage 1 (Build):** `node:20-bookworm-slim` installs dependencies and builds Vite app.
  - **Stage 2 (Server):** `caddy:2-alpine` serves static files from `/srv` on port 3000.
- Command to build and run standalone container:
  ```bash
  docker build -t rssflux:latest .
  docker run -d --name rssflux -p 3000:3000 --restart unless-stopped rssflux:latest
  ```

### 2. Docker Compose (Full Stack with Miniflux)
- `compose.yml` configures a complete RSS stack:
  - `miniflux`: Miniflux backend server
  - `db`: PostgreSQL 17 database for Miniflux
  - `rssflux`: RSSFlux frontend web client
- Launch stack with:
  ```bash
  docker compose up -d
  ```

### 3. Static / Cloudflare Pages Hosting
- RSSFlux is a pure Single Page Application (SPA).
- Output directory: `dist`
- Build command: `npm run build`
- All routing is handled client-side with Caddy / Cloudflare SPA fallback to `index.html`.
