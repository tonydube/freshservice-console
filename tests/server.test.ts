// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isAllowed } from '../server/allowlist';
import { loadConfig } from '../server/env';
import { createApp } from '../server/app';
import { createMockApp } from '../server/mock/app';

describe('allowlist', () => {
  it.each([
    ['GET', 'tickets'], ['POST', 'tickets'], ['GET', 'tickets/filter'], ['GET', 'tickets/42'], ['PUT', 'tickets/42'],
    ['POST', 'tickets/42/reply'], ['POST', 'tickets/42/notes'], ['GET', 'tickets/42/conversations'],
    ['DELETE', 'tickets/42/tasks/7'], ['GET', 'ticket_form_fields'], ['GET', 'agents'],
  ])('allows %s %s', (m, p) => expect(isAllowed(m, p)).toBe(true));

  it.each([
    ['DELETE', 'tickets/42'], ['PUT', 'tickets/42/restore'], ['DELETE', 'agents/1'], ['POST', 'agents'],
    ['GET', 'changes'], ['GET', 'tickets/../agents'], ['GET', 'tickets/abc'],
  ])('blocks %s %s', (m, p) => expect(isAllowed(m, p)).toBe(false));
});

describe('loadConfig', () => {
  it('expands a bare subdomain', () => {
    const c = loadConfig({ FRESHSERVICE_DOMAIN: 'acme', FRESHSERVICE_API_KEY: 'k' });
    expect(c.apiBase).toBe('https://acme.freshservice.com/api/v2');
    expect(c.configured).toBe(true);
  });
  it('accepts a full URL', () => {
    expect(loadConfig({ FRESHSERVICE_DOMAIN: 'https://acme.freshservice.com/', FRESHSERVICE_API_KEY: 'k' }).apiBase)
      .toBe('https://acme.freshservice.com/api/v2');
  });
  it('rejects custom CNAMEs and missing key', () => {
    const c = loadConfig({ FRESHSERVICE_DOMAIN: 'help.acme.com' });
    expect(c.configured).toBe(false);
    expect(c.problems).toHaveLength(2);
  });
});

/** Wire the proxy to the in-memory mock instead of the network. */
function setup(apiKey = 'mock-key', rateLimitTotal = 400) {
  const mock = createMockApp({ rateLimitTotal });
  const config = loadConfig({ FRESHSERVICE_BASE_URL: 'http://mock', FRESHSERVICE_API_KEY: apiKey });
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => mock.fetch(new Request(input, init))) as typeof fetch;
  return createApp(config, fetchImpl);
}

describe('proxy', () => {
  it('adds auth, forwards data and rate-limit headers', async () => {
    const res = await setup().request('/api/fs/tickets?per_page=2');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-ratelimit-total')).toBe('400');
    const body = (await res.json()) as { tickets: unknown[] };
    expect(body.tickets).toHaveLength(2);
  });

  it('rewrites Link headers to the proxy path', async () => {
    const res = await setup().request('/api/fs/tickets?per_page=10');
    expect(res.headers.get('link')).toMatch(/^<\/api\/fs\/tickets\?per_page=10&page=2>; rel="next"$/);
  });

  it('passes through a 401 for a bad key', async () => {
    expect((await setup('wrong').request('/api/fs/agents')).status).toBe(401);
  });

  it('blocks endpoints outside the allowlist without calling upstream', async () => {
    const res = await setup().request('/api/fs/tickets/1', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('passes through 429 with Retry-After', async () => {
    const app = setup('mock-key', 1);
    await app.request('/api/fs/agents');
    const res = await app.request('/api/fs/agents');
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('reports not configured on /api/health and 503 on calls', async () => {
    const app = createApp(loadConfig({}));
    expect(((await (await app.request("/api/health")).json()) as { configured: boolean }).configured).toBe(false);
    expect((await app.request('/api/fs/tickets')).status).toBe(503);
  });

  it('never leaks the API key in /api/health', async () => {
    const text = await (await setup('super-secret').request('/api/health')).text();
    expect(text).not.toContain('super-secret');
  });
});

describe('mock filter endpoint (via proxy)', () => {
  const q = (expr: string, page = 1) =>
    setup().request(`/api/fs/tickets/filter?${new URLSearchParams({ query: `"${expr}"`, page: String(page) })}`);

  it('filters with AND/OR and returns total', async () => {
    const body = (await (await q('(priority:3 OR priority:4) AND agent_id:null')).json()) as { tickets: Array<{ priority: number; responder_id: number | null }>; total: number };
    expect(body.total).toBeGreaterThan(0);
    expect(body.tickets.every((t) => t.priority >= 3 && t.responder_id === null)).toBe(true);
  });

  it('rejects unquoted strings and over-deep pages', async () => {
    expect((await q('tag:vip')).status).toBe(400);
    expect((await q('status:2', 11)).status).toBe(400);
  });

  it('serves includes, conversations and activities', async () => {
    const app = setup();
    const t = (await (await app.request('/api/fs/tickets/3?include=requester,stats')).json()) as { ticket: { requester: { email: string }; stats: object } };
    expect(t.ticket.requester.email).toContain('@');
    expect(t.ticket.stats).toBeTruthy();
    const conv = (await (await app.request('/api/fs/tickets/3/conversations')).json()) as { conversations: unknown[] };
    expect(conv.conversations).toHaveLength(3);
    expect((await app.request('/api/fs/tickets/3/activities')).status).toBe(200);
  });
});
