import Decimal from 'decimal.js-light';
import { getClient } from './xrplClient.js';
import { Currency, QuoteResponse } from './types.js';

interface NativeComparisonResult {
  native_expected_out: string;
  our_expected_out: string;
  improvement_bps: string;
  improvement_percent: string;
}

export async function compareToNative(
  sourceAsset: Currency,
  destAsset: Currency,
  amount: string,
  ourQuote: QuoteResponse,
  userAddress: string = 'rN7n7otQDd6FczFgLdlqtyMVrn3NnrcH7C'
): Promise<NativeComparisonResult | null> {
  try {
    const client = await getClient();

    const sendMax = sourceAsset.currency === 'XRP'
      ? new Decimal(amount).mul(1_000_000).toString()
      : {
          currency: sourceAsset.currency,
          issuer: sourceAsset.issuer!,
          value: amount,
        };

    const destAmount = destAsset.currency === 'XRP'
      ? new Decimal(ourQuote.expected_out).mul(1_000_000).toString()
      : {
          currency: destAsset.currency,
          issuer: destAsset.issuer!,
          value: ourQuote.expected_out,
        };

    const pathFindRequest: any = {
      command: 'ripple_path_find',
      source_account: userAddress,
      destination_account: userAddress,
      destination_amount: destAmount,
      send_max: sendMax,
    };

    const response: any = await client.request(pathFindRequest);

    if (!response.result?.alternatives || response.result.alternatives.length === 0) {
      return null;
    }

    const bestNativePath = response.result.alternatives[0];
    let nativeOutput: string;

    if (typeof bestNativePath.destination_amount === 'string') {
      nativeOutput = new Decimal(bestNativePath.destination_amount).div(1_000_000).toString();
    } else {
      nativeOutput = bestNativePath.destination_amount.value;
    }

    const nativeOutputDecimal = new Decimal(nativeOutput);
    const ourOutputDecimal = new Decimal(ourQuote.expected_out);

    const improvement = ourOutputDecimal.sub(nativeOutputDecimal);
    const improvementPercent = improvement.div(nativeOutputDecimal).mul(100);
    const improvementBps = improvementPercent.mul(100);

    return {
      native_expected_out: nativeOutput,
      our_expected_out: ourQuote.expected_out,
      improvement_bps: improvementBps.toFixed(2),
      improvement_percent: improvementPercent.toFixed(4),
    };
  } catch (error) {
    console.error('Error comparing to native pathfinder:', error);
    return null;
  }
}
