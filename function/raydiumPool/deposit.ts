import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, Percent, getPdaPoolAuthority } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import { initSdk, txVersion, getCurrentPool } from './raydiumConfig'
import Decimal from 'decimal.js'
import { isValidCpmm } from './raydiumConfig'



  //npx ts-node /root/ListenInRust/SolanaTradeBotTS/function/raydiumPool/deposit.ts
  //npx ts-node deposit.ts
export const deposit = async () => {
  const raydium = await initSdk()

  // Load pool id from config (DB-backed)
  const poolId = await getCurrentPool()
  console.log('poolId', poolId)
  let poolInfo: ApiV3PoolInfoStandardItemCpmm
  let poolKeys: CpmmKeys | undefined

  
  try {
    // Try API method first for both mainnet and devnet
    const data = await raydium.api.fetchPoolById({ ids: poolId })
    if (!data || data.length === 0 || !data[0]) {
      throw new Error('Pool not found in API')
    }
    poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
    if (!isValidCpmm(poolInfo.programId)) throw new Error('target pool is not CPMM pool')
  } catch (error) {
    console.log('API method failed, trying RPC method...', error instanceof Error ? error.message : String(error))
    try {
      // Fallback to RPC method if API fails
      const data = await raydium.cpmm.getPoolInfoFromRpc(poolId)
      poolInfo = data.poolInfo
      poolKeys = data.poolKeys
    } catch (rpcError) {
      console.log('RPC method also failed, this might be a newly created pool. Waiting 30 seconds and retrying...')
      // Wait 30 seconds for pool to be indexed
      await new Promise(resolve => setTimeout(resolve, 30000))
      
      try {
        const retryData = await raydium.cpmm.getPoolInfoFromRpc(poolId)
        poolInfo = retryData.poolInfo
        poolKeys = retryData.poolKeys
        console.log('Pool found after retry!')
      } catch (finalError) {
        throw new Error(`Pool ${poolId} not found on ${raydium.cluster} even after retry. This might be a newly created pool that needs more time to be indexed.`)
      }
    }
  }

  const uiInputAmount = '0.0001'
  const inputAmount = new BN(new Decimal(uiInputAmount).times(10 ** poolInfo.mintA.decimals).toFixed(0))
  const slippage = new Percent(1, 100) // 1%
  const baseIn = true

  // computePairAmount is not necessary, addLiquidity will compute automatically,
  // just for ui display
  /*
  const res = await raydium.cpmm.getRpcPoolInfos([poolId]);
  const pool1Info = res[poolId];

  const computeRes = await raydium.cpmm.computePairAmount({
    baseReserve: pool1Info.baseReserve,
    quoteReserve: pool1Info.quoteReserve,
    poolInfo,
    amount: uiInputAmount,
    slippage,
    baseIn,
    epochInfo: await raydium.fetchEpochInfo()
  });


  computeRes.anotherAmount.amount -> pair amount needed to add liquidity
  computeRes.anotherAmount.fee -> token2022 transfer fee, might be undefined if isn't token2022 program
  */

  const { execute } = await raydium.cpmm.addLiquidity({
    poolInfo,
    poolKeys,
    inputAmount,
    slippage,
    baseIn,
    txVersion,
    // optional: set up priority fee here
    // computeBudgetConfig: {
    //   units: 600000,
    //   microLamports: 46591500,
    // },

    // optional: add transfer sol to tip account instruction. e.g sent tip to jito
    // txTipConfig: {
    //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
    //   amount: new BN(10000000), // 0.01 sol
    // },
  })
  // don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
  const { txId } = await execute({ sendAndConfirm: true })
  console.log('pool deposited', { txId: `https://explorer.solana.com/tx/${txId}` })
  process.exit() // if you don't want to end up node execution, comment this line
}

/** uncomment code below to execute */
 deposit()