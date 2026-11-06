const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 86400_000], ['month', 30 * 86400_000], ['week', 7 * 86400_000],
  ['day', 86400_000], ['hour', 3600_000], ['minute', 60_000],
];

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const diff = Date.parse(iso) - now;
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function fileSize(bytes: number | null | undefined) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export const isOverdue = (dueBy: string | null | undefined, status: number, now = Date.now()) =>
  !!dueBy && ![4, 5].includes(status) && Date.parse(dueBy) < now;
