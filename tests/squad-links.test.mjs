import test from 'node:test';
import assert from 'node:assert/strict';
import {squadInvitationLink,squadPublicResultLink} from '../src/chain/squad-links.mjs';

test('invitation and result links carry only canonical public positive IDs',()=>{
  const home='https://iniwura.github.io/Gambit/?access_token=VERY_PRIVATE#token';
  assert.equal(squadInvitationLink(home,1n),
    'https://iniwura.github.io/Gambit/?squad=1');
  assert.equal(squadPublicResultLink(home,982n),
    'https://iniwura.github.io/Gambit/?duel=982');
  assert.ok(!squadInvitationLink(home,3n).includes('VERY_PRIVATE'));
  assert.ok(!squadPublicResultLink(home,8n).includes('token'));
});

test('invalid, overlong, credentialed or untrusted URL links are rejected',()=>{
  for(const id of [-1n,0n,2n**256n,3,NaN,'7']){
    assert.throws(()=>squadInvitationLink('https://iniwura.github.io/Gambit/',id));
  }
  for(const uri of [
    'javascript:alert(1)',
    'file:///index.html',
    'data:text/html,x',
    'https://name:password@iniwura.github.io/Gambit/',
    'not-a-valid-url'
  ])assert.throws(()=>squadPublicResultLink(uri,1n));
});
