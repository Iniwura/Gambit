# SquadGambit HCU feasibility — predeployment evidence

Updated 2026-11-20 on commit `a9b504b` plus the static analyzer changes in this
branch.

## Verdict

**UNVERIFIED for real Zama Sepolia FHE execution; static estimate is within the published
devnet limits.** The contract was successfully deployed on Sepolia on 20 Nov 2026 and its
runtime was recorded in [`fhe/deployments/sepolia-squad.json`](../fhe/deployments/sepolia-squad.json).
**No encrypted gameplay signature, live FHE resolution, signed KMS result or measured HCU
has been performed.** Deployment EVM gas does not measure FHE computational cost.

The official HCU guide currently documents a 20,000,000 total HCU limit and a
5,000,000 sequential-depth limit for its referenced devnet. These limits are
not a substitute for confirming the parameters of the target live network.

## Reproducible static inventory

Run:

```bash
cd fhe
npm run hcu:static
```

The analyzer is now a **required CI gate**, pinned to reviewed Solidity source via Git blob SHA `b5c7e307595a4b0259431daa92016d1887795b8d`. Any contract source edit, even one that does not modify the FHE calls, fails the gate until an engineer re-reviews the source-level operation inventory and updates the pin. This prevents silent *source drift* but does not automatically derive the counts or prove they were correct to begin with. The pinned source and the cost table must be re-audited before deployment after contract changes.

The analyzer uses the official published **non-scalar** costs, which are the
conservative choice for ciphertext-to-ciphertext expressions:

| Operation | Resolve count | Cost | HCU |
|---|---:|---:|---:|
| `euint8.eq` | 25 | 55,000 | 1,375,000 |
| `ebool.and` | 16 | 25,000 | 400,000 |
| `ebool.or` | 8 | 24,000 | 192,000 |
| `ebool.not` | 6 | 2 | 12 |
| encrypted `select` | 36 | 55,000 | 1,980,000 |
| `euint8.add` | 9 | 88,000 | 792,000 |
| `euint8.sub` | 2 | 91,000 | 182,000 |
| `euint8.shl` | 1 | 92,000 | 92,000 |
| **resolve total** |  |  | **5,013,012** |

Input normalization is separate: each of the ten values uses one `lt` and one
`select`, estimated at **1,140,000 HCU per seal or submit transaction**.

The source-level critical-path model reports **1,100,000 HCU sequential
depth** for `resolveDuel`. It includes the encrypted rotation selects,
conditional actions, lane winner predicate, serial score accumulation, bonus
path and final packing. This is a conservative dependency model, not a
coprocessor scheduler measurement.

Static headroom against the published devnet figures is therefore:

- resolve total: `14,986,988 HCU`
- modeled sequential depth: `3,900,000 HCU`

The analyzer explicitly reports unmeasured costs for external-input proof
validation, ACL bookkeeping, public-decryption preparation and live
coprocessor scheduling. Those unknowns prevent a live GO verdict.

## EVM gas discrepancy

The current public Sepolia preflight is read-only and reports:

```text
creation bytes: 10828
runtime bytes: 10183
eth_estimateGas: 19706846
latest block gas limit: 200000000
independent dRPC estimate: unavailable
transaction sent: false
```

The Hardhat FHE mock reports approximately 2,327,962 deployment gas and
2,033,436 resolve gas. Those numbers are local EVM mock execution only. They
do not include live FHEVM executor/coprocessor behavior and cannot be compared
as HCU measurements.

The public estimate is not a block-gas-cap fallback: it is below 90% of the
latest observed 200,000,000 gas block limit. The remaining discrepancy is
therefore unresolved without a live deployment or an independent RPC that
accepts this FHE creation payload. The preflight records the independent RPC
failure rather than substituting a guessed value.

## Permissions, SDK and adversarial coverage

- `FHE.allowThis` is applied to every stored input and the packed result.
- Only the packed aggregate score is made publicly decryptable.
- `FHE.checkSignatures` binds finalization to the stored packed-score handle
  and submitted ABI-encoded score.
- Local tests cover unauthorized callers, duplicate submissions, expiry,
  proof rejection, proof replay across duels, recovery by `duelForSquad`,
  finalized-state rejection, formation permutations and the nine formation
  pairings.
- The browser adapter uses `@zama-fhe/sdk` 3.8.0 public decryption APIs, but
  SDK latency and live KMS proof compatibility remain unmeasured.

Official references: [Zama HCU guide](https://docs.zama.org/protocol/solidity-guides/development-guide/hcu), [Zama ACL guide](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl), and [Zama KMS overview](https://docs.zama.org/protocol/protocol/overview/kms).
