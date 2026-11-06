import type { ReactNode } from 'react';

export function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      <div className="p-4 text-sm">{children}</div>
    </section>
  );
}

type Tone = 'ok' | 'warn' | 'error' | 'idle';
const toneClass: Record<Tone, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  error: 'bg-red-500',
  idle: 'bg-zinc-400 animate-pulse',
};

export function StatusDot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${toneClass[tone]}`} />;
}

export function Button({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 py-1.5">
      <dt className="w-40 shrink-0 text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
