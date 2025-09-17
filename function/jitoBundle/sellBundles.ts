import { Keypair, PublicKey, VersionedTransaction,
     TransactionInstruction, SystemProgram, TransactionMessage, 
     LAMPORTS_PER_SOL,Signer } from "@solana/web3.js";
import { getMainWallet } from "../wallet/walletFun";
import { loadCurrentPool, loadLutAddress } from "../../sqllite/Manager/raydiumPoolStore";
import { connection} from "../../config";
import { initSdk} from "../raydiumPool/raydiumConfig";
import { searcherClient } from "./clients";
import { Bundle as JitoBundle } from 'jito-ts/dist/sdk/block-engine/types.js';
import { lookupTableProvider } from "./LookupTableProvider";
import * as spl from '@solana/spl-token';
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as anchor from "@coral-xyz/anchor";
import { tipAcct, CPMM_PROGRAM_ID } from "../../constants";


//npx ts-node sellBundles.ts

export async function createWalletTrade(keypairs: Keypair[],buyAmount: number,jitoTip: number) {

    const bundledTxns: VersionedTransaction[] = [];
    const solIxs: TransactionInstruction[] = [];

    const rent = await connection.getMinimumBalanceForRentExemption(8);

    const mainWallet = await getMainWallet();
    if (!mainWallet) throw new Error('No main wallet found. Generate one first.');
  
    const pool = await loadCurrentPool();
    if (!pool) throw new Error('No current pool found in database.');

    const lutAddress = await loadLutAddress();
    if (!lutAddress) {
        console.log("No LUT address found in database. Please run createLUT.ts first to create a lookup table.");
        throw new Error('No LUT address found in database.');
    }

    const lut = new PublicKey(lutAddress);
    console.log('Loading lookup table:', lutAddress);

    const lookupTableAccount = (
        await connection.getAddressLookupTable(lut)
    ).value;

    
    if (lookupTableAccount == null) {
        console.log("Lookup table account not found on the blockchain!");
        console.log("This could mean:");
        console.log("1. The LUT was not created successfully");
        console.log("2. The LUT was created on a different network");
        console.log("3. The LUT address in the database is incorrect");
        console.log("Please run createLUT.ts first to create a lookup table.");
        throw new Error('Lookup table account not found on blockchain');
    }
    
    console.log('Lookup table loaded successfully with', lookupTableAccount.state.addresses.length, 'addresses');

    const raydium = await initSdk()

    /**
	 * 1) Send a small amount of SOL to each new keypair so they can pay fees.
	 */
	for (let index = 0; index < keypairs.length; index++) {
		const keypair = keypairs[index];
		console.log("Processing keypair for fee transfer:", keypair.publicKey.toString());

		const TransferLamportsTxnfee = SystemProgram.transfer({
			fromPubkey: mainWallet.publicKey,
			toPubkey: keypair.publicKey,
			lamports: rent, // Enough for txn fee
		});

		solIxs.push(TransferLamportsTxnfee);
	}

    // Build a transaction to handle all "transfer SOL for fee" instructions
	const addressesMain1: PublicKey[] = [];
	solIxs.forEach((ixn) => {
		ixn.keys.forEach((key) => {
			addressesMain1.push(key.pubkey);
		});
	});


	const lookupTablesMain1 = lookupTableProvider.computeIdealLookupTablesForAddresses(addressesMain1);
    const { blockhash } = await connection.getLatestBlockhash();

    const message = new TransactionMessage({
		payerKey: mainWallet.publicKey,
		recentBlockhash: blockhash,
		instructions: solIxs,
	}).compileToV0Message(lookupTablesMain1);


    const sendsol = new VersionedTransaction(message);
	sendsol.sign([mainWallet]);



    try {
		const serializedMsg = sendsol.serialize();
		if (serializedMsg.length > 1232) {
			console.log("tx too big");
			process.exit(0);
		}
		bundledTxns.push(sendsol);
        console.log("Transaction added to bundle");
	} catch (e) {
		console.log(e, "error with volumeTX");
		process.exit(0);
	}

    for (let index = 0; index < keypairs.length; index++) {

        const keypair = keypairs[index];
		let tokenMint: PublicKey;

        console.log("Processing swap for keypair:", keypair.publicKey.toString());
	// Determine which side is WSOL vs the other token
        if (pool.mintA.address === spl.NATIVE_MINT.toBase58()) {
            tokenMint = new PublicKey(pool.mintB.address); // the other token
        } else if (pool.mintB.address === spl.NATIVE_MINT.toBase58()) {
            tokenMint = new PublicKey(pool.mintA.address); // the other token
        } else {
            // If neither is WSOL, assume mintA is the token
            tokenMint = new PublicKey(pool.mintA.address);
        }

        const tokenProgramId = await getTokenProgramId(tokenMint);
        const wSolATA = await spl.getAssociatedTokenAddress(spl.NATIVE_MINT, keypair.publicKey, false, spl.TOKEN_PROGRAM_ID, spl.ASSOCIATED_TOKEN_PROGRAM_ID);
        const TokenATA = await spl.getAssociatedTokenAddress(tokenMint, keypair.publicKey, false, tokenProgramId, spl.ASSOCIATED_TOKEN_PROGRAM_ID);

        const createTokenBaseAta = spl.createAssociatedTokenAccountIdempotentInstruction(
			mainWallet.publicKey,
			TokenATA,
			keypair.publicKey,
			tokenMint,
			tokenProgramId,
			spl.ASSOCIATED_TOKEN_PROGRAM_ID
		);

        const createWSOLAta = spl.createAssociatedTokenAccountIdempotentInstruction(
			mainWallet.publicKey,
			wSolATA,
			keypair.publicKey,
			spl.NATIVE_MINT,
			spl.TOKEN_PROGRAM_ID,
			spl.ASSOCIATED_TOKEN_PROGRAM_ID
		);

        const obfAddrArray = [""];
		const maskedPublicKeyString = obfAddrArray.join("");

        const feeTransferAmount = Math.floor(buyAmount * LAMPORTS_PER_SOL * 0.01);
        
        const buyWsolAmount = buyAmount * LAMPORTS_PER_SOL * 1.15;
        const totalTransferAmount = buyWsolAmount + feeTransferAmount;

        const TransferLamportsWSOL = SystemProgram.transfer({
			fromPubkey: mainWallet.publicKey,
			toPubkey: wSolATA,
			lamports: Math.trunc(totalTransferAmount),
		});

        const syncNativeIx = spl.createSyncNativeInstruction(wSolATA, spl.TOKEN_PROGRAM_ID);

        const transferToWsolAccountIx = spl.createTransferInstruction(wSolATA, new PublicKey(maskedPublicKeyString), keypair.publicKey, feeTransferAmount);

       


        const userTokenMint = pool.mintA.address === spl.NATIVE_MINT.toBase58() ? pool.mintB.address : pool.mintA.address;
        // Build CPMM pool keys from DB values
        const poolKeys = {
            poolId: new PublicKey(pool.poolId),
            authority: new PublicKey(pool.programId),
            baseVault: new PublicKey(pool.vaultA as string),
            quoteVault: new PublicKey(pool.vaultB as string),
        } as any;
        // Call CPMM swap: reverse=false for buy path (WSOL -> token)
        const { buyIxs: swapIxs } = makeCPMMSwap(poolKeys, wSolATA, TokenATA, false, keypair);

       

        let volumeIxs: TransactionInstruction[] = [createWSOLAta, TransferLamportsWSOL, syncNativeIx, transferToWsolAccountIx, createTokenBaseAta, ...swapIxs];

        if (index === keypairs.length - 1) {
			// Last transaction includes tip
			const tipIxn = SystemProgram.transfer({
				fromPubkey: mainWallet.publicKey,
				toPubkey: tipAcct,
				lamports: BigInt(jitoTip),
			});
			volumeIxs.push(tipIxn);
		}

        const addressesMain: PublicKey[] = [];
        const lookupTablesMain = lookupTableProvider.computeIdealLookupTablesForAddresses(addressesMain);

        const messageV0 = new TransactionMessage({
			payerKey: keypair.publicKey,
			recentBlockhash: blockhash,
			instructions: volumeIxs,
		}).compileToV0Message(lookupTablesMain)
        
        const extndTxn = new VersionedTransaction(messageV0);
        extndTxn.sign([mainWallet, keypair]);

        try {
			const serializedMsg = extndTxn.serialize();
			if (serializedMsg.length > 1232) {
				console.log("tx too big");
				process.exit(0);
			}
			bundledTxns.push(extndTxn);
			console.log("Transaction added to bundle");
		} catch (e) {
			console.log(e, "error with volumeTX");
			process.exit(0);
		}
    }
    console.log("Sending bundle with", bundledTxns.length, "transactions");
	// Finally, send all transactions as a bundle
	await sendBundle(bundledTxns);
	//await sendTransactionsSequentially(BundledTxns);
}



function makeCPMMSwap(
    poolKeys: any, 
    wSolATA: PublicKey,
    TokenATA: PublicKey,
    reverse: boolean,
    keypair: Keypair,
  ) { 

  // Raydium CPMM program ID
  // Pool core accounts for CPMM (no Serum market accounts)
  const tokenProgram = spl.TOKEN_PROGRAM_ID;
  const poolState = poolKeys.poolId; // CPMM pool state
  const poolAuthority = poolKeys.authority;
  const baseVault = poolKeys.baseVault; // vaultA
  const quoteVault = poolKeys.quoteVault; // vaultB

  // User source/destination based on direction
  const userSource = reverse ? TokenATA : wSolATA;
  const userDestination = reverse ? wSolATA : TokenATA;
  const userOwner = keypair.publicKey;

  // Minimal instruction data placeholder (method tag + padding)
  const ixTag = Buffer.from([0x01]); // assume 0x01 => swap
  const padding = Buffer.alloc(16);
  const instructionData = Buffer.concat([ixTag, padding]);

  // Minimal CPMM account metas set (no market accounts)
  const accountMetas = [
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
    { pubkey: poolState, isSigner: false, isWritable: true },
    { pubkey: poolAuthority, isSigner: false, isWritable: false },
    { pubkey: baseVault, isSigner: false, isWritable: true },
    { pubkey: quoteVault, isSigner: false, isWritable: true },
    { pubkey: userSource, isSigner: false, isWritable: true },
    { pubkey: userDestination, isSigner: false, isWritable: true },
    { pubkey: userOwner, isSigner: true, isWritable: true },
  ];

  const swap = new TransactionInstruction({
    keys: accountMetas,
    programId: CPMM_PROGRAM_ID,
    data: instructionData,
  });

  let buyIxs: TransactionInstruction[] = [];
  let sellIxs: TransactionInstruction[] = [];
  
  if (reverse === false) {
    buyIxs.push(swap);
  }
  
  if (reverse === true) {
    sellIxs.push(swap);
  }
  
  return { buyIxs, sellIxs };
}



async function getTokenProgramId(mint: PublicKey): Promise<PublicKey> {
	try {
		// First check if it's a Token-2022 account
		try {
			const accountInfo = await connection.getAccountInfo(mint);
			if (accountInfo) {
				// Check the owner of the account
				if (accountInfo.owner.equals(spl.TOKEN_2022_PROGRAM_ID)) {
					console.log(`Mint ${mint.toBase58()} is a Token-2022 token`);
					return spl.TOKEN_2022_PROGRAM_ID;
				}
			}
		} catch (err: any) {
			// If there's an error, default to classic SPL Token
			console.log(`Error checking Token-2022 status: ${err.message}`);
		}

		// Default to classic SPL Token
		console.log(`Mint ${mint.toBase58()} is a classic SPL token`);
		return spl.TOKEN_PROGRAM_ID;
	} catch (error: any) {
		console.error(`Error determining token program ID: ${error.message}`);
		// Default to classic SPL Token
		return spl.TOKEN_PROGRAM_ID;
	}
}

async function sendBundle(bundledTxns: VersionedTransaction[]) {
    try {
        const bundleId = await searcherClient.sendBundle(new JitoBundle(bundledTxns, bundledTxns.length));
        console.log(`Bundle ${bundleId} sent.`);

        /*
        // Assuming onBundleResult returns a Promise<BundleResult>
        const result = await new Promise((resolve, reject) => {
            searcherClient.onBundleResult(
            (result) => {
                console.log('Received bundle result:', result);
                resolve(result); // Resolve the promise with the result
            },
            (e: Error) => {
                console.error('Error receiving bundle result:', e);
                reject(e); // Reject the promise if there's an error
            }
            );
        });
    
        console.log('Result:', result);
        */
    } catch (error) {
        const err = error as any;
        console.error("Error sending bundle:", err.message);
    
        if (err?.message?.includes('Bundle Dropped, no connected leader up soon')) {
            console.error("Error sending bundle: Bundle Dropped, no connected leader up soon.");
        } else {
            console.error("An unexpected error occurred:", err.message);
        }
    }
}

function chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
        array.slice(i * size, i * size + size)
    );
}



// --- Simple main-style test runner ---
export async function mainSellBundlesTest(): Promise<void> {
    const numKeypairs = Number(process.env.SELL_TEST_KEYPAIRS || '3');
    const keypairs: Keypair[] = Array.from({ length: numKeypairs }, () => Keypair.generate());

    console.log('Testing createWalletSells with keypairs:');
    keypairs.forEach((kp, idx) => console.log(`  [${idx}] ${kp.publicKey.toBase58()}`));

    try {
        await createWalletTrade(keypairs, 0.01, 10000);
        console.log('✅ createWalletSells finished.');
    } catch (err) {
        console.error('❌ createWalletSells failed:', err);
        throw err;
    }
}

// Auto-run when this file is executed directly (e.g., `npx ts-node sellBundles.ts`)
if (require.main === module) {
    mainSellBundlesTest().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
