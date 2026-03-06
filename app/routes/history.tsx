import { data, useLoaderData } from 'react-router';
import type { Route } from './+types/history';
import { getRecentExpenses } from '~/lib/sheets.server';
import { requireAuth } from '~/lib/auth.server';

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  try {
    const rows = await getRecentExpenses(20);
    return data({ entries: rows });
  } catch {
    return data({ entries: [], error: 'Failed to load expenses.' });
  }
}

export default function History() {
  const loaderData = useLoaderData<typeof loader>();
  const error = 'error' in loaderData ? (loaderData.error as string) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Recent Expenses</h1>
      {error && <p className="text-red-600">{error}</p>}
      <pre className="max-w-full overflow-auto rounded-md bg-muted p-4 text-sm">
        {JSON.stringify(loaderData.entries, null, 2)}
      </pre>
    </main>
  );
}
