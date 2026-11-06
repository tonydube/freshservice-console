import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { loadConfig } from './env';
import { createApp } from './app';

const config = loadConfig();
const app = createApp(config);

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
}

// Bind to loopback only: this app has no login, so it must not be reachable from the network.
serve({ fetch: app.fetch, port: config.port, hostname: '127.0.0.1' }, (info) => {
  console.log(`Proxy listening on http://127.0.0.1:${info.port} -> ${config.domainLabel || '(not configured)'}`);
  for (const p of config.problems) console.warn(`  ! ${p}`);
});
