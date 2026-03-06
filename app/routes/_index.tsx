import {
  data,
  Form,
  useActionData,
  useNavigation,
} from 'react-router';
import type { Route } from './+types/_index';
import { appendExpense } from '~/lib/sheets.server';

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const date = formData.get('date') as string;
  const payee = formData.get('payee') as string;
  const category = formData.get('category') as string;
  const amount = formData.get('amount') as string;
  const paymentMethod = formData.get('paymentMethod') as string;
  const description = formData.get('description') as string;

  if (!date || !payee || !category || !amount || !paymentMethod) {
    return data(
      { success: false, error: 'Please fill in all required fields.' },
      { status: 400 },
    );
  }

  try {
    const row = [date, payee, category, amount, paymentMethod, description];
    await appendExpense(row);
    return data({ success: true, message: 'Expense saved!' });
  } catch {
    return data(
      { success: false, error: 'Sheets API error — check server logs.' },
      { status: 500 },
    );
  }
}

const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Education',
  'Other',
];

const paymentMethods = [
  'Cash',
  'Bank Transfer',
  'Credit Card',
  'Debit Card',
  'E-Wallet',
];

export default function Index() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">DuitLog</h1>
      </header>

      <Form method="post" className="flex flex-1 flex-col">
        <main className="flex-1 space-y-4 p-4 pb-24">
          {actionData && 'message' in actionData && actionData.message && (
            <p className="rounded-md bg-green-100 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {actionData.message}
            </p>
          )}
          {actionData && 'error' in actionData && actionData.error && (
            <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {actionData.error}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="date" className="text-sm font-medium">
              Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              defaultValue={today}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-ring focus:outline-none focus:ring-2"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="payee" className="text-sm font-medium">
              Payee
            </label>
            <input
              type="text"
              id="payee"
              name="payee"
              placeholder="Who paid?"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-ring focus:outline-none focus:ring-2"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue=""
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-ring focus:outline-none focus:ring-2"
            >
              <option value="" disabled>
                Select category
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount (IDR)
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              placeholder="0"
              required
              min="0"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-ring focus:outline-none focus:ring-2"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="paymentMethod" className="text-sm font-medium">
              Payment Method
            </label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              required
              defaultValue=""
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-ring focus:outline-none focus:ring-2"
            >
              <option value="" disabled>
                Select payment method
              </option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <input
              type="text"
              id="description"
              name="description"
              placeholder="Optional note"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-ring focus:outline-none focus:ring-2"
            />
          </div>
        </main>

        <footer className="sticky bottom-0 border-t border-border bg-background p-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Expense'}
          </button>
        </footer>
      </Form>
    </div>
  );
}
