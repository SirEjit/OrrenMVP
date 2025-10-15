import Decimal from 'decimal.js-light';
import { config } from './config.js';

export interface FeeCalculationResult {
  improvement_bps: string;
  fee_bps: number;
  gross_out: string;
  net_out: string;
  native_out: string;
}

export interface FeeConfig {
  alpha: number;
  minFeeBps: number;
  capFeeBps: number;
}

const DEFAULT_FEE_CONFIG: FeeConfig = {
  alpha: 0.5,
  minFeeBps: 1,
  capFeeBps: 5,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateDynamicFee(
  grossOut: string,
  nativeOut: string,
  feeConfig: FeeConfig = DEFAULT_FEE_CONFIG
): FeeCalculationResult {
  const grossDecimal = new Decimal(grossOut);
  const nativeDecimal = new Decimal(nativeOut);

  const improvementRatio = grossDecimal.div(nativeDecimal).sub(1);
  const improvementBps = improvementRatio.mul(10_000);

  let feeBps = Math.floor(improvementBps.toNumber() * feeConfig.alpha);
  
  feeBps = clamp(feeBps, feeConfig.minFeeBps, feeConfig.capFeeBps);

  const netDecimal = grossDecimal.mul(new Decimal(1).sub(new Decimal(feeBps).div(10_000)));

  if (netDecimal.lt(nativeDecimal)) {
    feeBps = 0;
  }

  const finalNetDecimal = grossDecimal.mul(new Decimal(1).sub(new Decimal(feeBps).div(10_000)));

  return {
    improvement_bps: improvementBps.toFixed(2),
    fee_bps: feeBps,
    gross_out: grossOut,
    net_out: finalNetDecimal.toString(),
    native_out: nativeOut,
  };
}

export function getFeeConfig(): FeeConfig {
  return {
    alpha: parseFloat(process.env.FEE_ALPHA || '0.5'),
    minFeeBps: parseInt(process.env.FEE_MIN_BPS || '1'),
    capFeeBps: parseInt(process.env.FEE_CAP_BPS || '5'),
  };
}
