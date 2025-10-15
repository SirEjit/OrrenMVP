import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getBestQuote, getAllQuotes } from './quotes/index.js';
import { buildTransaction } from './buildTx.js';
import { compareToNative } from './nativeComparison.js';
import { currencySchema, rippleAddr, safeAmount } from './utils/validation.js';
import { computeFeeWithGuarantee } from './utils/fees.js';
import { recordQuoteLatency, recordWin, recordImprovement } from './metrics.js';
import { getFeeConfig } from './fees.js';

const addrSchema = z.string().regex(rippleAddr);

function normalizeAssets(body: any) {
  const from = body.from ?? body.source_asset;
  const to = body.to ?? body.destination_asset;
  if (!from || !to) throw new Error("Missing asset fields: from/to or source_asset/destination_asset");
  return { from, to };
}

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return { ok: true, ts: new Date().toISOString() };
  });

  app.post('/quote', async (request, reply) => {
    const t0 = Date.now();
    try {
      const schema = z.object({
        from: currencySchema.optional(),
        to: currencySchema.optional(),
        source_asset: currencySchema.optional(),
        destination_asset: currencySchema.optional(),
        amount: z.string(),
        user_address: addrSchema.optional()
      });
      const body = schema.parse(request.body);
      const { from, to } = normalizeAssets(body);
      const amountIn = safeAmount(body.amount);

      const quotes = await getAllQuotes({ 
        source_asset: from, 
        destination_asset: to, 
        amount: body.amount 
      });

      if (quotes.length === 0) {
        return reply.status(404).send({
          error: 'No routes found for the given asset pair',
        });
      }

      const bestQuote = quotes[0];
      const orrenGross = Number(bestQuote.expected_out);
      
      // Always attempt native comparison
      const comparison = body.user_address ? await compareToNative(
        from,
        to,
        body.amount,
        bestQuote,
        body.user_address
      ) : null;

      const nativeOut = comparison ? Number(comparison.native_expected_out) : undefined;
      
      // Compute fees with guarantee using the new utility
      const feeConfig = getFeeConfig();
      const { fee_bps, net, improvement_bps } = computeFeeWithGuarantee({ 
        gross: orrenGross, 
        native: nativeOut,
        alpha: feeConfig.alpha,
        min_bps: feeConfig.minFeeBps,
        cap_bps: feeConfig.capFeeBps
      });

      // Update quote with net amount
      bestQuote.expected_out = String(net);
      
      // Always include native_comparison with proper status
      if (comparison && nativeOut !== undefined) {
        bestQuote.source = 'ORREN';
        bestQuote.guarantee = 'available';
        bestQuote.native_comparison = {
          ...comparison,
          improvement_bps: String(improvement_bps ?? 0)
        };
        bestQuote.pricing = {
          gross_out: String(orrenGross),
          fee_bps,
          net_out: String(net),
          native_out: String(nativeOut),
          improvement_bps: String(improvement_bps ?? 0)
        };
        // Add fee_bps_applied to metadata
        (bestQuote as any).fee_bps_applied = fee_bps;
        (bestQuote as any).guarantee_status = "net>=native";
      } else {
        bestQuote.source = 'MOCK';
        bestQuote.guarantee = 'unavailable';
        (bestQuote.native_comparison as any) = {
          status: body.user_address ? "unavailable" : "not_requested",
          reason: body.user_address ? "native comparison failed" : "user_address not provided"
        };
      }

      recordQuoteLatency(Date.now() - t0);
      recordWin(net, nativeOut);
      recordImprovement(improvement_bps);

      return { quotes: [bestQuote, ...quotes.slice(1)] };
    } catch (error: any) {
      console.error('Quote error:', error);
      return reply.status(error.message?.includes('out of range') ? 400 : 500).send({
        error: error.message || 'Internal server error',
      });
    }
  });

  app.post('/build-tx', async (request, reply) => {
    try {
      const schema = z.object({
        from: currencySchema.optional(),
        to: currencySchema.optional(),
        source_asset: currencySchema.optional(),
        destination_asset: currencySchema.optional(),
        amount: z.string(),
        user_address: addrSchema,
        destination_address: addrSchema.optional(),
        min_out: z.string().optional(),
        slippage_bps: z.number().optional(),
        mode: z.enum(["exact_in", "exact_out"]).optional()
      });
      const body = schema.parse(request.body);
      const { from, to } = normalizeAssets(body);
      const amountIn = safeAmount(body.amount);

      const bestQuote = await getBestQuote({
        source_asset: from,
        destination_asset: to,
        amount: body.amount,
      });

      if (!bestQuote) {
        return reply.status(404).send({
          error: 'No route found',
        });
      }

      const orrenGross = Number(bestQuote.expected_out);
      const comparison = await compareToNative(
        from,
        to,
        body.amount,
        bestQuote,
        body.user_address
      );
      
      const nativeOut = comparison ? Number(comparison.native_expected_out) : undefined;
      const feeConfig = getFeeConfig();
      const { fee_bps, net, improvement_bps } = computeFeeWithGuarantee({ 
        gross: orrenGross, 
        native: nativeOut,
        alpha: feeConfig.alpha,
        min_bps: feeConfig.minFeeBps,
        cap_bps: feeConfig.capFeeBps
      });

      let feeInfo;
      if (comparison && nativeOut !== undefined) {
        bestQuote.source = 'ORREN';
        bestQuote.guarantee = 'available';
        bestQuote.native_comparison = {
          ...comparison,
          improvement_bps: String(improvement_bps ?? 0)
        };
        bestQuote.pricing = {
          gross_out: String(orrenGross),
          fee_bps,
          net_out: String(net),
          native_out: String(nativeOut),
          improvement_bps: String(improvement_bps ?? 0)
        };
        (bestQuote as any).fee_bps_applied = fee_bps;
        (bestQuote as any).guarantee_status = "net>=native";
        feeInfo = {
          gross_out: String(orrenGross),
          fee_bps,
          net_out: String(net)
        };
      } else {
        bestQuote.source = 'MOCK';
        bestQuote.guarantee = 'unavailable';
        (bestQuote.native_comparison as any) = {
          status: "unavailable",
          reason: "native comparison failed"
        };
      }

      const tx = buildTransaction(
        bestQuote,
        { source_asset: from, destination_asset: to, amount: body.amount },
        body.user_address,
        { minOut: body.min_out, slippageBps: body.slippage_bps, mode: body.mode, feeInfo }
      );

      return {
        quote: bestQuote,
        txJSON: tx,
      };
    } catch (error: any) {
      console.error('Build transaction error:', error);
      return reply.status(error.message?.includes('out of range') ? 400 : 500).send({
        error: error.message || 'Internal server error',
      });
    }
  });
}
