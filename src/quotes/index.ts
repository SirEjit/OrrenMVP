import { getAMMQuote } from './amm.js';
import { getCLOBQuote } from './clob.js';
import { QuoteRequest, QuoteResponse } from '../types.js';
import { calculateScore } from '../scoring.js';

export async function getAllQuotes(request: QuoteRequest): Promise<QuoteResponse[]> {
  const quotes: QuoteResponse[] = [];

  const [ammQuote, clobQuote] = await Promise.all([
    getAMMQuote(request.source_asset, request.destination_asset, request.amount),
    getCLOBQuote(request.source_asset, request.destination_asset, request.amount),
  ]);

  if (ammQuote) {
    ammQuote.score = calculateScore(ammQuote);
    quotes.push(ammQuote);
  }

  if (clobQuote) {
    clobQuote.score = calculateScore(clobQuote);
    quotes.push(clobQuote);
  }

  quotes.sort((a, b) => b.score - a.score);

  return quotes;
}

export async function getBestQuote(request: QuoteRequest): Promise<QuoteResponse | null> {
  const quotes = await getAllQuotes(request);
  return quotes.length > 0 ? quotes[0] : null;
}
