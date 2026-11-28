import test from 'node:test';
import assert from 'node:assert/strict';
import {loadApprovedCommanderPublicHistory}
  from '../src/profile/public-history.mjs';

const VALID='0x7d567Fa1d5fe35737BbF045f47667e13298Ee176';
function fakeProvider(chain='0xaa36a7'){
  const called=[];
  const provider={
    async send(method){
      called.push(method);
      assert.equal(method,'eth_chainId');
      return chain;
    },
    async getCode(address){
      called.push('getCode');
      assert.equal(address,'0x493aBFFE41869135d153D6EEfCCA4BcdC61d5134');
      return '0x60016003'; // Intentionally counterfeit runtime.
    },
    async getLogs(){throw Error('UNSAFE: log scan before authentic runtime')},
    async getBlock(){throw Error('UNSAFE: block scan before authentic runtime')}
  };
  return {provider,called};
}

test('player opts in with an exact valid address; invalid identity fails before RPC',async()=>{
  const x=fakeProvider();
  for(const wallet of [undefined,null,'','0x','victor.eth',
    '0x0000','0x'+'z'.repeat(40)]){
    await assert.rejects(loadApprovedCommanderPublicHistory(x.provider,wallet),
      /valid wallet address/);
  }
  assert.deepEqual(x.called,[],'bad wallet input must not query chain');
});

test('strict resource bounds and progress arguments fail without network effects',async()=>{
  const x=fakeProvider();
  for(const options of [
    null,[],{maxPages:0},{maxPages:-1},{maxPages:17},
    {maxPages:1.5},{maxPages:'12'},{onProgress:true}
  ]){
    await assert.rejects(loadApprovedCommanderPublicHistory(
      x.provider,VALID,options));
  }
  assert.deepEqual(x.called,[]);
});

test('aborted lookup never scans or replays a signing action',async()=>{
  const x=fakeProvider();
  const controller=new AbortController();
  controller.abort();
  await assert.rejects(loadApprovedCommanderPublicHistory(
    x.provider,VALID,{signal:controller.signal}),
    {name:'AbortError'});
  assert.deepEqual(x.called,[]);
});

test('wrong chain cannot report an empty or victorious Commander Profile',async()=>{
  const x=fakeProvider('0x1');
  await assert.rejects(loadApprovedCommanderPublicHistory(x.provider,VALID),
    /wrong chain/);
  assert.deepEqual(x.called,['eth_chainId']);
});

test('approved address with counterfeit bytecode cannot produce even an empty profile',async()=>{
  const x=fakeProvider();
  await assert.rejects(loadApprovedCommanderPublicHistory(x.provider,VALID),
    /approved contract runtime mismatch/);
  assert.deepEqual(x.called,['eth_chainId','getCode']);
  for(const write of ['eth_sendTransaction','eth_requestAccounts','personal_sign',
    'wallet_switchEthereumChain'])
    assert.equal(x.called.includes(write),false);
});

test('no test-only source can mint trusted wins: live verifier remains mandatory',async()=>{
  const x=fakeProvider();
  await assert.rejects(loadApprovedCommanderPublicHistory(
    x.provider,'0x70d086988706e4f27A53c484570B2a41897dcDD5'),
  /approved contract runtime mismatch/);
  console.log('GAMBIT_PROFILE_HISTORY_FAIL_CLOSED '+JSON.stringify({
    optInWalletRequired:true,
    runtimeRegistryRequired:true,
    cannotTreatEmptyUntrustedLogsAsNoMatches:true,
    mockWinsAccepted:false,
    walletActions:0,
    livePositiveProof:'separate actual Sepolia read-only workflow'
  }));
});
