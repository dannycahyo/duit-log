export const CATEGORIES = [
  'Food',
  'Transport',
  'Groceries',
  'Utilities',
  'Health',
  'Entertainment',
  'Shopping',
  'Education',
  'Other'
] as const;

export const METHODS = ['Cash', 'BCA Debit', 'QRIS'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Method = (typeof METHODS)[number];
