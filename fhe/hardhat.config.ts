import '@fhevm/hardhat-plugin';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import type { HardhatUserConfig } from 'hardhat/config';
import { vars } from 'hardhat/config';

const config: HardhatUserConfig = {
  solidity: {version: '0.8.27', settings: {optimizer:{enabled:true,runs:800},evmVersion:'cancun'}},
  networks: {
    hardhat: {chainId:31337},
    sepolia: {
      chainId:11155111,
      url: `https://sepolia.infura.io/v3/${vars.get('INFURA_API_KEY', 'CONFIGURE_ME')}`,
      accounts: {mnemonic:vars.get('MNEMONIC', 'test test test test test test test test test test test junk')}
    }
  },
  paths:{sources:'./contracts',tests:'./test'},
};
export default config;
