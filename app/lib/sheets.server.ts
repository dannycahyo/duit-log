import { google } from 'googleapis';
import { clerkClient } from '~/lib/clerk.server';
import { log } from './logger.server';

// Singleton — reuse across requests in the same server instance
let _sheets: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (_sheets) return _sheets;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // The private key is stored with literal \n in the env var; replace with real newlines
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

export async function getAvailableMonths(): Promise<string[]> {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      fields: 'sheets.properties.title',
    });

    const titles = (res.data.sheets ?? [])
      .map((s) => s.properties?.title ?? '')
      .filter((title) => /^\d{4}-\d{2}$/.test(title));

    titles.sort();
    titles.reverse();

    log('info', 'sheets_get_months_success', {
      count: titles.length,
    });
    return titles;
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_get_months_error', { error: error.message });
    throw err;
  }
}

export async function appendExpense(
  month: string,
  row: string[],
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: `'${month}'!A:G`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });
    log('info', 'sheets_append_success', { month });
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_append_error', { error: error.message });
    throw err;
  }
}

export async function getGoogleAccessToken(
  clerkUserId: string,
): Promise<string> {
  const tokens = await clerkClient.users.getUserOauthAccessToken(
    clerkUserId,
    'google',
  );
  const accessToken = tokens.data[0]?.token;
  if (!accessToken) {
    throw new Error(
      'Google OAuth token not found. Please sign in again.',
    );
  }
  return accessToken;
}

export async function createSpreadsheetForUser(
  accessToken: string,
  title: string = 'DuitLog Expenses',
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth });

  // Derive current month using Asia/Jakarta timezone to match expense normalization
  const now = new Date();
  const jakartaParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(now);
  const jakartaYear = jakartaParts.find((p) => p.type === 'year')?.value;
  const jakartaMonth = jakartaParts.find((p) => p.type === 'month')?.value;
  if (!jakartaYear || !jakartaMonth) {
    throw new Error('Failed to derive current month for Asia/Jakarta timezone');
  }
  const currentMonth = `${jakartaYear}-${jakartaMonth}`;

  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: currentMonth } }],
    },
  });

  const spreadsheetId = res.data.spreadsheetId!;
  const spreadsheetUrl = res.data.spreadsheetUrl!;

  // Add header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${currentMonth}'!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          'Timestamp',
          'Item',
          'Category',
          'Amount',
          'Payment Method',
          'Date',
          'Source',
        ],
      ],
    },
  });

  return { spreadsheetId, spreadsheetUrl };
}

export async function verifySpreadsheetAccess(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth });
  // First, verify that the spreadsheet exists and is readable.
  await sheets.spreadsheets.get({ spreadsheetId });

  // Then, verify that the user has edit permissions on the underlying Drive file.
  const drive = google.drive({ version: 'v3', auth });
  const file = await drive.files.get({
    fileId: spreadsheetId,
    fields: 'id, capabilities(canEdit)',
  });

  const canEdit = file.data.capabilities?.canEdit;
  if (!canEdit) {
    throw new Error(
      'The connected Google account does not have edit access to this spreadsheet. ' +
        'Please ensure you have editor permissions and try again.',
    );
  }
}

export async function getExpensesByMonth(
  month: string,
  limit?: number,
): Promise<string[][]> {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: `'${month}'!A:G`,
    });
    const values = res.data.values ?? [];
    const rows = values.slice(1);
    const bounded = limit ? rows.slice(-limit) : rows;
    return bounded.reverse() as string[][];
  } catch (err) {
    const error = err as Error;
    log('error', 'sheets_get_error', { error: error.message });
    throw err;
  }
}
