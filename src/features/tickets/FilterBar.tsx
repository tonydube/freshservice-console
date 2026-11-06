import { useEffect, useState } from 'react';
import { agentName, useAgents, useGroups } from '../../api/lookups';
import type { LabelMaps } from '../../lib/enums';
import { EMPTY_FILTERS, MAX_QUERY_LENGTH, queryTooLong, wrapQuery, type IdOrNone, type TicketFilters } from '../../lib/filterQuery';

const input = 'rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900';

function Toggle({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-md border px-2 py-0.5 text-xs ${on ? 'border-sky-600 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
    >
      {children}
    </button>
  );
}

function IdSelect({ label, value, options, onChange }: {
  label: string; value: IdOrNone | null; options: Array<{ id: number; name: string }>; onChange: (v: IdOrNone | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      {label}
      <select
        className={input}
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'none' ? 'none' : Number(e.target.value))}
      >
        <option value="">Any</option>
        <option value="none">Unassigned</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}

export function FilterBar({ filters, rawQuery, effectiveQuery, labels, onApply, onRawQuery }: {
  filters: TicketFilters;
  rawQuery: string;
  effectiveQuery: string | null;
  labels: LabelMaps;
  onApply: (f: TicketFilters) => void;
  onRawQuery: (q: string) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [raw, setRaw] = useState(rawQuery || effectiveQuery || '');
  const agents = useAgents();
  const groups = useGroups();
  useEffect(() => setDraft(filters), [filters]);
  useEffect(() => setRaw(rawQuery || effectiveQuery || ''), [rawQuery, effectiveQuery]);

  const toggle = (key: 'statuses' | 'priorities', v: number) =>
    setDraft((d) => ({ ...d, [key]: d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v] }));

  const tooLong = queryTooLong(raw);

  return (
    <form
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      onSubmit={(e) => { e.preventDefault(); onApply(draft); }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-16 text-xs text-zinc-500">Status</span>
        {Object.entries(labels.status).map(([k, v]) => (
          <Toggle key={k} on={draft.statuses.includes(Number(k))} onClick={() => toggle('statuses', Number(k))}>{v}</Toggle>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-16 text-xs text-zinc-500">Priority</span>
        {Object.entries(labels.priority).map(([k, v]) => (
          <Toggle key={k} on={draft.priorities.includes(Number(k))} onClick={() => toggle('priorities', Number(k))}>{v}</Toggle>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <IdSelect label="Agent" value={draft.agent} onChange={(agent) => setDraft({ ...draft, agent })}
          options={(agents.data ?? []).filter((a) => a.active !== false).map((a) => ({ id: a.id, name: agentName(a) }))} />
        <IdSelect label="Group" value={draft.group} onChange={(group) => setDraft({ ...draft, group })} options={groups.data ?? []} />
        <label className="flex flex-col gap-1 text-xs text-zinc-500">Requester email
          <input className={input} type="email" value={draft.requesterEmail} onChange={(e) => setDraft({ ...draft, requesterEmail: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">Tag
          <input className={input} value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">Created from
          <input className={input} type="date" value={draft.createdFrom} onChange={(e) => setDraft({ ...draft, createdFrom: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">Created to
          <input className={input} type="date" value={draft.createdTo} onChange={(e) => setDraft({ ...draft, createdTo: e.target.value })} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900">Apply filters</button>
        <button type="button" className="rounded-md px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          onClick={() => { setDraft(EMPTY_FILTERS); onApply(EMPTY_FILTERS); }}>Clear</button>
      </div>

      <details className="text-xs" open={!!rawQuery}>
        <summary className="cursor-pointer text-zinc-500">Advanced: Freshservice filter query</summary>
        <div className="mt-2 space-y-1.5">
          <textarea
            className={`${input} w-full font-mono text-xs`}
            rows={2}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="(priority:3 OR priority:4) AND agent_id:null"
          />
          <div className="flex items-center gap-2">
            <button type="button" disabled={tooLong || !raw.trim()} onClick={() => onRawQuery(raw)}
              className="rounded-md border border-zinc-300 px-2.5 py-1 font-medium disabled:opacity-50 dark:border-zinc-700">Run query</button>
            {rawQuery && <button type="button" onClick={() => onRawQuery('')} className="text-zinc-500 underline">Back to view + filters</button>}
            <span className={`ml-auto tabular-nums ${tooLong ? 'text-red-600' : 'text-zinc-500'}`}>
              {wrapQuery(raw).length}/{MAX_QUERY_LENGTH}{tooLong && ': too long for Freshservice'}
            </span>
          </div>
          <p className="text-zinc-500">
            Fields: status, priority, urgency, impact, agent_id, group_id, requester_id, email, tag, due_by, fr_due_by, created_at, updated_at, cf_*.
            Operators: <code>:</code> equals, <code>:&gt;</code> ≥, <code>:&lt;</code> ≤, AND, OR. Strings and dates in single quotes.
          </p>
        </div>
      </details>
    </form>
  );
}
