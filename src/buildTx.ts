import Decimal from 'decimal.js-light';
import { QuoteResponse, QuoteRequest, Currency } from './types.js';
import { config } from './config.js';

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
  mode?: 'exact_in' | 'exact_out';
  feeInfo?: {
    gross_out: string;
    fee_bps: number;
    net_out: string;
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

const TF_PARTIAL_PAYMENT = 0x00020000;
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

function buildFeePayment(
  userAddress: string,
  destinationCurrency: Currency,
  grossOut: string,
  feeBps: number
): TransactionBlueprint {
  const feeAmount = new Decimal(grossOut).mul(feeBps).div(10000);
  
  return {
    TransactionType: 'Payment',
    Account: userAddress,
    Destination: config.fees.orrenAddress,
    Amount: formatAmount(destinationCurrency, feeAmount.toString()),
  };
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
      { minOut: options?.minOut, slippageBps: options?.slippageBps, mode: options?.mode }
    );
    
    const tx2Result = buildTransaction(
      quote.metadata.leg2,
      { source_asset: XRP_CURRENCY, destination_asset: request.destination_asset, amount: quote.metadata.leg1.expected_out },
      userAddress,
      { minOut: options?.minOut, slippageBps: options?.slippageBps, mode: options?.mode, feeInfo: options?.feeInfo }
    );

    if (Array.isArray(tx2Result)) {
      return [tx1 as TransactionBlueprint, ...tx2Result];
    }
    
    return [tx1 as TransactionBlueprint, tx2Result as TransactionBlueprint];
  }

  if (quote.route_type === 'amm') {
    const mode = options?.mode || 'exact_in';
    const deliverAmount = options?.feeInfo?.gross_out || quote.expected_out;
    
    if (mode === 'exact_out') {
      const sendMaxBuffer = new Decimal(request.amount).mul(1.02);
      const tx: TransactionBlueprint = {
        TransactionType: 'Payment',
        Account: userAddress,
        Amount: formatAmount(request.destination_asset, deliverAmount),
        SendMax: formatAmount(request.source_asset, sendMaxBuffer.toString()),
        Destination: userAddress,
        DeliverMin: formatAmount(request.destination_asset, deliverAmount),
        Flags: TF_PARTIAL_PAYMENT,
      };
      
      if (options?.feeInfo) {
        const feeTx = buildFeePayment(
          userAddress,
          request.destination_asset,
          options.feeInfo.gross_out,
          options.feeInfo.fee_bps
        );
        return [tx, feeTx];
      }
      
      return tx;
    }
    
    const tx: TransactionBlueprint = {
      TransactionType: 'Payment',
      Account: userAddress,
      Amount: formatAmount(request.destination_asset, deliverAmount),
      SendMax: formatAmount(request.source_asset, request.amount),
      Destination: userAddress,
    };
    
    const minOut = options?.feeInfo?.net_out || calculateMinOut(quote.expected_out, options);
    
    if (options?.minOut || options?.slippageBps || options?.feeInfo) {
      tx.DeliverMin = formatAmount(request.destination_asset, minOut);
      tx.Flags = TF_PARTIAL_PAYMENT;
    }
    
    if (options?.feeInfo) {
      const feeTx = buildFeePayment(
        userAddress,
        request.destination_asset,
        options.feeInfo.gross_out,
        options.feeInfo.fee_bps
      );
      return [tx, feeTx];
    }
    
    return tx;
  }

  const mode = options?.mode || 'exact_in';
  const deliverAmount = options?.feeInfo?.gross_out || quote.expected_out;
  
  if (mode === 'exact_out') {
    const sendMaxBuffer = new Decimal(request.amount).mul(1.02);
    const tx: TransactionBlueprint = {
      TransactionType: 'OfferCreate',
      Account: userAddress,
      TakerGets: formatAmount(request.destination_asset, deliverAmount),
      TakerPays: formatAmount(request.source_asset, sendMaxBuffer.toString()),
      Flags: TF_FILL_OR_KILL,
    };
    
    if (options?.feeInfo) {
      const feeTx = buildFeePayment(
        userAddress,
        request.destination_asset,
        options.feeInfo.gross_out,
        options.feeInfo.fee_bps
      );
      return [tx, feeTx];
    }
    
    return tx;
  }
  
  const tx: TransactionBlueprint = {
    TransactionType: 'OfferCreate',
    Account: userAddress,
    TakerGets: formatAmount(request.destination_asset, deliverAmount),
    TakerPays: formatAmount(request.source_asset, request.amount),
  };
  
  if (options?.minOut || options?.slippageBps) {
    tx.Flags = TF_FILL_OR_KILL;
  }
  
  if (options?.feeInfo) {
    const feeTx = buildFeePayment(
      userAddress,
      request.destination_asset,
      options.feeInfo.gross_out,
      options.feeInfo.fee_bps
    );
    return [tx, feeTx];
  }
  
  return tx;
}
