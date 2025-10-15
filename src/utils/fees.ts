export type FeeParams = { gross: number; native?: number; alpha?: number; min_bps?: number; cap_bps?: number };

/**
 * Compute dynamic routing fee from improvement, with guarantee that net >= native.
 * Returns { fee_bps, net }.
 */
export function computeFeeWithGuarantee(p: FeeParams): { fee_bps: number; net: number; improvement_bps?: number } {
  const { gross, native, alpha = 0.5, min_bps = 1, cap_bps = 5 } = p;
  if (!native || native <= 0 || !Number.isFinite(native)) {
    const fee_bps = Math.max(0, Math.min(cap_bps, min_bps));
    const net = gross * (1 - fee_bps / 10_000);
    return { fee_bps, net };
  }
  const improvement_bps = Math.max(0, 10_000 * (gross / native - 1));
  let fee_bps = Math.min(cap_bps, Math.max(min_bps, Math.floor(improvement_bps * alpha)));
  let net = gross * (1 - fee_bps / 10_000);

  if (net < native) {
    const needed = Math.ceil(10_000 * (1 - native / gross)); // bps needed to equal native
    fee_bps = Math.max(0, Math.min(fee_bps, Math.max(0, needed)));
    net = gross * (1 - fee_bps / 10_000);
  }
  if (net < native) { // still worse? no fee.
    fee_bps = 0;
    net = gross;
  }
  return { fee_bps, net, improvement_bps };
}
