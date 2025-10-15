import { FastifyInstance } from 'fastify';
import { getBestQuote, getAllQuotes } from './quotes/index.js';
import { buildTransaction } from './buildTx.js';
import { QuoteRequest } from './types.js';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.post<{ Body: QuoteRequest }>('/quote', async (request, reply) => {
    try {
      const { source_asset, destination_asset, amount } = request.body;

      if (!source_asset || !destination_asset || !amount) {
        return reply.status(400).send({
          error: 'Missing required fields: source_asset, destination_asset, amount',
        });
      }

      const quotes = await getAllQuotes(request.body);

      if (quotes.length === 0) {
        return reply.status(404).send({
          error: 'No routes found for the given asset pair',
        });
      }

      return { quotes };
    } catch (error) {
      console.error('Quote error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });

  app.post<{
    Body: QuoteRequest & { user_address: string };
  }>('/build-tx', async (request, reply) => {
    try {
      const { source_asset, destination_asset, amount, user_address } = request.body;

      if (!source_asset || !destination_asset || !amount || !user_address) {
        return reply.status(400).send({
          error: 'Missing required fields: source_asset, destination_asset, amount, user_address',
        });
      }

      const bestQuote = await getBestQuote({
        source_asset,
        destination_asset,
        amount,
      });

      if (!bestQuote) {
        return reply.status(404).send({
          error: 'No route found',
        });
      }

      const tx = buildTransaction(
        bestQuote,
        { source_asset, destination_asset, amount },
        user_address
      );

      return {
        quote: bestQuote,
        transaction: tx,
      };
    } catch (error) {
      console.error('Build transaction error:', error);
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
}
