/** User-approved default scene rollout. Explicit rollback preserves the old city. */
export const TARGET_CITY_DEFAULTS=Object.freeze({citadelCanopy:'1',citadelTargetAtmosphere:'1',citadelCloudBanks:'1',citadelTargetArchitecture:'1',citadelTerrainFirst:'1',citadelTargetRemesh:'1',citadelTerraceAprons:'1',citadelRecessedSaddle:'1',citadelValleyBenches:'1'});
export function targetCityRuntimeEnabled(search=globalThis.location?.search||'',standalone=typeof window!=='undefined'&&window.top===window){const v=new URLSearchParams(search).get('citadelRuntime');return v==='1'||(standalone&&v!=='0');}/* citadelRuntime=1：内嵌（如系统工坊）显式要求与独立游戏相同的城 */
export function targetCliffTransitEnabled(search=globalThis.location?.search||'',standalone=typeof window!=='undefined'&&window.top===window){
 const p=targetCityParams(search,{standalone});
 return targetCityRuntimeEnabled(search,standalone)&&p.get('citadelCliffTransit')!=='0'&&['citadelTerrainFirst','citadelTargetRemesh','citadelTargetArchitecture'].every(k=>p.get(k)==='1');
}
export function targetCityParams(search=globalThis.location?.search||'',{standalone=typeof window!=='undefined'&&window.top===window}={}){
 const p=new URLSearchParams(search);if(targetCityRuntimeEnabled(search,standalone))for(const[k,v]of Object.entries(TARGET_CITY_DEFAULTS))if(!p.has(k))p.set(k,v);return p;
}
