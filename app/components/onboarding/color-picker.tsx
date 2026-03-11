import { cn } from '~/lib/utils';

const PRESET_COLORS = [
  'blue-500',
  'rose-500',
  'indigo-500',
  'green-500',
  'amber-500',
  'purple-500',
  'red-500',
  'pink-500',
  'teal-500',
  'gray-500',
] as const;

const COLOR_BG_MAP: Record<string, string> = {
  'blue-500': 'bg-blue-500',
  'rose-500': 'bg-rose-500',
  'indigo-500': 'bg-indigo-500',
  'green-500': 'bg-green-500',
  'amber-500': 'bg-amber-500',
  'purple-500': 'bg-purple-500',
  'red-500': 'bg-red-500',
  'pink-500': 'bg-pink-500',
  'teal-500': 'bg-teal-500',
  'gray-500': 'bg-gray-500',
};

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'h-6 w-6 rounded-full transition-all',
            COLOR_BG_MAP[color],
            value === color
              ? 'ring-2 ring-slate-900 ring-offset-2'
              : 'hover:scale-110',
          )}
          aria-label={color}
        />
      ))}
    </div>
  );
}

export { PRESET_COLORS, COLOR_BG_MAP };
