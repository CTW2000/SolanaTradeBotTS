import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

export interface StoredTokenRow {
	id?: number;
	mint: string;
	owner: string;
	symbol?: string;
	name?: string;
	metadataUri?: string;
	signature?: string;
	createdAt?: string;
}

async function getDb(): Promise<Database> {
	const dbPath = path.resolve(__dirname, '../DB/token.db');
	const db = await open({
		filename: dbPath,
		driver: sqlite3.Database,
	});
	await db.exec(`
		CREATE TABLE IF NOT EXISTS tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			mint TEXT NOT NULL,
			owner TEXT NOT NULL,
			symbol TEXT,
			name TEXT,
			metadataUri TEXT,
			signature TEXT,
			createdAt TEXT DEFAULT (datetime('now'))
		);
		CREATE TABLE IF NOT EXISTS current_token (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			tokenId INTEGER,
			mint TEXT,
			updatedAt TEXT DEFAULT (datetime('now'))
		);
	`);
	return db;
}

export async function storeToken(params: {
	mint: string;
	owner: string;
	symbol?: string;
	name?: string;
	metadataUri?: string;
	signature?: string;
}): Promise<number> {
	const db = await getDb();
	const result = await db.run(
		`INSERT INTO tokens (mint, owner, symbol, name, metadataUri, signature) VALUES (?, ?, ?, ?, ?, ?)`,
		params.mint,
		params.owner,
		params.symbol ?? null,
		params.name ?? null,
		params.metadataUri ?? null,
		params.signature ?? null
	);
	const insertedId = result.lastID as number;
	await db.run(
		`INSERT INTO current_token (id, tokenId, mint, updatedAt) VALUES (1, ?, ?, datetime('now'))
		 ON CONFLICT(id) DO UPDATE SET tokenId=excluded.tokenId, mint=excluded.mint, updatedAt=excluded.updatedAt`,
		insertedId,
		params.mint
	);
	return insertedId;
}

export interface LoadedCurrentToken {
	tokenId: number;
	mint: string;
}

export async function loadCurrentToken(): Promise<LoadedCurrentToken | null> {
	const db = await getDb();
	const row = await db.get<{ tokenId: number; mint: string }>(
		`SELECT tokenId, mint FROM current_token WHERE id = 1`
	);
	if (!row || row.tokenId == null || !row.mint) return null;
	return { tokenId: row.tokenId, mint: row.mint };
}
