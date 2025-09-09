import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connection } from '../../config';

//npx ts-node walletFun.ts
export function generateKeypair(): Keypair {
  return Keypair.generate();
}


export async function getBalance(publicKey: PublicKey): Promise<number> {
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

export async function main(): Promise<void> {
  const keypair = generateKeypair();
  console.log('Public Key:', keypair.publicKey.toBase58());
  console.log('Secret Key (Uint8Array):', Array.from(keypair.secretKey));

  const balance = await getBalance(keypair.publicKey);
  console.log('Balance (SOL):', balance);
}

// Auto-run when executed directly (ts-node walletFun.ts)
// Use typeof checks to avoid requiring Node type definitions
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main().catch((error) => {
    console.error(error);
  });
}
