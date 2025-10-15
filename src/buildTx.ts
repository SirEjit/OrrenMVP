import { QuoteResponse, QuoteRequest, Currency } from './types.js';

export interface TransactionBlueprint {
  TransactionType: string;
  Account: string;
  Amount?: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  SendMax?: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  Destination?: string;
  TakerGets?: string | {
    currency: string;
    issuer: string;
    value: string;
  };
  TakerPays?: string | {
    currency: string;
    issuer: string;
    value: string;
  };
}

function formatAmount(currency: Currency, amount: string): string | { currency: string; issuer: string; value: string } {
  if (currency.currency === 'XRP') {
    const drops = Math.floor(parseFloat(amount) * 1_000_000).toString();
    return drops;
  }
  
  if (!currency.issuer) {
    throw new Error(`Issued currency ${currency.currency} requires an issuer`);
  }
  
  return {
    currency: currency.currency,
    issuer: currency.issuer,
    value: amount,
  };
}

export function buildTransaction(
  quote: QuoteResponse,
  request: QuoteRequest,
  userAddress: string
): TransactionBlueprint | TransactionBlueprint[] {
  if (quote.route_type === 'xrp-bridge' || quote.route_type === 'hybrid-amm-clob' || quote.route_type === 'hybrid-clob-amm') {
    if (!quote.metadata?.leg1 || !quote.metadata?.leg2) {
      throw new Error(`${quote.route_type} route missing leg information`);
    }

    const XRP_CURRENCY: Currency = { currency: 'XRP' };
    
    const tx1 = buildTransaction(
      quote.metadata.leg1,
      { source_asset: request.source_asset, destination_asset: XRP_CURRENCY, amount: request.amount },
      userAddress
    );
    
    const tx2 = buildTransaction(
      quote.metadata.leg2,
      { source_asset: XRP_CURRENCY, destination_asset: request.destination_asset, amount: quote.metadata.leg1.expected_out },
      userAddress
    );

    return [tx1 as TransactionBlueprint, tx2 as TransactionBlueprint];
  }

  if (quote.route_type === 'amm') {
    return {
      TransactionType: 'Payment',
      Account: userAddress,
      Amount: formatAmount(request.destination_asset, quote.expected_out),
      SendMax: formatAmount(request.source_asset, request.amount),
      Destination: quote.metadata?.amm_account || userAddress,
    };
  }

  return {
    TransactionType: 'OfferCreate',
    Account: userAddress,
    TakerGets: formatAmount(request.destination_asset, quote.expected_out),
    TakerPays: formatAmount(request.source_asset, request.amount),
  };
}
