/**
 * EIP-6963 multi-injected Ethereum wallet discovery.
 * Does not request accounts, sign, send, query balances, or choose a wallet
 * behind the user's back. The selected EIP-1193 provider is passed unchanged
 * to ethers and Zama, including its exact account/chain change listeners.
 */
export function discoverInjectedWallets(scope){
  const choices=[];
  const byProvider=new Map();
  const isProvider=value=>!!value&&typeof value.request==='function';
  const safeText=(value,max=70)=>typeof value==='string'
    ?value.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max):'';
  const add=(provider,label,identifier)=>{
    if(!isProvider(provider))return;
    const cleanLabel=safeText(label)||'Browser wallet';
    const cleanIdentifier=safeText(identifier,96);
    const known=byProvider.get(provider);
    if(known){
      // EIP-6963 naming is more informative than legacy "Injected wallet".
      if(cleanIdentifier&&known.identifier.startsWith('legacy:')){
        known.label=cleanLabel;
        known.identifier=cleanIdentifier;
      }
      return;
    }
    const entry={id:String(choices.length+1),label:cleanLabel,provider,
      identifier:cleanIdentifier||'legacy:'+choices.length};
    choices.push(entry);
    byProvider.set(provider,entry);
  };
  const collectLegacy=()=>{
    const ethereum=scope.ethereum;
    const providers=Array.isArray(ethereum?.providers)
      ?ethereum.providers:[ethereum];
    for(const provider of providers){
      add(provider,provider?.isMetaMask?'MetaMask':'Injected wallet',null);
    }
  };
  const onAnnouncement=event=>{
    const detail=event?.detail;
    if(!detail||!isProvider(detail.provider))return;
    const info=detail.info??{};
    const name=safeText(info.name)||(detail.provider?.isMetaMask?'MetaMask':'Browser wallet');
    // rdns/uuid are descriptive display data, not authentication.
    const uuid=safeText(info.uuid,80);
    add(detail.provider,name,uuid?'eip6963:'+uuid:'eip6963:unnamed');
    onChange?.();
  };
  let onChange=null;
  scope.addEventListener('eip6963:announceProvider',onAnnouncement);
  const refresh=()=>{
    collectLegacy();
    scope.dispatchEvent(new Event('eip6963:requestProvider'));
    return choices.slice();
  };
  const subscribe=callback=>{onChange=typeof callback==='function'?callback:null};
  const close=()=>{
    scope.removeEventListener('eip6963:announceProvider',onAnnouncement);
    onChange=null;
  };
  collectLegacy();
  // Consumers that need diagnostics must use metadata(), which deliberately
  // excludes the live provider object and all arbitrary EIP-6963 fields.
  const metadata=()=>choices.map(({id,label,identifier})=>(
    Object.freeze({id,label,identifier})
  ));
  return {refresh,list:()=>choices.slice(),metadata,subscribe,close};
}
