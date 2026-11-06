import type { TicketField } from '../api/schemas';

/** Built-in Freshservice enums (API v2 docs). Overridden by /ticket_form_fields where available. */
export const DEFAULT_LABELS = {
  status: { 2: 'Open', 3: 'Pending', 4: 'Resolved', 5: 'Closed' },
  priority: { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent' },
  urgency: { 1: 'Low', 2: 'Medium', 3: 'High' },
  impact: { 1: 'Low', 2: 'Medium', 3: 'High' },
  source: {
    1: 'Email', 2: 'Portal', 3: 'Phone', 4: 'Chat', 5: 'Feedback widget', 6: 'Yammer', 7: 'AWS CloudWatch',
    8: 'PagerDuty', 9: 'Walk-up', 10: 'Slack', 11: 'Chatbot', 12: 'Workplace', 13: 'Employee onboarding',
    14: 'Alerts', 15: 'MS Teams', 18: 'Employee offboarding',
  },
} as const satisfies Record<string, Record<number, string>>;

export type EnumField = keyof typeof DEFAULT_LABELS;
export type LabelMaps = Record<EnumField, Record<number, string>>;

/**
 * Merge account-specific choices (e.g. custom statuses) from /ticket_form_fields over the defaults.
 * Choices whose id isn't numeric are ignored for these numeric enums.
 */
export function buildLabelMaps(fields: TicketField[] | undefined): LabelMaps {
  const maps: LabelMaps = {
    status: { ...DEFAULT_LABELS.status },
    priority: { ...DEFAULT_LABELS.priority },
    urgency: { ...DEFAULT_LABELS.urgency },
    impact: { ...DEFAULT_LABELS.impact },
    source: { ...DEFAULT_LABELS.source },
  };
  for (const f of fields ?? []) {
    if (!(f.name in maps) || !f.choices?.length) continue;
    const target = maps[f.name as EnumField];
    for (const c of f.choices) {
      const key = typeof c.id === 'number' ? c.id : Number(c.id);
      if (Number.isFinite(key)) target[key] = String(c.value);
    }
  }
  return maps;
}

export function label(maps: LabelMaps, field: EnumField, value: number | null | undefined): string {
  if (value == null) return '—';
  return maps[field][value] ?? `#${value}`;
}
