import { google } from 'googleapis';
import { clerkClient } from '~/lib/clerk.server';
import { log } from './logger.server';

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

function createSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

export async function getAvailableMonths(
  accessToken: string,
  spreadsheetId: string,
): Promise<string[]> {
  const sheets = createSheetsClient(accessToken);
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
  accessToken: string,
  spreadsheetId: string,
  month: string,
  row: string[],
): Promise<void> {
  const sheets = createSheetsClient(accessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${month}'!A:F`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  log('info', 'sheets_append_success', { month });
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
    range: `'${currentMonth}'!A1:F1`,
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
  accessToken: string,
  spreadsheetId: string,
  month: string,
  limit?: number,
): Promise<string[][]> {
  const sheets = createSheetsClient(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${month}'!A:F`,
  });
  const rows = res.data.values ?? [];
  const data = rows.slice(1);
  const bounded = limit ? data.slice(-limit) : data;
  return bounded.reverse();
}
