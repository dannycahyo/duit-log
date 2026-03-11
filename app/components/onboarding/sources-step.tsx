import { ColorPicker, PRESET_COLORS } from './color-picker';

interface SourcesStepProps {
  value: Array<{ label: string; color: string }>;
  onChange: (value: SourcesStepProps['value']) => void;
}

export function SourcesStep({ value, onChange }: SourcesStepProps) {
  function addSource() {
    const usedColors = new Set(value.map((s) => s.color));
    const nextColor =
      PRESET_COLORS.find((c) => !usedColors.has(c)) ?? PRESET_COLORS[0];
    onChange([...value, { label: '', color: nextColor }]);
  }

  function removeSource(index: number) {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== index));
  }

  function updateSource(
    index: number,
    updates: Partial<{ label: string; color: string }>,
  ) {
    onChange(value.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Money sources</h2>
        <p className="mt-1 text-sm text-slate-500">
          Where does your money come from? You can always change these later.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {value.map((source, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-xl border-2 border-slate-200 p-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={source.label}
                onChange={(e) =>
                  updateSource(index, { label: e.target.value })
                }
                placeholder="Source name"
                className="min-w-0 flex-1 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900"
              />
              <button
                type="button"
                onClick={() => removeSource(index)}
                disabled={value.length <= 1}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                aria-label="Remove source"
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
              value={source.color}
              onChange={(color) => updateSource(index, { color })}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSource}
        className="w-full rounded-lg border-2 border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
      >
        + Add source
      </button>
    </div>
  );
}
