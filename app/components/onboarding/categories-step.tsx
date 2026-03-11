import { ColorPicker, PRESET_COLORS } from './color-picker';

interface CategoriesStepProps {
  value: Array<{ label: string; color: string }>;
  onChange: (value: CategoriesStepProps['value']) => void;
}

export function CategoriesStep({ value, onChange }: CategoriesStepProps) {
  function addCategory() {
    const usedColors = new Set(value.map((c) => c.color));
    const nextColor =
      PRESET_COLORS.find((c) => !usedColors.has(c)) ?? PRESET_COLORS[0];
    onChange([...value, { label: '', color: nextColor }]);
  }

  function removeCategory(index: number) {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== index));
  }

  function updateCategory(
    index: number,
    updates: Partial<{ label: string; color: string }>,
  ) {
    onChange(value.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Expense categories
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          How do you group your spending? Customize as needed.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {value.map((category, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-xl border-2 border-slate-200 p-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={category.label}
                onChange={(e) =>
                  updateCategory(index, { label: e.target.value })
                }
                placeholder="Category name"
                className="min-w-0 flex-1 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
              />
              <button
                type="button"
                onClick={() => removeCategory(index)}
                disabled={value.length <= 1}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                aria-label="Remove category"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
            <ColorPicker
              value={category.color}
              onChange={(color) => updateCategory(index, { color })}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCategory}
        className="w-full rounded-lg border-2 border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
      >
        + Add category
      </button>
    </div>
  );
}
