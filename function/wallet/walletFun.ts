import { Keypair } from '@solana/web3.js';




//npx ts-node walletFun.ts
export function generateKeypair(): Keypair {
  return Keypair.generate();
}





export function main(): void {
  const keypair = generateKeypair();
  console.log('Public Key:', keypair.publicKey.toBase58());
  console.log('Secret Key (Uint8Array):', Array.from(keypair.secretKey));
}

// Auto-run when executed directly (ts-node walletFun.ts)
// Use typeof checks to avoid requiring Node type definitions
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  main();
}
