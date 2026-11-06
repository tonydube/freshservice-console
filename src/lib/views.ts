import { andAll, anyOf, isoDate } from './filterQuery';

/** Status ids treated as "done". Everything else (incl. custom statuses) counts as unresolved. */
export const DONE_STATUSES = [4, 5];

export interface ViewContext {
  myAgentId: number | null;
  statusIds: number[];
  today?: Date;
}

export type ViewSource =
  | { kind: 'filter'; query: string }
  | { kind: 'list'; params: Record<string, string> }
  | { kind: 'unavailable'; reason: string };

export interface ViewDef {
  id: string;
  label: string;
  description: string;
  build: (ctx: ViewContext) => ViewSource;
}

const unresolved = (ctx: ViewContext) => anyOf('status', ctx.statusIds.filter((s) => !DONE_STATUSES.includes(s)));

export const VIEWS: ViewDef[] = [
  {
    id: 'my-open',
    label: 'My open',
    description: 'Unresolved tickets assigned to you',
    build: (ctx) =>
      ctx.myAgentId == null
        ? { kind: 'unavailable', reason: 'Set your agent email in Settings to use this view.' }
        : { kind: 'filter', query: andAll([`agent_id:${ctx.myAgentId}`, unresolved(ctx)]) },
  },
  {
    id: 'unassigned',
    label: 'Unassigned',
    description: 'Unresolved tickets with no agent',
    build: (ctx) => ({ kind: 'filter', query: andAll(['agent_id:null', unresolved(ctx)]) }),
  },
  {
    id: 'open',
    label: 'All open',
    description: 'Every unresolved ticket',
    build: (ctx) => ({ kind: 'filter', query: unresolved(ctx) ?? 'status:2' }),
  },
  {
    id: 'pending',
    label: 'Pending',
    description: 'Status is Pending',
    build: () => ({ kind: 'filter', query: 'status:3' }),
  },
  {
    id: 'overdue',
    label: 'Overdue',
    description: 'Unresolved and past the resolution due date',
    build: (ctx) => ({ kind: 'filter', query: andAll([unresolved(ctx), `due_by:<'${isoDate(-1, ctx.today)}'`]) }),
  },
  {
    id: 'recent',
    label: 'Updated this week',
    description: 'Updated in the last 7 days',
    build: (ctx) => ({ kind: 'filter', query: `updated_at:>'${isoDate(-7, ctx.today)}'` }),
  },
  {
    id: 'all',
    label: 'All (30 days)',
    description: 'Everything from the last 30 days (Freshservice list default)',
    build: () => ({ kind: 'list', params: {} }),
  },
  {
    id: 'spam',
    label: 'Spam',
    description: 'Tickets marked as spam',
    build: () => ({ kind: 'list', params: { filter: 'spam' } }),
  },
];

export const DEFAULT_VIEW = 'open';
export const getView = (id: string | null) => VIEWS.find((v) => v.id === id) ?? VIEWS.find((v) => v.id === DEFAULT_VIEW)!;
