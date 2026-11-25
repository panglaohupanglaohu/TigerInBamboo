import {PipeLineEngine} from './PipeLineEngine.js';
const catalog=(caps,module,canRun,describe)=>caps.map(c=>{if(!canRun(c))throw Error('能力缺少实现 '+c.meta.id);return{...(describe?describe().find(row=>row.id===c.meta.id):c.meta),executable:true,implementation:module+'#'+c.meta.id};});
/** Each adapter imports the live capability code; this file contains no copied algorithms. */
export async function createWorkerEngine(kind){
 if(kind==='object'){
  const m=await import('../system-workshop/object/capabilities.js?v=contract-r2');return new PipeLineEngine({id:'object',catalog:()=>catalog(m.OBJECT_CAPABILITIES,'src/system-workshop/object/capabilities.js',c=>typeof c.run==='function',m.describeObjectCapabilities),scan:layout=>({matches:m.matchObjects(layout)}),execute:(layout,steps,onStep)=>m.runObjectPlan(layout,steps,onStep)});
 }
 if(kind==='materials'){
  const m=await import('../system-workshop/gscene/capabilities.js?v=contract-r2');return new PipeLineEngine({id:'materials',catalog:()=>catalog(m.GSCENE_CAPABILITIES,'src/system-workshop/gscene/capabilities.js',c=>typeof c.run==='function',m.describeGsceneCapabilities),scan:materials=>({matches:m.matchGscene(materials)}),execute:(materials,steps,onStep)=>m.runGscenePlan(materials,steps,onStep)});
 }
 if(kind==='planet'){
  const [m,s]=await Promise.all([import('../system-workshop/planet/capabilities.js?v=contract-r3'),import('../system-workshop/planet/summarize.js?v=sys-r15')]);return new PipeLineEngine({id:'planet',catalog:()=>catalog(m.PLANET_CAPABILITIES,'src/system-workshop/planet/capabilities.js',c=>['run','runSea','runWeather'].some(k=>typeof c[k]==='function'),m.describePlanetCapabilities),scan:recipe=>{const summary=s.compileAndSummarize(recipe);if(!summary.ok)throw Error('当前配方编译失败：'+summary.stage);return{summary,matches:m.PLANET_CAPABILITIES.map(c=>{const rows=c.match(summary,{});return{id:c.meta.id,count:rows.length,targets:rows};})};},execute:(recipe,steps,onStep)=>{const plan=m.runPlanetPlan(recipe,steps,onStep);onStep('@compile');return{...plan,summary:s.compileAndSummarize(plan.recipe)};}});
 }
 if(kind==='battle'){
  const m=await import('../system-workshop/battle/capabilities.js?v=contract-r2');return new PipeLineEngine({id:'battle',catalog:()=>catalog(m.BATTLE_CAPABILITIES,'src/system-workshop/battle/capabilities.js',c=>typeof c.run==='function',m.describeBattleCapabilities),scan:site=>({matches:m.matchAll(site)}),execute:(site,steps,onStep)=>{const report=m.runPlan(site,steps,onStep);return{plan:site.plan,report};}});
 }
 if(kind==='fx'){
  const m=await import('../system-workshop/fx/capabilities.js?v=fx-meta-r1');return new PipeLineEngine({id:'fx',catalog:()=>catalog(m.FX_CAPABILITIES,'src/system-workshop/fx/capabilities.js',c=>typeof c.run==='function',m.describeFxCapabilities),scan:site=>({matches:m.matchAll(site)}),execute:(site,steps,onStep)=>{const report=m.runPlan(site,steps,onStep);return{plan:site.plan,report};}});
 }
 if(kind==='mountain'){
  const m=await import('../system-workshop/mountain/capabilities.js?v=contract-r2');return new PipeLineEngine({id:'mountain',catalog:()=>catalog(m.MOUNTAIN_CAPABILITIES,'src/system-workshop/mountain/capabilities.js',c=>typeof c.run==='function',m.describeMountainCapabilities),scan:site=>({matches:m.matchAll(site)}),execute:(site,steps,onStep)=>{const report=m.runPlan(site,steps,onStep);return{plan:site.plan,report};}});
 }
 if(kind==='building'){
  const m=await import('../system-workshop/building/capabilities.js?v=building-r2');return new PipeLineEngine({id:'building',catalog:()=>catalog(m.BUILDING_CAPABILITIES,'src/system-workshop/building/capabilities.js',c=>typeof c.run==='function',m.describeBuildingCapabilities),scan:site=>({matches:m.matchAll(site)}),execute:(site,steps,onStep)=>{const report=m.runPlan(site,steps,onStep);return{plan:site.plan,report};}});
 }
 if(kind==='apostles-terrain'){
  const m=await import('../system-workshop/apostles-terrain/capabilities.js?v=contract-r2');return new PipeLineEngine({id:'apostles-terrain',catalog:()=>catalog(m.APOSTLES_TERRAIN_CAPABILITIES,'src/system-workshop/apostles-terrain/capabilities.js',c=>typeof c.run==='function',m.describeApostlesTerrainCapabilities),scan:site=>({matches:m.matchAll(site)}),execute:(site,steps,onStep)=>{const report=m.runPlan(site,steps,onStep);return{plan:site.plan,report};}});
 }
 if(kind==='relief'){
  // R46 地貌管线（软坡 / 硬崖 / 河谷 / 悬垂 / 薄台攀爬 / 三遍等高线），能力代码在 system-workshop/relief/capabilities.js
  const m=await import('../system-workshop/relief/capabilities.js?v=relief-r2');return new PipeLineEngine({id:'relief',catalog:()=>catalog(m.RELIEF_CAPABILITIES,'src/system-workshop/relief/capabilities.js',c=>typeof c.run==='function',m.describeReliefCapabilities),scan:site=>({matches:m.matchAll(site)}),execute:(site,steps,onStep)=>{const report=m.runPlan(site,steps,onStep);return{plan:site.plan,report};}});
 }
 if(kind==='lightlife'){
  const m=await import('../system-workshop/lightlife/capabilities.js?v=light-r66');return new PipeLineEngine({id:'lightlife',catalog:()=>catalog(m.LIGHTLIFE_CAPABILITIES,'src/system-workshop/lightlife/capabilities.js',c=>typeof c.run==='function',m.describeLightLifeCapabilities),scan:site=>({matches:m.matchAll(site)}),execute:(site,steps,onStep)=>{const report=m.runPlan(site,steps,onStep);return{plan:site.plan,report};}});
 }
 if(kind==='voxel'){
  const [{worldFrom},{rea}]=await Promise.all([import('../scene-authoring/agent/world-cache.js'),import('../scene-authoring/agent/rea.js')]),m=await import(rea('src/capabilities/registry.js'));
  return new PipeLineEngine({id:'voxel',catalog:()=>catalog(m.CAPABILITIES,'townscaper-web/REACodeRefactoring/src/capabilities/registry.js',c=>typeof c.run==='function'||c.meta.kind2==='layer'&&!!c.meta.layer3d,m.describeCapabilities),scan:async input=>{const{world}=await worldFrom(input.data);return{matches:m.matchAll(world,{allowed:input.allowed?Uint8Array.from(input.allowed):null},{focusCells:input.focusCells||null}),registryVersion:m.REGISTRY_VERSION};},execute:async(input,steps,onStep)=>{const{world,encode}=await worldFrom(input.data),report=[],ctx={allowed:input.allowed?Uint8Array.from(input.allowed):null};for(const step of steps){onStep(step.id);report.push(...m.runPlan(world,[step],ctx,{focusCells:input.focusCells||null}));}return{data:encode(world),report};}});
 }
 throw Error('PipeLineEngine：未知Worker适配器 '+kind);
}
