/**
 * Endpoints the UI is allowed to call, relative to /api/v2.
 * Anything not listed is rejected by the proxy with 403.
 * v1 scope: full ticket work minus delete/restore (see SPEC.md §10).
 */
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

const ID = '\\d+';
const rules: Array<[Method[], RegExp]> = [
  [['GET', 'POST'], new RegExp(`^tickets$`)],
  [['GET'], new RegExp(`^tickets/filter$`)],
  [['GET', 'PUT'], new RegExp(`^tickets/${ID}$`)],
  [['GET'], new RegExp(`^tickets/${ID}/(conversations|activities)$`)],
  [['POST'], new RegExp(`^tickets/${ID}/(reply|notes)$`)],
  [['GET', 'POST'], new RegExp(`^tickets/${ID}/(tasks|time_entries)$`)],
  [['GET', 'PUT', 'DELETE'], new RegExp(`^tickets/${ID}/(tasks|time_entries)/${ID}$`)],
  [['GET'], new RegExp(`^ticket_form_fields$`)],
  [['GET'], new RegExp(`^(agents|groups|requesters|departments)$`)],
  [['GET'], new RegExp(`^(agents|groups|requesters|departments)/${ID}$`)],
];

export function isAllowed(method: string, path: string): boolean {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return rules.some(([methods, re]) => (methods as string[]).includes(method) && re.test(clean));
}
