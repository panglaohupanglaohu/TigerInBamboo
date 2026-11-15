// 1704218784028905984 / 1705195380457996629: cast height independent of z-test height, roof (eave) casters,
// 3-ray soft edge, where-the-shadow-lands stats and the A/B sweep — on the shared World.
import assert from 'node:assert/strict';
import {register} from 'node:module';import {pathToFileURL,fileURLToPath} from 'node:url';import {dirname,join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root,'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const {generateModulePatch}=await import('../src/core/module-patch.js');const {World}=await import('../src/core/world.js');const {buildCellIndex}=await import('../src/core/spatial.js');
const {bakeSurfaceShadow,surfaceHeightsFromWorld,surfaceShadowStats,sweepSurfaceShadow,islandSeams,GroundSurfaceShadow,SURFACE_SHADOW_GLSL}=await import('../src/light/surface-shadow.js');
const vertices=[],faces=[];for(let x=0;x<=12;x++)for(let z=0;z<=6;z++)vertices.push([x,z]);for(let x=0;x<12;x++)for(let z=0;z<6;z++){const a=x*7+z;faces.push([a,a+7,a+8,a+1])}
const g=generateModulePatch({vertices,faces}),world=new World(g),index=buildCellIndex(g);
for(const c of world.cells){world.fill(c,1,{rock:true});if(c.cx>2&&c.cx<4)world.fill(c,2,{rock:true});if(c.cx>6&&c.cx<8)world.fill(c,4,{rock:true});}
const house=world.cells.find(c=>c.cx>10&&c.cx<11&&c.cz>2&&c.cz<3);world.setSolid(house,2,true);assert.ok(world.topIsBuilt(house));
const f=surfaceHeightsFromWorld(world,index,{res:96,L:.5,roofRise:.35});
const at=(wx,wz)=>Math.floor((wz-f.minZ)/f.stepWorld)*f.width+Math.floor((wx-f.minX)/f.stepWorld);
assert.equal(f.roof[at(10.5,2.5)],1);assert.ok(Math.abs(f.casters[at(10.5,2.5)]-1.35)<1e-6&&f.heights[at(10.5,2.5)]===1);
const sun={dx:-1,dz:0,slope:.6};
const base={...f,...sun,steps:48,eligibility:'relative',zBias:.02};
const r=bakeSurfaceShadow({...base,castHeight:.6});
const sh=(x,z)=>r.shadow[at(x,z)]/255;
assert.equal(sh(4.1,4.5),0,'one-level terrace step does not cast (cast height threshold)');
assert.ok(sh(8.1,4.5)>0,'cliff (3 levels) casts onto the grass at its foot');
assert.ok(sh(11.05,2.5)>0,'house roof casts an eave shadow');
assert.equal(sh(1,4.5),0);
// the same step DOES cast when the threshold is zero — the "too 3D" first version
const r0=bakeSurfaceShadow({...base,castHeight:0});assert.ok(r0.shadow[at(4.1,4.5)]>0);
// cast height and z-test bias are independent knobs: changing zBias moves the reach, not who casts
const zA=bakeSurfaceShadow({...base,castHeight:.6,zBias:.02}),zB=bakeSurfaceShadow({...base,castHeight:.6,zBias:.4});assert.ok(zB.hits<zA.hits&&zB.shadow[at(4.1,4.5)]===0);
// prominence eligibility (REACode src) also excludes the low step while keeping the cliff
const p=bakeSurfaceShadow({...f,...sun,steps:48,castHeight:.3,baseRadius:6});assert.equal(p.shadow[at(4.1,4.5)],0);assert.ok(p.shadow[at(8.1,4.5)]>0);
// 3 slightly spread rays give fractional (soft) values somewhere along shadow edges
const soft=bakeSurfaceShadow({...base,dx:-1,dz:-.45,slope:.35,castHeight:.6,rays:3});assert.ok([...soft.shadow].some(v=>v>0&&v<255),'soft edge');
// landing stats: shadow is near the cliff edge or under the roof, nowhere else
const st=surfaceShadowStats(r.shadow,f,{nearPx:22});assert.ok(st.underRoof>0&&st.atEdge>0);assert.equal(st.elsewhere,0);
const table=sweepSurfaceShadow({...f,...sun,steps:48,eligibility:'relative'},{castHeights:[0,.6],zBiases:[.02,.4]});assert.ok(table[0].cells[0].hits>table[1].cells[0].hits);
assert.equal(islandSeams(r.shadow,f.width,f.height).seamPx>=0,true);
// View adapter: refresh on a fake view, caches by version+sun, follows edits
const T=await import('three');
const view={town:world,index,levelHeight:.5,sunDir:new T.Vector3(-1,.6,0).normalize()};const gs=new GroundSurfaceShadow(view);gs.set({strength:.4,castHeight:.6,eligibility:'relative'});gs.refresh();
assert.ok(gs.stats.hits>0&&gs.stats.underRoof>0);const k1=gs.key;gs.refresh();assert.equal(gs.key,k1);
world.setSolid(house,2,false);gs.refresh();assert.notEqual(gs.key,k1);assert.equal(gs.stats.underRoof,0);
assert.ok(SURFACE_SHADOW_GLSL.includes('surfaceShadowToneN'));assert.throws(()=>gs.set({rays:2}));
console.log('PASS surface shadow: step excluded, cliff+eave cast, zBias independent, 3-ray soft, stats',{underRoof:st.underRoof,atEdge:st.atEdge,elsewhere:st.elsewhere});
