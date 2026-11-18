import {BrowserProvider,ContractFactory,formatEther,getAddress} from 'ethers';

type DeploymentArtifact={
  name:string;
  chainId:number;
  abi:unknown[];
  bytecode:string;
  bytecodeSha256:string;
};
type Wallet={request:(args:{method:string;params?:unknown[]})=>Promise<unknown>};
const byId=(id:string)=>{const e=document.getElementById(id);if(!e)throw Error('Missing UI '+id);return e;};
const connect=byId('connect') as HTMLButtonElement;
const deploy=byId('deploy') as HTMLButtonElement;
const copy=byId('copy') as HTMLButtonElement;
const status=byId('status'),result=byId('result');
let artifact:DeploymentArtifact|null=null;
let address='';
let deployer:Awaited<ReturnType<BrowserProvider['getSigner']>>|null=null;
let lastReceipt='';
let pending=false;

function message(s:string){status.textContent=s;}
function getWallet():Wallet{
  const eth=(window as unknown as {ethereum?:Wallet}).ethereum;
  if(!eth)throw Error('No browser wallet found. Open this page in a browser with an Ethereum wallet extension.');
  return eth;
}
function toHex(bytes:Uint8Array){return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
async function verifyArtifact(raw:DeploymentArtifact){
  if(raw.chainId!==11155111||raw.name!=='GAMBIT SealedGambit')throw Error('Wrong contract or network artifact');
  if(!/^0x[\da-f]+$/i.test(raw.bytecode)||raw.bytecode.length<1000)throw Error('Invalid deploy bytecode');
  if(!/^[a-f0-9]{64}$/.test(raw.bytecodeSha256))throw Error('Missing bytecode fingerprint');
  const rawBytes=Uint8Array.from(raw.bytecode.slice(2).match(/.{2}/g)!.map(x=>parseInt(x,16)));
  const digest=toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',rawBytes)));
  if(digest!==raw.bytecodeSha256)throw Error('Compiled contract fingerprint mismatch');
  const names=new Set(raw.abi.filter((v):v is {type:string,name:string}=>!!v&&typeof v==='object'&&'name'in v&&'type'in v).filter(x=>x.type==='function').map(x=>x.name));
  for(const method of ['seal','submit','resolve','finalize','publicResultHandle','openChallenge']){
    if(!names.has(method))throw Error('Missing required verified method '+method);
  }
}
async function busy<T>(action:()=>Promise<T>):Promise<T|undefined>{
  if(pending)return;
  pending=true;
  connect.disabled=true;deploy.disabled=true;
  try{return await action();}
  catch(error){
    message('Cannot continue: '+(error instanceof Error?error.message:String(error)));
    return undefined;
  }finally{
    pending=false;
    connect.disabled=!artifact;
    deploy.disabled=!artifact||!deployer;
  }
}
async function connectWallet(){
  if(!artifact)throw Error('Compiled contract artifact is not ready');
  const eth=getWallet();
  await eth.request({method:'eth_requestAccounts'});
  const provider=new BrowserProvider(eth as any);
  const chain=await provider.getNetwork();
  if(chain.chainId!==11155111n)throw Error('Wrong chain. Switch your wallet to Ethereum Sepolia (11155111), then connect again.');
  const signer=await provider.getSigner();
  address=getAddress(await signer.getAddress());
  const wei=await provider.getBalance(address);
  if(wei===0n){
    deployer=null;
    message('Connected '+address+' on Sepolia, but this wallet has no Sepolia test ETH. Fund it using a testnet faucet and connect again.');
    return;
  }
  deployer=signer;
  message('Ready on Ethereum Sepolia.\nPublic wallet: '+address+'\nTest ETH: '+formatEther(wei)+'\nOnly your wallet can authorize deployment.');
}
async function deployContract(){
  if(!artifact||!deployer)throw Error('Connect a funded Sepolia wallet first.');
  const provider=deployer.provider;
  if(!provider)throw Error('Wallet provider unavailable');
  const current=await provider.getNetwork();
  if(current.chainId!==11155111n)throw Error('Network changed. Reconnect to Sepolia.');
  const currentAccount=getAddress(await deployer.getAddress());
  if(currentAccount!==address)throw Error('Selected wallet account changed. Reconnect first.');
  const bal=await provider.getBalance(address);
  if(bal===0n)throw Error('No Sepolia test ETH for gas');
  const factory=new ContractFactory(artifact.abi,artifact.bytecode,deployer);
  message('Review the Sepolia contract creation in your wallet. Do not approve anything on mainnet.');
  const contract=await factory.deploy();
  const tx=contract.deploymentTransaction();
  if(!tx)throw Error('Wallet did not return a deployment transaction');
  message('Waiting for Sepolia confirmation.\nTransaction: '+tx.hash);
  const mined=await tx.wait(1);
  if(!mined||Number(mined.status)!==1)throw Error('Deployment transaction was not successful');
  const deployedAddress=getAddress(await contract.getAddress());
  if((await provider.getCode(deployedAddress))==='0x')throw Error('No deployed contract bytecode found');
  const checkNetwork=await provider.getNetwork();
  if(checkNetwork.chainId!==11155111n)throw Error('Network changed while deploying');
  const manifest={
    project:'GAMBIT',
    contract:'SealedGambit',
    chainId:11155111,
    address:deployedAddress,
    deployer:address,
    txHash:tx.hash,
    blockNumber:mined.blockNumber,
    bytecodeSha256:artifact.bytecodeSha256,
    explorer:'https://sepolia.etherscan.io/tx/'+tx.hash,
    verifiedLiveMatch:false
  };
  lastReceipt=JSON.stringify(manifest,null,2);
  result.replaceChildren();
  const heading=document.createElement('p');heading.textContent='Sepolia deployment confirmed';
  heading.style.cssText='font-weight:800;color:#affde7';
  const addr=document.createElement('code');addr.textContent=deployedAddress;
  const link=document.createElement('a');link.href=manifest.explorer;
  link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open deployment transaction on Etherscan';
  const note=document.createElement('p');note.textContent='Send the public transaction link to ChatGPT. The contract is deployed, but no live encrypted match has been verified yet.';
  result.append(heading,addr,document.createElement('br'),link,note);
  result.style.display='block';copy.hidden=false;
  message('Deployed safely on Ethereum Sepolia.\nContract: '+deployedAddress);
}
connect.addEventListener('click',()=>{void busy(connectWallet);});
deploy.addEventListener('click',()=>{void busy(deployContract);});
copy.addEventListener('click',()=>{void navigator.clipboard.writeText(lastReceipt).then(()=>{
  copy.textContent='Copied public deployment receipt';
}).catch(()=>{message('Copy failed. Share the visible Etherscan link instead.');});});
void (async()=>{
  try{
    const response=await fetch('/chain/sealed-gambit.json',{cache:'no-cache'});
    if(!response.ok)throw Error('Compiled deployment artifact not published: HTTP '+response.status);
    const raw=await response.json() as DeploymentArtifact;
    await verifyArtifact(raw);
    artifact=raw;
    message('Compiled SealedGambit verified.\nBytecode SHA-256: '+raw.bytecodeSha256+'\nConnect a Sepolia wallet to continue.');
    connect.disabled=false;
  }catch(error){message('Deployment is disabled: '+(error instanceof Error?error.message:String(error)));}
})();
