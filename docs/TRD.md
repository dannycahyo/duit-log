# TRD — Technical Requirement Document

## High-Level Architecture

```
┌─────────────────────────────┐
│  Client (PWA)               │
│  React Router v7 (browser)  │
│  Form → POST to action      │
├─────────────────────────────┤
│  Server (RR7 Framework)     │
│  action() → validate        │
│         → Sheets API append │
│  loader() → Sheets API read │
├─────────────────────────────┤
│  Google Sheets API v4       │
│  Service Account (JSON key) │
│  Spreadsheet: Transactions  │
└─────────────────────────────┘
```

React Router v7 in Framework Mode runs on the server (deployed to Vercel via `@react-router/vercel`). The `action` function in a route module handles form POSTs server-side and calls the Sheets API. The `loader` function reads recent rows for the history view. The client is a standard React SPA that hydrates after SSR.

## Data Model

### Google Sheet: `Transactions`

| Column    | Type            | Source           | Notes                                        |
| --------- | --------------- | ---------------- | -------------------------------------------- |
| Timestamp | ISO 8601 string | Server-generated | `new Date().toISOString()`                   |
| User      | String          | Form field       | `"Danny"` or `"Wife"` (configurable)         |
| Category  | String          | Form field       | From predefined list                         |
| Amount    | Number          | Form field       | Positive decimal, IDR                        |
| Method    | String          | Form field       | e.g. `"Cash"`, `"BCA Debit"`, `"GoPay"`      |
| Note      | String          | Form field       | Free text, optional                          |
| Date      | Date string     | Form field       | `YYYY-MM-DD`, the user-selected expense date |

> The `Timestamp` column records _when the entry was submitted_, while `Date` records _when the expense occurred_. This distinction lets the Sheets analysis tabs do date-based aggregation on `Date` while preserving an audit trail via `Timestamp`.

### Predefined Values (hardcoded in v1, configurable later)

**Categories**: `Food`, `Transport`, `Groceries`, `Utilities`, `Health`, `Entertainment`, `Shopping`, `Education`, `Other`

**Payment Methods**: `Cash`, `BCA Debit`, `BCA Credit`, `GoPay`, `OVO`, `ShopeePay`, `Transfer`, `Other`

**Users**: `Danny`, `Wife`

## API Contract: Action Function

### `POST /` (Add Expense)

The root route's `action` function handles expense submission.

**Request** — Standard `FormData` from an HTML form POST (React Router handles serialization).

```
Fields:
  date:     string   (YYYY-MM-DD, required)
  amount:   string   (parseable to positive number, required)
  category: string   (from predefined list, required)
  method:   string   (from predefined list, required)
  user:     string   ("Danny" | "Wife", required)
  note:     string   (optional, max 200 chars)
```

**Server-side validation** (inside the `action`):

```typescript
// Pseudo-schema (use zod or manual checks)
{
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount:   z.string().transform(Number).pipe(z.number().positive()),
  category: z.enum(CATEGORIES),
  method:   z.enum(METHODS),
  user:     z.enum(USERS),
  note:     z.string().max(200).optional().default(""),
}
```

**Response** — Returned via `data()` from the action (React Router convention):

```typescript
// Success
{ success: true, entry: { date, amount, category, method, user, note } }

// Validation failure
{ success: false, errors: Record<string, string> }

// Sheets API failure
{ success: false, error: "Failed to save. Please try again." }
```

The client reads this via `useActionData()`.

### `GET /history` (Recent Expenses)

The `/history` route's `loader` function reads the last N rows.

**Loader logic**:

1. Call `spreadsheets.values.get` on `Transactions!A:G`.
2. Slice the last 20 rows.
3. Return as `{ entries: ExpenseEntry[] }`.

**Response shape**:

```typescript
type ExpenseEntry = {
  timestamp: string;
  user: string;
  category: string;
  amount: number;
  method: string;
  note: string;
  date: string;
};
```

## Google Sheets API Integration

### Service Account Setup

1. Create a GCP project and enable the Google Sheets API.
2. Create a Service Account, download the JSON key.
3. Share the target spreadsheet with the service account email (`xxx@xxx.iam.gserviceaccount.com`) as **Editor**.

### Environment Variables

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1AbCdEf...
GOOGLE_SHEET_NAME=Transactions
```

> Store the private key as a single env var with literal `\n`. Parse in code: `key.replace(/\\n/g, '\n')`.

### Sheets Client Module (`app/lib/sheets.server.ts`)

```typescript
import { google } from 'googleapis';

let _sheets: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (_sheets) return _sheets;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(
        /\\n/g,
        '\n',
      ),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

export async function appendExpense(row: string[]) {
  const sheets = getSheetsClient();
  return sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
    range: `${process.env.GOOGLE_SHEET_NAME}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

export async function getRecentExpenses(count = 20) {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
    range: `${process.env.GOOGLE_SHEET_NAME}!A:G`,
  });
  const rows = res.data.values ?? [];
  // Skip header row, take last N, reverse for newest-first
  return rows.slice(1).slice(-count).reverse();
}
```

> The `.server.ts` suffix ensures React Router tree-shakes this from the client bundle.

## PWA Considerations

### Web App Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "DuitLog",
  "short_name": "DuitLog",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f172a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker Strategy

**Network-first for data routes** — Expense submission and history reads must always hit the server when online.

**Cache-first for static assets** — App shell (HTML, CSS, JS bundles, icons) cached on install for fast repeat loads.

**Offline behavior (v1)**: Show a clear "You're offline" message on the form. Do **not** queue submissions silently in v1 — this avoids silent data loss if the queue fails. A future phase can add Background Sync.

**Offline behavior (v2+)**: Implement an IndexedDB-backed queue. On form submit while offline, store the entry locally and register a Background Sync event. When connectivity resumes, replay the queue. Show a badge on the form indicating N pending entries.

### Offline Queue (Future — v2)

```
Submit → Online?
  ├─ Yes → POST to action → success
  └─ No  → Save to IndexedDB queue
           → Register Background Sync
           → Show "Saved offline, will sync" toast
           → On reconnect: replay queue → clear
```

## Routing Structure (React Router v7 Framework Mode)

```
app/
├── root.tsx              # Root layout, <html>, manifest link, SW registration
├── routes/
│   ├── _index.tsx        # "/" — Add Expense form + action
│   ├── history.tsx       # "/history" — Recent expenses loader + list
│   └── login.tsx         # "/login" — Passcode entry
├── lib/
│   ├── sheets.server.ts  # Google Sheets API client
│   ├── auth.server.ts    # Session/cookie helpers
│   ├── constants.ts      # Categories, methods, users
│   └── validation.ts     # Zod schemas
├── components/
│   ├── expense-form.tsx  # Reusable form component
│   ├── toast.tsx         # Success/error notification
│   └── nav.tsx           # Bottom tab bar
```

### Route Modules

| Route         | `loader`                           | `action`                     | Purpose             |
| ------------- | ---------------------------------- | ---------------------------- | ------------------- |
| `_index.tsx`  | (none in v1)                       | Validate + append to Sheets  | Main expense form   |
| `history.tsx` | Read last 20 rows from Sheets      | (none)                       | Recent entries list |
| `login.tsx`   | Check if already authed → redirect | Verify passcode → set cookie | Simple auth gate    |

## Form Handling Strategy

Use React Router's built-in `<Form>` component and `useActionData` / `useNavigation` hooks. This is idiomatic RR7 and requires zero additional libraries.

```tsx
// Simplified example in _index.tsx
import { Form, useActionData, useNavigation } from 'react-router';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  // validate, append to Sheets, return result
}

export default function AddExpense() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <Form method="post">
      {/* fields */}
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </Form>
  );
}
```

**Why this approach**: No client-side state management needed. The form POST is handled by the RR7 action server-side; the page revalidates automatically on success. `useNavigation` gives us loading/submitting states for free.

## Data Fetching / Caching

- **No client-side cache in v1.** Every navigation to `/history` calls the loader, which reads from Sheets. This keeps things simple and guarantees fresh data.
- **Future**: Add `Cache-Control` headers or `stale-while-revalidate` on the loader response if Sheets reads become slow (unlikely at our scale).
- Sheets API calls from the server are fast (~100–300ms). Acceptable for our use case.

## Authentication (v1 — Simple Passcode)

1. A shared passcode stored as `AUTH_PASSCODE` env var.
2. On first visit (no session cookie), redirect to `/login`.
3. User enters the passcode. The `login` action compares it, and on match, sets an `HttpOnly` cookie (`session=<signed-value>`).
4. A utility function `requireAuth(request)` checks the cookie in every loader/action. Throws a redirect to `/login` if missing/invalid.
5. Cookie signing uses a `SESSION_SECRET` env var.

This is intentionally minimal. A future version can swap in Google Sign-In or any proper auth.
