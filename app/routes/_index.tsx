import { useEffect, useRef, useState, useCallback } from 'react';
import {
  data,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  isRouteErrorResponse,
} from 'react-router';
import type { Route } from './+types/_index';
import {
  appendExpense,
  getAvailableMonths,
} from '~/lib/sheets.server';
import { expenseSchema } from '~/lib/validation';
import { ExpenseForm } from '~/components/expense-form';
import { MonthSelector } from '~/components/month-selector';
import { log } from '~/lib/logger.server';
import { toast } from 'sonner';
import { requireAuth } from '~/lib/auth.server';
import { resolveActiveMonth } from '~/lib/month.server';
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
  | { success: false; error: string };

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const cookieHeader = request.headers.get('Cookie');
  const cookieMonth = await selectedMonthCookie.parse(cookieHeader);
  const cookieSource = await selectedSourceCookie.parse(cookieHeader);

  const { months, activeMonth } =
    await resolveActiveMonth(cookieMonth);

  return data({
    months,
    activeMonth,
    defaultSource: cookieSource ?? 'Danny',
  });
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const raw = {
    month: formData.get('month') as string,
    item: formData.get('item') as string,
    date: formData.get('date') as string,
    amount: formData.get('amount') as string,
    category: formData.get('category') as string,
    method: formData.get('method') as string,
    source: formData.get('source') as string,
  };

  const result = expenseSchema.safeParse(raw);

  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return data({ success: false as const, errors: fieldErrors });
  }

  const parsed = result.data;

  // Verify the target month tab exists
  const availableMonths = await getAvailableMonths();
  if (!availableMonths.includes(parsed.month)) {
    return data({
      success: false as const,
      error:
        "Sheet tab '" +
        parsed.month +
        "' not found. Please create it in the spreadsheet.",
    });
  }

  const now = new Date();
  const jakartaDate = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }),
  );
  const timestamp = `${jakartaDate.getMonth() + 1}/${jakartaDate.getDate()}/${jakartaDate.getFullYear()} ${String(jakartaDate.getHours()).padStart(2, '0')}:${String(jakartaDate.getMinutes()).padStart(2, '0')}:${String(jakartaDate.getSeconds()).padStart(2, '0')}`;

  const [year, month, day] = parsed.date.split('-');
  const formattedDate = `${Number(month)}/${Number(day)}/${year}`;

  const row = [
    timestamp, // Timestamp
    parsed.item, // Item
    parsed.category, // Category
    String(parsed.amount), // Amount (IDR)
    parsed.method, // Payment Method
    formattedDate, // Date
    parsed.source, // Source
  ];

  try {
    await appendExpense(parsed.month, row);
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
        entry: {
          item: parsed.item,
          category: parsed.category,
          amount: parsed.amount,
          method: parsed.method,
          date: parsed.date,
          source: parsed.source,
          month: parsed.month,
        },
      },
      { headers },
    );
  } catch (err) {
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

export default function Index() {
  const { months, activeMonth, defaultSource } =
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

  // Handle online success toast
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
    } else if ('error' in actionData && actionData.error) {
      toast.error(actionData.error);
    }
  }, [actionData]);

  // Handle offline form submission
  async function handleOfflineSubmit(formData: FormData) {
    const expense = {
      id: crypto.randomUUID(),
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
        href="/"
        className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
      >
        Go home
      </a>
    </main>
  );
}
