import { useReducer, type RefObject } from 'react';
import { Form } from 'react-router';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { CATEGORIES, METHODS } from '~/lib/constants';
import { Calendar } from '~/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { cn } from '~/lib/utils';

interface ExpenseFormProps {
  errors?: Record<string, string>;
  isSubmitting?: boolean;
  amountRef?: RefObject<HTMLInputElement | null>;
}

function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type State = {
  date: Date;
  calendarOpen: boolean;
  amount: string;
};

type Action =
  | { type: 'select_date'; date: Date }
  | { type: 'toggle_calendar'; open: boolean }
  | { type: 'set_amount'; value: string };

function formatAmount(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'select_date':
      return { ...state, date: action.date, calendarOpen: false };
    case 'toggle_calendar':
      return { ...state, calendarOpen: action.open };
    case 'set_amount':
      return { ...state, amount: formatAmount(action.value) };
  }
}

export function ExpenseForm({
  errors,
  isSubmitting,
  amountRef,
}: ExpenseFormProps) {
  const [state, dispatch] = useReducer(reducer, {
    date: new Date(),
    calendarOpen: false,
    amount: '',
  });

  return (
    <Form
      method="post"
      className="flex flex-col gap-4 p-4"
    >
        {/* Amount */}
        <fieldset>
          <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-3 focus-within:border-slate-900">
            <span className="text-lg font-semibold text-slate-400">
              IDR
            </span>
            <input
              type="hidden"
              name="amount"
              value={state.amount.replace(/,/g, '')}
            />
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              placeholder="0"
              autoFocus
              value={state.amount}
              onChange={(e) =>
                dispatch({
                  type: 'set_amount',
                  value: e.target.value,
                })
              }
              className="w-full bg-transparent text-3xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
            />
          </div>
          {errors?.amount && (
            <p className="mt-1 text-xs text-red-500">
              {errors.amount}
            </p>
          )}
        </fieldset>

        {/* Item */}
        <fieldset>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Item
          </label>
          <input
            type="text"
            name="item"
            placeholder="What did you buy?"
            maxLength={100}
            className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
          />
          {errors?.item && (
            <p className="mt-1 text-xs text-red-500">{errors.item}</p>
          )}
        </fieldset>

        {/* Category */}
        <fieldset>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Category
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <label key={c} className="cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value={c}
                  className="peer sr-only"
                />
                <div className="rounded-lg bg-slate-100 py-2 text-center text-xs font-medium text-slate-600 transition-colors peer-checked:bg-slate-900 peer-checked:text-white">
                  {c}
                </div>
              </label>
            ))}
          </div>
          {errors?.category && (
            <p className="mt-1 text-xs text-red-500">
              {errors.category}
            </p>
          )}
        </fieldset>

        {/* Payment Method */}
        <fieldset>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <label key={m} className="cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  value={m}
                  className="peer sr-only"
                />
                <div className="rounded-lg bg-slate-100 py-2 text-center text-xs font-medium text-slate-600 transition-colors peer-checked:bg-slate-900 peer-checked:text-white">
                  {m}
                </div>
              </label>
            ))}
          </div>
          {errors?.method && (
            <p className="mt-1 text-xs text-red-500">
              {errors.method}
            </p>
          )}
        </fieldset>

        {/* Date */}
        <fieldset>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Date
          </label>
          <input
            type="hidden"
            name="date"
            value={toDateString(state.date)}
          />
          <Popover
            open={state.calendarOpen}
            onOpenChange={(open) =>
              dispatch({ type: 'toggle_calendar', open })
            }
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-left text-sm text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-slate-900',
                  state.calendarOpen && 'border-slate-900',
                )}
              >
                <span className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-slate-400" />
                  {format(state.date, 'EEEE, d MMMM yyyy')}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto">
              <Calendar
                mode="single"
                selected={state.date}
                onSelect={(d) =>
                  d && dispatch({ type: 'select_date', date: d })
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors?.date && (
            <p className="mt-1 text-xs text-red-500">{errors.date}</p>
          )}
        </fieldset>

        {/* Description */}
        <fieldset>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Description
          </label>
          <input
            type="text"
            name="description"
            placeholder="Add a description (optional)"
            maxLength={200}
            className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
          />
          {errors?.description && (
            <p className="mt-1 text-xs text-red-500">
              {errors.description}
            </p>
          )}
        </fieldset>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50 mt-4"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving...
            </span>
          ) : (
            'Save Expense'
          )}
        </button>
    </Form>
  );
}
