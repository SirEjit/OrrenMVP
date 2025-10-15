import { getOrderBook } from '../xrplClient.js';
import { Currency, QuoteResponse, OrderBookOffer } from '../types.js';
import { LRUCache } from '../cache.js';
import { config } from '../config.js';

const clobCache = new LRUCache<QuoteResponse>(config.cache.maxSize, config.cache.ttlMs);

function normalizeAmount(amount: string | { value: string }): number {
  if (typeof amount === 'string') {
    return parseFloat(amount) / 1_000_000;
  }
  return parseFloat(amount.value);
}

export async function getCLOBQuote(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string
): Promise<QuoteResponse | null> {
  const cacheKey = `clob:${JSON.stringify(sourceAsset)}:${JSON.stringify(destAsset)}:${amount}`;
  const cached = clobCache.get(cacheKey);
  if (cached) return cached;

  const startTime = Date.now();
  const offers = await getOrderBook(sourceAsset, destAsset);
  
  if (!offers || offers.length === 0) return null;

  const bestOffer = offers[0];
  const takerGetsAmount = normalizeAmount(bestOffer.TakerGets);
  const takerPaysAmount = normalizeAmount(bestOffer.TakerPays);
  
  const inputAmount = parseFloat(amount);
  const rate = takerGetsAmount / takerPaysAmount;
  const expectedOut = inputAmount * rate;

  const latencyMs = Date.now() - startTime;

  const quote: QuoteResponse = {
    route_type: 'clob',
    expected_out: expectedOut.toFixed(6),
    latency_ms: latencyMs,
    trust_tier: 'medium',
    score: 0,
    metadata: {
      taker_gets: takerGetsAmount.toString(),
      taker_pays: takerPaysAmount.toString(),
      quality: bestOffer.quality,
    },
  };

  clobCache.set(cacheKey, quote);
  return quote;
}
