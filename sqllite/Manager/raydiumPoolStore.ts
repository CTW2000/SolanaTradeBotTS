import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'

export interface StoredPoolRow {
  id?: number
  poolId: string
  programId: string
  lpMint?: string
  vaultA?: string
  vaultB?: string
  poolFeeAccount?: string
  feeConfigId?: string
  mintAAddress: string
  mintADecimals: number
  mintAProgramId: string
  mintBAddress: string
  mintBDecimals: number
  mintBProgramId: string
  createdAt?: string
}

async function getDb(): Promise<Database> {
  const dbPath = path.resolve(__dirname, '../DB/raydiumPool.db')
  const db = await open({ filename: dbPath, driver: sqlite3.Database })
  await db.exec(`
    CREATE TABLE IF NOT EXISTS pools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poolId TEXT NOT NULL,
      programId TEXT NOT NULL,
      lpMint TEXT,
      vaultA TEXT,
      vaultB TEXT,
      poolFeeAccount TEXT,
      feeConfigId TEXT,
      mintAAddress TEXT NOT NULL,
      mintADecimals INTEGER NOT NULL,
      mintAProgramId TEXT NOT NULL,
      mintBAddress TEXT NOT NULL,
      mintBDecimals INTEGER NOT NULL,
      mintBProgramId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS current_pool (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      poolRowId INTEGER,
      poolId TEXT,
      updatedAt TEXT DEFAULT (datetime('now'))
    );
  `)
  return db
}

export async function storePool(params: Omit<StoredPoolRow, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDb()
  const result = await db.run(
    `INSERT INTO pools (
      poolId, programId, lpMint, vaultA, vaultB, poolFeeAccount, feeConfigId,
      mintAAddress, mintADecimals, mintAProgramId, mintBAddress, mintBDecimals, mintBProgramId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params.poolId,
    params.programId,
    params.lpMint ?? null,
    params.vaultA ?? null,
    params.vaultB ?? null,
    params.poolFeeAccount ?? null,
    params.feeConfigId ?? null,
    params.mintAAddress,
    params.mintADecimals,
    params.mintAProgramId,
    params.mintBAddress,
    params.mintBDecimals,
    params.mintBProgramId,
  )
  const insertedId = result.lastID as number
  await db.run(
    `INSERT INTO current_pool (id, poolRowId, poolId, updatedAt) VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET poolRowId=excluded.poolRowId, poolId=excluded.poolId, updatedAt=excluded.updatedAt`,
    insertedId,
    params.poolId,
  )
  return insertedId
}

export interface LoadedCurrentPool {
  poolId: string
  programId: string
  lpMint?: string
  vaultA?: string
  vaultB?: string
  poolFeeAccount?: string
  feeConfigId?: string
  mintA: { address: string; decimals: number; programId: string }
  mintB: { address: string; decimals: number; programId: string }
}

export async function loadCurrentPool(): Promise<LoadedCurrentPool | null> {
  const db = await getDb()
  const row = await db.get<StoredPoolRow & { poolRowId: number }>(
    `SELECT p.* FROM pools p
     JOIN current_pool c ON p.id = c.poolRowId
     WHERE c.id = 1`
  )
  if (!row) return null
  return {
    poolId: row.poolId,
    programId: row.programId,
    lpMint: row.lpMint ?? undefined,
    vaultA: row.vaultA ?? undefined,
    vaultB: row.vaultB ?? undefined,
    poolFeeAccount: row.poolFeeAccount ?? undefined,
    feeConfigId: row.feeConfigId ?? undefined,
    mintA: { address: row.mintAAddress, decimals: row.mintADecimals, programId: row.mintAProgramId },
    mintB: { address: row.mintBAddress, decimals: row.mintBDecimals, programId: row.mintBProgramId },
  }
}


