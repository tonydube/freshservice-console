import { EMPTY_FILTERS, type IdOrNone, type TicketFilters } from '../../lib/filterQuery';

/** Ticket list state lives in the URL so back/forward and reloads keep your place. */
export interface ListState {
  view: string | null;
  page: number;
  filters: TicketFilters;
  /** Raw filter expression typed in "Advanced"; overrides view + filters when set. */
  rawQuery: string;
}

const nums = (v: string | null) => (v ? v.split(',').map(Number).filter(Number.isFinite) : []);
const idOrNone = (v: string | null): IdOrNone | null => (v === 'none' ? 'none' : v && Number.isFinite(Number(v)) ? Number(v) : null);

export function readListState(p: URLSearchParams): ListState {
  return {
    view: p.get('view'),
    page: Math.max(1, Number(p.get('page') ?? 1) || 1),
    rawQuery: p.get('q') ?? '',
    filters: {
      statuses: nums(p.get('status')),
      priorities: nums(p.get('priority')),
      agent: idOrNone(p.get('agent')),
      group: idOrNone(p.get('group')),
      requesterEmail: p.get('email') ?? '',
      tag: p.get('tag') ?? '',
      createdFrom: p.get('from') ?? '',
      createdTo: p.get('to') ?? '',
    },
  };
}

export function writeListState(s: ListState): URLSearchParams {
  const p = new URLSearchParams();
  const f = s.filters;
  if (s.view) p.set('view', s.view);
  if (s.page > 1) p.set('page', String(s.page));
  if (s.rawQuery) p.set('q', s.rawQuery);
  if (f.statuses.length) p.set('status', f.statuses.join(','));
  if (f.priorities.length) p.set('priority', f.priorities.join(','));
  if (f.agent != null) p.set('agent', String(f.agent));
  if (f.group != null) p.set('group', String(f.group));
  if (f.requesterEmail) p.set('email', f.requesterEmail);
  if (f.tag) p.set('tag', f.tag);
  if (f.createdFrom) p.set('from', f.createdFrom);
  if (f.createdTo) p.set('to', f.createdTo);
  return p;
}

export { EMPTY_FILTERS };
