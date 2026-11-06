import { useSyncExternalStore } from 'react';

export interface RateLimitState {
  total: number | null;
  remaining: number | null;
  updatedAt: number | null;
  /** Epoch ms until which we are told to back off (after a 429). */
  blockedUntil: number | null;
}

let state: RateLimitState = { total: null, remaining: null, updatedAt: null, blockedUntil: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Read X-RateLimit-* / Retry-After headers from a Freshservice response. */
export function recordRateLimit(headers: Headers, status: number) {
  const total = headers.get('x-ratelimit-total');
  const remaining = headers.get('x-ratelimit-remaining');
  const retryAfter = headers.get('retry-after');
  const next: RateLimitState = { ...state };
  if (total !== null) next.total = Number(total);
  if (remaining !== null) next.remaining = Number(remaining);
  if (total !== null || remaining !== null) next.updatedAt = Date.now();
  if (status === 429) next.blockedUntil = Date.now() + Number(retryAfter ?? 60) * 1000;
  state = next;
  emit();
}

export function getRateLimit() {
  return state;
}

export function resetRateLimit() {
  state = { total: null, remaining: null, updatedAt: null, blockedUntil: null };
  emit();
}

export function useRateLimit() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Map an account's per-minute limit to its likely plan (published tiers). */
export function planFromTotal(total: number | null): string | null {
  if (total == null) return null;
  const tiers: Record<number, string> = { 100: 'Starter', 200: 'Growth', 400: 'Pro', 500: 'Enterprise', 1000: 'Pro/Enterprise + add-on', 2000: 'Pro/Enterprise + add-on' };
  return tiers[total] ?? null;
}
