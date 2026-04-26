import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { golfRoutes } from './routes/golf';

const app = new Hono();

app.route('/golf', golfRoutes);
app.get('/', (c) => c.json({ status: 'ok', version: '1.0.0' }));

const port = parseInt(process.env['PORT'] ?? '3000', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`);
});
