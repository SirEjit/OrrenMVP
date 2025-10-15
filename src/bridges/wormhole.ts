import Decimal from 'decimal.js-light';
import { Currency, QuoteResponse } from '../types.js';

const WORMHOLE_FEE_BPS = 12;

export async function getWormholeQuote(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string,
  destinationChain: string = 'ethereum'
): Promise<QuoteResponse | null> {
  const startTime = Date.now();

  const inputAmount = new Decimal(amount);
  const feeBps = new Decimal(WORMHOLE_FEE_BPS);
  const feeAmount = inputAmount.mul(feeBps).div(10000);
  const outputAmount = inputAmount.sub(feeAmount);

  const latencyMs = Date.now() - startTime;

  return {
    route_type: 'cross-chain-wormhole',
    expected_out: outputAmount.toString(),
    latency_ms: latencyMs,
    trust_tier: 'medium',
    score: 0,
    metadata: {
      bridge_fee: feeAmount.toString(),
      destination_chain: destinationChain,
    },
  };
}
