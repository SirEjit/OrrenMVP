import { getAMMQuote } from './amm.js';
import { getCLOBQuote } from './clob.js';
import { getXRPBridgeQuote } from './xrpBridge.js';
import { QuoteRequest, QuoteResponse } from '../types.js';
import { calculateScore } from '../scoring.js';

export async function getAllQuotes(request: QuoteRequest): Promise<QuoteResponse[]> {
  const quotes: QuoteResponse[] = [];

  const isIouToIou = request.source_asset.currency !== 'XRP' && request.destination_asset.currency !== 'XRP';

  const quotePromises = [
    getAMMQuote(request.source_asset, request.destination_asset, request.amount),
    getCLOBQuote(request.source_asset, request.destination_asset, request.amount),
  ];

  if (isIouToIou) {
    quotePromises.push(getXRPBridgeQuote(request.source_asset, request.destination_asset, request.amount));
  }

  const results = await Promise.all(quotePromises);

  for (const quote of results) {
    if (quote) {
      quote.score = calculateScore(quote);
      quotes.push(quote);
    }
  }

  quotes.sort((a, b) => b.score - a.score);

  return quotes;
}

export async function getBestQuote(request: QuoteRequest): Promise<QuoteResponse | null> {
  const quotes = await getAllQuotes(request);
  return quotes.length > 0 ? quotes[0] : null;
}
