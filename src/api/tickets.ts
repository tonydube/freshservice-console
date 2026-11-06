import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { fsGet, fsGetAll } from './client';
import {
  ActivitiesResponse, ConversationsResponse, FilterResponse, RequesterResponse, TicketResponse, TicketsResponse,
  type Ticket,
} from './schemas';
import { agentName, useAgents, useHealth } from './lookups';
import { useSettings } from '../lib/settings';
import { wrapQuery } from '../lib/filterQuery';

export const FILTER_PAGE_SIZE = 30;
/** Freshservice caps how deep the filter endpoint pages. Treat beyond this as "refine your filter". */
export const FILTER_MAX_PAGES = 10;
export const LIST_PAGE_SIZE = 50;

export type TicketSource =
  | { kind: 'filter'; query: string }
  | { kind: 'list'; params: Record<string, string> };

export interface TicketPage {
  tickets: Ticket[];
  /** Known only for filter queries. */
  total: number | null;
  hasNext: boolean;
}

export function useTicketList(source: TicketSource | null, page: number) {
  const { refreshSeconds } = useSettings();
  return useQuery({
    queryKey: ['tickets', source, page],
    enabled: source !== null,
    placeholderData: keepPreviousData,
    refetchInterval: refreshSeconds > 0 ? refreshSeconds * 1000 : false,
    queryFn: async (): Promise<TicketPage> => {
      if (!source) throw new Error('no source');
      if (source.kind === 'filter') {
        const qs = new URLSearchParams({ query: wrapQuery(source.query), page: String(page) });
        const { data } = await fsGet(`tickets/filter?${qs}`, FilterResponse);
        return { tickets: data.tickets, total: data.total, hasNext: page * FILTER_PAGE_SIZE < data.total && page < FILTER_MAX_PAGES };
      }
      const qs = new URLSearchParams({ ...source.params, per_page: String(LIST_PAGE_SIZE), page: String(page) });
      const { data, nextPath } = await fsGet(`tickets?${qs}`, TicketsResponse);
      return { tickets: data.tickets, total: null, hasNext: nextPath !== null };
    },
  });
}

/** Embeds cost 1 API credit each; requester+stats+tags = 3 extra credits per view. */
export function useTicket(id: number) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => (await fsGet(`tickets/${id}?include=requester,stats,tags`, TicketResponse)).data.ticket,
  });
}

export function useConversations(id: number) {
  return useQuery({
    queryKey: ['ticket', id, 'conversations'],
    queryFn: () => fsGetAll(`tickets/${id}/conversations?per_page=100`, ConversationsResponse, (d) => d.conversations),
  });
}

export function useActivities(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ['ticket', id, 'activities'],
    enabled,
    queryFn: async () => (await fsGet(`tickets/${id}/activities`, ActivitiesResponse)).data.activities,
  });
}

/**
 * Resolve user ids (requesters or agents) to display names.
 * Agents come from the cached lookup; requesters are fetched one by one and cached for an hour.
 */
export function usePeopleNames(ids: Array<number | null | undefined>): Map<number, string> {
  const agents = useAgents();
  const agentMap = new Map((agents.data ?? []).map((a) => [a.id, agentName(a)]));
  const unique = [...new Set(ids.filter((x): x is number => typeof x === 'number'))];
  // Only look up requesters once agents have loaded; if agents failed, don't fan out more calls.
  const toFetch = agents.isSuccess ? unique.filter((i) => !agentMap.has(i)) : [];
  const results = useQueries({
    queries: toFetch.map((rid) => ({
      queryKey: ['requester', rid],
      staleTime: 60 * 60_000,
      queryFn: async () => (await fsGet(`requesters/${rid}`, RequesterResponse)).data.requester,
    })),
  });
  const out = new Map(agentMap);
  results.forEach((r, i) => {
    if (r.data) out.set(toFetch[i], agentName({ ...r.data, email: r.data.primary_email }));
  });
  return out;
}

/** Resolve the "me" agent from settings (UI) or MY_AGENT_EMAIL (.env). */
export function useMyAgent() {
  const { myAgentEmail } = useSettings();
  const health = useHealth();
  const agents = useAgents(health.data?.configured === true);
  const email = (myAgentEmail || health.data?.myAgentEmail || '').toLowerCase();
  const agent = email ? agents.data?.find((a) => a.email?.toLowerCase() === email) ?? null : null;
  // isFetched stays true once the first attempt settles (success or error), so a later refetch
  // can't flip the UI back to "loading" and unmount the table.
  return { email, agent, loading: !agents.isFetched, failed: agents.isError };
}
