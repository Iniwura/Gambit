import { ethers, network } from "hardhat";
import { formatEther } from "ethers";

/**
 * Read-only public wallet readiness check for Ethereum Sepolia.
 * Does not sign or broadcast. Does not display mnemonic, keys, RPC credentials,
 * Hardhat var values, or any private key material.
 */
async function main() {
  const networkInfo = await ethers.provider.getNetwork();
  if (network.name !== "sepolia" || networkInfo.chainId !== 11155111n) {
    throw new Error("Only Ethereum Sepolia (chain 11155111) is allowed");
  }

  const signers = await ethers.getSigners();
  if (!signers.length) {
    console.log("NETWORK=sepolia CHAIN_ID=11155111 SIGNER=NOT_CONFIGURED");
    process.exitCode = 2;
    return;
  }
  const signer = signers[0];
  const address = await signer.getAddress();
  const balanceWei = await ethers.provider.getBalance(address);

  const contractFactory = await ethers.getContractFactory("SealedGambit", signer);
  const unsignedDeployment = await contractFactory.getDeployTransaction();

  let estimatedGas: bigint | null = null;
  let feePerGasWei: bigint | null = null;
  let estimatedMaxFeeWei: bigint | null = null;
  let estimationError = "";
  try {
    estimatedGas = await ethers.provider.estimateGas({
      from: address,
      data: unsignedDeployment.data,
      value: 0n,
    });
    const fee = await ethers.provider.getFeeData();
    feePerGasWei = fee.maxFeePerGas ?? fee.gasPrice ?? null;
    estimatedMaxFeeWei = feePerGasWei === null ? null : estimatedGas * feePerGasWei;
  } catch (error) {
    estimationError = error instanceof Error ? error.message.slice(0, 200) : "unavailable";
  }

  // Output only *public* account/chain and transaction cost estimates.
  console.log(JSON.stringify({
    network: "Ethereum Sepolia",
    chainId: Number(networkInfo.chainId),
    publicSignerAddress: address,
    sepETH: formatEther(balanceWei),
    estimatedGas: estimatedGas?.toString() ?? null,
    estimatedMaxFeeInSepoliaETH: estimatedMaxFeeWei === null
      ? null
      : formatEther(estimatedMaxFeeWei),
    funded: balanceWei > 0n,
    sufficientForEstimatedFee:
      estimatedMaxFeeWei === null ? null : balanceWei >= estimatedMaxFeeWei,
    gasEstimationIssue: estimationError || null,
    transactionSent: false,
  }, null, 2));
}

main().catch((error: unknown) => {
  // Avoid including underlying provider error objects that might embed RPC
  // credentials. Do not print stack traces, raw URLs, or request options.
  console.error(
    "Sepolia inspection stopped; check local RPC and signing configuration.",
    error instanceof Error ? error.name : "UnknownError"
  );
  process.exitCode = 1;
});
