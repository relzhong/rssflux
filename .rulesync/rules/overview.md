---
root: true
---

# RSSFlux Project Instructions

## Project Overview
RSSFlux is a modern, responsive RSS reader client for [Miniflux](https://github.com/miniflux/v2) built with React 19, Vite, HeroUI, TailwindCSS v4, Dexie.js (IndexedDB), and Nanostores.

## Tech Stack
- **Framework & Build:** React 19, Vite 6
- **UI Components & Styling:** HeroUI, TailwindCSS v4, Lucide React icons, Framer Motion
- **State Management:** Nanostores (`nanostores`, `@nanostores/react`, `@nanostores/persistent`)
- **Local Persistence & Cache:** Dexie.js (IndexedDB) for offline-first article and feed caching
- **Backend API:** Miniflux REST API via Axios
- **Internationalization (i18n):** `i18next`, `react-i18next` (English, Chinese, Turkish, French)
- **Deployment & Server:** Docker multi-stage build with Caddy 2, Docker Compose, Cloudflare Pages

## Directory Structure
- `src/api/`: API clients (`miniflux.js` for Miniflux API, `openai.js` for AI summaries)
- `src/components/`: UI components organized by feature:
  - `FeedList/`: Sidebar, feeds, categories, feed addition/editing, sync controls
  - `ArticleList/`: Article list stream, filters (all/unread/starred), mark-as-read, actions
  - `ArticleView/`: Full article reading view, readability mode, image viewer, AI summary
  - `Settings/`: General, Appearance, Theme, Language, AI, Shortcuts, About
  - `Search/`: Full-text and keyword search modal and results
  - `ui/`: Shared atomic and compound UI components (modals, dialogs, context menus, sidebar)
- `src/stores/`: Reactive Nanostores:
  - `articlesStore.js`: Current articles list, active article, filtering, pagination
  - `feedsStore.js`: Subscribed feeds, categories, unread/starred counts
  - `syncStore.js`: Syncing status, sync interval, last sync timestamp
  - `authStore.js`: Server URL, credentials / API token, authentication state
  - `settingsStore.js`: User preferences (layout, font, gestures, unread filters)
  - `themeStore.js`: Color theme, dark/light mode, accent colors
  - `modalStore.js`: Dialog and modal visibility states
  - `aiStore.js`: AI summarization configuration and state
- `src/db/`: Dexie IndexedDB schemas and data access methods (`storage.js`)
- `src/handlers/`: Event handlers for articles and feeds (`articleHandlers.js`, `feedHandlers.jsx`)
- `src/hooks/`: Custom React hooks (gestures, hotkeys, font loader, navigation, zoom, mobile detection)
- `src/i18n/`: Internationalization configs and locale dictionaries (`en-US`, `zh-CN`, `tr-TR`, `fr-FR`)
- `src/lib/`: Shared utility functions, URL handling, formatting, font loaders
- `src/routes/`: Client routing definitions with React Router
- `public/`: PWA webmanifest, favicons, touch icons, pattern assets

## Agent Skills & Workflow

### Skill Authoring & Synchronization
When creating or updating repo-local skills or rules, use Rulesync as the source of truth under `.rulesync/`. Run `rulesync generate` to synchronize generated agent configurations.

### Product Planning & Feature Lifecycle
1. **Phase 1 (Sketch):** Use `/sketch-to-planning` to turn raw feature ideas into planning skeletons under `docs/planning/`.
2. **Phase 2 (Design & Dialogue):** Use `/conversation-to-planning` to preserve decisions, requirements, and technical trade-offs.
3. **Phase 3 (Review):** Use `/review-to-planning`, `/parallel-review`, or `/review-loop` to capture code health and architecture feedback.
4. **Phase 4 (Merge Safety):** Use `/safe-merge-review-gate` for conflict resolution and merge verification.
5. **Phase 5 (Architecture & Closure):** Use `/document-architecture-decision` to capture ADRs in `docs/adr/` and concept notes in `docs/concepts/`, then use `/mark-planning-implemented` to finalize the planning doc.
