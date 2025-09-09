import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connection } from '../../config';
import { loadMainKeypair, storeMainKeypair } from '../../sqllite/Manager/keypairStore';


//npx ts-node walletFun.ts
export async function generateMainWallet(): Promise<void> {
  const keypair = Keypair.generate();
  const insertedId = await storeMainKeypair(keypair.publicKey.toBase58(), keypair.secretKey);
  console.log('Generated and set main wallet with id:', insertedId);
}

export async function getMainWallet(): Promise<Keypair | null> {
  const keypair = await loadMainKeypair();
  return keypair ? Keypair.fromSecretKey(keypair.secretKey) : null;
}

export async function getBalance(publicKey: PublicKey): Promise<number> {
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}













export async function main(): Promise<void> {

  const mainWallet = await getMainWallet();
  console.log('Main wallet:', mainWallet?.publicKey.toBase58());
  const balance = await getBalance(mainWallet?.publicKey as PublicKey);
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
