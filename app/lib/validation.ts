import { z } from 'zod';

export function createExpenseSchema(config: {
  sources: string[];
  categories: string[];
  methods: string[];
}) {
  return z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    amount: z
      .string()
      .min(1, 'Amount is required')
      .transform(Number)
      .pipe(z.number().positive('Amount must be positive')),
    category: z.enum(config.categories as [string, ...string[]], {
      message: 'Pick a category',
    }),
    method: z.enum(config.methods as [string, ...string[]], {
      message: 'Pick a payment method',
    }),
    source: z.enum(config.sources as [string, ...string[]], {
      message: 'Select a source',
    }),
  });
}

export type ExpenseData = z.output<ReturnType<typeof createExpenseSchema>>;
