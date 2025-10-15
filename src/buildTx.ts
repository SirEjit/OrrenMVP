import Decimal from 'decimal.js-light';
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
  DeliverMin?: string | {
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
  Flags?: number;
}

export interface BuildTransactionOptions {
  minOut?: string;
  slippageBps?: number;
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

const TF_FILL_OR_KILL = 0x00000004;

function calculateMinOut(expectedOut: string, options?: BuildTransactionOptions): string {
  if (options?.minOut) {
    return options.minOut;
  }
  
  if (options?.slippageBps) {
    const slippageDecimal = new Decimal(options.slippageBps).div(10000);
    const minOut = new Decimal(expectedOut).mul(new Decimal(1).sub(slippageDecimal));
    return minOut.toString();
  }
  
  return expectedOut;
}

export function buildTransaction(
  quote: QuoteResponse,
  request: QuoteRequest,
  userAddress: string,
  options?: BuildTransactionOptions
): TransactionBlueprint | TransactionBlueprint[] {
  if (quote.route_type === 'xrp-bridge' || quote.route_type === 'hybrid-amm-clob' || quote.route_type === 'hybrid-clob-amm') {
    if (!quote.metadata?.leg1 || !quote.metadata?.leg2) {
      throw new Error(`${quote.route_type} route missing leg information`);
    }

    const XRP_CURRENCY: Currency = { currency: 'XRP' };
    
    const tx1 = buildTransaction(
      quote.metadata.leg1,
      { source_asset: request.source_asset, destination_asset: XRP_CURRENCY, amount: request.amount },
      userAddress,
      options
    );
    
    const tx2 = buildTransaction(
      quote.metadata.leg2,
      { source_asset: XRP_CURRENCY, destination_asset: request.destination_asset, amount: quote.metadata.leg1.expected_out },
      userAddress,
      options
    );

    return [tx1 as TransactionBlueprint, tx2 as TransactionBlueprint];
  }

  if (quote.route_type === 'amm') {
    const tx: TransactionBlueprint = {
      TransactionType: 'Payment',
      Account: userAddress,
      Amount: formatAmount(request.destination_asset, quote.expected_out),
      SendMax: formatAmount(request.source_asset, request.amount),
      Destination: quote.metadata?.amm_account || userAddress,
    };
    
    if (options?.minOut || options?.slippageBps) {
      const minOut = calculateMinOut(quote.expected_out, options);
      tx.DeliverMin = formatAmount(request.destination_asset, minOut);
    }
    
    return tx;
  }

  const tx: TransactionBlueprint = {
    TransactionType: 'OfferCreate',
    Account: userAddress,
    TakerGets: formatAmount(request.destination_asset, quote.expected_out),
    TakerPays: formatAmount(request.source_asset, request.amount),
  };
  
  if (options?.minOut || options?.slippageBps) {
    tx.Flags = TF_FILL_OR_KILL;
  }
  
  return tx;
}
