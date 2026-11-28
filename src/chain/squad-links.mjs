/**
 * GAMBIT share links contain public non-secret chain IDs ONLY.
 * Discard arbitrary query strings, fragments and credentials so the user
 * cannot accidentally copy a wallet redirect token or untrusted URL state.
 */
function link(currentUrl,id,param){
  if(typeof id!=='bigint'||id<=0n||id>=(1n<<256n))
    throw Error('Link requires a positive onchain uint256 ID.');
  const url=new URL(currentUrl);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)
    throw Error('Only ordinary web game URLs can become public links.');
  url.search='';
  url.hash='';
  url.searchParams.set(param,id.toString());
  return url.toString();
}
export function squadInvitationLink(currentUrl,squadId){
  return link(currentUrl,squadId,'squad');
}
export function squadPublicResultLink(currentUrl,duelId){
  return link(currentUrl,duelId,'duel');
}
