import { useFetcher } from 'react-router';
import type { ExpenseEntry } from '~/lib/types';

const categoryColors: Record<string, string> = {
  Food: 'bg-amber-100 text-amber-800',
  Transport: 'bg-blue-100 text-blue-800',
  Groceries: 'bg-green-100 text-green-800',
  Utilities: 'bg-purple-100 text-purple-800',
  Health: 'bg-red-100 text-red-800',
  Entertainment: 'bg-pink-100 text-pink-800',
  Shopping: 'bg-indigo-100 text-indigo-800',
  Education: 'bg-teal-100 text-teal-800',
  Other: 'bg-slate-100 text-slate-800',
};

function sourceColor(source: string): string {
  if (source === 'Danny') return 'bg-blue-500 text-white';
  if (source === 'Dewi') return 'bg-rose-500 text-white';
  if (source === 'Together') return 'bg-indigo-500 text-white';
  return 'bg-slate-200 text-slate-700';
}

function formatAmount(amount: number): string {
  return `IDR ${new Intl.NumberFormat('id-ID').format(amount)}`;
}

function formatDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const [month, day, year] = parts;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

function relativeTime(timestamp: string): string {
  const [datePart, timePart] = timestamp.split(' ');
  if (!datePart || !timePart) return '';
  const [month, day, year] = datePart.split('/');
  const [hours, minutes, seconds] = timePart.split(':');
  const d = new Date(
    Number(year), Number(month) - 1, Number(day),
    Number(hours), Number(minutes), Number(seconds),
  );
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 7)}w ago`;
}

export function ExpenseCard({
  entry,
  activeMonth,
}: {
  entry: ExpenseEntry;
  activeMonth: string;
}) {
  const colorClass = categoryColors[entry.category] ?? categoryColors.Other;
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== 'idle';

  function handleDelete() {
    if (!confirm(`Hapus "${entry.item}"?`)) return;
    fetcher.submit(
      { timestamp: entry.timestamp, month: activeMonth },
      { method: 'POST', action: '/history' }
    );
  }

  if (isDeleting) return null;

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-lg font-semibold text-slate-900">
          {formatAmount(entry.amount)}
        </span>
        <span className="truncate text-sm font-medium text-slate-700">
          {entry.item}
        </span>
        <div className="flex items-center gap-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
            {entry.category}
          </span>
          <span className="text-[11px] text-slate-400">{entry.method}</span>
          {entry.source && (
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceColor(entry.source)}`}>
              {entry.source}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pl-3">
        <span className="text-xs font-medium text-slate-600">
          {formatDate(entry.date)}
        </span>
        <span className="text-[10px] text-slate-400">
          {relativeTime(entry.timestamp)}
        </span>
        <button
          onClick={handleDelete}
          className="mt-1 rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500 hover:bg-red-100"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}
