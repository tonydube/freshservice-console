import { useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { agentName, useAgents, useDepartments, useGroups, useHealth, useLabelMaps, useTicketFields } from '../../api/lookups';
import type { Attachment, Conversation, TicketDetail } from '../../api/schemas';
import { useActivities, useConversations, usePeopleNames, useTicket } from '../../api/tickets';
import { PriorityText, StatusPill, Tag } from '../../components/Pill';
import { SafeHtml } from '../../components/SafeHtml';
import { Button } from '../../components/ui';
import { label } from '../../lib/enums';
import { dateTime, fileSize, isOverdue, relativeTime } from '../../lib/format';

export function TicketDetailPage() {
  const id = Number(useParams().id);
  const from = (useLocation().state as { from?: string } | null)?.from ?? '';
  const ticket = useTicket(id);
  const health = useHealth();

  const back = <Link to={`/${from}`} className="text-sm text-zinc-500 hover:underline">← Back to tickets</Link>;

  if (!Number.isInteger(id) || id <= 0) return <div className="space-y-3">{back}<p className="text-sm">Invalid ticket ID.</p></div>;
  if (ticket.isPending) return <div className="space-y-3">{back}<p className="text-sm text-zinc-500">Loading ticket #{id}…</p></div>;
  if (ticket.isError) {
    const e = ticket.error;
    return (
      <div className="space-y-3">{back}
        <p className="text-sm text-red-600">
          {e instanceof ApiError && e.status === 404 ? `Ticket #${id} doesn't exist or you can't see it.` : e instanceof ApiError ? e.message : String(e)}
        </p>
      </div>
    );
  }

  const t = ticket.data;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {back}
        <div className="flex gap-2">
          <Button onClick={() => ticket.refetch()} disabled={ticket.isFetching}>{ticket.isFetching ? 'Refreshing…' : 'Refresh'}</Button>
          {health.data?.webBase && (
            <a href={`${health.data.webBase}/a/tickets/${t.id}`} target="_blank" rel="noreferrer"
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Open in Freshservice ↗
            </a>
          )}
        </div>
      </div>
      <TicketHeader t={t} />
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <TicketBody t={t} />
        <TicketSidebar t={t} />
      </div>
    </div>
  );
}

function TicketHeader({ t }: { t: TicketDetail }) {
  const labels = useLabelMaps();
  return (
    <header className="space-y-2">
      <h1 className="text-xl font-semibold">
        <span className="mr-2 font-normal text-zinc-500">#{t.id}</span>{t.subject || '(no subject)'}
      </h1>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatusPill value={t.status} labels={labels} />
        <PriorityText value={t.priority} labels={labels} />
        {t.type && <Tag>{t.type}</Tag>}
        {isOverdue(t.due_by, t.status) && <Tag tone="danger">Overdue</Tag>}
        <span className="text-zinc-500">Created {relativeTime(t.created_at)} · updated {relativeTime(t.updated_at)}</span>
      </div>
    </header>
  );
}

function Attachments({ items }: { items: Attachment[] | undefined }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map((a, i) => (
        <li key={a.id ?? i}>
          <a href={a.attachment_url ?? undefined} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            📎 {a.name} <span className="text-zinc-500">{fileSize(a.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function TicketBody({ t }: { t: TicketDetail }) {
  const [tab, setTab] = useState<'conversation' | 'activity'>('conversation');
  const conversations = useConversations(t.id);
  const activities = useActivities(t.id, tab === 'activity');
  const names = usePeopleNames([t.requester_id, ...(conversations.data ?? []).map((c) => c.user_id)]);
  const requesterName = t.requester?.name ?? (t.requester_id ? names.get(t.requester_id) : null) ?? 'Requester';

  const tabBtn = (key: typeof tab, text: string) => (
    <button type="button" onClick={() => setTab(key)} aria-pressed={tab === key}
      className={`border-b-2 px-1 pb-2 text-sm ${tab === key ? 'border-zinc-900 font-medium dark:border-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
      {text}
    </button>
  );

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800">
        {tabBtn('conversation', `Conversation${conversations.data ? ` (${conversations.data.length + 1})` : ''}`)}
        {tabBtn('activity', 'Activity')}
      </div>

      {tab === 'conversation' ? (
        <ol className="space-y-3">
          <Message author={requesterName} meta={`raised ${relativeTime(t.created_at)}`} when={t.created_at} kind="incoming">
            <SafeHtml html={t.description ?? t.description_text} />
            <Attachments items={t.attachments} />
          </Message>
          {conversations.isPending && <li className="text-sm text-zinc-500">Loading conversation…</li>}
          {conversations.isError && <li className="text-sm text-red-600">Couldn't load conversation: {String(conversations.error.message)}</li>}
          {conversations.data?.map((c) => <ConversationItem key={c.id} c={c} names={names} />)}
        </ol>
      ) : (
        <ol className="space-y-2 text-sm">
          {activities.isPending && <li className="text-zinc-500">Loading activity…</li>}
          {activities.isError && <li className="text-red-600">{activities.error.message}</li>}
          {activities.data?.length === 0 && <li className="text-zinc-500">No activity.</li>}
          {activities.data?.map((a, i) => (
            <li key={i} className="rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-medium">{a.actor?.name ?? 'System'}</span> {a.content}
              <span className="ml-2 text-xs text-zinc-500" title={dateTime(a.created_at)}>{relativeTime(a.created_at)}</span>
              {!!a.sub_contents?.length && (
                <ul className="mt-1 list-disc pl-5 text-xs text-zinc-600 dark:text-zinc-400">
                  {a.sub_contents.map((s, j) => <li key={j}>{s}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ConversationItem({ c, names }: { c: Conversation; names: Map<number, string> }) {
  const author = (c.user_id ? names.get(c.user_id) : null) ?? c.from_email ?? 'Unknown';
  const kind = c.private ? 'note' : c.incoming ? 'incoming' : 'outgoing';
  const verb = c.private ? 'added a private note' : c.incoming ? 'replied' : `replied${c.to_emails?.length ? ` to ${c.to_emails.join(', ')}` : ''}`;
  return (
    <Message author={author} meta={verb} when={c.created_at} kind={kind}>
      <SafeHtml html={c.body ?? c.body_text} />
      <Attachments items={c.attachments} />
    </Message>
  );
}

function Message({ author, meta, when, kind, children }: {
  author: string; meta: string; when: string; kind: 'incoming' | 'outgoing' | 'note'; children: ReactNode;
}) {
  const tone = kind === 'note'
    ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40'
    : kind === 'outgoing'
      ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/30'
      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
  return (
    <li className={`rounded-lg border p-4 text-sm ${tone}`}>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="text-sm font-medium">{author}</span>
        <span className="text-zinc-500">{meta}</span>
        {kind === 'note' && <Tag tone="note">Private</Tag>}
        <span className="ml-auto text-zinc-500" title={dateTime(when)}>{relativeTime(when)}</span>
      </div>
      {children}
    </li>
  );
}

function Prop({ label: l, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-zinc-500">{l}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function TicketSidebar({ t }: { t: TicketDetail }) {
  const labels = useLabelMaps();
  const agents = useAgents();
  const groups = useGroups();
  const departments = useDepartments();
  const fields = useTicketFields();
  const agent = agents.data?.find((a) => a.id === t.responder_id);
  const fieldLabel = (name: string) => fields.data?.find((f) => f.name === name)?.label ?? name.replace(/^cf_/, '').replace(/_/g, ' ');
  const custom = Object.entries(t.custom_fields ?? {}).filter(([, v]) => v !== null && v !== '');

  const section = 'rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900';
  return (
    <aside className="space-y-3">
      <div className={section}>
        <h2 className="mb-1 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Requester</h2>
        <p className="font-medium">{t.requester?.name ?? '—'}</p>
        {t.requester?.email && <a className="text-sky-700 hover:underline dark:text-sky-400" href={`mailto:${t.requester.email}`}>{t.requester.email}</a>}
        {(t.requester?.phone || t.requester?.mobile) && <p className="text-zinc-500">{t.requester.phone ?? t.requester.mobile}</p>}
        {!!t.cc_emails?.length && <p className="mt-1 text-xs text-zinc-500">CC: {t.cc_emails.join(', ')}</p>}
      </div>

      <dl className={section}>
        <Prop label="Agent">{agent ? agentName(agent) : t.responder_id ? `#${t.responder_id}` : <span className="text-zinc-400">Unassigned</span>}</Prop>
        <Prop label="Group">{groups.data?.find((g) => g.id === t.group_id)?.name ?? '—'}</Prop>
        <Prop label="Department">{departments.data?.find((d) => d.id === t.department_id)?.name ?? '—'}</Prop>
        <Prop label="Urgency">{label(labels, 'urgency', t.urgency)}</Prop>
        <Prop label="Impact">{label(labels, 'impact', t.impact)}</Prop>
        <Prop label="Source">{label(labels, 'source', t.source)}</Prop>
        <Prop label="Category">{t.category ?? '—'}</Prop>
      </dl>

      <dl className={section}>
        <Prop label="First response due">
          <span title={dateTime(t.fr_due_by)}>{relativeTime(t.fr_due_by)}</span>
        </Prop>
        <Prop label="First responded">{t.stats?.first_responded_at ? relativeTime(t.stats.first_responded_at) : <span className="text-zinc-400">not yet</span>}</Prop>
        <Prop label="Resolution due">
          <span className={isOverdue(t.due_by, t.status) ? 'text-red-600' : ''} title={dateTime(t.due_by)}>{relativeTime(t.due_by)}</span>
        </Prop>
        {t.stats?.resolved_at && <Prop label="Resolved">{relativeTime(t.stats.resolved_at)}</Prop>}
        <Prop label="Created">{dateTime(t.created_at)}</Prop>
      </dl>

      {(custom.length > 0 || !!t.tags?.length) && (
        <dl className={section}>
          {custom.map(([k, v]) => <Prop key={k} label={fieldLabel(k)}>{String(v)}</Prop>)}
          {!!t.tags?.length && <Prop label="Tags"><span className="flex flex-wrap justify-end gap-1">{t.tags.map((x) => <Tag key={x}>{x}</Tag>)}</span></Prop>}
        </dl>
      )}
    </aside>
  );
}
