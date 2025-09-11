import {
    CREATE_CPMM_POOL_PROGRAM,
    CREATE_CPMM_POOL_FEE_ACC,
    DEVNET_PROGRAM_ID,
    getCpmmPdaAmmConfigId,
    printSimulate,
  } from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import { initSdk, txVersion, SOL_MINT_CONST, getCurrentTokenMintAddress } from './raydiumConfig'
import { TOKEN_CONFIG,cluster } from '../../config'
import { TOKEN_PROGRAM_ID } from '../../constants'
import { storePool } from '../../sqllite/Manager/raydiumPoolStore'

  //npx ts-node /root/ListenInRust/SolanaTradeBotTS/function/raydiumPool/createCpmmPool.ts
  //npx ts-node createCpmmPool.ts
  
  export const createPool = async () => {
    const raydium = await initSdk({ loadToken: true })
  
    // Build mint info directly without calling token.getTokenInfo
    const currentMint = await getCurrentTokenMintAddress()
    const mintA = {
      address: currentMint,
      programId: TOKEN_PROGRAM_ID,
      decimals: TOKEN_CONFIG.decimals,
    }
    const mintB = {
      address: SOL_MINT_CONST,
      programId: TOKEN_PROGRAM_ID,
      decimals: 9,
    }
  
    /**
     * you also can provide mint info directly like below, then don't have to call token info api
     *  {
        address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
        programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        decimals: 6,
      } 
     */
  
    const isMainnet = (cluster as unknown as string) === 'mainnet'
    const baseProgramId = isMainnet ? CREATE_CPMM_POOL_PROGRAM : DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
    const basePoolFeeAccount = isMainnet ? CREATE_CPMM_POOL_FEE_ACC : DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC

    const feeConfigs = await raydium.api.getCpmmConfigs()

    if (raydium.cluster === 'devnet') {
      feeConfigs.forEach((config) => {
        config.id = getCpmmPdaAmmConfigId(DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, config.index).publicKey.toBase58()
      })
    }
  
    const { execute, extInfo, transaction } = await raydium.cpmm.createPool({
      // poolId: // your custom publicKey, default sdk will automatically calculate pda pool id
      // programId: CREATE_CPMM_POOL_PROGRAM, // devnet: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
      // poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC, // devnet:  DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
      programId: baseProgramId,
      poolFeeAccount: basePoolFeeAccount,
      mintA,
      mintB,
      mintAAmount: new BN(100),
      mintBAmount: new BN(100),
      startTime: new BN(0),
      feeConfig: feeConfigs[0],
      associatedOnly: false,
      ownerInfo: {
        useSOLBalance: true,
      },
      txVersion,
      // optional: set up priority fee here
      // computeBudgetConfig: {
      //   units: 600000,
      //   microLamports: 46591500,
      // },
    })
  
    // Log detailed pool info
    try {
      const addr: any = extInfo.address
      const asStr = (v: any) => (typeof v === 'string' ? v : v?.toString?.() ?? v)
      console.log('Created pool details:', {
        programId: asStr(addr.programId),
        poolId: asStr(addr.poolId ?? addr.id),
        authority: asStr(addr.authority),
        lpMint: asStr(addr.lpMint),
        vaultA: asStr(addr.vault?.A ?? addr.vaultA),
        vaultB: asStr(addr.vault?.B ?? addr.vaultB),
        poolFeeAccount: asStr(addr.poolFeeAccount),
        feeConfigId: asStr(addr.feeConfig?.id),
        mintA: addr.mintA,
        mintB: addr.mintB,
      })

      await storePool({
        poolId: asStr(addr.poolId ?? addr.id),
        programId: asStr(addr.programId),
        lpMint: asStr(addr.lpMint),
        vaultA: asStr(addr.vault?.A ?? addr.vaultA),
        vaultB: asStr(addr.vault?.B ?? addr.vaultB),
        poolFeeAccount: asStr(addr.poolFeeAccount),
        feeConfigId: asStr(addr.feeConfig?.id),
        mintAAddress: addr.mintA.address,
        mintADecimals: addr.mintA.decimals,
        mintAProgramId: addr.mintA.programId,
        mintBAddress: addr.mintB.address,
        mintBDecimals: addr.mintB.decimals,
        mintBProgramId: addr.mintB.programId,
      })
    } catch (e) {
      console.warn('Failed to log created pool details:', (e as Error)?.message ?? e)
    }

    printSimulate([transaction])
  
    // Execute the transaction to create the pool
    console.log('Executing pool creation transaction...')
    const { txId } = await execute({ sendAndConfirm: true })
    
    console.log('✅ Pool created successfully!')
    console.log('Transaction ID:', txId)
    console.log('Solscan URL:', `https://solscan.io/tx/${txId}`)
    // Fix: Ensure asStr and addr are defined in this scope
    const addr: any = extInfo.address
    const asStr = (v: any) => (typeof v === 'string' ? v : v?.toString?.() ?? v)
    console.log('Pool Explorer URL:', `https://solscan.io/account/${asStr(addr.poolId ?? addr.id)}`)
    
    console.log('Pool created', {
      txId,
      poolKeys: Object.keys(extInfo.address).reduce(
        (acc, cur) => ({
          ...acc,
          [cur]: extInfo.address[cur as keyof typeof extInfo.address].toString(),
        }),
        {}
      ),
    })
    
    process.exit() // if you don't want to end up node execution, comment this line
  }
  
  /** uncomment code below to execute */
  createPool()