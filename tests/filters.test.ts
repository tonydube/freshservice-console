import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, andAll, anyOf, filtersToClauses, isoDate, queryTooLong, quote } from '../src/lib/filterQuery';
import { getView } from '../src/lib/views';
import { resolveSource } from '../src/features/tickets/source';
import { readListState, writeListState, type ListState } from '../src/features/tickets/urlState';

const ctx = { myAgentId: 1001, statusIds: [2, 3, 4, 5, 6], today: new Date(2026, 10, 6) };

describe('filter query builder', () => {
  it('builds OR groups and quotes strings', () => {
    expect(anyOf('status', [2])).toBe('status:2');
    expect(anyOf('status', [2, 3])).toBe('(status:2 OR status:3)');
    expect(anyOf('status', [])).toBeNull();
    expect(quote("o'brien@x.com")).toBe("'obrien@x.com'");
  });

  it('turns filter state into clauses', () => {
    expect(filtersToClauses({
      ...EMPTY_FILTERS, statuses: [2, 3], priorities: [4], agent: 'none', group: 2002,
      requesterEmail: 'ana@example.com', tag: 'vip', createdFrom: '2026-10-01', createdTo: '2026-10-31',
    })).toEqual([
      '(status:2 OR status:3)', 'priority:4', 'agent_id:null', 'group_id:2002',
      "email:'ana@example.com'", "tag:'vip'", "created_at:>'2026-10-01'", "created_at:<'2026-10-31'",
    ]);
  });

  it('enforces the 512-char limit including the wrapping quotes', () => {
    expect(queryTooLong('a'.repeat(510))).toBe(false);
    expect(queryTooLong('a'.repeat(511))).toBe(true);
  });

  it('formats dates', () => expect(isoDate(-7, new Date(2026, 10, 6))).toBe('2026-10-30'));
  it('ignores empty clauses', () => expect(andAll(['a', null, '', 'b'])).toBe('a AND b'));
});

describe('views', () => {
  it('treats custom statuses as unresolved', () => {
    expect(getView('open').build(ctx)).toEqual({ kind: 'filter', query: '(status:2 OR status:3 OR status:6)' });
  });
  it('My open needs an agent', () => {
    expect(getView('my-open').build({ ...ctx, myAgentId: null }).kind).toBe('unavailable');
    expect(getView('my-open').build(ctx)).toEqual({ kind: 'filter', query: 'agent_id:1001 AND (status:2 OR status:3 OR status:6)' });
  });
  it('falls back to the default view for unknown ids', () => expect(getView('nope').id).toBe('open'));
});

describe('resolveSource', () => {
  const base: ListState = { view: 'unassigned', page: 1, filters: EMPTY_FILTERS, rawQuery: '' };
  it('ANDs filters onto a filter view', () => {
    expect(resolveSource({ ...base, filters: { ...EMPTY_FILTERS, priorities: [4] } }, ctx))
      .toEqual({ kind: 'filter', query: 'agent_id:null AND (status:2 OR status:3 OR status:6) AND priority:4' });
  });
  it('switches the All view to the filter endpoint once filtered', () => {
    expect(resolveSource({ ...base, view: 'all' }, ctx)).toEqual({ kind: 'list', params: {} });
    expect(resolveSource({ ...base, view: 'all', filters: { ...EMPTY_FILTERS, tag: 'vip' } }, ctx))
      .toEqual({ kind: 'filter', query: "tag:'vip'" });
  });
  it('ignores filters on Spam', () => {
    expect(resolveSource({ ...base, view: 'spam', filters: { ...EMPTY_FILTERS, tag: 'vip' } }, ctx))
      .toMatchObject({ kind: 'list', filtersIgnored: true });
  });
  it('raw query wins', () => {
    expect(resolveSource({ ...base, rawQuery: ' priority:4 ' }, ctx)).toEqual({ kind: 'filter', query: 'priority:4' });
  });
});

describe('URL state', () => {
  it('round-trips', () => {
    const s: ListState = {
      view: 'overdue', page: 3, rawQuery: '',
      filters: { ...EMPTY_FILTERS, statuses: [2, 6], agent: 'none', group: 2001, tag: 'vip', createdFrom: '2026-10-01' },
    };
    expect(readListState(writeListState(s))).toEqual(s);
  });
  it('tolerates junk', () => {
    const s = readListState(new URLSearchParams('page=-4&status=a,2&agent=xyz'));
    expect(s.page).toBe(1);
    expect(s.filters.statuses).toEqual([2]);
    expect(s.filters.agent).toBeNull();
  });
});
