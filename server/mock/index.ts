import { serve } from '@hono/node-server';
import { createMockApp } from './app';

const port = Number(process.env.MOCK_PORT ?? 8788);
serve({ fetch: createMockApp().fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`Mock Freshservice on http://127.0.0.1:${info.port}/api/v2 (API key: mock-key)`);
});
