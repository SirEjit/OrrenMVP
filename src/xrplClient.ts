import { Client, BookOffersRequest, AMMInfoRequest } from 'xrpl';
import { config } from './config.js';
import { Currency, OrderBookOffer, AMMInfo } from './types.js';

let client: Client | null = null;

export async function getClient(): Promise<Client> {
  if (!client) {
    client = new Client(config.xrpl.server);
    await client.connect();
  }
  
  if (!client.isConnected()) {
    await client.connect();
  }
  
  return client;
}

export async function getOrderBook(
  takerGets: Currency,
  takerPays: Currency
): Promise<OrderBookOffer[]> {
  const xrplClient = await getClient();
  
  const request: BookOffersRequest = {
    command: 'book_offers',
    taker_gets: takerGets,
    taker_pays: takerPays,
    limit: 10,
  };

  const response = await xrplClient.request(request);
  return response.result.offers || [];
}

export async function getAMMInfo(
  asset: Currency,
  asset2: Currency
): Promise<AMMInfo | null> {
  const xrplClient = await getClient();
  
  try {
    const request: AMMInfoRequest = {
      command: 'amm_info',
      asset: asset,
      asset2: asset2,
    };

    const response = await xrplClient.request(request);
    return response.result.amm as AMMInfo;
  } catch (error) {
    return null;
  }
}

export async function disconnectClient(): Promise<void> {
  if (client && client.isConnected()) {
    await client.disconnect();
    client = null;
  }
}
