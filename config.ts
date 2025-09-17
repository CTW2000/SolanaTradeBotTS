import { Connection } from "@solana/web3.js"




export const cluster = 'devnet' // 'mainnet' | 'devnet'
export const rpc = 'https://devnet.helius-rpc.com/?api-key=323bbf75-3d84-4395-8ba4-2a503c4c4909'; // ENTER YOUR RPC
//https://api.testnet.solana.com
//https://devnet.helius-rpc.com/?api-key=323bbf75-3d84-4395-8ba4-2a503c4c4909

export const connection = new Connection(rpc, {
  commitment: 'confirmed',
});

export const TOKEN_METADATA = {
  name: 'CTW2000',
  symbol: 'CTW',
  uri: 'https://black-decisive-condor-99.mypinata.cloud/ipfs/bafkreihijphze2wqnzkgkeech4sqlln7b62lgjxwc5lan5eqxqsggzjw54',
  sellerFeeBasisPoints: 0,
};

export const TOKEN_CONFIG = {
  decimals: 9,
  initialSupply: 1_000_000,
};

export const block_engine_urls = ['dallas.testnet.block-engine.jito.wtf:443'];
