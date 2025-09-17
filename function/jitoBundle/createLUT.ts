import { TransactionMessage, AddressLookupTableProgram, Keypair, VersionedTransaction, TransactionInstruction, PublicKey, SystemProgram, Blockhash,AddressLookupTableAccount } from "@solana/web3.js";
import { getMainWallet } from "../wallet/walletFun";
import { loadCurrentPool, storeLutAddress, loadLutAddress } from "../../sqllite/Manager/raydiumPoolStore";
import { connection, cluster } from "../../config";
import { lookupTableProvider } from "./LookupTableProvider";
import * as spl from '@solana/spl-token';
import { tipAcct } from "../../constants";
import { searcherClient } from "./clients";
import { Bundle as JitoBundle } from 'jito-ts/dist/sdk/block-engine/types.js';
import bs58 from 'bs58';


//12pfkBoyLucdahjoaJmauBok6vkKUocohnUjmp71FfB4
//npx ts-node createLUT.ts


const keypairWSOLATAIxs: TransactionInstruction[] = []



export async function createLUT(jitoTipAmt: number, keypairs: Keypair[]) {

    const bundledTxns: VersionedTransaction[] = [];

    
    const mainWallet = await getMainWallet();
  
    if (!mainWallet) throw new Error('No main wallet found. Generate one first.');
;
    const pool = await loadCurrentPool();

    if (!pool) throw new Error('No current pool found in database.');


    const createLUTixs: TransactionInstruction[] = [];

  
    
    const recentSlot = await connection.getSlot("finalized");
   
    
    const [ create, lut ] = AddressLookupTableProgram.createLookupTable({
        authority: mainWallet.publicKey,
        payer: mainWallet.publicKey,
        recentSlot: recentSlot
    });
    
    // Store LUT address to database
    await storeLutAddress(lut.toBase58());


    createLUTixs.push(
        create
    );

    
    const addressesMain: PublicKey[] = [];

    createLUTixs.forEach((ixn) => {
        ixn.keys.forEach((key) => {
            addressesMain.push(key.pubkey);
        });
    });
    
    const lookupTablesMain1 = lookupTableProvider.computeIdealLookupTablesForAddresses(addressesMain);

    const { blockhash } = await connection.getLatestBlockhash(); 

    const messageMain1 = new TransactionMessage({
        payerKey: mainWallet.publicKey,
        recentBlockhash: blockhash,
        instructions: createLUTixs,
    }).compileToV0Message(lookupTablesMain1);

    const createLUT = new VersionedTransaction(messageMain1);


    try {
        const serializedMsg = createLUT.serialize();
        console.log('Txn size:', serializedMsg.length);
        if (serializedMsg.length > 1232) {
            console.log('tx too big');
        }
        createLUT.sign([mainWallet]);
    } catch (e) {
        console.log(e, 'error signing createLUT');
        process.exit(0);
    }
     
    bundledTxns.push(createLUT);


    await generateWSOLATAForKeypairs(keypairs);
    const wsolATATxn = await processWSOLInstructionsATA(jitoTipAmt, blockhash)
    bundledTxns.push(...wsolATATxn);
    

      // -------- step 4: SEND BUNDLE --------
    await sendBundle(bundledTxns);
    bundledTxns.length = 0;   // Reset array
    createLUTixs.length = 0;
    keypairWSOLATAIxs.length = 0;
}


export async function extendLUT(jitoTipAmt: number, keypairs: Keypair[]) {

    const pool = await loadCurrentPool();
    if (!pool) throw new Error('No current pool found in database.');


    const bundledTxns1: VersionedTransaction[] = [];


    const mainWallet = await getMainWallet();
    if (!mainWallet) throw new Error('No main wallet found. Generate one first.');


    // Get LUT address from database
    const lutAddress = await loadLutAddress();
    if (!lutAddress) throw new Error('No LUT address found in database.');

    const accounts: PublicKey[] = []; // Array with all new keys to push to the new LUT
    const lut = new PublicKey(lutAddress);  

    console.log('Using LUT address:', lutAddress);

    const lookupTableAccount = (
        await connection.getAddressLookupTable(lut)
    ).value;

    if (lookupTableAccount == null) {
        console.log("Lookup table account not found!");
        process.exit(0);
    }

      // Loop through each keypair and push its pubkey and ATAs to the accounts array
      //todo:please confirm that mintA is the token we are using
      for (const keypair of keypairs) {
          const ataToken = await spl.getAssociatedTokenAddress(
              new PublicKey(pool.mintB.address),
              keypair.publicKey,
          );
          const ataWSOL = await spl.getAssociatedTokenAddress(
              spl.NATIVE_MINT,
              keypair.publicKey,
          );
          accounts.push(keypair.publicKey, ataToken, ataWSOL);
      }

    const ataTokenwall = await spl.getAssociatedTokenAddress(
        new PublicKey(pool.mintB.address),
        mainWallet.publicKey,
    );
    const ataWSOLwall = await spl.getAssociatedTokenAddress(
        spl.NATIVE_MINT,
        mainWallet.publicKey,
    ); 

    accounts.push(
        mainWallet.publicKey,
        ataTokenwall, 
        ataWSOLwall, 
        lut, 
        spl.NATIVE_MINT, 
        new PublicKey(pool.mintB.address),
    );  // DO NOT ADD PROGRAM OR JITO TIP ACCOUNT

    const extendLUTixs1: TransactionInstruction[] = [];
    const extendLUTixs2: TransactionInstruction[] = [];
    const extendLUTixs3: TransactionInstruction[] = [];
    const extendLUTixs4: TransactionInstruction[] = [];

     // Chunk accounts array into groups of 30
     const accountChunks = Array.from({ length: Math.ceil(accounts.length / 30) }, (v, i) => accounts.slice(i * 30, (i + 1) * 30));
     console.log("Num of chunks:", accountChunks.length);
     console.log("Num of accounts:", accounts.length);



     for (let i = 0; i < accountChunks.length; i++) {

        const chunk = accountChunks[i];

        const extendInstruction = AddressLookupTableProgram.extendLookupTable({
            lookupTable: lut,
            authority: mainWallet.publicKey,
            payer: mainWallet.publicKey,
            addresses: chunk,
        });
        if (i == 0) {
            extendLUTixs1.push(extendInstruction);
            console.log("Chunk:", i);
        } else if (i == 1) {
            extendLUTixs2.push(extendInstruction);
            console.log("Chunk:", i);
        } else if (i == 2) {
            extendLUTixs3.push(extendInstruction);
            console.log("Chunk:", i);
        } else if (i == 3) {
            extendLUTixs4.push(extendInstruction);
            console.log("Chunk:", i);
        }
    }
    
    // Add the jito tip to the last txn
    extendLUTixs4.push(
        SystemProgram.transfer({
            fromPubkey: mainWallet.publicKey,
            toPubkey: tipAcct,
            lamports: BigInt(jitoTipAmt),
        })
    );

    // -------- step 6: seperate into 2 different bundles to complete all txns --------
    const { blockhash: block1 } = await connection.getLatestBlockhash();

    const extend1 = await buildTxn(extendLUTixs1, block1, lookupTableAccount);
    const extend2 = await buildTxn(extendLUTixs2, block1, lookupTableAccount);
    const extend3 = await buildTxn(extendLUTixs3, block1, lookupTableAccount);
    const extend4 = await buildTxn(extendLUTixs4, block1, lookupTableAccount);
   
    bundledTxns1.push(
        extend1,
        extend2,
        extend3,
        extend4,
    );

    await sendBundle(bundledTxns1);
   
    
    // -------- step 7: reset arrays --------
    bundledTxns1.length = 0;   // Reset array
    extendLUTixs1.length = 0;   // Reset array
    extendLUTixs2.length = 0;   // Reset array
    extendLUTixs3.length = 0;   // Reset array
    extendLUTixs4.length = 0;   // Reset array
    
}

async function buildTxn(extendLUTixs: TransactionInstruction[], blockhash: string | Blockhash, lut: AddressLookupTableAccount): Promise<VersionedTransaction> {
   
    const mainWallet = await getMainWallet();
    if (!mainWallet) throw new Error('No main wallet found. Generate one first.');

    const messageMain = new TransactionMessage({
            payerKey: mainWallet.publicKey,
            recentBlockhash: blockhash,
            instructions: extendLUTixs,
        }).compileToV0Message([lut]);
        const txn = new VersionedTransaction(messageMain);
    
        try {
            const serializedMsg = txn.serialize();
            console.log('Txn size:', serializedMsg.length);
            if (serializedMsg.length > 1232) {
                console.log('tx too big');
            }
            txn.sign([mainWallet]);
        } catch (e) {
            const serializedMsg = txn.serialize();
            console.log('txn size:', serializedMsg.length);
            console.log(e, 'error signing extendLUT');
            process.exit(0);
        }
        return txn;
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

async function sendBundle(bundledTxns: VersionedTransaction[]) {
    // Log transaction signatures and Solscan URLs before sending
    try {
        const explorerCluster = String(cluster);
        const explorerClusterParam = (explorerCluster === 'mainnet' || explorerCluster === 'mainnet-beta') ? '' : `?cluster=${explorerCluster}`;
        bundledTxns.forEach((tx, idx) => {
            const sig = tx.signatures && tx.signatures.length > 0 ? bs58.encode(tx.signatures[0]) : null;
            if (sig) {
                const url = `https://solscan.io/tx/${sig}${explorerClusterParam}`;
                console.log(`Txn[${idx}] signature: ${sig}`);
                console.log(`Txn[${idx}] solscan: ${url}`);
            } else {
                console.log(`Txn[${idx}] signature: <missing - transaction not signed>`);
            }
        });
    } catch (e) {
        console.log('Error preparing signatures/urls for bundle logging:', e);
    }

    // Deduplicate transactions by signature or message bytes to avoid duplicate message hash errors
    const seenKeys = new Set<string>();
    const uniqueTxns: VersionedTransaction[] = [];
    for (let i = 0; i < bundledTxns.length; i++) {
        const tx = bundledTxns[i];
        let key = '';
        try {
            if (tx.signatures && tx.signatures.length > 0) {
                key = bs58.encode(tx.signatures[0]);
            }
        } catch {}
        if (!key) {
            try {
                // Fallback to message bytes
                key = Buffer.from(tx.message.serialize()).toString('base64');
            } catch {}
        }
        if (!key || !seenKeys.has(key)) {
            if (key) seenKeys.add(key);
            uniqueTxns.push(tx);
        } else {
            console.log(`Skipping duplicate transaction at index ${i}`);
        }
    }

    try {   
        const bundleRes: any = await searcherClient.sendBundle(new JitoBundle(uniqueTxns, uniqueTxns.length));
        const bundleId: string = (bundleRes && typeof bundleRes === 'object' && 'ok' in bundleRes)
            ? (bundleRes.ok ? bundleRes.value : '')
            : (bundleRes as string);
        if (!bundleId) {
            throw new Error((bundleRes && bundleRes.error && bundleRes.error.message) || 'Failed to send bundle');
        }
        console.log(`Bundle ${bundleId} sent.`);

        // Minimal: wait for bundle result via SDK stream
        const waitForBundleResult = (id: string, timeoutMs: number): Promise<any> => {
            return new Promise((resolve, reject) => {
                let cancelFn: undefined | (() => void);
                const timer = setTimeout(() => {
                    cancelFn?.();
                    reject(new Error('Timed out waiting for bundle result'));
                }, timeoutMs);

                cancelFn = (searcherClient as any).onBundleResult(
                    (result: any) => {
                        if (result?.bundleId === id) {
                            clearTimeout(timer);
                            cancelFn?.();
                            resolve(result);
                        }
                    },
                    (e: Error) => {
                        clearTimeout(timer);
                        cancelFn?.();
                        reject(e);
                    }
                );
            });
        };

        try {
            const res: any = await waitForBundleResult(bundleId, 120000);
            const explorerUrl = `https://explorer.jito.wtf/bundle/${bundleId}`;
            console.log('Bundle Explorer URL:', explorerUrl);
            if (res?.finalized) {
                console.log(`Bundle finalized at slot ${res.finalized.slot}`);
            } else if (res?.processed) {
                console.log(`Bundle processed at slot ${res.processed.slot}`);
            } else if (res?.accepted) {
                console.log('Bundle accepted by block engine; awaiting on-chain status.');
            } else if (res?.dropped) {
                console.log(`Bundle dropped: ${res.dropped.reason}`);
            } else if (res?.rejected) {
                console.log(`Bundle rejected: ${res.rejected.reason}`);
            } else {
                console.log('Received bundle result with unknown status:', JSON.stringify(res));
            }
        } catch (e) {
            console.log('Error or timeout waiting for bundle result:', (e as any)?.message || e);
            const explorerUrl = `https://explorer.jito.wtf/bundle/${bundleId}`;
            console.log('You can monitor here:', explorerUrl);
        }
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

async function processWSOLInstructionsATA(jitoTipAmt: number, blockhash: string | Blockhash) : Promise<VersionedTransaction[]> {
    const instructionChunks = chunkArray(keypairWSOLATAIxs, 10); // Adjust the chunk size as needed
    const WSOLtxns: VersionedTransaction[] = [];
    const mainWallet = await getMainWallet();
    if (!mainWallet) throw new Error('No main wallet found. Generate one first.');

    for (let i = 0; i < instructionChunks.length; i++) {
        if (i === instructionChunks.length - 1) {
            const tipIxn = SystemProgram.transfer({
                fromPubkey: mainWallet.publicKey,
                toPubkey: tipAcct,
                lamports: BigInt(jitoTipAmt),
            });
            instructionChunks[i].push(tipIxn);
            console.log('Jito tip added :).');
        }
        const versionedTx = await createAndSignVersionedTxNOLUT(instructionChunks[i], blockhash);
        WSOLtxns.push(versionedTx);
    }
    return WSOLtxns;
}

async function generateWSOLATAForKeypairs(keypairs: Keypair[]) {

    const mainWallet = await getMainWallet();
    if (!mainWallet) throw new Error('No main wallet found. Generate one first.');

    const wsolataAddresspayer = await spl.getAssociatedTokenAddress(
        new PublicKey(spl.NATIVE_MINT),
        mainWallet.publicKey,
    );

    const createWSOLAtapayer = spl.createAssociatedTokenAccountIdempotentInstruction(
        mainWallet.publicKey,
        wsolataAddresspayer,
        mainWallet.publicKey,
        new PublicKey(spl.NATIVE_MINT)
    );

    keypairWSOLATAIxs.push(createWSOLAtapayer);

    for (const [index, keypair] of keypairs.entries()) {
        const wsolataAddress = await spl.getAssociatedTokenAddress(
            new PublicKey(spl.NATIVE_MINT),
            keypair.publicKey,
        );
        const createWSOLAta = spl.createAssociatedTokenAccountIdempotentInstruction(
            mainWallet.publicKey,
            wsolataAddress,
            keypair.publicKey,
            new PublicKey(spl.NATIVE_MINT)
        );

        keypairWSOLATAIxs.push(createWSOLAta);
        console.log(`Created WSOL ATA for Wallet ${index + 1} (${keypair.publicKey.toString()}).`);
    }
}

async function createAndSignVersionedTxNOLUT(
    instructionsChunk: TransactionInstruction[], 
    blockhash: Blockhash | string,
): Promise<VersionedTransaction> {

    const mainWallet = await getMainWallet();
    if (!mainWallet) throw new Error('No main wallet found. Generate one first.');

    const addressesMain: PublicKey[] = [];
    instructionsChunk.forEach((ixn) => {
        ixn.keys.forEach((key) => {
            addressesMain.push(key.pubkey);
        });
    });
 
    const lookupTablesMain1 =
        lookupTableProvider.computeIdealLookupTablesForAddresses(addressesMain);

    const message = new TransactionMessage({
        payerKey: mainWallet.publicKey,
        recentBlockhash: blockhash,
        instructions: instructionsChunk,
    }).compileToV0Message(lookupTablesMain1);

    const versionedTx = new VersionedTransaction(message);
    const serializedMsg = versionedTx.serialize();

    console.log("Txn size:", serializedMsg.length);
    if (serializedMsg.length > 1232) { console.log('tx too big'); }
    versionedTx.sign([mainWallet]);

    /*
    // Simulate each txn
    const simulationResult = await connection.simulateTransaction(versionedTx, { commitment: "processed" });

    if (simulationResult.value.err) {
    console.log("Simulation error:", simulationResult.value.err);
    } else {
    console.log("Simulation success. Logs:");
    simulationResult.value.logs?.forEach(log => console.log(log));
    }
    */

    return versionedTx;
}


//Test code

// --- Simple main-style test runner ---
export async function mainCreateLUTTest(): Promise<void> {
    
    const numKeypairs = Number(process.env.LUT_TEST_KEYPAIRS || '3');
    const jitoTipLamports = Number(process.env.LUT_TEST_TIP_LAMPORTS || '1000');

    const keypairs: Keypair[] = Array.from({ length: numKeypairs }, () => Keypair.generate());

    console.log('Testing createLUT with keypairs:');
    keypairs.forEach((kp, idx) => console.log(`  [${idx}] ${kp.publicKey.toBase58()}`));
    console.log('Jito tip (lamports):', jitoTipLamports);

    try {
        await createLUT(jitoTipLamports, keypairs);
        console.log('✅ createLUT finished.');
    } catch (err) {
        console.error('❌ createLUT failed:', err);
        throw err;
    }
}


// Auto-run when this file is executed directly (e.g., `npx ts-node createLUT.ts`)
if (require.main === module) {
    mainCreateLUTTest().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
