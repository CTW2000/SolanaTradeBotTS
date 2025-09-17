import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';

export interface StoredKeypairRow {
	id?: number;
	publicKey: string;
	secretKey: string;
	label?: string;
	isMain?: number; // 0 or 1
	createdAt?: string;
}

async function getDb(): Promise<Database> {
	// Use DB file placed under sqllite/DB/wallet.db relative to this module
	const dbPath = path.resolve(__dirname, '../DB/wallet.db');
	if (!fs.existsSync(dbPath)) {
		throw new Error(`Database file not found at ${dbPath}. Please create it first.`);
	}

	const db = await open({
		filename: dbPath,
		driver: sqlite3.Database,
		mode: sqlite3.OPEN_READWRITE,
	});
	await db.exec(`
		CREATE TABLE IF NOT EXISTS keypairs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			publicKey TEXT NOT NULL,
			secretKey TEXT NOT NULL,
			label TEXT,
			isMain INTEGER DEFAULT 0,
			createdAt TEXT DEFAULT (datetime('now'))
		);
	`);
	return db;
}

export async function storeMainKeypair(publicKey: string, secretKey: Uint8Array): Promise<number> {
	const db = await getDb();
	await db.run(`UPDATE keypairs SET isMain = 0 WHERE isMain = 1`);
	const result = await db.run(
		`INSERT INTO keypairs (publicKey, secretKey, label, isMain) VALUES (?, ?, ?, 1)`,
		publicKey,
		JSON.stringify(Array.from(secretKey)),
		'main'
	);
	return result.lastID as number;
}

export interface LoadedKeypair {
	publicKey: string;
	secretKey: Uint8Array;
}

export async function loadMainKeypair(): Promise<LoadedKeypair | null> {
	const db = await getDb();
	const row = await db.get<StoredKeypairRow>(
		`SELECT publicKey, secretKey FROM keypairs WHERE isMain = 1 ORDER BY id DESC LIMIT 1`
	);
	if (!row) return null;
	let parsed: number[];
	try {
		parsed = JSON.parse(row.secretKey) as number[];
	} catch {
		return null;
	}
	return {
		publicKey: row.publicKey,
		secretKey: new Uint8Array(parsed),
	};
}

export async function storeLabeledKeypair(publicKey: string, secretKey: Uint8Array, label: string): Promise<number> {
	const db = await getDb();
	const result = await db.run(
		`INSERT INTO keypairs (publicKey, secretKey, label, isMain) VALUES (?, ?, ?, 0)`,
		publicKey,
		JSON.stringify(Array.from(secretKey)),
		label
	);
	return result.lastID as number;
}

export async function loadLabeledKeypairs(label: string, limit?: number): Promise<LoadedKeypair[]> {
	const db = await getDb();
	const rows = await db.all<StoredKeypairRow[]>(
		`SELECT publicKey, secretKey FROM keypairs WHERE label = ? ORDER BY id DESC ${typeof limit === 'number' ? 'LIMIT ?' : ''}`,
		...(typeof limit === 'number' ? [label, limit] as unknown[] : [label])
	);
	return rows.map((row) => {
		let parsed: number[] = [];
		try {
			parsed = JSON.parse(row.secretKey) as number[];
		} catch {
			parsed = [];
		}
		return {
			publicKey: row.publicKey,
			secretKey: new Uint8Array(parsed),
		};
	});
}


