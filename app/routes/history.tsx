import { useReducer, useEffect, useCallback } from 'react';
import {
  data,
  useLoaderData,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from 'react-router';
import type { Route } from './+types/history';
import { getExpensesByMonth } from '~/lib/sheets.server';
import { requireAuth } from '~/lib/auth.server';
import { resolveActiveMonth } from '~/lib/month.server';
import { selectedMonthCookie } from '~/lib/cookies.server';
import type { ExpenseEntry } from '~/lib/types';
import { ExpenseCard } from '~/components/expense-card';
import { MonthSelector } from '~/components/month-selector';
import { getPendingCount } from '~/lib/offline-queue';
import { syncPendingExpenses } from '~/lib/sync';
import { toast } from 'sonner';
import { deleteExpenseByTimestamp } from '~/lib/sheets.server';

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const timestamp = formData.get('timestamp');
  const month = formData.get('month');

  // Validate timestamp presence and type
  if (typeof timestamp !== 'string' || !timestamp.trim()) {
    return data({ error: 'Invalid or missing timestamp' }, { status: 400 });
  }

  // Validate month presence, type, and format YYYY-MM
  if (typeof month !== 'string' || !month.trim()) {
    return data({ error: 'Invalid or missing month' }, { status: 400 });
  }
  const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!monthPattern.test(month)) {
    return data({ error: 'Invalid month format. Expected YYYY-MM.' }, { status: 400 });
  }
  await deleteExpenseByTimestamp(month, timestamp);
  return data({ success: true });
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const url = new URL(request.url);
  const monthParam = url.searchParams.get('month');
  const cookieMonth = await selectedMonthCookie.parse(
    request.headers.get('Cookie'),
  );

  const { months, activeMonth, offline } = await resolveActiveMonth(
    monthParam ?? cookieMonth,
  );

  if (offline) {
    return data({
      entries: [] as ExpenseEntry[],
      activeMonth,
      months,
      offline: true,
    });
  }

  try {
    const LIMIT = 20;
    const rows = await getExpensesByMonth(activeMonth, LIMIT);
    const entries: ExpenseEntry[] = rows.map((row) => ({
      timestamp: row[0] ?? '',
      item: row[1] ?? '',
      category: row[2] ?? '',
      amount: Number(row[3]) || 0,
      method: row[4] ?? '',
      date: row[5] ?? '',
      source: row[6] ?? '',
    }));
    return data({ entries, activeMonth, months });
  } catch {
    return data({
      entries: [] as ExpenseEntry[],
      activeMonth,
      months,
      error: 'Failed to load expenses',
    });
  }
}

export default function History() {
  const loaderData = useLoaderData<typeof loader>();
  const error =
    'error' in loaderData ? (loaderData.error as string) : null;
  const isOffline =
    'offline' in loaderData ? (loaderData.offline as boolean) : false;
  const entries = loaderData.entries as ExpenseEntry[];
  const activeMonth = loaderData.activeMonth as string;
  const months = loaderData.months as string[];
  const navigate = useNavigate();

  type State = {
    sourceFilter: string;
    pendingCount: number;
    isOnline: boolean;
    isSyncing: boolean;
    cachedEntries: ExpenseEntry[];
  };
  type Action =
    | { type: 'SET_SOURCE_FILTER'; filter: string }
    | { type: 'SET_PENDING_COUNT'; count: number }
    | { type: 'SET_ONLINE'; online: boolean }
    | { type: 'SET_SYNCING'; syncing: boolean }
    | { type: 'SET_CACHED_ENTRIES'; entries: ExpenseEntry[] };

  const [state, dispatch] = useReducer(
    (s: State, a: Action): State => {
      switch (a.type) {
        case 'SET_SOURCE_FILTER': return { ...s, sourceFilter: a.filter };
        case 'SET_PENDING_COUNT': return { ...s, pendingCount: a.count };
        case 'SET_ONLINE': return { ...s, isOnline: a.online };
        case 'SET_SYNCING': return { ...s, isSyncing: a.syncing };
        case 'SET_CACHED_ENTRIES': return { ...s, cachedEntries: a.entries };
      }
    },
    {
      sourceFilter: 'All',
      pendingCount: 0,
      isOnline: true,
      isSyncing: false,
      cachedEntries: [],
    },
  );
  const { sourceFilter, pendingCount, isOnline, isSyncing, cachedEntries } = state;

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      dispatch({ type: 'SET_PENDING_COUNT', count });
    } catch {
      // IndexedDB not available
    }
  }, []);

  useEffect(() => {
    dispatch({ type: 'SET_ONLINE', online: navigator.onLine });
    refreshPendingCount();

    const handleOnline = () => dispatch({ type: 'SET_ONLINE', online: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', online: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshPendingCount]);

  // Persist entries to localStorage when loaded successfully
  useEffect(() => {
    if (isOffline || entries.length === 0) return;
    try {
      localStorage.setItem(
        `duitlog-history-${activeMonth}`,
        JSON.stringify(entries),
      );
    } catch {
      // Storage quota exceeded or unavailable
    }
  }, [entries, activeMonth, isOffline]);

  // Load cached entries from localStorage when offline
  useEffect(() => {
    if (!isOffline) return;
    try {
      const cached = localStorage.getItem(`duitlog-history-${activeMonth}`);
      if (cached) {
        dispatch({ type: 'SET_CACHED_ENTRIES', entries: JSON.parse(cached) });
      }
    } catch {
      // localStorage unavailable
    }
  }, [isOffline, activeMonth]);

  // Auto-sync when online with pending entries
  useEffect(() => {
    if (!isOnline || pendingCount === 0 || isSyncing) return;

    dispatch({ type: 'SET_SYNCING', syncing: true });
    syncPendingExpenses((synced, total) => {
      dispatch({ type: 'SET_PENDING_COUNT', count: total - synced });
    })
      .then(({ synced, failed }) => {
        refreshPendingCount();
        if (synced > 0) {
          toast.success(
            `Synced ${synced} expense${synced > 1 ? 's' : ''} to Google Sheets${failed > 0 ? ` (${failed} failed)` : ''}`,
          );
        }
      })
      .catch((error) => {
        console.error('Failed to sync pending expenses', error);
        toast.error('Failed to sync pending expenses. Please try again.');
      })
      .finally(() => {
        dispatch({ type: 'SET_SYNCING', syncing: false });
      });
  }, [isOnline, pendingCount, isSyncing, refreshPendingCount]);

  function handleMonthChange(month: string) {
    navigate(`/history?month=${month}`);
  }

  const displayEntries = isOffline && cachedEntries.length > 0 ? cachedEntries : entries;
  const isShowingCached = isOffline && cachedEntries.length > 0;
  const filtered =
    sourceFilter === 'All'
      ? displayEntries
      : displayEntries.filter((e) => e.source === sourceFilter);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="flex justify-between items-center shrink-0 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-2">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Recent Expenses
        </h1>
        <div className="mt-2">
          <MonthSelector
            months={months}
            activeMonth={activeMonth}
            onChange={handleMonthChange}
          />
        </div>
      </header>

      {isOffline && (
        <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          {isShowingCached
            ? "You're offline — showing last loaded data."
            : "You're offline — history unavailable until reconnected."}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm text-blue-800">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
            {pendingCount}
          </span>
          {isSyncing ? 'Syncing...' : `pending expense${pendingCount > 1 ? 's' : ''} — not yet in history`}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1 px-4 pb-2">
        {['All', 'Danny', 'Dewi', 'Together'].map((s) => (
          <button
            key={s}
            onClick={() => dispatch({ type: 'SET_SOURCE_FILTER', filter: s })}
            className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
              sourceFilter === s
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="px-4 text-sm text-red-600">{error}</p>}

      {filtered.length === 0 && !error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <span className="text-5xl">🧾</span>
          <p className="text-lg font-semibold text-slate-700">
            {isOffline ? 'No cached history for this month' : 'No expenses yet'}
          </p>
          <p className="text-sm text-slate-400">
            {isOffline
              ? 'Visit this month while online to cache it.'
              : 'Start logging your expenses from the Add tab.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 pt-2 pb-4">
          {filtered.map((entry, i) => (
            <ExpenseCard
              key={`${entry.timestamp}-${i}`}
              entry={entry}
              activeMonth={activeMonth}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isDev =
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NODE_ENV === 'development';
  const message = isRouteErrorResponse(error)
    ? error.statusText || 'Something went wrong'
    : error instanceof Error
      ? isDev
        ? error.message
        : 'Something went wrong'
      : 'Something went wrong';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <a
        href="/"
        className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
      >
        Go home
      </a>
    </main>
  );
}
