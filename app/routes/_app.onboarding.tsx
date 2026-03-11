import { useReducer } from 'react';
import { redirect, useNavigate } from 'react-router';
import { getAuth } from '@clerk/react-router/server';
import { toast } from 'sonner';
import { z } from 'zod';

import type { Route } from './+types/_app.onboarding';
import { db } from '~/db/index.server';
import {
  users,
  userSpreadsheets,
  userSources,
  userCategories,
  userMethods,
} from '~/db/schema';
import { eq } from 'drizzle-orm';
import {
  getGoogleAccessToken,
  createSpreadsheetForUser,
  verifySpreadsheetAccess,
} from '~/lib/sheets.server';
import {
  DEFAULT_SOURCES,
  DEFAULT_CATEGORIES,
  DEFAULT_METHODS,
} from '~/lib/defaults';
import { cn } from '~/lib/utils';

import { SpreadsheetStep } from '~/components/onboarding/spreadsheet-step';
import { SourcesStep } from '~/components/onboarding/sources-step';
import { CategoriesStep } from '~/components/onboarding/categories-step';
import { MethodsStep } from '~/components/onboarding/methods-step';

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader(args: Route.LoaderArgs) {
  const { userId: clerkUserId } = await getAuth(args);
  if (!clerkUserId) throw redirect('/');

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
  });

  if (user?.onboardingComplete) throw redirect('/dashboard');

  return {
    defaults: {
      sources: DEFAULT_SOURCES,
      categories: DEFAULT_CATEGORIES,
      methods: DEFAULT_METHODS,
    },
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

const onboardingSchema = z.object({
  spreadsheetMode: z.enum(['create', 'connect']),
  spreadsheetUrl: z.string().optional(),
  spreadsheetTitle: z.string().optional(),
  sources: z
    .array(z.object({ label: z.string().min(1), color: z.string().min(1) }))
    .min(1),
  categories: z
    .array(z.object({ label: z.string().min(1), color: z.string().min(1) }))
    .min(1),
  methods: z
    .array(z.object({ label: z.string().min(1) }))
    .min(1),
});

export async function action(args: Route.ActionArgs) {
  const { userId: clerkUserId } = await getAuth(args);
  if (!clerkUserId) throw redirect('/');

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
  });
  if (!user) throw redirect('/');

  let body: unknown;
  try {
    body = await args.request.json();
  } catch {
    return { error: 'Invalid request body.' };
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return { error: 'Invalid data. Please check your inputs.' };
  }

  const data = parsed.data;

  try {
    // --- Spreadsheet handling ---
    const accessToken = await getGoogleAccessToken(clerkUserId);

    let spreadsheetId: string;
    let spreadsheetUrl: string;
    let spreadsheetTitle: string;

    if (data.spreadsheetMode === 'create') {
      spreadsheetTitle = data.spreadsheetTitle?.trim() || 'DuitLog Expenses';
      const result = await createSpreadsheetForUser(
        accessToken,
        spreadsheetTitle,
      );
      spreadsheetId = result.spreadsheetId;
      spreadsheetUrl = result.spreadsheetUrl;
    } else {
      const url = data.spreadsheetUrl ?? '';
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        return {
          error:
            'Invalid spreadsheet URL. Make sure it looks like https://docs.google.com/spreadsheets/d/...',
        };
      }
      spreadsheetId = match[1];

      try {
        await verifySpreadsheetAccess(accessToken, spreadsheetId);
      } catch {
        return {
          error:
            'Cannot access this spreadsheet. Make sure it exists and you have edit access.',
        };
      }

      spreadsheetUrl = url;
      spreadsheetTitle = data.spreadsheetTitle?.trim() || 'Connected Sheet';
    }

    // --- Save spreadsheet ---
    await db.insert(userSpreadsheets).values({
      userId: user.id,
      spreadsheetId,
      spreadsheetUrl,
      spreadsheetTitle,
    });

    // --- Seed sources ---
    await db.insert(userSources).values(
      data.sources.map((s, i) => ({
        userId: user.id,
        label: s.label,
        color: s.color,
        sortOrder: i,
      })),
    );

    // --- Seed categories ---
    await db.insert(userCategories).values(
      data.categories.map((c, i) => ({
        userId: user.id,
        label: c.label,
        color: c.color,
        sortOrder: i,
      })),
    );

    // --- Seed methods ---
    await db.insert(userMethods).values(
      data.methods.map((m, i) => ({
        userId: user.id,
        label: m.label,
        sortOrder: i,
      })),
    );

    // --- Mark onboarding complete ---
    await db
      .update(users)
      .set({ onboardingComplete: true })
      .where(eq(users.id, user.id));

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Something went wrong.';
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

const STEPS = ['Spreadsheet', 'Sources', 'Categories', 'Methods'] as const;

interface WizardState {
  step: number;
  spreadsheet: {
    mode: 'create' | 'connect';
    spreadsheetUrl?: string;
    spreadsheetTitle?: string;
  };
  sources: Array<{ label: string; color: string }>;
  categories: Array<{ label: string; color: string }>;
  methods: Array<{ label: string }>;
  submitting: boolean;
}

type WizardAction =
  | { type: 'next' }
  | { type: 'back' }
  | {
      type: 'set_spreadsheet';
      value: WizardState['spreadsheet'];
    }
  | { type: 'set_sources'; value: WizardState['sources'] }
  | { type: 'set_categories'; value: WizardState['categories'] }
  | { type: 'set_methods'; value: WizardState['methods'] }
  | { type: 'set_submitting'; value: boolean };

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'next':
      return { ...state, step: Math.min(state.step + 1, STEPS.length - 1) };
    case 'back':
      return { ...state, step: Math.max(state.step - 1, 0) };
    case 'set_spreadsheet':
      return { ...state, spreadsheet: action.value };
    case 'set_sources':
      return { ...state, sources: action.value };
    case 'set_categories':
      return { ...state, categories: action.value };
    case 'set_methods':
      return { ...state, methods: action.value };
    case 'set_submitting':
      return { ...state, submitting: action.value };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { defaults } = loaderData;
  const navigate = useNavigate();

  const [state, dispatch] = useReducer(wizardReducer, {
    step: 0,
    spreadsheet: { mode: 'create' },
    sources: defaults.sources,
    categories: defaults.categories,
    methods: defaults.methods,
    submitting: false,
  });

  function validateCurrentStep(): string | null {
    switch (state.step) {
      case 0:
        if (
          state.spreadsheet.mode === 'connect' &&
          (!state.spreadsheet.spreadsheetUrl ||
            !state.spreadsheet.spreadsheetUrl.includes('/spreadsheets/d/'))
        ) {
          return 'Please enter a valid Google Sheets URL.';
        }
        return null;
      case 1:
        if (
          state.sources.length === 0 ||
          state.sources.some((s) => !s.label.trim())
        ) {
          return 'Each source needs a name.';
        }
        return null;
      case 2:
        if (
          state.categories.length === 0 ||
          state.categories.some((c) => !c.label.trim())
        ) {
          return 'Each category needs a name.';
        }
        return null;
      case 3:
        if (
          state.methods.length === 0 ||
          state.methods.some((m) => !m.label.trim())
        ) {
          return 'Each method needs a name.';
        }
        return null;
      default:
        return null;
    }
  }

  function handleNext() {
    const err = validateCurrentStep();
    if (err) {
      toast.error(err);
      return;
    }
    dispatch({ type: 'next' });
  }

  async function handleComplete() {
    const err = validateCurrentStep();
    if (err) {
      toast.error(err);
      return;
    }

    dispatch({ type: 'set_submitting', value: true });

    try {
      const response = await fetch('/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetMode: state.spreadsheet.mode,
          spreadsheetUrl: state.spreadsheet.spreadsheetUrl,
          spreadsheetTitle: state.spreadsheet.spreadsheetTitle,
          sources: state.sources,
          categories: state.categories,
          methods: state.methods,
        }),
      });

      const result = await response.json();

      if (result.error) {
        toast.error(result.error);
        dispatch({ type: 'set_submitting', value: false });
        return;
      }

      navigate('/dashboard');
    } catch {
      toast.error('Network error. Please try again.');
      dispatch({ type: 'set_submitting', value: false });
    }
  }

  const isLastStep = state.step === STEPS.length - 1;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white px-6 py-8">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                    i < state.step
                      ? 'bg-slate-900 text-white'
                      : i === state.step
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200 text-slate-400',
                  )}
                >
                  {i < state.step ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1 text-[10px] font-medium',
                    i <= state.step ? 'text-slate-700' : 'text-slate-400',
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 flex-1',
                    i < state.step ? 'bg-slate-900' : 'bg-slate-200',
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1">
        {state.step === 0 && (
          <SpreadsheetStep
            value={state.spreadsheet}
            onChange={(value) =>
              dispatch({ type: 'set_spreadsheet', value })
            }
          />
        )}
        {state.step === 1 && (
          <SourcesStep
            value={state.sources}
            onChange={(value) =>
              dispatch({ type: 'set_sources', value })
            }
          />
        )}
        {state.step === 2 && (
          <CategoriesStep
            value={state.categories}
            onChange={(value) =>
              dispatch({ type: 'set_categories', value })
            }
          />
        )}
        {state.step === 3 && (
          <MethodsStep
            value={state.methods}
            onChange={(value) =>
              dispatch({ type: 'set_methods', value })
            }
          />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex gap-3">
        {state.step > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'back' })}
            disabled={state.submitting}
            className="flex-1 rounded-xl border-2 border-slate-200 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 disabled:opacity-50"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={isLastStep ? handleComplete : handleNext}
          disabled={state.submitting}
          className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {state.submitting ? (
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
              Setting up your account...
            </span>
          ) : isLastStep ? (
            'Complete'
          ) : (
            'Next'
          )}
        </button>
      </div>
    </main>
  );
}
