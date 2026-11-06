import { Hono } from 'hono';
import type { ServerConfig } from './env';
import { isAllowed } from './allowlist';

/** Headers from Freshservice worth passing back to the browser. */
const PASS_HEADERS = [/^x-ratelimit-/i, /^retry-after$/i, /^link$/i, /^content-type$/i];

export function createApp(config: ServerConfig, fetchImpl: typeof fetch = fetch) {
  const app = new Hono();
  const auth = 'Basic ' + Buffer.from(`${config.apiKey}:X`).toString('base64');

  app.get('/api/health', (c) =>
    c.json({
      configured: config.configured,
      domain: config.domainLabel,
      webBase: config.webBase,
      myAgentEmail: config.myAgentEmail || null,
      problems: config.problems,
      replySignature: config.replySignature || null,
    }),
  );

  app.all('/api/fs/*', async (c) => {
    if (!config.configured) {
      return c.json({ error: 'not_configured', problems: config.problems }, 503);
    }
    const url = new URL(c.req.url);
    const path = url.pathname.slice('/api/fs/'.length);
    const method = c.req.method.toUpperCase();
    if (!isAllowed(method, path)) {
      console.warn(`[proxy] blocked ${method} /${path}`);
      return c.json({ error: 'forbidden_endpoint', method, path }, 403);
    }

    const headers: Record<string, string> = { Authorization: auth, Accept: 'application/json' };
    const contentType = c.req.header('content-type');
    if (contentType) headers['Content-Type'] = contentType;
    const body = method === 'GET' || method === 'HEAD' ? undefined : await c.req.arrayBuffer();

    let upstream: Response;
    try {
      upstream = await fetchImpl(`${config.apiBase}/${path}${url.search}`, { method, headers, body });
    } catch (err) {
      console.warn(`[freshservice] ${method} /${path} -> unreachable: ${(err as Error).message}`);
      return c.json({ error: 'upstream_unreachable', message: (err as Error).message }, 502);
    }

    const out = new Headers();
    upstream.headers.forEach((value, key) => {
      if (PASS_HEADERS.some((re) => re.test(key))) out.set(key, value);
    });
    // Rewrite Link header to point at the proxy instead of Freshservice (any host/scheme form).
    const link = out.get('link');
    if (link) out.set('link', link.replace(/<[^>]*?\/api\/v2\//g, '</api/fs/'));

    if (!upstream.ok) {
      // Log failures (never the key) so the terminal shows *why* a call failed.
      const text = await upstream.text();
      console.warn(`[freshservice] ${method} /${path}${url.search} -> ${upstream.status} ${text.slice(0, 300).replace(/\s+/g, ' ')}`);
      return new Response(text, { status: upstream.status, headers: out });
    }

    return new Response(upstream.body, { status: upstream.status, headers: out });
  });

  return app;
}
