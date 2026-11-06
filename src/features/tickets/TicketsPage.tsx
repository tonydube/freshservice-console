import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useAgents, useConnectionCheck, useGroups, useHealth, useLabelMaps, useTicketFields } from '../../api/lookups';
import { FILTER_MAX_PAGES, FILTER_PAGE_SIZE, useMyAgent, useTicketList } from '../../api/tickets';
import { Button } from '../../components/ui';
import { filtersToClauses } from '../../lib/filterQuery';
import { getView, VIEWS } from '../../lib/views';
import { SetupInstructions } from '../settings/ConnectionPage';
import { FilterBar } from './FilterBar';
import { resolveSource } from './source';
import { TicketTable } from './TicketTable';
import { readListState, writeListState, type ListState } from './urlState';

export function TicketsPage() {
  const health = useHealth();
  const conn = useConnectionCheck(health.data?.configured === true);
  if (health.data && !health.data.configured) return <SetupInstructions problems={health.data.problems} />;
  if (conn.isError) {
    return (
      <p className="text-sm text-red-600">
        Can't reach Freshservice. See <Link className="underline" to="/settings">Settings</Link>.
      </p>
    );
  }
  return <TicketList />;
}

function TicketList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const state = readListState(params);
  const labels = useLabelMaps();
  const fields = useTicketFields();
  const me = useMyAgent();
  const agents = useAgents();
  const groups = useGroups();
  const failedLookups = [
    agents.isError && ['agents', agents.error],
    groups.isError && ['groups', groups.error],
    fields.isError && ['ticket fields', fields.error],
  ].filter(Boolean) as Array<[string, Error]>;
  const [search, setSearch] = useState('');
  const [jump, setJump] = useState('');
  const activeFilterCount = filtersToClauses(state.filters).length;
  const [showFilters, setShowFilters] = useState(activeFilterCount > 0 || !!state.rawQuery);

  const statusIds = useMemo(() => Object.keys(labels.status).map(Number), [labels]);
  const source = resolveSource(state, { myAgentId: me.agent?.id ?? null, statusIds });
  const view = getView(state.view);
  // Wait for account statuses (and "me") so the first query is the right one, not a wasted API call.
  const ready = fields.isFetched && !me.loading;
  const list = useTicketList(source.kind === 'unavailable' || !ready ? null : source, state.page);

  const update = (patch: Partial<ListState>) =>
    setParams(writeListState({ ...state, page: 1, ...patch }));

  const totalPages = list.data?.total != null ? Math.ceil(list.data.total / FILTER_PAGE_SIZE) : null;
  const capped = totalPages != null && totalPages > FILTER_MAX_PAGES;

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <nav className="flex shrink-0 gap-1 overflow-x-auto md:w-44 md:flex-col" aria-label="Views">
        {VIEWS.map((v) => {
          const active = !state.rawQuery && v.id === view.id;
          return (
            <button key={v.id} type="button" title={v.description}
              onClick={() => update({ view: v.id, rawQuery: '' })}
              className={`rounded-md px-2.5 py-1.5 text-left text-sm whitespace-nowrap ${active ? 'bg-zinc-200 font-medium dark:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'}`}>
              {v.label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-lg font-semibold">
            {state.rawQuery ? 'Custom query' : view.label}
            {list.data?.total != null && <span className="ml-2 text-sm font-normal text-zinc-500">{list.data.total} tickets</span>}
          </h1>
          <input
            className="w-44 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Search this page…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search this page"
          />
          <form onSubmit={(e) => { e.preventDefault(); const id = Number(jump.replace('#', '')); if (id) navigate(`/tickets/${id}`); }}>
            <input
              className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Go to #" value={jump} onChange={(e) => setJump(e.target.value)} aria-label="Go to ticket ID" inputMode="numeric"
            />
          </form>
          <Button onClick={() => setShowFilters((s) => !s)}>
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
          <Button onClick={() => list.refetch()} disabled={list.isFetching}>{list.isFetching ? 'Refreshing…' : 'Refresh'}</Button>
        </div>

        {showFilters && (
          <FilterBar
            filters={state.filters}
            rawQuery={state.rawQuery}
            effectiveQuery={source.kind === 'filter' ? source.query : null}
            labels={labels}
            onApply={(filters) => update({ filters, rawQuery: '' })}
            onRawQuery={(rawQuery) => update({ rawQuery })}
          />
        )}

        {failedLookups.length > 0 && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Couldn't load {failedLookups.map(([n]) => n).join(', ')}, so names show as IDs and nothing will retry automatically.{' '}
            {failedLookups.map(([n, e]) => `${n}: ${e instanceof ApiError ? `${e.message} (HTTP ${e.status})` : e.message}`).join(' · ')}.{' '}
            <Link to="/settings" className="underline">Settings → Re-check</Link>
          </p>
        )}

        {'filtersIgnored' in source && source.filtersIgnored && (
          <p className="text-xs text-amber-700 dark:text-amber-400">Filters don't apply to the Spam view.</p>
        )}

        {!ready ? (
          <p className="text-sm text-zinc-500">Loading tickets…</p>
        ) : source.kind === 'unavailable' ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {source.reason} <Link to="/settings" className="underline">Open Settings</Link>
          </p>
        ) : list.isPending ? (
          <p className="text-sm text-zinc-500">Loading tickets…</p>
        ) : list.isError ? (
          <p className="text-sm text-red-600">
            {list.error instanceof ApiError ? `${list.error.message} (HTTP ${list.error.status})` : String(list.error)}
          </p>
        ) : (
          <>
            <div className={list.isPlaceholderData ? 'opacity-60' : ''}>
              <TicketTable tickets={list.data.tickets} labels={labels} search={search} />
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Button disabled={state.page <= 1} onClick={() => setParams(writeListState({ ...state, page: state.page - 1 }))}>← Prev</Button>
              <span className="tabular-nums">
                Page {state.page}{totalPages ? ` of ${Math.min(totalPages, FILTER_MAX_PAGES)}` : ''}
              </span>
              <Button disabled={!list.data.hasNext} onClick={() => setParams(writeListState({ ...state, page: state.page + 1 }))}>Next →</Button>
              {capped && <span className="text-amber-700 dark:text-amber-400">Freshservice only returns the first {FILTER_MAX_PAGES * FILTER_PAGE_SIZE} matches. Narrow your filters to see the rest.</span>}
              {search && <span className="ml-auto">Search only covers this page.</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
