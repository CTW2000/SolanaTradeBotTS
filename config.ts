import { Connection, Keypair, PublicKey } from "@solana/web3.js"

export const rpc = 'https://devnet.helius-rpc.com/?api-key=323bbf75-3d84-4395-8ba4-2a503c4c4909'; // ENTER YOUR RPC

export const connection = new Connection(rpc, {
  commitment: 'confirmed',
});