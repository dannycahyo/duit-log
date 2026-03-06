import { z } from 'zod';
import { CATEGORIES, METHODS } from './constants';

export const expenseSchema = z.object({
  item: z.string().min(1, 'Item is required').max(100, 'Item too long'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .transform(Number)
    .pipe(z.number().positive('Amount must be positive')),
  category: z.enum(CATEGORIES, { message: 'Pick a category' }),
  method: z.enum(METHODS, { message: 'Pick a payment method' }),
  description: z
    .string()
    .max(200, 'Description too long')
    .optional()
    .default('')
});

export type ExpenseInput = z.input<typeof expenseSchema>;
export type ExpenseData = z.output<typeof expenseSchema>;
