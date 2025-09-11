import {  TxVersion, Raydium, DEV_API_URLS, CREATE_CPMM_POOL_PROGRAM, DEVNET_PROGRAM_ID } from '@raydium-io/raydium-sdk-v2'
import { connection, cluster } from '../../config'
import { clusterApiUrl, Keypair } from '@solana/web3.js'
import { getMainWallet } from '../wallet/walletFun'
import { loadCurrentToken } from '../../sqllite/Manager/tokenStore'
import { SOL_MINT } from '../../constants';
import { loadCurrentPool } from '../../sqllite/Manager/raydiumPoolStore'




export const SOL_MINT_CONST = SOL_MINT;


// Function to get owner from wallet.db
export const getOwner = async (): Promise<Keypair> => {
  const mainWallet = await getMainWallet();
  if (!mainWallet) {
    throw new Error('No main wallet found in database. Please generate one first.');
  }
  return mainWallet;
}
export const txVersion = TxVersion.V0 // or TxVersion.LEGACY



let raydium: Raydium | undefined
export const initSdk = async (params?: { loadToken?: boolean }) => {
  if (raydium) return raydium
  if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
    console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)
  
  // Get owner from wallet.db
  const owner = await getOwner();
  console.log(`Using main wallet: ${owner.publicKey.toBase58()}`);
  
  raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
     ...(cluster === 'devnet'
      ? {
          urlConfigs: {
            ...DEV_API_URLS,
            BASE_HOST: 'https://api-v3-devnet.raydium.io',
            OWNER_BASE_HOST: 'https://owner-v1-devnet.raydium.io',
            SWAP_HOST: 'https://transaction-v1-devnet.raydium.io',
            CPMM_LOCK: 'https://dynamic-ipfs-devnet.raydium.io/lock/cpmm/position',
          },
        }
      : {}),
  })
  
  return raydium;
}


// Get current token mint address from token.db (current_token table)
export const getCurrentTokenMintAddress = async (): Promise<string> => {
  const current = await loadCurrentToken()
  if (!current?.mint) throw new Error('No current token mint found. Please store a token first.')
  return current.mint
}

export const getCurrentPool = async (): Promise<string> => {
  const current = await loadCurrentPool()
  if (!current?.poolId) throw new Error('No current pool found. Please store a pool first.')
  return current.poolId as string
}



const VALID_PROGRAM_ID = new Set([
    CREATE_CPMM_POOL_PROGRAM.toBase58(),
    DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM.toBase58(),
  ])
  
  export const isValidCpmm = (id: string) => VALID_PROGRAM_ID.has(id)