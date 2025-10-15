import { QuoteResponse } from './types.js';

const TRUST_WEIGHTS = {
  high: 1.0,
  medium: 0.8,
  low: 0.5,
} as const;

const LATENCY_THRESHOLD_MS = 100;

export function calculateScore(quote: QuoteResponse): number {
  const expectedOut = parseFloat(quote.expected_out);
  const trustWeight = TRUST_WEIGHTS[quote.trust_tier];
  const latencyPenalty = Math.max(0, 1 - (quote.latency_ms / LATENCY_THRESHOLD_MS) * 0.2);
  
  const score = expectedOut * trustWeight * latencyPenalty;
  
  return parseFloat(score.toFixed(6));
}
