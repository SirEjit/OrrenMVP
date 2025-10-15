import { z } from "zod";

export const rippleAddr = /^r[1-9A-HJ-NP-Za-km-z]{25,35}$/;

export const currencySchema = z.object({
  currency: z.string().min(3).max(160),
  issuer: z.string().regex(rippleAddr).optional()
}).refine(c => (c.currency === "XRP" ? !c.issuer : !!c.issuer), {
  message: "XRP must not have issuer; IOUs must include issuer"
});

export function safeAmount(s: string, max = 1e9): number {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw new Error("amount out of range");
  return n;
}
