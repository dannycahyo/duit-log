# PRD — Product Requirement Document

| Version | Date       | Author | Change Description |
| ------- | ---------- | ------ | ------------------ |
| 2       | 2025-03-09 | Danny  | SaaS Plan          |

## Problem Statement

DuitLog started as a personal expense tracker for one couple. The core value proposition — "log expenses in under 10 seconds, keep all analysis power in Google Sheets" — resonates with a broader audience. However, the current implementation is deeply personalized: hardcoded sources (Danny/Dewi/Together), hardcoded categories and payment methods, a single shared spreadsheet ID in an env var, and a simple passcode for auth.

To serve multiple users, DuitLog needs real authentication, per-user configuration, and a way for each user to connect their own Google Sheet — all without losing the speed and simplicity that makes it useful.

## Goals

1. **Multi-user support** — anyone can sign up, configure their own expense tracker, and use it independently.
2. **Per-user Google Sheets** — each user connects their own spreadsheet via Google OAuth. The app reads/writes to their sheet on their behalf.
3. **Customizable fields** — each user defines their own sources, categories, and payment methods during onboarding (and can edit later).
4. **Zero-config spreadsheet setup** — the app creates the spreadsheet and monthly tabs for the user automatically.
5. **Preserve the core UX** — the expense form must remain fast, mobile-first, and under 10 seconds from open to saved.
6. **Retain existing features** — monthly tab organization, offline queue with background sync, PWA installability.

## Non-Goals (SaaS v1)

- Billing / paid tiers (free for now, evaluate later).
- Shared household accounts or multi-user → one-spreadsheet setups (each account connects to and manages its own sheet; any Google Sheets sharing/collaboration happens outside the app and is not recognized as a shared account in v1).
- Admin dashboard or usage analytics.
- White-labeling or custom domains.
- Data export beyond Google Sheets (the sheet IS the export).

## User Personas

**New User (Non-technical)** — Heard about DuitLog from a friend. Has a Google account. Wants to start tracking expenses immediately. Has no idea what a "service account" or "spreadsheet ID" is. Needs a smooth onboarding that creates everything for them.

**Power User** — Already has a Google Sheet with their own expense tracking format. Wants to connect their existing sheet and customize the app to match their categories. Comfortable with a few setup steps.

**Returning User (Danny)** — Current user migrating from the personal version. Needs to connect his existing spreadsheet and configure the same sources/categories/methods.

## Key User Journeys

### J1: Sign Up & Onboarding (First-time)

1. Land on DuitLog homepage → "Sign in with Google".
2. Clerk handles Google OAuth, requesting Google Sheets API permissions plus the minimal Google Drive scopes needed to create spreadsheets and let the user pick an existing spreadsheet from Drive (via the Google Picker or equivalent).
3. On first login, redirected to onboarding wizard:
   - **Step 1 — Spreadsheet**: Choose "Create a new spreadsheet" (auto-setup) or "Connect an existing spreadsheet" (paste URL or pick from Drive).
   - **Step 2 — Sources**: Define money sources (e.g., "Me", "Wife", "Joint"). Starts with sensible defaults, user can add/remove/rename.
   - **Step 3 — Categories**: Define expense categories. Starts with defaults (Food, Transport, etc.), user can customize.
   - **Step 4 — Payment Methods**: Define payment methods. Starts with defaults, user can customize.
4. App saves config to database.
5. If "Create new" was chosen: app creates a Google Spreadsheet in the user's Drive, adds the current month's tab with header row.
6. Redirected to the main expense form — ready to use.

### J2: Log an Expense (Existing User)

Same as the personal version:

1. Open PWA → expense form with month selector.
2. Sources, categories, and methods are loaded from the user's config in the database.
3. Submit → server uses the user's Google OAuth token to append to their spreadsheet.
4. Success toast.

### J3: Manage Settings

1. Navigate to Settings page.
2. View/edit sources, categories, payment methods (add, remove, rename, reorder).
3. View connected spreadsheet (link to open in Sheets).
4. Disconnect and reconnect a different spreadsheet.
5. Account settings (sign out, delete account).

### J4: Offline Submission (Unchanged)

Same as current implementation — entries queue in IndexedDB, sync when back online via `/api/sync`.

## Feature List

### SaaS MVP

| Feature                                                          | Priority |
| ---------------------------------------------------------------- | -------- |
| Google OAuth-based authentication (including Sheets API scope)   | P0       |
| Relational database for user profiles and configuration          | P0       |
| Onboarding wizard (spreadsheet + sources + categories + methods) | P0       |
| Per-user Sheets API calls using OAuth token from the auth system | P0       |
| Auto-create spreadsheet in user's Drive (onboarding option)      | P0       |
| Customizable sources, categories, payment methods per user       | P0       |
| Settings page (edit config, view spreadsheet, sign out)          | P1       |
| Landing page (marketing, sign-in CTA)                            | P1       |
| Migrate existing personal data (Danny's setup)                   | P1       |

### Future

| Feature                                                          | Phase |
| ---------------------------------------------------------------- | ----- |
| Shared household accounts (multiple users → one spreadsheet)     | v2    |
| Billing / usage limits                                           | v2    |
| Spreadsheet templates (preset configs for different use cases)   | v2    |
| Import existing expense data from CSV                            | v3    |
| Dashboard widgets in the app (pulling from Sheets analysis tabs) | v3    |

## UX Expectations

Everything from the personal version still applies (mobile-first, one-hand, numeric keyboard, smart defaults). Additionally:

- **Onboarding must be completable in under 2 minutes** — most users should tap through defaults without changing anything.
- **Settings changes take effect immediately** — no "save and restart" flow.
- **The expense form must not feel slower** despite loading config from a database. Config should be cached or loaded in the route loader efficiently.
