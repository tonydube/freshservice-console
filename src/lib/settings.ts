import { useSyncExternalStore } from 'react';

/** Per-browser UI preferences (localStorage). Nothing here needs to be durable. */
export interface UiSettings {
  myAgentEmail: string;
  refreshSeconds: number; // 0 = off
}

const KEY = 'fs-console:settings';
const DEFAULTS: UiSettings = { myAgentEmail: '', refreshSeconds: 60 };

function read(): UiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function updateSettings(patch: Partial<UiSettings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: keep in memory */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): UiSettings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
