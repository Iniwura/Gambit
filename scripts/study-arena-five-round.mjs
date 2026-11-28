import {parity,research} from './arena-five-round-model.mjs';
const checked=parity();
const results=[];
for(const seed of [0x6a6d6269,1234567,0xdeadbeef])
 for(const correlated of [false,true])results.push(research(seed,correlated));
console.log(JSON.stringify({canonicalParitySamples:checked,results},null,2));
