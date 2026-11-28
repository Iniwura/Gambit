import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Hand-reviewed exact source, not actual network telemetry.
// https://docs.zama.org/protocol/solidity-guides/development-guide/hcu
const sha='c3a3e9f99a798554f876361bdbae88c9016dd719';
const bytes=readFileSync(new URL('../fhe/contracts/NeutralBlacksiteResearch.sol',import.meta.url));
const source=bytes.toString('utf8');
const cost={eq:55000,lt:59000,select:55000,add:88000,sub:91000,shlScalar:32000};

function circuit(){
 const counts=Object.fromEntries(Object.keys(cost).map(k=>[k,0]));
 const op=(name,...inputs)=>{counts[name]++;return cost[name]+Math.max(0,...inputs)};
 // All transaction inputs and trivial constants have depth zero in this model.
 // Non-scalar costs used except for the explicit plaintext shift distance.
 const count=()=>{let value=0;for(let i=0;i<5;i++)value=op('add',value,op('select',op('eq',0,0),0,0));return value};
 const exact=count();
 let matched=0;
 for(let glyph=0;glyph<4;glyph++){
  const secret=count(),guess=count();
  const minimum=op('select',op('lt',secret,guess),secret,guess);
  matched=op('add',matched,minimum);
 }
 const misplaced=op('sub',matched,exact);
 const probe=op('add',op('shlScalar',exact),misplaced);
 const breach=op('add',0,exact);
 const result=op('select',op('eq',0,0),exact,
  op('select',op('eq',0,0),op('add',0,probe),breach));
 const complexity=Object.entries(counts).reduce((sum,[k,n])=>sum+n*cost[k],0);
 return {counts,complexity,depth:result};
}

test('neutral Blacksite source-locked resolution circuit fits published example complexity/depth budgets',()=>{
 const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(actual,sha,'Contract source changed; re-audit FHE loops, dependencies, ACL and cost inventory');
 const report=circuit();
 assert.deepEqual(report.counts,{eq:47,lt:4,select:51,add:52,sub:1,shlScalar:1});
 assert.equal(report.complexity,10325000);
 assert.equal(report.depth,1393000);
 assert.ok(report.complexity<20000000);
 assert.ok(report.depth<5000000);
 console.log('NEUTRAL_BLACKSITE_STATIC_HCU '+JSON.stringify({...report,
  limits:'published devnet examples, not verified Sepolia limits',
  overheadExcluded:['input proof','trivial encryption','ACL bookkeeping','RNG allocation','public-decryption preparation','network scheduling'],
  liveHcuMeasured:false,liveDepthMeasured:false}));
});

test('reviewed neutral vault source grants no player or public allowance over secret or guess handles',()=>{
 assert.equal((source.match(/FHE\.randEuint8\(4\)/g)||[]).length,1);
 assert.match(source,/CODE_LENGTH = 5/);
 assert.match(source,/MAX_ATTEMPTS = 4/);
 assert.match(source,/FHE\.allowThis\(m\.vaultCode\[i\]\)/);
 assert.match(source,/FHE\.allowThis\(a\.guess\[i\]\)/);
 assert.doesNotMatch(source,/FHE\.(allow|allowTransient)\s*\(/);
 assert.deepEqual(source.match(/FHE\.makePubliclyDecryptable\([^)]*\)/g),['FHE.makePubliclyDecryptable(a.encryptedFeedback)']);
 // Source review only; mock or live ACL isolation must be separately tested.
});
