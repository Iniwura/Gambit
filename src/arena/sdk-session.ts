import {BrowserProvider} from 'ethers';
import {ZamaSDK} from '@zama-fhe/sdk';
import {createConfig} from '@zama-fhe/sdk/ethers';
import {web} from '@zama-fhe/sdk/web';
import {sepolia} from '@zama-fhe/sdk/chains';
import {arenaV3ReadOnlyWallet,readArenaV3SelectedAccount} from './fhe-preparation.mjs';

/** Production SDK wiring for the explicitly selected wallet; no signer access.
 * The app must separately supply a reviewed deployment manifest before using
 * any preparation routine. This factory does not call the relayer itself.
 */
export type ArenaWallet={request:(args:{method:string,params?:unknown})=>Promise<unknown>};
export async function createArenaV3SdkSession(wallet:ArenaWallet,signal?:AbortSignal){
  const actor=await readArenaV3SelectedAccount(wallet,signal);
  const ethereum=arenaV3ReadOnlyWallet(wallet);
  const provider=new BrowserProvider(ethereum as any);
  const sdk=new ZamaSDK(createConfig({
    chains:[sepolia],ethereum:ethereum as any,relayers:{[sepolia.id]:web()}
  }));
  return Object.freeze({actor,wallet:ethereum,provider,sdk});
}
