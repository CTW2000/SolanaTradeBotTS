import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connection } from '../../config';
import { loadMainKeypair, storeMainKeypair, storeLabeledKeypair, loadLabeledKeypairs } from '../../sqllite/Manager/keypairStore';


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

export async function generateMarketWallet(count: number = 1, label: string = 'market'): Promise<void> {
  const toCreate = Math.max(0, Math.floor(count));
  for (let i = 0; i < toCreate; i++) {
    const keypair = Keypair.generate();
    const insertedId = await storeLabeledKeypair(keypair.publicKey.toBase58(), keypair.secretKey, label);
    console.log(`Generated and stored ${label} wallet #${i + 1} with id:`, insertedId);
  }
}

export async function generateTokenWallet(count: number = 1, label: string = 'token'): Promise<void> {
  const toCreate = Math.max(0, Math.floor(count));
  for (let i = 0; i < toCreate; i++) {
    const keypair = Keypair.generate();
    const insertedId = await storeLabeledKeypair(keypair.publicKey.toBase58(), keypair.secretKey, label);
    console.log(`Generated and stored ${label} wallet #${i + 1} with id:`, insertedId);
  }
}

export async function loadMarketWallets(limit?: number): Promise<Keypair[]> {
  const loaded = await loadLabeledKeypairs('market', limit);
  return loaded
    .filter((l) => l.secretKey.length > 0)
    .map((l) => Keypair.fromSecretKey(l.secretKey));
}

export async function loadTokenWallets(limit?: number): Promise<Keypair[]> {
  const loaded = await loadLabeledKeypairs('token', limit);
  return loaded
    .filter((l) => l.secretKey.length > 0)
    .map((l) => Keypair.fromSecretKey(l.secretKey));
}








