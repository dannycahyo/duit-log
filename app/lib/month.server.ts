import { getAvailableMonths } from './sheets.server';

export function isNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET'
    )
      return true;
    if (
      err.message.includes('ENOTFOUND') ||
      err.message.includes('getaddrinfo')
    )
      return true;
  }
  return false;
}

function buildFallbackMonths(cookieMonth?: string): string[] {
  const now = new Date();
  const jakartaDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
  );
  const months: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(
      jakartaDate.getFullYear(),
      jakartaDate.getMonth() - i,
      1
    );
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    );
  }
  if (cookieMonth && !months.includes(cookieMonth)) {
    months.push(cookieMonth);
    months.sort().reverse();
  }
  return months;
}

export async function resolveActiveMonth(
  accessToken: string,
  spreadsheetId: string,
  cookieMonth?: string,
): Promise<{ months: string[]; activeMonth: string; offline?: boolean }> {
  let months: string[];
  try {
    months = await getAvailableMonths(accessToken, spreadsheetId);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const fallback = buildFallbackMonths(cookieMonth);
    const activeMonth =
      cookieMonth && fallback.includes(cookieMonth) ? cookieMonth : fallback[0];
    return { months: fallback, activeMonth, offline: true };
  }

  if (months.length === 0) {
    throw new Error(
      'No monthly sheet tabs found. Create a tab named YYYY-MM (e.g., 2025-07) in the spreadsheet.'
    );
  }

  // Priority 1: cookie value, if it still exists as a tab
  if (cookieMonth && months.includes(cookieMonth)) {
    return { months, activeMonth: cookieMonth };
  }

  // Priority 2: current calendar month (in Asia/Jakarta timezone)
  const jakartaFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit'
  });
  const jakartaParts = jakartaFormatter.formatToParts(new Date());
  const jakartaYear = jakartaParts.find((p) => p.type === 'year')?.value;
  const jakartaMonth = jakartaParts.find((p) => p.type === 'month')?.value;
  const currentMonth =
    jakartaYear && jakartaMonth ? `${jakartaYear}-${jakartaMonth}` : months[0];
  if (months.includes(currentMonth)) {
    return { months, activeMonth: currentMonth };
  }

  // Priority 3: most recent available month
  return { months, activeMonth: months[0] };
}
