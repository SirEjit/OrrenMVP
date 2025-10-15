import Decimal from 'decimal.js-light';
import { QuoteResponse } from './types.js';

const TRUST_WEIGHTS = {
  high: 1.0,
  medium: 0.8,
  low: 0.5,
} as const;

const LATENCY_THRESHOLD_MS = 100;

export function calculateScore(quote: QuoteResponse): number {
  const expectedOut = new Decimal(quote.expected_out);
  const trustWeight = new Decimal(TRUST_WEIGHTS[quote.trust_tier]);
  
  const latencyPenaltyFactor = new Decimal(quote.latency_ms)
    .div(LATENCY_THRESHOLD_MS)
    .mul(0.2);
  
  const latencyPenaltyCalc = new Decimal(1).sub(latencyPenaltyFactor);
  const latencyPenalty = latencyPenaltyCalc.lt(0) ? new Decimal(0) : latencyPenaltyCalc;
  
  const score = expectedOut.mul(trustWeight).mul(latencyPenalty);
  
  return parseFloat(score.toFixed(6));
}
