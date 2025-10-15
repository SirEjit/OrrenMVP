export interface Currency {
  currency: string;
  issuer?: string;
}

export interface QuoteRequest {
  source_asset: Currency;
  destination_asset: Currency;
  amount: string;
}

export interface QuoteResponse {
  route_type: 'amm' | 'clob' | 'xrp-bridge' | 'hybrid-amm-clob' | 'hybrid-clob-amm' | 'cross-chain-axelar' | 'cross-chain-wormhole';
  expected_out: string;
  latency_ms: number;
  trust_tier: 'high' | 'medium' | 'low';
  score: number;
  source?: 'ORREN' | 'NATIVE' | 'MOCK';
  guarantee?: 'available' | 'unavailable';
  metadata?: {
    amm_account?: string;
    taker_gets?: string;
    taker_pays?: string;
    quality?: string;
    trading_fee?: string;
    leg1?: QuoteResponse;
    leg2?: QuoteResponse;
    bridge_fee?: string;
    destination_chain?: string;
  };
  native_comparison?: {
    native_expected_out: string;
    our_expected_out: string;
    improvement_bps: string;
    improvement_percent: string;
  };
  pricing?: {
    gross_out: string;
    fee_bps: number;
    net_out: string;
    native_out: string;
    improvement_bps: string;
  };
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

export interface OrderBookOffer {
  TakerGets: string | { currency: string; issuer: string; value: string };
  TakerPays: string | { currency: string; issuer: string; value: string };
  quality?: string;
}

export interface AMMInfo {
  amm_account: string;
  amount: string | { currency: string; issuer: string; value: string };
  amount2: string | { currency: string; issuer: string; value: string };
  lp_token: {
    currency: string;
    issuer: string;
    value: string;
  };
  trading_fee?: number;
}
