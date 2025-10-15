import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { registerRoutes } from './routes.js';
import { disconnectClient } from './xrplClient.js';

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

await registerRoutes(app);

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
