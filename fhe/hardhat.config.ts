import '@fhevm/hardhat-plugin';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import type { HardhatUserConfig } from 'hardhat/config';
import { vars } from 'hardhat/config';

// NEVER use a well-known development mnemonic on a live network.
// A missing wallet means Sepolia is read-only until the user provisions one.
const apiKey=vars.get('INFURA_API_KEY','');
const mnemonic=vars.get('MNEMONIC','');
const rpc=vars.get('SEPOLIA_RPC_URL','') ||
  (apiKey ? `https://sepolia.infura.io/v3/${apiKey}` : 'https://ethereum-sepolia-rpc.publicnode.com');

const config: HardhatUserConfig = {
  solidity: {version: '0.8.27', settings: {optimizer:{enabled:true,runs:800},evmVersion:'cancun'}},
  networks: {
    hardhat: {chainId:31337},
    sepolia: {
      chainId:11155111,
      url:rpc,
      accounts:mnemonic?{mnemonic}:[]
    }
  },
  paths:{sources:'./contracts',tests:'./test'},
};
export default config;
