import assert from 'node:assert/strict';
import test from 'node:test';
import {getAddress} from 'ethers';
import {approvedArenaV3Deployment} from '../src/arena/approved-deployment.mjs';

test('live Arena v3 UI manifest is the independently verified Sepolia deployment',()=>{
  const manifest=approvedArenaV3Deployment();
  assert.deepEqual(manifest,{
    contract:'ArenaV3Research',version:1,chainId:11155111,
    address:'0xBF56087EFF029594beeFf1B57B47b1419bCDF16b',
    runtimeHash:'0xf4f31fff6b4ec7f90e573bba95362a49d43ffeb12d971f515cef6301afbde8a9',
    deploymentTransaction:'0x7856d4031860e919329bb00b678f2c107ac093ba8b1f7dc9f6cbcafd08696be5',
    deploymentBlock:12201819
  });
  assert.equal(getAddress(manifest.address),manifest.address);
  assert.equal(Object.isFrozen(manifest),true);
});
