import Decimal from 'decimal.js-light';
import { getAMMQuote } from './amm.js';
import { getCLOBQuote } from './clob.js';
import { Currency, QuoteResponse } from '../types.js';

const XRP_CURRENCY: Currency = { currency: 'XRP' };

async function getBestQuoteForLeg(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string
): Promise<QuoteResponse | null> {
  const [ammQuote, clobQuote] = await Promise.all([
    getAMMQuote(sourceAsset, destAsset, amount),
    getCLOBQuote(sourceAsset, destAsset, amount),
  ]);

  if (!ammQuote && !clobQuote) return null;
  if (!ammQuote) return clobQuote;
  if (!clobQuote) return ammQuote;

  const ammOutput = new Decimal(ammQuote.expected_out);
  const clobOutput = new Decimal(clobQuote.expected_out);

  return ammOutput.gt(clobOutput) ? ammQuote : clobQuote;
}

export async function getXRPBridgeQuote(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string
): Promise<QuoteResponse | null> {
  if (sourceAsset.currency === 'XRP' || destAsset.currency === 'XRP') {
    return null;
  }

  const startTime = Date.now();

  const leg1Quote = await getBestQuoteForLeg(sourceAsset, XRP_CURRENCY, amount);
  if (!leg1Quote) return null;

  const leg2Quote = await getBestQuoteForLeg(XRP_CURRENCY, destAsset, leg1Quote.expected_out);
  if (!leg2Quote) return null;

  const latencyMs = Date.now() - startTime;

  const quote: QuoteResponse = {
    route_type: 'xrp-bridge',
    expected_out: leg2Quote.expected_out,
    latency_ms: latencyMs,
    trust_tier: 'high',
    score: 0,
    metadata: {
      leg1: leg1Quote,
      leg2: leg2Quote,
    },
  };

  return quote;
}
