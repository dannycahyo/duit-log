# TRD — Technical Requirement Document

| Version | Date       | Author | Change Description |
| ------- | ---------- | ------ | ------------------ |
| 2       | 2025-03-09 | Danny  | SaaS Plan          |

## High-Level Architecture

```
┌───────────────────────────────────┐
│  Client (PWA)                     │
│  React Router v7 (browser)        │
│  Clerk auth (React components)    │
│  Form → POST to action            │
├───────────────────────────────────┤
│  Server (RR7 Framework Mode)      │
│  Clerk middleware (auth)          │
│  loader() → DB config + months    │
│  action() → validate → append     │
│            (using user's OAuth)   │
├──────────┬────────────────────────┤
│  Vercel  │  Google Sheets API v4  │
│  Postgres│  Per-user OAuth token  │
│  (Neon)  │  from Clerk            │
│  Drizzle │  User's spreadsheet    │
│  ORM     │                        │
└──────────┴────────────────────────┘
```

## Authentication: Clerk + Google OAuth

### How it works

1. Clerk provides the authentication UI (sign-in, sign-up, user management).
2. The Google OAuth provider in Clerk is configured with **additional scopes**:
   - `https://www.googleapis.com/auth/spreadsheets` — read/write Sheets
   - `https://www.googleapis.com/auth/drive.file` — create new spreadsheets in user's Drive (only files the app creates)
3. When a user signs in with Google, Clerk stores their OAuth access token and refresh token.
4. On the server (in loaders/actions), we retrieve the user's Google OAuth token:

   ```typescript
   import { clerkClient } from '@clerk/react-router/api.server';

   const tokens = await clerkClient.users.getUserOauthAccessToken(
     userId,
     'google',
   );
   const accessToken = tokens.data[0]?.token;
   ```

5. This access token is used to create a per-request Google Sheets client:

   ```typescript
   import { google } from 'googleapis';

   function getSheetsClientForUser(accessToken: string) {
     const auth = new google.auth.OAuth2();
     auth.setCredentials({ access_token: accessToken });
     return google.sheets({ version: 'v4', auth });
   }
   ```

6. Clerk handles token refresh automatically — when we request the token, we always get a valid one.

### Clerk setup requirements

- Create a Clerk application.
- Enable the Google OAuth social provider.
- In Clerk dashboard → Google OAuth settings → add custom scopes: `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive.file`.
- Set the Google OAuth client ID and secret (from the same GCP project, or a new one — the service account is no longer needed).
- Clerk env vars: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

### Removing old auth

- Remove `auth.server.ts` (passcode-based session auth).
- Remove `login.tsx` routes.
- Remove `AUTH_PASSCODE` and `SESSION_SECRET` env vars.
- Remove `duitlog_session` cookie.
- Replace all `requireAuth(request)` calls with Clerk's auth middleware/helpers.

## Database: Vercel Postgres + Drizzle ORM

### Schema

```typescript
// app/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  onboardingComplete: boolean('onboarding_complete')
    .notNull()
    .default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 1:1 relationship — each user has exactly one spreadsheet.
// The unique constraint on user_id enforces this at the DB level.
export const userSpreadsheets = pgTable('user_spreadsheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique() // One spreadsheet per user
    .references(() => users.id, { onDelete: 'cascade' }),
  spreadsheetId: text('spreadsheet_id').notNull(),
  spreadsheetUrl: text('spreadsheet_url'),
  spreadsheetTitle: text('spreadsheet_title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSources = pgTable('user_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  color: text('color').notNull(), // Tailwind color class, e.g. "blue-500"
  sortOrder: integer('sort_order').notNull().default(0),
});

export const userCategories = pgTable('user_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  color: text('color').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const userMethods = pgTable('user_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});
```

### Default configs (seeded on onboarding)

```typescript
// app/lib/defaults.ts

export const DEFAULT_SOURCES = [
  { label: 'Personal', color: 'blue-500' },
  { label: 'Partner', color: 'rose-500' },
  { label: 'Shared', color: 'indigo-500' },
];

export const DEFAULT_CATEGORIES = [
  { label: 'Food', color: 'amber-500' },
  { label: 'Transport', color: 'blue-500' },
  { label: 'Groceries', color: 'green-500' },
  { label: 'Utilities', color: 'purple-500' },
  { label: 'Health', color: 'red-500' },
  { label: 'Entertainment', color: 'pink-500' },
  { label: 'Shopping', color: 'indigo-500' },
  { label: 'Education', color: 'teal-500' },
  { label: 'Other', color: 'gray-500' },
];

export const DEFAULT_METHODS = [
  { label: 'Cash' },
  { label: 'Debit Card' },
  { label: 'Credit Card' },
  { label: 'E-Wallet' },
  { label: 'Bank Transfer' },
  { label: 'Other' },
];
```

These are generic defaults (not "Danny" / "BCA Debit"). Users customize during onboarding.

### Drizzle config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './app/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Database client

```typescript
// app/db/index.server.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

## Google Sheets API: Per-User OAuth

### Sheets client (replaces service account)

```typescript
// app/lib/sheets.server.ts
import { google } from 'googleapis';
import { clerkClient } from '@clerk/react-router/api.server';

/**
 * Get a Google Sheets client authenticated as the given user.
 * Retrieves the OAuth token from Clerk.
 */
export async function getSheetsClientForUser(clerkUserId: string) {
  const tokens = await clerkClient.users.getUserOauthAccessToken(
    clerkUserId,
    'google',
  );
  const accessToken = tokens.data[0]?.token;

  if (!accessToken) {
    throw new Error(
      'Google OAuth token not found. User may need to re-authenticate.',
    );
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Get a Google Drive client (for creating spreadsheets).
 */
export async function getDriveClientForUser(clerkUserId: string) {
  const tokens = await clerkClient.users.getUserOauthAccessToken(
    clerkUserId,
    'google',
  );
  const accessToken = tokens.data[0]?.token;

  if (!accessToken) {
    throw new Error('Google OAuth token not found.');
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.drive({ version: 'v3', auth });
}
```

### Updated Sheets functions

All Sheets functions now take a `clerkUserId` and `spreadsheetId` instead of reading from env vars:

```typescript
export async function getAvailableMonths(
  clerkUserId: string,
  spreadsheetId: string,
): Promise<string[]> {
  const sheets = await getSheetsClientForUser(clerkUserId);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter((name) => /^\d{4}-\d{2}$/.test(name))
    .sort()
    .reverse();
}

export async function appendExpense(
  clerkUserId: string,
  spreadsheetId: string,
  month: string,
  row: string[],
): Promise<void> {
  const sheets = await getSheetsClientForUser(clerkUserId);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${month}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function getExpensesByMonth(
  clerkUserId: string,
  spreadsheetId: string,
  month: string,
): Promise<string[][]> {
  const sheets = await getSheetsClientForUser(clerkUserId);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${month}!A:G`,
  });
  const rows = res.data.values ?? [];
  return rows.slice(1).reverse();
}
```

### Auto-create spreadsheet (onboarding)

```typescript
export async function createSpreadsheetForUser(
  clerkUserId: string,
  title: string = 'DuitLog Expenses',
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const sheets = await getSheetsClientForUser(clerkUserId);

  // Create spreadsheet with current month's tab
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        {
          properties: { title: currentMonth },
        },
      ],
    },
  });

  const spreadsheetId = res.data.spreadsheetId!;
  const spreadsheetUrl = res.data.spreadsheetUrl!;

  // Add header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${currentMonth}!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          'Timestamp',
          'Source',
          'Category',
          'Amount',
          'Method',
          'Date',
          'Source',
        ],
      ],
    },
  });

  return { spreadsheetId, spreadsheetUrl };
}
```

## Routing Structure (Updated)

```
app/
├── root.tsx                     # Root layout, Clerk provider, PWA meta
├── routes/
│   ├── _index.tsx               # "/" — Landing page (unauthenticated)
│   ├── _app.tsx                 # Layout route for authenticated area
│   ├── _app.dashboard.tsx       # "/dashboard" — Expense form (was _index)
│   ├── _app.history.tsx         # "/history" — Month-scoped expense list
│   ├── _app.settings.tsx        # "/settings" — Config management
│   ├── _app.onboarding.tsx      # "/onboarding" — Setup wizard
│   ├── api.sync.tsx             # POST /api/sync — Offline sync endpoint
│   └── offline.tsx              # Offline fallback page
├── db/
│   ├── schema.ts                # Drizzle schema
│   └── index.server.ts          # Database client
├── lib/
│   ├── sheets.server.ts         # Google Sheets API (per-user OAuth)
│   ├── month.server.ts          # Month resolution logic
│   ├── user.server.ts           # User config CRUD (DB queries)
│   ├── cookies.server.ts        # Preference cookies (month, source)
│   ├── logger.server.ts         # Structured logging
│   ├── defaults.ts              # Default sources, categories, methods
│   ├── validation.ts            # Zod schemas (dynamic, not hardcoded enums)
│   ├── offline-queue.ts         # IndexedDB queue (client-side)
│   └── sync.ts                  # Sync engine (client-side)
├── components/
│   ├── month-selector.tsx
│   ├── expense-form.tsx         # Now receives dynamic options as props
│   ├── expense-card.tsx
│   ├── toast.tsx
│   ├── nav.tsx
│   ├── onboarding/              # Wizard step components
│   │   ├── spreadsheet-step.tsx
│   │   ├── sources-step.tsx
│   │   ├── categories-step.tsx
│   │   └── methods-step.tsx
│   └── settings/                # Settings page sections
│       ├── sources-editor.tsx
│       ├── categories-editor.tsx
│       ├── methods-editor.tsx
│       └── spreadsheet-info.tsx
└── types.ts
```

### Route changes from personal version

| Personal route     | SaaS route         | Change                                 |
| ------------------ | ------------------ | -------------------------------------- |
| `/` (expense form) | `/` (landing page) | Landing page for unauthenticated users |
| —                  | `/dashboard`       | Expense form (moved, behind auth)      |
| `/history`         | `/history`         | Same, behind auth                      |
| `/login`           | —                  | Removed (Clerk handles auth)           |
| `/logout`          | —                  | Removed (Clerk handles auth)           |
| —                  | `/onboarding`      | New: setup wizard                      |
| —                  | `/settings`        | New: config management                 |
| `/api/sync`        | `/api/sync`        | Updated: per-user Sheets auth          |

### Auth middleware pattern

Use a layout route (`_app.tsx`) that gates all authenticated routes:

```typescript
// app/routes/_app.tsx
import { getAuth } from "@clerk/react-router/ssr.server";
import { redirect, Outlet } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const { userId } = await getAuth(request);
  if (!userId) throw redirect("/");

  // Check onboarding status
  const user = await getUserByClerkId(userId);
  if (!user?.onboardingComplete) {
    const url = new URL(request.url);
    if (url.pathname !== "/onboarding") {
      throw redirect("/onboarding");
    }
  }

  return null;
}

export default function AppLayout() {
  return <Outlet />;
}
```

## Validation: Dynamic Schemas

The current Zod schema uses hardcoded `z.enum(CATEGORIES)`. With per-user config, validation must accept the user's custom values.

```typescript
// app/lib/validation.ts
import { z } from 'zod';

/**
 * Create an expense schema dynamically based on the user's config.
 */
export function createExpenseSchema(config: {
  sources: string[];
  categories: string[];
  methods: string[];
}) {
  return z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .transform(Number)
      .pipe(z.number().positive('Amount must be positive')),
    category: z.enum(config.categories as [string, ...string[]], {
      errorMap: () => ({ message: 'Pick a category' }),
    }),
    method: z.enum(config.methods as [string, ...string[]], {
      errorMap: () => ({ message: 'Pick a payment method' }),
    }),
    source: z.enum(config.sources as [string, ...string[]], {
      errorMap: () => ({ message: 'Select a source' }),
    }),
  });
}
```

## Expense Form: Dynamic Options

The `<ExpenseForm>` component no longer imports constants. Instead, it receives options as props from the loader:

```typescript
interface ExpenseFormProps {
  sources: Array<{ label: string; color: string }>;
  categories: Array<{ label: string; color: string }>;
  methods: Array<{ label: string }>;
  selectedMonth: string;
  defaultSource?: string;
  errors?: Record<string, string>;
  isSubmitting?: boolean;
}
```

The loader queries the database for the user's config and passes it to the component.

## Offline Queue: Updated for Multi-User

The offline queue uses IndexedDB but must be **scoped per user** to prevent cross-account data leakage. When a different user signs in on the same device, queued expenses from the previous user must never sync to the new user's spreadsheet.

### Client-side changes

1. **Store the authenticated `clerkUserId` with each queued expense.** The `PendingExpense` record gains a `userId` field set at enqueue time.
2. **On auth change (sign-out / sign-in), clear or segregate the queue.** Use Clerk's `useAuth()` hook to detect user changes and either:
   - Clear all pending expenses on sign-out (`clearAllPending()`), or
   - Filter pending expenses by `userId` so only the current user's entries are synced.
3. **IndexedDB database name can be kept global** (`duitlog-offline`), but the sync engine must filter by `userId` before posting.

### Server-side validation

The `/api/sync` endpoint **must validate that the `userId` in the queued expense matches the authenticated Clerk user**. This is the authoritative check — even if the client is tampered with, the server rejects mismatched entries.

### Updated `/api/sync` endpoint

1. Authenticate via Clerk (the session cookie is sent with the fetch).
2. **Validate that the expense's `userId` matches the authenticated user** (reject if mismatched).
3. Look up the user's spreadsheet ID from the database.
4. Look up the user's sources/categories/methods for validation.
5. Use the user's OAuth token for the Sheets API call.

## Environment Variables (Updated)

> **Note:** The repo's current `.env.example` still documents the old service-account and passcode vars (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SPREADSHEET_ID`, `AUTH_PASSCODE`, `SESSION_SECRET`). As part of the implementation PR, `.env.example` and `README.md` must be updated to reflect the new variables below.

```env
# Clerk
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Database (Vercel Postgres / Neon)
DATABASE_URL=postgresql://...

# Google OAuth (configured in Clerk, but the GCP project needs these)
# These go in the Clerk dashboard, not in the app's env vars.
# GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in Clerk.

# Removed:
# GOOGLE_SERVICE_ACCOUNT_EMAIL (no longer needed)
# GOOGLE_PRIVATE_KEY (no longer needed)
# GOOGLE_SPREADSHEET_ID (per-user, stored in DB)
# AUTH_PASSCODE (replaced by Clerk)
# SESSION_SECRET (replaced by Clerk)
```

## Data Flow: Expense Submission (SaaS Version)

```
1. User opens /dashboard
2. Loader:
   a. Clerk middleware → get userId
   b. DB query → user's spreadsheetId, sources, categories, methods
   c. Sheets API (user's OAuth token) → available months
   d. Return { config, months, activeMonth }
3. User fills form, submits
4. Action:
   a. Clerk middleware → get userId
   b. DB query → user's spreadsheetId, config
   c. Validate with dynamic Zod schema (user's sources/categories/methods)
   d. Sheets API (user's OAuth token) → append row to user's spreadsheet
   e. Return success
```

## Performance Considerations

- **DB queries per request**: Each loader/action needs the user's config (1 DB query) and the Sheets API call. The DB query adds ~10–30ms on Vercel's network. Acceptable.
- **OAuth token retrieval**: Clerk's `getUserOauthAccessToken` is a network call to Clerk's API (~50–100ms). To reduce duplicate Clerk calls within a single request, use a **server-side helper** that fetches the token once per request and reuses it across loader/action logic. **Do not pass the OAuth access token to the client via loader data** — loader data is serialized to the browser and would leak the bearer token. Keep all token handling server-side only.
- **Config caching**: For heavy users, we could cache their config in a cookie or short-lived in-memory cache. Not needed for v1 — the DB query is fast enough.
