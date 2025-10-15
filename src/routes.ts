import { FastifyInstance } from 'fastify';
import { getBestQuote, getAllQuotes } from './quotes/index.js';
import { buildTransaction } from './buildTx.js';
import { compareToNative } from './nativeComparison.js';
import { QuoteRequest } from './types.js';
import { config } from './config.js';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.post<{ Body: QuoteRequest & { user_address?: string } }>('/quote', async (request, reply) => {
    try {
      const { source_asset, destination_asset, amount, user_address } = request.body;

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

      if (config.features.nativeComparison && user_address && quotes.length > 0) {
        const comparison = await compareToNative(
          source_asset,
          destination_asset,
          amount,
          quotes[0],
          user_address
        );
        if (comparison) {
          quotes[0].native_comparison = comparison;
        }
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
    Body: QuoteRequest & { user_address: string; min_out?: string; slippage_bps?: number; mode?: 'exact_in' | 'exact_out' };
  }>('/build-tx', async (request, reply) => {
    try {
      const { source_asset, destination_asset, amount, user_address, min_out, slippage_bps, mode } = request.body;

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

      if (config.features.nativeComparison) {
        const comparison = await compareToNative(
          source_asset,
          destination_asset,
          amount,
          bestQuote,
          user_address
        );
        if (comparison) {
          bestQuote.native_comparison = comparison;
        }
      }

      const tx = buildTransaction(
        bestQuote,
        { source_asset, destination_asset, amount },
        user_address,
        { minOut: min_out, slippageBps: slippage_bps, mode }
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
