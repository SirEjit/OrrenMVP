import Decimal from 'decimal.js-light';
import { getAMMInfo } from '../xrplClient.js';
import { Currency, QuoteResponse } from '../types.js';
import { LRUCache } from '../cache.js';
import { config } from '../config.js';

const ammCache = new LRUCache<QuoteResponse>(config.cache.maxSize, config.cache.ttlMs);

const DEFAULT_TRADING_FEE = 30;

function normalizeAmount(amount: string | { value: string }): Decimal {
  if (typeof amount === 'string') {
    return new Decimal(amount).div(1_000_000);
  }
  return new Decimal(amount.value);
}

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

  const amount1 = normalizeAmount(ammInfo.amount);
  const amount2 = normalizeAmount(ammInfo.amount2);
  const inputAmount = new Decimal(amount);
  
  const tradingFeeRaw = ammInfo.trading_fee ?? DEFAULT_TRADING_FEE;
  const tradingFee = new Decimal(tradingFeeRaw).div(100000);
  
  const inputAfterFee = inputAmount.mul(new Decimal(1).sub(tradingFee));
  const k = amount1.mul(amount2);
  const newAmount1 = amount1.add(inputAfterFee);
  const newAmount2 = k.div(newAmount1);
  const outputAmount = amount2.sub(newAmount2);

  const latencyMs = Date.now() - startTime;

  const quote: QuoteResponse = {
    route_type: 'amm',
    expected_out: outputAmount.toFixed(),
    latency_ms: latencyMs,
    trust_tier: 'high',
    score: 0,
    metadata: {
      amm_account: ammInfo.amm_account,
      trading_fee: tradingFee.mul(100).toFixed(4),
    },
  };

  ammCache.set(cacheKey, quote);
  return quote;
}
