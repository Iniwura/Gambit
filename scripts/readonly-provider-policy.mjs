// Read-only verification fallback policy. Only explicit infrastructure
// unavailability permits a fresh full verification on a different provider.
// Evidence contradictions, wrong chain/runtime, missing proof, incomplete
// scans and unknown errors must stop, never be hidden by provider rotation.
export const ARCHIVE_READ_ENDPOINTS=Object.freeze([
 'https://ethereum-sepolia-rpc.publicnode.com',
 'https://rpc.sepolia.ethpandaops.io',
 'https://sepolia.gateway.tenderly.co'
]);
export function canRetryHistoricalRead(output){
 return typeof output==='string' &&
 /(?:^|[\s"'])pruned history unavailable(?:$|[\s"'])/i.test(output) &&
 !/ARENA_V3_HISTORY_INVALID|COMMANDER_PROFILE_INVALID|PROFILE_EVIDENCE_INVALID|proof mismatch|provider disagreement|wrong chain|runtime mismatch/i.test(output);
}
export function runReadOnlyProviderPolicy(run,explicitEndpoint){
 const endpoints=explicitEndpoint?[explicitEndpoint]:ARCHIVE_READ_ENDPOINTS;
 for(let i=0;i<endpoints.length;i++){
  const result=run(endpoints[i],i);
  if(result.status===0)return {ok:true,attempts:i+1};
  if(i===endpoints.length-1||!canRetryHistoricalRead(result.output))return {ok:false,attempts:i+1};
 }
 throw Error('Missing read-only provider');
}
