# DuitLog

> A zero-friction expense tracker PWA backed by Google Sheets.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![React Router](https://img.shields.io/badge/React_Router-v7-orange.svg)

## Overview

DuitLog is a mobile-first Progressive Web App for logging daily expenses in under 10 seconds. It uses Google Sheets as the single source of truth — the app is purely a fast input surface, while all analysis (pivots, charts, dashboards) lives in Sheets. Designed for couples who want a shared, no-fuss expense tracker they can launch from the phone home screen.

### How it works

```mermaid
flowchart LR
    A["Phone (PWA)"] -->|Form POST| B["React Router v7\nServer Action"]
    B -->|Validate with Zod| C["Google Sheets API v4"]
    C --> D["Google Spreadsheet\n(Transactions sheet)"]
    D -->|loader() read| B
    B -->|JSON response| A
```

## Features

- Sub-10-second expense logging from phone home screen
- Mobile-first UI with numeric keyboard, smart defaults, one-hand operation
- Google Sheets as canonical datastore (no secondary database)
- Category and payment method selection via tap-friendly pill buttons
- Installable PWA (Android + iOS)
- Simple passcode authentication
- Offline fallback page

## Tech Stack

| Layer      | Technology                             |
| ---------- | -------------------------------------- |
| Framework  | React Router v7 (Framework Mode)       |
| Language   | TypeScript                             |
| Styling    | Tailwind CSS v4                        |
| Data Layer | Google Sheets API v4 (Service Account) |
| Validation | Zod                                    |
| Deployment | Vercel (Serverless)                    |

## Getting Started

### Prerequisites

- Node.js >= 20
- npm
- A Google Cloud project with the Sheets API enabled
- A Service Account with a JSON key (see [Google Sheets Setup](#google-sheets-setup))

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/dannycahyo/duit-log.git
cd duit-log

# 2. Install dependencies
npm install

# 3. Copy the environment template and fill in your values
cp .env.example .env

# 4. Start the dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

## Google Sheets Setup

Follow these steps to configure Google Sheets as your datastore:

1. **Create a GCP project**
   Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a new project (or use an existing one).

2. **Enable the Google Sheets API**
   In your project, navigate to **APIs & Services > Library**, search for "Google Sheets API", and enable it.

3. **Create a Service Account**
   Go to **APIs & Services > Credentials > Create Credentials > Service Account**. Give it a name (e.g., `duitlog-sheets`), then click **Done**.

4. **Download the JSON key**
   On the Service Account detail page, go to the **Keys** tab, click **Add Key > Create new key**, and choose **JSON**. Save the downloaded file securely.

5. **Extract credentials from the JSON key**
   Open the JSON file and copy:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`

6. **Create a Google Spreadsheet**
   Create a new spreadsheet in Google Sheets.

7. **Add a "Transactions" sheet with the header row**
   Rename the first sheet tab to `Transactions` and add these headers in row 1:

   | Timestamp | User | Category | Amount | Method | Note | Date |
   | --------- | ---- | -------- | ------ | ------ | ---- | ---- |

8. **Share the spreadsheet with the Service Account**
   Click **Share**, paste the `client_email` from step 5, and grant **Editor** access.

9. **Copy the Spreadsheet ID**
   From the spreadsheet URL `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`, copy the `SPREADSHEET_ID` portion.

10. **Fill in the `.env` file**
    Populate all values in your `.env` file using the credentials and IDs from the steps above.

> **Note about `GOOGLE_PRIVATE_KEY`:** The key from the JSON file contains real newlines. In the `.env` file, store it as a single line with literal `\n` characters, wrapped in double quotes (e.g., `"-----BEGIN PRIVATE KEY-----\nMIIEv....\n-----END PRIVATE KEY-----\n"`). The app parses this at runtime with `.replace(/\\n/g, "\n")`.

## Project Structure

```
duit-log/
├── app/
│   ├── root.tsx                 # Root layout, manifest link, SW registration
│   ├── routes/
│   │   ├── _index.tsx           # "/" — Add Expense form + action
│   │   ├── history.tsx          # "/history" — Recent expenses list
│   │   ├── login.tsx            # "/login" — Passcode entry
│   │   └── offline.tsx          # "/offline" — Offline fallback page
│   ├── lib/
│   │   ├── sheets.server.ts     # Google Sheets API client
│   │   ├── auth.server.ts       # Session/cookie helpers
│   │   ├── logger.server.ts     # Structured JSON logging
│   │   ├── constants.ts         # Categories, methods, users
│   │   └── validation.ts        # Zod schemas
│   ├── components/
│   │   ├── expense-form.tsx     # Main expense input form
│   │   └── expense-card.tsx     # Single expense entry card
│   └── lib/types.ts             # Shared types
├── public/
│   ├── manifest.webmanifest     # PWA manifest
│   ├── sw.js                    # Service worker
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── .env.example                 # Environment variable template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── react-router.config.ts
```

## Available Scripts

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `npm run dev`       | Start development server        |
| `npm run build`     | Production build                |
| `npm run start`     | Start production server locally |
| `npm run typecheck` | Run TypeScript type checking    |

The `@react-router/node` adapter handles the serverless function configuration.

## Roadmap

- **v1.5:** Today's spending total widget
- **v2:** Offline queue with background sync, category/method management
- **v3:** Receipt photo upload, monthly summaries, Google Sign-In

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
