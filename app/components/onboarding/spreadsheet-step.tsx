import { cn } from '~/lib/utils';

interface SpreadsheetStepProps {
  value: {
    mode: 'create' | 'connect';
    spreadsheetUrl?: string;
    spreadsheetTitle?: string;
  };
  onChange: (value: SpreadsheetStepProps['value']) => void;
}

export function SpreadsheetStep({ value, onChange }: SpreadsheetStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Connect your spreadsheet
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          DuitLog stores your expenses in a Google Sheet.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Create new */}
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, mode: 'create' })
          }
          className={cn(
            'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors',
            value.mode === 'create'
              ? 'border-slate-900 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300',
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Create new spreadsheet
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              We'll create a new Google Sheet in your Drive, ready to go.
            </p>
          </div>
        </button>

        {/* Connect existing */}
        <button
          type="button"
          onClick={() =>
            onChange({ ...value, mode: 'connect' })
          }
          className={cn(
            'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors',
            value.mode === 'connect'
              ? 'border-slate-900 bg-slate-50'
              : 'border-slate-200 hover:border-slate-300',
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Connect existing spreadsheet
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Paste the URL of a Google Sheet you already use.
            </p>
          </div>
        </button>
      </div>

      {/* Conditional inputs */}
      {value.mode === 'create' && (
        <fieldset className="mt-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Spreadsheet name (optional)
          </label>
          <input
            type="text"
            value={value.spreadsheetTitle ?? ''}
            onChange={(e) =>
              onChange({ ...value, spreadsheetTitle: e.target.value })
            }
            placeholder="DuitLog Expenses"
            className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
          />
        </fieldset>
      )}

      {value.mode === 'connect' && (
        <fieldset className="mt-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Spreadsheet URL
          </label>
          <input
            type="url"
            value={value.spreadsheetUrl ?? ''}
            onChange={(e) =>
              onChange({ ...value, spreadsheetUrl: e.target.value })
            }
            onBlur={(e) => {
              const url = e.target.value;
              if (url && !url.includes('/spreadsheets/d/')) {
                e.target.setCustomValidity(
                  'Please enter a valid Google Sheets URL',
                );
                e.target.reportValidity();
              } else {
                e.target.setCustomValidity('');
              }
            }}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full rounded-lg border-2 border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
          />
        </fieldset>
      )}
    </div>
  );
}
