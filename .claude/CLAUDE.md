# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

DuitLog — mobile-first PWA for logging daily expenses, backed by Google Sheets as datastore.

## Commands

```bash
npm run dev          # Start dev server (React Router v7 + Vite)
npm run build        # Production build
npm start            # Serve production build
npm run typecheck    # Run typegen + tsc
```

No lint or test scripts configured.

## Tech Stack

- **Framework:** React Router v7 (SSR, framework mode)
- **Build:** Vite + Tailwind CSS v4 (`@tailwindcss/vite` plugin)
- **UI:** shadcn/ui (new-york style) + Radix UI + Lucide icons
- **Validation:** Zod (client + server)
- **Backend:** Google Sheets API v4 via service account
- **Offline:** IndexedDB queue + Service Worker background sync + Web Locks
- **Auth:** Passcode + React Router session cookies (30-day)
- **Deploy:** Vercel (serverless, `@react-router/node` adapter)

## Architecture

**Path alias:** `~/*` → `./app/*`

**Key directories:**

- `app/routes/` — Route modules with loaders + actions
- `app/components/` — React components; `ui/` subdirectory has shadcn primitives
- `app/lib/` — Server utilities (`*.server.ts`) and shared code

**Server modules (`.server.ts` suffix):**

- `sheets.server.ts` — Google Sheets API: `getAvailableMonths()`, `appendExpense()`
- `auth.server.ts` — `login()`, `requireAuth()`, `isAuthenticated()`
- `cookies.server.ts` — `selectedMonthCookie`, `selectedSourceCookie`
- `month.server.ts` — Month resolution + network error detection
- `logger.server.ts` — Structured JSON logging

**Offline flow:**

1. Form submit fails → save to IndexedDB via `offline-queue.ts`
2. SW registers background sync OR `online` event fires
3. `sync.ts` acquires Web Lock (`duitlog-sync`) to prevent concurrent sync
4. POSTs to `/api/sync` per entry → validates with Zod → appends to Sheets
5. Removes from IndexedDB on success

**Data flow:** Client form → RR7 server action → Zod validation → Google Sheets API → JSON response. On network error: IndexedDB → background sync.

## Conventions

- Use `useReducer` for complex state; max 2 `useState` hooks per component
- Conventional commit messages
- Short branch names: `feat/x`, `fix/y`
- GitHub CLI for all GitHub interactions
- ESM (`"type": "module"` in package.json)
- Strict TypeScript (ES2022 target)
