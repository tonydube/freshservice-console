import { Hono, type Context } from 'hono';
import { activitiesFor, agents, conversationsFor, departments, groups, requesters, ticketFields, tickets } from './data';
import { compileFilter, FilterSyntaxError } from './filter';

/** A small stand-in for Freshservice API v2, for local development and tests. */
export function createMockApp(opts: { apiKey?: string; rateLimitTotal?: number } = {}) {
  const apiKey = opts.apiKey ?? 'mock-key';
  const total = opts.rateLimitTotal ?? 400;
  let windowStart = Date.now();
  let used = 0;

  const app = new Hono().basePath('/api/v2');

  app.use('*', async (c, next) => {
    if (Date.now() - windowStart > 60_000) {
      windowStart = Date.now();
      used = 0;
    }
    used++;
    c.header('X-RateLimit-Total', String(total));
    c.header('X-RateLimit-Remaining', String(Math.max(0, total - used)));
    c.header('X-RateLimit-Used-CurrentRequest', '1');
    if (used > total) {
      c.header('Retry-After', String(Math.ceil((windowStart + 60_000 - Date.now()) / 1000)));
      return c.json({ message: 'You have exceeded the limit of requests per minute' }, 429);
    }
    const expected = 'Basic ' + Buffer.from(`${apiKey}:X`).toString('base64');
    if (c.req.header('authorization') !== expected) {
      return c.json({ code: 'invalid_credentials', message: 'You have to be logged in to perform this action.' }, 401);
    }
    await next();
  });

  const paginate = <T,>(c: Context, items: T[], maxPerPage = 100) => {
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    const perPage = Number(c.req.query('per_page') ?? 30);
    if (perPage > maxPerPage) return { error: true as const };
    const slice = items.slice((page - 1) * perPage, page * perPage);
    if (page * perPage < items.length) {
      const next = new URL(c.req.url);
      next.searchParams.set('page', String(page + 1));
      c.header('Link', `<${next.toString()}>; rel="next"`);
    }
    return { error: false as const, slice };
  };

  const listRoute = (path: string, key: string, items: unknown[]) =>
    app.get(path, (c) => {
      const r = paginate(c, items);
      if (r.error) return c.json({ description: 'Validation failed', errors: [{ field: 'per_page', message: 'Must be <= 100' }] }, 400);
      return c.json({ [key]: r.slice });
    });

  listRoute('/agents', 'agents', agents);
  listRoute('/groups', 'groups', groups);
  listRoute('/departments', 'departments', departments);
  listRoute('/requesters', 'requesters', requesters);
  app.get('/ticket_form_fields', (c) => c.json({ ticket_fields: ticketFields }));

  const visible = tickets.filter((t) => !t.spam && !t.deleted);
  const byUpdated = (a: { updated_at: string }, b: { updated_at: string }) => b.updated_at.localeCompare(a.updated_at);

  const withIncludes = (t: (typeof tickets)[number], include: string | undefined) => {
    const inc = new Set((include ?? '').split(',').filter(Boolean));
    const out: Record<string, unknown> = { ...t };
    if (!inc.has('tags')) delete out.tags;
    if (inc.has('requester')) {
      const r = requesters.find((x) => x.id === t.requester_id)!;
      out.requester = { id: r.id, name: `${r.first_name} ${r.last_name}`, email: r.primary_email, mobile: null, phone: '+1 555 0100' };
    }
    if (inc.has('stats')) {
      const created = Date.parse(t.created_at);
      out.stats = {
        first_responded_at: t.id % 4 ? new Date(created + 2 * 3600_000).toISOString() : null,
        resolved_at: t.status === 4 || t.status === 5 ? t.updated_at : null,
        closed_at: t.status === 5 ? t.updated_at : null,
        status_updated_at: t.updated_at,
      };
    }
    if (inc.has('department')) out.department = departments.find((d) => d.id === t.department_id);
    return out;
  };

  app.get('/tickets', (c) => {
    const f = c.req.query('filter');
    const source = f === 'spam' ? tickets.filter((t) => t.spam)
      : f === 'deleted' ? tickets.filter((t) => t.deleted)
      : f === 'new_and_my_open' ? visible.filter((t) => t.status === 2 && (t.responder_id == null || t.responder_id === agents[0].id))
      : visible;
    const r = paginate(c, [...source].sort(byUpdated));
    if (r.error) return c.json({ description: 'Validation failed' }, 400);
    return c.json({ tickets: r.slice.map((t) => withIncludes(t, c.req.query('include'))) });
  });

  app.get('/tickets/filter', (c) => {
    const raw = c.req.query('query') ?? '';
    if (raw.length > 514 || !/^".*"$/s.test(raw)) {
      return c.json({ description: 'Validation failed', errors: [{ field: 'query', message: 'Query must be wrapped in double quotes and be at most 512 characters' }] }, 400);
    }
    let pred;
    try {
      pred = compileFilter(raw.slice(1, -1), (t, field) => {
        if (field === 'agent_id') return t.responder_id;
        if (field === 'tag') return t.tags;
        if (field === 'email') return requesters.find((r) => r.id === t.requester_id)?.primary_email;
        if (field.startsWith('cf_')) return (t.custom_fields as Record<string, unknown>)?.[field];
        return t[field];
      });
    } catch (e) {
      if (e instanceof FilterSyntaxError) return c.json({ description: 'Validation failed', errors: [{ field: 'query', message: e.message }] }, 400);
      throw e;
    }
    const matched = visible.filter((t) => pred(t as unknown as Record<string, unknown>)).sort(byUpdated);
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    if (page > 10) return c.json({ description: 'Validation failed', errors: [{ field: 'page', message: 'Must be <= 10' }] }, 400);
    return c.json({ tickets: matched.slice((page - 1) * 30, page * 30), total: matched.length });
  });

  app.get('/tickets/:id{[0-9]+}', (c) => {
    const t = tickets.find((x) => x.id === Number(c.req.param('id')));
    return t ? c.json({ ticket: withIncludes(t, c.req.query('include')) }) : c.json({ code: 'access_denied', message: 'Not found' }, 404);
  });

  app.get('/tickets/:id{[0-9]+}/conversations', (c) => {
    const r = paginate(c, conversationsFor(Number(c.req.param('id'))));
    if (r.error) return c.json({ description: 'Validation failed' }, 400);
    return c.json({ conversations: r.slice });
  });

  app.get('/tickets/:id{[0-9]+}/activities', (c) => c.json({ activities: activitiesFor(Number(c.req.param('id'))) }));

  app.get('/requesters/:id{[0-9]+}', (c) => {
    const r = requesters.find((x) => x.id === Number(c.req.param('id')));
    return r ? c.json({ requester: r }) : c.json({ code: 'access_denied', message: 'Not found' }, 404);
  });

  return app;
}
