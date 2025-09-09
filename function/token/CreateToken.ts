import {
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  PublicKey,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token';
import { createCreateMetadataAccountV3Instruction } from '@metaplex-foundation/mpl-token-metadata';
import { connection, TOKEN_METADATA, TOKEN_CONFIG } from '../../config';
import { TOKEN_METADATA_PROGRAM_ID } from '../../constants';
import { loadMainKeypair } from '../../sqllite/Manager/keypairStore';
import { storeToken, loadCurrentToken } from '../../sqllite/Manager/tokenStore';

const TOKEN_METADATA_PROGRAM_ID_PUBKEY = new PublicKey(TOKEN_METADATA_PROGRAM_ID);



//npx ts-node /root/ListenInRust/SolanaTradeBotTS/function/token/CreateToken.ts



function parsePrivateKey(input: string | number[] | Uint8Array): Uint8Array {
  if (typeof input === 'string') {
    const hex = input.trim();
    const bytes = hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [];
    return new Uint8Array(bytes);
  }
  return Uint8Array.from(input);
}

export async function createTokenWithMetadata(privateKey: string | number[] | Uint8Array): Promise<{
  success: boolean;
  signature?: string;
  mint?: string;
  metadata?: string;
  tokenAccount?: string;
  explorerUrl?: string;
  transactionUrl?: string;
  error?: string;
}> {
  try {
    const secretKey = parsePrivateKey(privateKey);
    const wallet = Keypair.fromSecretKey(secretKey);

    const balance = await connection.getBalance(wallet.publicKey);
    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      // proceed anyway; simplest behavior
    }

    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;

    const associatedTokenAccount = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey
    );

    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID_PUBKEY.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID_PUBKEY
    );

    const rentExemptBalance = await getMinimumBalanceForRentExemptMint(connection);

    const transaction = new Transaction();

    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 250000 })
    );

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200000 })
    );

    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint,
        space: MINT_SIZE,
        lamports: rentExemptBalance,
        programId: TOKEN_PROGRAM_ID,
      })
    );

    transaction.add(
      createInitializeMintInstruction(
        mint,
        TOKEN_CONFIG.decimals,
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_PROGRAM_ID
      )
    );

    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedTokenAccount,
        wallet.publicKey,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    transaction.add(
      createMintToInstruction(
        mint,
        associatedTokenAccount,
        wallet.publicKey,
        TOKEN_CONFIG.initialSupply * Math.pow(10, TOKEN_CONFIG.decimals),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    transaction.add(
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAddress,
          mint,
          mintAuthority: wallet.publicKey,
          payer: wallet.publicKey,
          updateAuthority: wallet.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name: TOKEN_METADATA.name,
              symbol: TOKEN_METADATA.symbol,
              uri: TOKEN_METADATA.uri,
              sellerFeeBasisPoints: TOKEN_METADATA.sellerFeeBasisPoints,
              creators: null,
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: null,
          },
        }
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet, mintKeypair],
      { commitment: 'confirmed', maxRetries: 3 }
    );

    // Store token info
    await storeToken({
      mint: mint.toString(),
      owner: wallet.publicKey.toBase58(),
      symbol: TOKEN_METADATA.symbol,
      name: TOKEN_METADATA.name,
      metadataUri: TOKEN_METADATA.uri,
      signature,
    });

    return {
      success: true,
      signature,
      mint: mint.toString(),
      metadata: metadataAddress.toString(),
      tokenAccount: associatedTokenAccount.toString(),
      explorerUrl: `https://solscan.io/token/${mint.toString()}`,
      transactionUrl: `https://solscan.io/tx/${signature}`,
    };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

export async function main(): Promise<void> {

  const current = await loadCurrentToken();
  console.log('Current token:', current);
}

// Auto-run when executed directly
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main().catch((err) => console.error(err));
}
