# SolanaTradeBotTS

## Project status

This project is not yet complete. The core blocker is a network mismatch between required services:

- Jito block engine and bundle submission have been available for testing on testnet
- Raydium CPMM pools and associated on-chain programs used here operate on devnet/mainnet

Because Jito (for bundles) and Raydium (for CPMM swaps) do not operate together on the same non-mainnet cluster, a full end‑to‑end test requires mainnet. That implies real SOL costs for:

- Creating and extending Address Lookup Tables (ALTs)
- Funding ephemeral keypairs and ATAs
- Performing CPMM swaps and sending Jito bundles

Proceed only if you understand the risks and costs of mainnet testing.

## What’s implemented

- Wallet/keypair handling and initial fee funding
- Address Lookup Table create/load logic
- Jito bundle submission scaffolding
- Raydium CPMM swap scaffolding (instructions wiring in progress)

## What blocks completion

- End-to-end validation needs mainnet to exercise both Jito bundle flow and Raydium CPMM swaps together
- Devnet/testnet can validate pieces independently but not the full pipeline

## Mainnet testing warning

Testing on mainnet will consume SOL. Costs will vary based on:

- Number of keypairs funded in a bundle
- Number of LUT operations (create/extend)
- Number of swaps and ATA creations
- Any Jito tips you include per bundle

Estimate and provision sufficient SOL before running. Start with the smallest amounts and a single keypair to limit losses.

## Quick start (development)

1) Install deps

```
npm install
```

2) Configure RPC and cluster in `SolanaTradeBotTS/config.ts`

3) Prepare a pool row in the SQLite DB via `sqllite/Manager/raydiumPoolStore.ts` helpers (mintA/mintB, vaults, authority, etc.)

4) Optional: create an ALT (mainnet only)

5) Dry-run scripts on devnet/testnet to validate non-integrated pieces (no full E2E)

## Mainnet run (high risk)

- Double‑check your `config.ts` is set to mainnet and your wallet is funded
- Understand every instruction being sent before executing
- You are fully responsible for any losses

## Disclaimer

This software is experimental. It is provided “as is,” without warranty of any kind. Using it on mainnet can result in irreversible loss of funds. Use at your own risk.
