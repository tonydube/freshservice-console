import { planFromTotal, useRateLimit } from '../lib/rateLimit';

export function RateLimitMeter() {
  const { total, remaining, blockedUntil } = useRateLimit();
  if (total == null || remaining == null) {
    return <span className="text-zinc-500">API budget: unknown until first call</span>;
  }
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const blocked = blockedUntil != null && blockedUntil > Date.now();
  const bar = blocked || pct < 10 ? 'bg-red-500' : pct < 30 ? 'bg-amber-500' : 'bg-emerald-500';
  const plan = planFromTotal(total);
  return (
    <span className="flex items-center gap-2" title="Freshservice requests left this minute (shared across the account)">
      <span className="text-zinc-500">API budget</span>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <span className={`block h-full ${bar}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">
        {remaining}/{total} per min{plan ? ` · ${plan}` : ''}
      </span>
      {blocked && <span className="text-red-600">rate limited</span>}
    </span>
  );
}
