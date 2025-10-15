import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { registerRoutes } from './routes.js';
import { registerMetricsRoute } from './metrics.js';
import { disconnectClient } from './xrplClient.js';

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

// API key (optional)
app.addHook("onRequest", async (req, reply) => {
  const required = process.env.ORREN_API_KEY;
  if (!required) return;
  if (req.url === '/metrics' || req.url === '/health') return; // Skip auth for metrics/health
  if (req.headers["x-api-key"] !== required) {
    reply.code(401);
    throw new Error("Unauthorized");
  }
});

// Naïve per-IP rate limit (MVP): 120/min
const hits = new Map<string, { n: number; ts: number }>();
app.addHook("onRequest", async (req, reply) => {
  if (req.url === '/metrics' || req.url === '/health') return; // Skip rate limit for metrics/health
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const rec = hits.get(ip) ?? { n: 0, ts: now };
  if (now - rec.ts > 60_000) {
    rec.n = 0;
    rec.ts = now;
  }
  rec.n++;
  hits.set(ip, rec);
  if (rec.n > 120) {
    reply.code(429);
    throw new Error("Rate limit exceeded: 120 req/min");
  }
});

await registerRoutes(app);
await registerMetricsRoute(app);

const shutdown = async () => {
  console.log('Shutting down gracefully...');
  await disconnectClient();
  await app.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({
    host: config.server.host,
    port: config.server.port,
  });
  console.log(`Server running on http://${config.server.host}:${config.server.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
