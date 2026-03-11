# PRD — Product Requirement Document

## Problem Statement

Logging daily expenses is a high-frequency, low-effort task — yet it carries enough friction (opening a spreadsheet app, navigating to the right cell, formatting correctly) that it gets skipped. Missed entries compound into inaccurate budgets.

We already rely on Google Sheets for analysis (pivot tables, monthly summaries, charts). What we lack is a **zero-friction input surface** optimized for mobile — a PWA that lets us tap, type, and submit an expense in under 10 seconds, while the spreadsheet remains our single source of truth.

## Goals

1. **Sub-10-second expense logging** from phone home screen to confirmed entry.
2. **Google Sheets as the canonical datastore** — no secondary database, no sync conflicts.
3. **Mobile-first, one-hand-friendly UX** — big tap targets, smart defaults, minimal scrolling.
4. **Couple-aware** — two users sharing one financial picture, each identifiable per entry.

## Non-Goals

- Building dashboards or analytics inside the PWA (Sheets handles this).
- Multi-tenant / team support.
- Full OAuth/JWT auth in MVP.
- Offline-first with complex conflict resolution (simple queuing is acceptable).
- Native app stores distribution.

## User Personas

**Danny** — Tech-savvy, logs expenses immediately after paying. Prefers quick numeric input. Occasionally reviews recent entries to catch duplicates.

**Wife** — Less technical, uses the app purely as a quick form. Wants large buttons, clear confirmation, and zero learning curve.

## Key User Journeys

### J1: Log an Expense (Primary)

1. Tap PWA icon on home screen.
2. App opens to the Add Expense screen (no navigation needed).
3. Fields pre-filled: today's date, user = last used identity.
4. Enter amount (numeric keyboard auto-focused), pick category, pick payment method, optionally add a note.
5. Tap **Save**.
6. See a success toast/confirmation with the entry summary.
7. Form resets for the next entry (stay on screen).

### J2: Quick Review

1. Navigate to a "Recent" tab/page.
2. See the last 10–20 entries in reverse chronological order.
3. Optionally filter by user.
4. No edit/delete in MVP — corrections happen in the spreadsheet.

### J3: Install as PWA

1. First visit shows an "Add to Home Screen" prompt (or browser-native install banner).
2. Subsequent launches feel app-like (standalone display, splash screen).

## Feature List

### MVP (v1)

| Feature                                                       | Priority |
| ------------------------------------------------------------- | -------- |
| Add Expense form (date, amount, category, method, user, note) | P0       |
| Submit → append row to Google Sheets via Service Account      | P0       |
| Success/error feedback (toast)                                | P0       |
| PWA installability (manifest + basic service worker)          | P0       |
| Simple passcode gate (shared secret, cookie-based session)    | P1       |
| Recent Expenses view (last 20 rows, read-only)                | P1       |

### Future Phases

| Feature                                          | Phase |
| ------------------------------------------------ | ----- |
| Today's spending total (quick glance widget)     | v1.5  |
| Offline queue with background sync               | v2    |
| Category/method management from UI               | v2    |
| Receipt photo attachment (Drive upload)          | v3    |
| Monthly summary pulled from Sheets analysis tabs | v3    |
| Per-user auth with Google Sign-In                | v3    |

## UX Expectations

- **Mobile-first**: Designed for 375px–430px viewport widths.
- **One-hand reachable**: Primary actions in the bottom 60% of the screen.
- **Numeric keyboard**: The amount field triggers `inputmode="decimal"`.
- **Smart defaults**: Date = today, User = last used (stored in cookie/localStorage).
- **Fast feedback**: Optimistic-style UI — disable button + show spinner on submit, toast on result.
- **Minimal navigation**: Two screens max (Add / Recent). Bottom tab bar or simple header toggle.
