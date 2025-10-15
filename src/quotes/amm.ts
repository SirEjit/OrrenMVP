import { getAMMInfo } from '../xrplClient.js';
import { Currency, QuoteResponse } from '../types.js';
import { LRUCache } from '../cache.js';
import { config } from '../config.js';

const ammCache = new LRUCache<QuoteResponse>(config.cache.maxSize, config.cache.ttlMs);

export async function getAMMQuote(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string
): Promise<QuoteResponse | null> {
  const cacheKey = `amm:${JSON.stringify(sourceAsset)}:${JSON.stringify(destAsset)}:${amount}`;
  const cached = ammCache.get(cacheKey);
  if (cached) return cached;

  const startTime = Date.now();
  const ammInfo = await getAMMInfo(sourceAsset, destAsset);
  
  if (!ammInfo) return null;

  const amount1 = typeof ammInfo.amount === 'string' 
    ? parseFloat(ammInfo.amount) / 1_000_000
    : parseFloat(ammInfo.amount.value);
  
  const amount2 = typeof ammInfo.amount2 === 'string'
    ? parseFloat(ammInfo.amount2) / 1_000_000
    : parseFloat(ammInfo.amount2.value);

  const inputAmount = parseFloat(amount);
  const k = amount1 * amount2;
  const newAmount1 = amount1 + inputAmount;
  const newAmount2 = k / newAmount1;
  const outputAmount = amount2 - newAmount2;

  const latencyMs = Date.now() - startTime;

  const quote: QuoteResponse = {
    route_type: 'amm',
    expected_out: outputAmount.toFixed(6),
    latency_ms: latencyMs,
    trust_tier: 'high',
    score: 0,
    metadata: {
      amm_account: ammInfo.amm_account,
    },
  };

  ammCache.set(cacheKey, quote);
  return quote;
}
