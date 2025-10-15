import { FastifyInstance } from 'fastify';
import { getBestQuote, getAllQuotes } from './quotes/index.js';
import { buildTransaction } from './buildTx.js';
import { compareToNative } from './nativeComparison.js';
import { QuoteRequest } from './types.js';
import { config } from './config.js';
import { calculateDynamicFee, getFeeConfig } from './fees.js';

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

      if (user_address && quotes.length > 0) {
        const comparison = await compareToNative(
          source_asset,
          destination_asset,
          amount,
          quotes[0],
          user_address
        );
        if (comparison) {
          quotes[0].source = 'ORREN';
          quotes[0].guarantee = 'available';
          quotes[0].native_comparison = comparison;
          
          const feeResult = calculateDynamicFee(
            quotes[0].expected_out,
            comparison.native_expected_out,
            getFeeConfig()
          );
          
          quotes[0].pricing = {
            gross_out: feeResult.gross_out,
            fee_bps: feeResult.fee_bps,
            net_out: feeResult.net_out,
            native_out: feeResult.native_out,
            improvement_bps: feeResult.improvement_bps,
          };
        } else {
          quotes[0].source = 'MOCK';
          quotes[0].guarantee = 'unavailable';
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
    Body: QuoteRequest & { 
      user_address: string; 
      min_out?: string; 
      slippage_bps?: number; 
      mode?: 'exact_in' | 'exact_out';
      pricing?: {
        gross_out: string;
        fee_bps: number;
        net_out: string;
      };
    };
  }>('/build-tx', async (request, reply) => {
    try {
      const { source_asset, destination_asset, amount, user_address, min_out, slippage_bps, mode, pricing } = request.body;

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

      let feeInfo;
      
      if (pricing) {
        feeInfo = {
          gross_out: pricing.gross_out,
          fee_bps: pricing.fee_bps,
          net_out: pricing.net_out,
        };
        bestQuote.source = 'ORREN';
        bestQuote.guarantee = 'available';
        bestQuote.pricing = {
          gross_out: pricing.gross_out,
          fee_bps: pricing.fee_bps,
          net_out: pricing.net_out,
          native_out: 'preserved_from_quote',
          improvement_bps: 'preserved_from_quote',
        };
      } else {
        const comparison = await compareToNative(
          source_asset,
          destination_asset,
          amount,
          bestQuote,
          user_address
        );
        
        if (comparison) {
          bestQuote.source = 'ORREN';
          bestQuote.guarantee = 'available';
          bestQuote.native_comparison = comparison;
          
          const feeResult = calculateDynamicFee(
            bestQuote.expected_out,
            comparison.native_expected_out,
            getFeeConfig()
          );
          
          bestQuote.pricing = {
            gross_out: feeResult.gross_out,
            fee_bps: feeResult.fee_bps,
            net_out: feeResult.net_out,
            native_out: feeResult.native_out,
            improvement_bps: feeResult.improvement_bps,
          };
          
          feeInfo = {
            gross_out: feeResult.gross_out,
            fee_bps: feeResult.fee_bps,
            net_out: feeResult.net_out,
          };
        } else {
          bestQuote.source = 'MOCK';
          bestQuote.guarantee = 'unavailable';
        }
      }

      const tx = buildTransaction(
        bestQuote,
        { source_asset, destination_asset, amount },
        user_address,
        { minOut: min_out, slippageBps: slippage_bps, mode, feeInfo }
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
