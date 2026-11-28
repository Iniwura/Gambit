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
  // Keep SDK chain reads on the same independently verified, read-only
  // provider as the lobby. This avoids silently falling back to the preset
  // public RPC while preserving the real Sepolia relayer/WASM encryption path.
  const network=Object.freeze({
    request:ethereum.request.bind(ethereum),
    on:()=>{},removeListener:()=>{}
  });
  const liveSepolia={...sepolia,network:network as any};
  const sdk=new ZamaSDK(createConfig({
    chains:[liveSepolia],ethereum:ethereum as any,
    // Vite's node_modules worker URL can remain unresolved in the live
    // browser bundle. Keep this narrow Arena path deterministic and visible;
    // the SDK still uses the real Sepolia relayer and WASM encryption.
    relayers:{[liveSepolia.id]:web({offloadEncrypt:false})}
  }));
  return Object.freeze({actor,wallet:ethereum,provider,sdk});
}
