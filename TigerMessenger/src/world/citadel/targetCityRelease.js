/** User-approved default scene rollout. Explicit rollback preserves the old city. */
export const TARGET_CITY_DEFAULTS=Object.freeze({citadelCanopy:'1',citadelTargetAtmosphere:'1',citadelCloudBanks:'1',citadelTargetArchitecture:'1',citadelTerrainFirst:'1',citadelTargetRemesh:'1',citadelTerraceAprons:'1',citadelRecessedSaddle:'1',citadelValleyBenches:'1'});
export function targetCityRuntimeEnabled(search=globalThis.location?.search||'',standalone=typeof window!=='undefined'&&window.top===window){return standalone&&new URLSearchParams(search).get('citadelRuntime')!=='0';}
export function targetCliffTransitEnabled(search=globalThis.location?.search||'',standalone=typeof window!=='undefined'&&window.top===window){
 const p=targetCityParams(search,{standalone});
 return targetCityRuntimeEnabled(search,standalone)&&p.get('citadelCliffTransit')!=='0'&&['citadelTerrainFirst','citadelTargetRemesh','citadelTargetArchitecture'].every(k=>p.get(k)==='1');
}
export function targetCityParams(search=globalThis.location?.search||'',{standalone=typeof window!=='undefined'&&window.top===window}={}){
 const p=new URLSearchParams(search);if(targetCityRuntimeEnabled(search,standalone))for(const[k,v]of Object.entries(TARGET_CITY_DEFAULTS))if(!p.has(k))p.set(k,v);return p;
}
