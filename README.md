# GAMBIT

Confidential tactical strategy game for the **Zama Developer Program — Season 5: Confidential Gaming**.

> **Development status:** An offline, cleartext practice game and reference combat engine exist. The Phaser game, Zama FHEVM contract, wallet integration and full Sepolia match have **not** been verified or deployed. Nothing in this repository should be presented as a finished encrypted game.

## Goal

Create a polished 3v3 squad strategy game with hidden conditional tactics whose authoritative outcomes are computed using Zama FHE on Ethereum Sepolia.

## Architecture

- **Game:** Phaser + TypeScript, original 2D arena and fighter artwork
- **Rules reference:** deterministic cleartext simulation for testing only
- **Private combat:** Solidity + Zama FHEVM (research candidate, uncompiled)
- **Target network:** Ethereum Sepolia

## Development gates

1. Upload and validate the full production game source and original assets.
2. Install dependencies, run typechecking, build and browser gameplay tests.
3. Compile and test the FHE contract, checking permissions, signature verification and replay protection.
4. Complete a real two-wallet Sepolia confrontation with explorer evidence.
5. Integrate the encrypted result into the full match flow and audit the finished player experience.

**No simulated encryption, fabricated receipts, or unverified completion claims.**

## Local files

The complete prepared working tree is in the `gambit-repository-initial.zip` handoff from this conversation. Code is being imported into this GitHub repository; art and binary assets must also be checked in before the playable build can be claimed ready.
