import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { Ticket } from '../../api/schemas';
import { useGroups } from '../../api/lookups';
import { usePeopleNames } from '../../api/tickets';
import type { LabelMaps } from '../../lib/enums';
import { dateTime, isOverdue, relativeTime } from '../../lib/format';
import { PriorityText, StatusPill, Tag } from '../../components/Pill';

type SortKey = 'id' | 'subject' | 'status' | 'priority' | 'due_by' | 'updated_at';

export function TicketTable({ tickets, labels, search }: { tickets: Ticket[]; labels: LabelMaps; search: string }) {
  const location = useLocation();
  const groups = useGroups();
  const groupNames = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const names = usePeopleNames(tickets.flatMap((t) => [t.requester_id, t.responder_id]));
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    let out = s
      ? tickets.filter((t) => `#${t.id} ${t.subject ?? ''} ${t.description_text ?? ''}`.toLowerCase().includes(s))
      : tickets;
    if (sort) {
      out = [...out].sort((a, b) => {
        const av = a[sort.key] ?? '', bv = b[sort.key] ?? '';
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir;
      });
    }
    return out;
  }, [tickets, search, sort]);

  const th = (key: SortKey | null, text: string, cls = '') => (
    <th className={`px-3 py-2 text-left font-medium ${cls}`}>
      {key ? (
        <button type="button" className="hover:underline" onClick={() =>
          setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }))}>
          {text}{sort?.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
        </button>
      ) : text}
    </th>
  );

  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">No tickets match.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
          <tr>
            {th('id', 'ID', 'w-16')}
            {th('subject', 'Subject')}
            {th(null, 'Requester', 'hidden md:table-cell')}
            {th('status', 'Status')}
            {th('priority', 'Priority')}
            {th(null, 'Agent', 'hidden lg:table-cell')}
            {th(null, 'Group', 'hidden xl:table-cell')}
            {th('due_by', 'Due', 'hidden md:table-cell')}
            {th('updated_at', 'Updated')}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((t) => {
            const overdue = isOverdue(t.due_by, t.status);
            return (
              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-3 py-2 tabular-nums text-zinc-500">#{t.id}</td>
                <td className="max-w-md px-3 py-2">
                  <Link to={`/tickets/${t.id}`} state={{ from: location.search }} className="font-medium hover:underline">
                    {t.subject || '(no subject)'}
                  </Link>
                  <span className="ml-2 inline-flex gap-1">
                    {overdue && <Tag tone="danger">Overdue</Tag>}
                    {t.tags?.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                  </span>
                </td>
                <td className="hidden px-3 py-2 whitespace-nowrap text-zinc-600 md:table-cell dark:text-zinc-400">{t.requester_id ? names.get(t.requester_id) ?? '…' : '—'}</td>
                <td className="px-3 py-2"><StatusPill value={t.status} labels={labels} /></td>
                <td className="px-3 py-2"><PriorityText value={t.priority} labels={labels} /></td>
                <td className="hidden px-3 py-2 whitespace-nowrap text-zinc-600 lg:table-cell dark:text-zinc-400">
                  {t.responder_id ? names.get(t.responder_id) ?? '…' : <span className="text-zinc-400">Unassigned</span>}
                </td>
                <td className="hidden px-3 py-2 whitespace-nowrap text-zinc-600 xl:table-cell dark:text-zinc-400">{t.group_id ? groupNames.get(t.group_id) ?? '…' : '—'}</td>
                <td className={`hidden px-3 py-2 whitespace-nowrap md:table-cell ${overdue ? 'text-red-600' : 'text-zinc-600 dark:text-zinc-400'}`} title={dateTime(t.due_by)}>
                  {relativeTime(t.due_by)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400" title={dateTime(t.updated_at)}>{relativeTime(t.updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
