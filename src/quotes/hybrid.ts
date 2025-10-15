import Decimal from 'decimal.js-light';
import { getAMMQuote } from './amm.js';
import { getCLOBQuote } from './clob.js';
import { Currency, QuoteResponse } from '../types.js';

const XRP_CURRENCY: Currency = { currency: 'XRP' };

export async function getHybridQuote(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string
): Promise<QuoteResponse | null> {
  if (sourceAsset.currency === 'XRP' || destAsset.currency === 'XRP') {
    return null;
  }

  const startTime = Date.now();

  const [ammClobQuote, clobAmmQuote] = await Promise.all([
    tryAmmThenClob(sourceAsset, destAsset, amount),
    tryClobThenAmm(sourceAsset, destAsset, amount),
  ]);

  const latencyMs = Date.now() - startTime;

  if (!ammClobQuote && !clobAmmQuote) return null;
  if (!ammClobQuote) return { ...clobAmmQuote!, latency_ms: latencyMs };
  if (!clobAmmQuote) return { ...ammClobQuote!, latency_ms: latencyMs };

  const ammClobOutput = new Decimal(ammClobQuote.expected_out);
  const clobAmmOutput = new Decimal(clobAmmQuote.expected_out);

  const bestQuote = ammClobOutput.gt(clobAmmOutput) ? ammClobQuote : clobAmmQuote;
  return { ...bestQuote, latency_ms: latencyMs };
}

async function tryAmmThenClob(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string
): Promise<QuoteResponse | null> {
  const leg1 = await getAMMQuote(sourceAsset, XRP_CURRENCY, amount);
  if (!leg1) return null;

  const leg2 = await getCLOBQuote(XRP_CURRENCY, destAsset, leg1.expected_out);
  if (!leg2) return null;

  return {
    route_type: 'hybrid-amm-clob',
    expected_out: leg2.expected_out,
    latency_ms: 0,
    trust_tier: 'high',
    score: 0,
    metadata: {
      leg1,
      leg2,
    },
  };
}

async function tryClobThenAmm(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string
): Promise<QuoteResponse | null> {
  const leg1 = await getCLOBQuote(sourceAsset, XRP_CURRENCY, amount);
  if (!leg1) return null;

  const leg2 = await getAMMQuote(XRP_CURRENCY, destAsset, leg1.expected_out);
  if (!leg2) return null;

  return {
    route_type: 'hybrid-clob-amm',
    expected_out: leg2.expected_out,
    latency_ms: 0,
    trust_tier: 'high',
    score: 0,
    metadata: {
      leg1,
      leg2,
    },
  };
}
