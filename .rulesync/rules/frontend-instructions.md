---
root: false
targets:
  - '*'
globs:
  - src/**
  - index.html
  - vite.config.js
  - tailwind.config.js
---

# Frontend Code Guidelines

## React & Component Patterns

### React 19 Conventions
- **Function Components:** Always use function components with named or default exports.
- **No Default React Import:** Do not write `import React from "react"`. Import specific hooks and utilities directly (e.g., `import { useState, useEffect, useRef } from "react"`).
- **Hooks Discipline:** Follow React Hooks rules strictly. Include all required dependencies in `useEffect`, `useCallback`, and `useMemo` dependency arrays.
- **Component File Structure:** Place feature components in `src/components/<Feature>/` and co-locate subcomponents in `src/components/<Feature>/components/`.

### State Management & Persistence
- **Global State (Nanostores):**
  - Use Nanostores (`atom`, `map`, `persistentAtom`, `persistentMap`) in `src/stores/` for application-wide reactive state.
  - Subscribe to stores inside React components using `useStore` from `@nanostores/react` (e.g., `const $filter = useStore(filter)`).
  - Prefix store value variables with `$` (e.g., `$articles`, `$theme`, `$isSyncing`) to clearly distinguish store values from local component state.
- **Offline Cache (Dexie.js / IndexedDB):**
  - All local persistence and offline caching are managed through `src/db/storage.js`.
  - Maintain the offline-first sync model: update local IndexedDB cache and sync with Miniflux backend.

### Styling & Design System
- **TailwindCSS v4 & HeroUI:**
  - Primarily use Tailwind utility classes directly in JSX `className` props.
  - Leverage HeroUI components (`@heroui/react`) for accessible and cohesive UI elements.
  - Use `size-*` utility classes for equal width/height icons and elements.
  - Respect light and dark mode classes and theme color variables.
  - Handle mobile viewports with safe area padding (`standalone:pt-safe`, `standalone:pb-safe`).

### Internationalization (i18n)
- **Zero Hardcoded User-Visible Strings:**
  - Every user-visible text string, label, placeholder, and tooltip MUST be translated using `useTranslation()` from `react-i18next` (e.g., `{t("common.save")}`).
  - Place translation keys in hierarchical categories (e.g., `common.*`, `sidebar.*`, `articleList.*`, `articleView.*`, `settings.*`, `feed.*`).
  - When adding new translation keys, update all supported locale files in `src/i18n/locales/`:
    - `en-US.js` (English)
    - `zh-CN.js` (Simplified Chinese)
    - `tr-TR.js` (Turkish)
    - `fr-FR.js` (French)

### Miniflux API Integration
- Centralize all backend API interactions in `src/api/miniflux.js`.
- Always handle network failures, authentication errors, and offline fallbacks gracefully.
- Provide user feedback using toast notifications (`sonner`).

### Code Hygiene & Linting
- Ensure all code passes `npm run lint` (`eslint .`) without errors.
- Ensure production builds succeed with `npm run build` (`vite build`).
- Keep code clean, avoiding unused variables, global identifier shadowing, or redundant dependencies.
