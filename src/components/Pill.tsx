import type { LabelMaps } from '../lib/enums';
import { label } from '../lib/enums';

const base = 'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap';

const statusTone: Record<number, string> = {
  2: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  3: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  4: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  5: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};
const priorityTone: Record<number, string> = {
  1: 'text-zinc-600 dark:text-zinc-400',
  2: 'text-sky-700 dark:text-sky-400',
  3: 'text-amber-700 dark:text-amber-400',
  4: 'text-red-700 dark:text-red-400 font-semibold',
};

export function StatusPill({ value, labels }: { value: number; labels: LabelMaps }) {
  const tone = statusTone[value] ?? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300';
  return <span className={`${base} ${tone}`}>{label(labels, 'status', value)}</span>;
}

export function PriorityText({ value, labels }: { value: number; labels: LabelMaps }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${priorityTone[value] ?? ''}`}>
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
      {label(labels, 'priority', value)}
    </span>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'danger' | 'note' }) {
  const t = tone === 'danger' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
    : tone === 'note' ? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-300'
    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
  return <span className={`${base} ${t}`}>{children}</span>;
}
