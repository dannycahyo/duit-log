import { useEffect, useRef, useState, useCallback } from 'react';
import {
  data,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from 'react-router';
import type { Route } from './+types/_app.dashboard';
import {
  appendExpense,
  getAvailableMonths,
  getGoogleAccessToken,
} from '~/lib/sheets.server';
import { createExpenseSchema } from '~/lib/validation';
import { getOrCreateUser, getUserConfig } from '~/lib/user.server';
import { ExpenseForm } from '~/components/expense-form';
import { MonthSelector } from '~/components/month-selector';
import { log } from '~/lib/logger.server';
import { toast } from 'sonner';
import { getAuth } from '@clerk/react-router/server';
import { redirect } from 'react-router';
import { resolveActiveMonth, isNetworkError } from '~/lib/month.server';
import {
  selectedMonthCookie,
  selectedSourceCookie,
} from '~/lib/cookies.server';
import {
  addPendingExpense,
  getPendingCount,
  registerBackgroundSync,
} from '~/lib/offline-queue';
import { syncPendingExpenses } from '~/lib/sync';

function formatMonthLabel(month: string): string {
  const date = new Date(month + '-01');
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

type ActionData =
  | {
      success: true;
      entry: {
        item: string;
        category: string;
        amount: number;
        method: string;
        date: string;
        source: string;
        month: string;
      };
    }
  | { success: false; errors: Record<string, string> }
  | { success: false; error: string }
  | {
      success: false;
      networkError: true;
      pendingData: {
        month: string;
        item: string;
        date: string;
        amount: number;
        category: string;
        method: string;
        source: string;
      };
    };

export async function loader(args: Route.LoaderArgs) {
  const { userId: clerkUserId } = await getAuth(args);
  if (!clerkUserId) throw redirect('/');

  const user = await getOrCreateUser(clerkUserId, '');
  if (!user) throw redirect('/');
  const config = await getUserConfig(user.id);

  if (!config.spreadsheet) {
    throw redirect('/onboarding');
  }

  const accessToken = await getGoogleAccessToken(clerkUserId);
  const cookieHeader = args.request.headers.get('Cookie');
  const [cookieMonth, cookieSource] = await Promise.all([
    selectedMonthCookie.parse(cookieHeader),
    selectedSourceCookie.parse(cookieHeader),
  ]);

  const { months, activeMonth } = await resolveActiveMonth(
    accessToken,
    config.spreadsheet.spreadsheetId,
    cookieMonth,
  );

  return data({
    months,
    activeMonth,
    sources: config.sources.map((s) => ({ label: s.label, color: s.color })),
    categories: config.categories.map((c) => ({ label: c.label, color: c.color })),
    methods: config.methods.map((m) => ({ label: m.label })),
    defaultSource: cookieSource ?? config.sources[0]?.label ?? '',
  });
}

export async function action(args: Route.ActionArgs) {
  const { userId: clerkUserId } = await getAuth(args);
  if (!clerkUserId) throw redirect('/');

  const user = await getOrCreateUser(clerkUserId, '');
  if (!user || !('email' in user) || !user.email) {
    return data({ success: false as const, error: 'User account is not fully initialized. Please reload the page and try again.' });
  }
  const config = await getUserConfig(user.id);

  if (!config.spreadsheet) {
    return data({ success: false as const, error: 'No spreadsheet configured.' });
  }

  const request = args.request;
  const formData = await request.formData();

  const schema = createExpenseSchema({
    sources: config.sources.map((s) => s.label),
    categories: config.categories.map((c) => c.label),
    methods: config.methods.map((m) => m.label),
  });

  const result = schema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      if (!errors[key]) errors[key] = issue.message;
    }
    return data({ success: false as const, errors });
  }

  const parsed = result.data;
  const accessToken = await getGoogleAccessToken(clerkUserId);

  // Verify the target month tab exists
  try {
    const months = await getAvailableMonths(accessToken, config.spreadsheet.spreadsheetId);
    if (!months.includes(parsed.month)) {
      return data({
        success: false as const,
        error: `Sheet tab '${parsed.month}' not found.`,
      });
    }
  } catch (err) {
    if (!isNetworkError(err)) throw err;
  }

  const now = new Date();
  const jakartaDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }),
  );
  const timestamp = `${jakartaDate.getMonth() + 1}/${jakartaDate.getDate()}/${jakartaDate.getFullYear()} ${String(jakartaDate.getHours()).padStart(2, '0')}:${String(jakartaDate.getMinutes()).padStart(2, '0')}:${String(jakartaDate.getSeconds()).padStart(2, '0')}`;

  const [year, month, day] = parsed.date.split('-');
  const formattedDate = `${Number(month)}/${Number(day)}/${year}`;

  const row = [
    timestamp,        // Timestamp
    parsed.item,      // Item
    parsed.category,  // Category
    String(parsed.amount), // Amount (IDR)
    parsed.method,    // Payment Method
    formattedDate,    // Date
    parsed.source,    // Source
  ];

  try {
    await appendExpense(accessToken, config.spreadsheet.spreadsheetId, parsed.month, row);

    const headers = new Headers();
    headers.append(
      'Set-Cookie',
      await selectedMonthCookie.serialize(parsed.month),
    );
    headers.append(
      'Set-Cookie',
      await selectedSourceCookie.serialize(parsed.source),
    );

    return data(
      {
        success: true as const,
        entry: { ...parsed },
      },
      { headers },
    );
  } catch (err) {
    if (isNetworkError(err)) {
      return data({
        success: false as const,
        networkError: true as const,
        pendingData: {
          month: parsed.month,
          item: parsed.item,
          date: parsed.date,
          amount: parsed.amount,
          category: parsed.category,
          method: parsed.method,
          source: parsed.source,
        },
      });
    }
    log('error', 'action_append_error', {
      error: (err as Error).message,
    });
    return data(
      {
        success: false as const,
        error: 'Failed to save. Please try again.',
      },
      { status: 500 },
    );
  }
}

export default function Dashboard() {
  const { months, activeMonth, sources, categories, methods, defaultSource } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | ActionData
    | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const amountRef = useRef<HTMLInputElement>(null);

  const [selectedMonth, setSelectedMonth] = useState(activeMonth);
  const [formKey, setFormKey] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Track online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending count on mount
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB not available
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Auto-sync when coming back online
  // Skip when SyncManager is available — the SW Background Sync owns it then,
  // preventing concurrent submissions of the same queued entry.
  useEffect(() => {
    if (!isOnline || pendingCount === 0 || isSyncing) return;
    if (typeof window !== 'undefined' && 'SyncManager' in window)
      return;

    setIsSyncing(true);
    syncPendingExpenses((synced, total) => {
      setPendingCount(total - synced);
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
        // Ensure the user is informed when background sync fails
        console.error('Failed to sync pending expenses', error);
        toast.error(
          'Failed to sync pending expenses. They will be retried automatically when possible.',
        );
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, [isOnline, pendingCount, isSyncing, refreshPendingCount]);

  // Listen for SW sync-complete message
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        refreshPendingCount();
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () =>
      navigator.serviceWorker.removeEventListener('message', handler);
  }, [refreshPendingCount]);

  // Handle action response
  useEffect(() => {
    if (!actionData) return;

    if (actionData.success) {
      const monthLabel = formatMonthLabel(actionData.entry.month);
      toast.success(
        `Saved to ${monthLabel}: ${actionData.entry.item} — IDR ${actionData.entry.amount.toLocaleString()}`,
      );
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        navigator.vibrate(50);
      }
      setFormKey((k) => k + 1);
      setTimeout(() => amountRef.current?.focus(), 100);
    } else if ('networkError' in actionData && actionData.networkError) {
      // Server couldn't reach Sheets — fall back to offline queue
      const fd = new FormData();
      Object.entries(actionData.pendingData).forEach(([k, v]) =>
        fd.set(k, String(v)),
      );
      handleOfflineSubmit(fd);
    } else if ('error' in actionData && actionData.error) {
      toast.error(actionData.error);
    }
  }, [actionData]);

  function generateOfflineId(): string {
    // Prefer native crypto.randomUUID when available, fall back to timestamp+random
    if (
      typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }

    return (
      'offline-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2)
    );
  }

  // Handle offline form submission
  async function handleOfflineSubmit(formData: FormData) {
    const expense = {
      id: generateOfflineId(),
      createdAt: new Date().toISOString(),
      formData: {
        month: formData.get('month') as string,
        item: formData.get('item') as string,
        date: formData.get('date') as string,
        amount: formData.get('amount') as string,
        category: formData.get('category') as string,
        method: formData.get('method') as string,
        source: formData.get('source') as string,
      },
    };

    try {
      await addPendingExpense(expense);
      await registerBackgroundSync();
      await refreshPendingCount();

      toast('Saved offline — will sync when connected', {
        style: {
          backgroundColor: '#fffbeb',
          color: '#92400e',
          border: '1px solid #fde68a',
        },
      });

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.vibrate === 'function'
      ) {
        navigator.vibrate(50);
      }

      setFormKey((k) => k + 1);
      setTimeout(() => amountRef.current?.focus(), 100);
    } catch (error) {
      console.error('Failed to save expense offline', error);
      toast.error(
        'Could not save expense for offline use. Please try again or submit when back online.',
      );
    }
  }

  const errors =
    actionData && !actionData.success && 'errors' in actionData
      ? actionData.errors
      : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="px-4 flex justify-between items-center pt-[max(1.5rem,env(safe-area-inset-top))] pb-2 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          DuitLog
        </h1>
        <div className="mt-2">
          <MonthSelector
            months={months}
            activeMonth={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>
      </header>

      {/* Offline banner */}
      {!isOnline && (
        <div className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          You're offline — expenses will be saved locally and synced
          when you reconnect.
        </div>
      )}

      {/* Pending sync badge */}
      {pendingCount > 0 && (
        <div className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm text-blue-800">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
            {pendingCount}
          </span>
          {isSyncing
            ? 'Syncing...'
            : `pending expense${pendingCount > 1 ? 's' : ''}`}
        </div>
      )}

      <ExpenseForm
        key={formKey}
        sources={sources}
        categories={categories}
        methods={methods}
        errors={errors}
        isSubmitting={isSubmitting}
        amountRef={amountRef}
        selectedMonth={selectedMonth}
        defaultSource={defaultSource}
        isOnline={isOnline}
        onOfflineSubmit={handleOfflineSubmit}
      />
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isDev = process.env.NODE_ENV === 'development';
  const message = isRouteErrorResponse(error)
    ? error.statusText || 'Something went wrong'
    : isDev && error instanceof Error
      ? error.message
      : 'Something went wrong';

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-slate-500">{message}</p>
      <a
        href="/dashboard"
        className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
      >
        Go home
      </a>
    </main>
  );
}
