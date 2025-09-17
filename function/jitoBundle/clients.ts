import {
    SearcherClient,
    searcherClient as jitoSearcherClient,
  } from 'jito-ts/dist/sdk/block-engine/searcher.js';
import { block_engine_urls } from '../../config';


const BLOCK_ENGINE_URLS =  block_engine_urls;

let searcherClients: SearcherClient[] = [];
let searcherClient: SearcherClient;

async function initSearcherClient(): Promise<void> {
  searcherClients = [];
  for (const url of BLOCK_ENGINE_URLS) {
    const client = jitoSearcherClient(url, undefined, {
      'grpc.keepalive_timeout_ms': 4000,
    });
    searcherClients.push(client);
  }
  searcherClient = searcherClients[0];
}

void initSearcherClient();

export { searcherClient, searcherClients };