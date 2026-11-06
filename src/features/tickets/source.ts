import { andAll, filtersToClauses } from '../../lib/filterQuery';
import { getView, type ViewContext, type ViewSource } from '../../lib/views';
import type { ListState } from './urlState';

/**
 * Decide which endpoint/query to use for the list:
 * - raw "Advanced" query wins;
 * - filter views AND their query with the filter bar;
 * - list views (All / Spam) switch to the filter endpoint once filters are added (All) or ignore them (Spam).
 */
export function resolveSource(state: ListState, ctx: ViewContext): ViewSource & { filtersIgnored?: boolean } {
  if (state.rawQuery.trim()) return { kind: 'filter', query: state.rawQuery.trim() };
  const view = getView(state.view).build(ctx);
  const clauses = filtersToClauses(state.filters);
  if (view.kind === 'unavailable') return view;
  if (view.kind === 'filter') return { kind: 'filter', query: andAll([view.query, ...clauses]) };
  if (clauses.length === 0) return view;
  if (view.params.filter) return { ...view, filtersIgnored: true };
  return { kind: 'filter', query: andAll(clauses) };
}
