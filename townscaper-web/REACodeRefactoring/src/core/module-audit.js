/** 1670794261669769217: restrictive conditions can hide a desirable WFC tile.
 * This measures finite grid-footprint searches, NOT WFC tile-selection odds.
 * Censored searches retain lower bounds and never become confirmed absence.
 */
import{findModulePatches}from'./module-search.js';
export function auditModuleOccurrences(pattern,samples,{maxTestsPerGrid=50000,totalTests=200000,limit=100}={}){
 if(!Array.isArray(samples)||!samples.length||samples.length>64||!Number.isSafeInteger(maxTestsPerGrid)||maxTestsPerGrid<0||!Number.isSafeInteger(totalTests)||totalTests<0||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new RangeError('Invalid audit budget');
 const labels=new Set();for(const s of samples){if(typeof s.id!=='string'||!s.id||labels.has(s.id))throw new TypeError('Samples require unique IDs');labels.add(s.id)}
 const rows=[];let tests=0;
 for(const s of samples){const result=findModulePatches(s.grid,pattern,{maxTests:Math.min(maxTestsPerGrid,totalTests-tests),limit});tests+=result.tests;rows.push({id:s.id,countAtLeast:result.matches.length,exactCount:result.complete?result.matches.length:null,reason:result.reason,tests:result.tests,confirmedAbsent:result.complete&&result.matches.length===0})}
 const detected=rows.filter(r=>r.countAtLeast>0).length,absent=rows.filter(r=>r.confirmedAbsent).length,unknown=rows.length-detected-absent;
 return{rows,tests,detected,absent,unknown,sampleCount:rows.length,observedHitShare:detected/rows.length,scope:'finite-topology-sample-not-wfc-probability'};
}
