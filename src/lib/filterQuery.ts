/**
 * Builds Freshservice /tickets/filter queries.
 * Syntax: field:value, field:>value (>=), field:<value (<=), AND/OR, parentheses.
 * Strings and dates in single quotes; whole query wrapped in double quotes; max 512 chars.
 */

export const MAX_QUERY_LENGTH = 512;

export type IdOrNone = number | 'none';

export interface TicketFilters {
  statuses: number[];
  priorities: number[];
  agent: IdOrNone | null;
  group: IdOrNone | null;
  requesterEmail: string;
  tag: string;
  createdFrom: string; // yyyy-mm-dd
  createdTo: string;
}

export const EMPTY_FILTERS: TicketFilters = {
  statuses: [], priorities: [], agent: null, group: null, requesterEmail: '', tag: '', createdFrom: '', createdTo: '',
};

/** Quote a string value. Freshservice has no documented escape, so single quotes are stripped. */
export const quote = (v: string) => `'${v.replace(/'/g, '').trim()}'`;

export const anyOf = (field: string, values: Array<number | string>) => {
  if (values.length === 0) return null;
  const parts = values.map((v) => `${field}:${typeof v === 'number' ? v : quote(v)}`);
  return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
};

const idOrNull = (field: string, v: IdOrNone | null) => (v == null ? null : `${field}:${v === 'none' ? 'null' : v}`);

/** AND together non-empty clauses. Returns '' when nothing is set. */
export function andAll(clauses: Array<string | null | undefined>): string {
  return clauses.filter((c): c is string => !!c && c.trim() !== '').join(' AND ');
}

export function filtersToClauses(f: TicketFilters): string[] {
  return [
    anyOf('status', f.statuses),
    anyOf('priority', f.priorities),
    idOrNull('agent_id', f.agent),
    idOrNull('group_id', f.group),
    f.requesterEmail.trim() ? `email:${quote(f.requesterEmail)}` : null,
    f.tag.trim() ? `tag:${quote(f.tag)}` : null,
    f.createdFrom ? `created_at:>${quote(f.createdFrom)}` : null,
    f.createdTo ? `created_at:<${quote(f.createdTo)}` : null,
  ].filter((c): c is string => c !== null);
}

export function hasFilters(f: TicketFilters) {
  return filtersToClauses(f).length > 0;
}

/** Value for the `query` URL param: the expression wrapped in double quotes. */
export const wrapQuery = (expr: string) => `"${expr}"`;

export function queryTooLong(expr: string) {
  return wrapQuery(expr).length > MAX_QUERY_LENGTH;
}

/** yyyy-mm-dd for a date offset from today (local time). */
export function isoDate(offsetDays = 0, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
