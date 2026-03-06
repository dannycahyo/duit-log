import { useEffect, useState } from 'react';
import { data, useActionData, useNavigation } from 'react-router';
import type { Route } from './+types/_index';
import { appendExpense } from '~/lib/sheets.server';
import { expenseSchema } from '~/lib/validation';
import { ExpenseForm } from '~/components/expense-form';
import { log } from '~/lib/logger.server';
import { toast } from 'sonner';
import { requireAuth } from '~/lib/auth.server';

type ActionData =
  | {
      success: true;
      entry: {
        item: string;
        category: string;
        amount: number;
        method: string;
        date: string;
        description: string;
      };
    }
  | { success: false; errors: Record<string, string> }
  | { success: false; error: string };

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const raw = {
    item: formData.get('item') as string,
    date: formData.get('date') as string,
    amount: formData.get('amount') as string,
    category: formData.get('category') as string,
    method: formData.get('method') as string,
    description: formData.get('description') as string,
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

  const now = new Date();
  const timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const [year, month, day] = parsed.date.split('-');
  const formattedDate = `${Number(month)}/${Number(day)}/${year}`;

  const row = [
    timestamp, // Timestamp
    parsed.item, // Item
    parsed.category, // Category
    String(parsed.amount), // Amount (IDR)
    parsed.method, // Payment Method
    formattedDate, // Date
    parsed.description, // Description
  ];

  try {
    await appendExpense(row);
    return data({
      success: true as const,
      entry: {
        item: parsed.item,
        category: parsed.category,
        amount: parsed.amount,
        method: parsed.method,
        date: parsed.date,
        description: parsed.description,
      },
    });
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
  const actionData = useActionData<typeof action>() as
    | ActionData
    | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (!actionData) return;

    if (actionData.success) {
      toast.success(
        `Saved: ${actionData.entry.item} · ${actionData.entry.category} — IDR ${actionData.entry.amount.toLocaleString()}`,
      );
      setFormKey((k) => k + 1);
    } else if ('error' in actionData && actionData.error) {
      toast.error(actionData.error);
    }
  }, [actionData]);

  const errors =
    actionData && !actionData.success && 'errors' in actionData
      ? actionData.errors
      : undefined;

  return (
    <main className="mx-auto flex h-screen max-w-md flex-col bg-white">
      <header className="px-4 pt-6 pb-2 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          DuitLog
        </h1>
      </header>
      <ExpenseForm
        key={formKey}
        errors={errors}
        isSubmitting={isSubmitting}
      />
    </main>
  );
}
