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
  const add=(provider,label,identifier)=>{
    if(!isProvider(provider))return;
    const cleanLabel=typeof label==='string'&&label.trim()
      ?label.trim().slice(0,70):'Browser wallet';
    const known=byProvider.get(provider);
    if(known){
      // EIP-6963 naming is more informative than legacy "Injected wallet".
      if(identifier&&known.identifier.startsWith('legacy:')){
        known.label=cleanLabel;
        known.identifier=identifier;
      }
      return;
    }
    const entry={id:String(choices.length+1),label:cleanLabel,provider,
      identifier:identifier||'legacy:'+choices.length};
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
    const name=typeof info.name==='string'&&info.name.trim()
      ?info.name:detail.provider?.isMetaMask?'MetaMask':'Browser wallet';
    // rdns/uuid are descriptive display data, not authentication.
    add(detail.provider,name,typeof info.uuid==='string'
      ?'eip6963:'+info.uuid:'eip6963:unnamed');
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
  return {refresh,list:()=>choices.slice(),subscribe,close};
}
