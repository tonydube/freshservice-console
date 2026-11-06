import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fsGet, fsGetAll } from './client';
import {
  AgentsResponse, DepartmentsResponse, GroupsResponse, HealthSchema, TicketFieldsResponse, TicketsResponse,
} from './schemas';
import { buildLabelMaps } from '../lib/enums';

const LOOKUP_STALE = 10 * 60_000;

export const queryKeys = {
  health: ['health'] as const,
  connection: ['connection'] as const,
  agents: ['lookups', 'agents'] as const,
  groups: ['lookups', 'groups'] as const,
  departments: ['lookups', 'departments'] as const,
  ticketFields: ['lookups', 'ticketFields'] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: async () => HealthSchema.parse(await (await fetch('/api/health')).json()),
    retry: 1,
  });
}

/** Cheapest real call that proves the key works for tickets: one ticket, no embeds. */
export function useConnectionCheck(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.connection,
    enabled,
    queryFn: async () => {
      const started = performance.now();
      const { data } = await fsGet('tickets?per_page=1', TicketsResponse);
      return { latencyMs: Math.round(performance.now() - started), sampleTicketId: data.tickets[0]?.id ?? null };
    },
  });
}

export function useAgents(enabled = true) {
  return useQuery({
    queryKey: queryKeys.agents,
    enabled,
    staleTime: LOOKUP_STALE,
    queryFn: () => fsGetAll('agents?per_page=100', AgentsResponse, (d) => d.agents),
  });
}

export function useGroups(enabled = true) {
  return useQuery({
    queryKey: queryKeys.groups,
    enabled,
    staleTime: LOOKUP_STALE,
    queryFn: () => fsGetAll('groups?per_page=100', GroupsResponse, (d) => d.groups),
  });
}

export function useDepartments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.departments,
    enabled,
    staleTime: LOOKUP_STALE,
    queryFn: () => fsGetAll('departments?per_page=100', DepartmentsResponse, (d) => d.departments),
  });
}

export function useTicketFields(enabled = true) {
  return useQuery({
    queryKey: queryKeys.ticketFields,
    enabled,
    staleTime: LOOKUP_STALE,
    queryFn: async () => (await fsGet('ticket_form_fields', TicketFieldsResponse)).data.ticket_fields,
  });
}

/** Enum label maps, using account choices when loaded and built-in defaults until then. */
export function useLabelMaps() {
  const fields = useTicketFields();
  return useMemo(() => buildLabelMaps(fields.data), [fields.data]);
}

export function agentName(a: { first_name?: string | null; last_name?: string | null; email?: string | null }) {
  return [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Unknown';
}
