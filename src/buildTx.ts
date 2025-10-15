import { QuoteResponse, QuoteRequest } from './types.js';

export interface TransactionBlueprint {
  TransactionType: string;
  Account: string;
  Amount: string | {
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

export function buildTransaction(
  quote: QuoteResponse,
  request: QuoteRequest,
  userAddress: string
): TransactionBlueprint {
  if (quote.route_type === 'amm') {
    return {
      TransactionType: 'Payment',
      Account: userAddress,
      Amount: quote.metadata?.amm_account
        ? {
            currency: request.destination_asset.currency,
            issuer: request.destination_asset.issuer || '',
            value: quote.expected_out,
          }
        : quote.expected_out,
      SendMax: {
        currency: request.source_asset.currency,
        issuer: request.source_asset.issuer || '',
        value: request.amount,
      },
      Destination: quote.metadata?.amm_account || userAddress,
    };
  }

  return {
    TransactionType: 'OfferCreate',
    Account: userAddress,
    TakerGets: {
      currency: request.destination_asset.currency,
      issuer: request.destination_asset.issuer || '',
      value: quote.expected_out,
    },
    TakerPays: {
      currency: request.source_asset.currency,
      issuer: request.source_asset.issuer || '',
      value: request.amount,
    },
  };
}
