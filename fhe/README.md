# Research FHEVM workspace — unverified

This is an authored draft, **not** a deployed smart contract or a complete proof of confidentiality. Versions mirror the current Zama Hardhat template. The candidate test suite is not verified against installed dependencies.

In an unrestricted environment:

```bash
cd fhe
npm install
npm run compile
npm test
# ONLY after tests pass:
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set MNEMONIC
```

Do not ship without an end-to-end public-decryption proof, full parity coverage against the reference engine, timeout and stranded-match tests, cryptographic ACL review, and a live Sepolia receipt. Public matches use no pseudo-random opponent strategy; each side submits ciphertext. No chance-based combat events exist yet; introduce Zama encrypted onchain randomness if that changes.
