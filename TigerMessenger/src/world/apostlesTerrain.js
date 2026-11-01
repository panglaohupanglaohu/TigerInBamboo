// Twelve Apostles terrain = the REACodeRefactoring terrain pipeline (src/terrain/generate.js), stage by stage,
// with one change: the island's radial falloff is replaced by the approved Apostles composition (lobe footprint +
// lobe hierarchy). Everything after the height field is the pipeline's own rule set:
//
//   1  height field     domain-warped fbm + ridged noise (generate.js step 1), times the composition mask
//   2  even layers      quantised to even levels so cliffs are vertical, thin 1-level shelf at the sea (step 2)
//   3  towers           stone pillars rising off the platforms (step 3)
//   4  de-spike         no column 3+ above / 4+ below its neighbours (step 4)
//   5  canyons          narrow ridged-noise bands cut a mass into several mesas (step 5)
//   6  rivers           carveRivers(): depth-first downhill with backtracking, V valleys (step 6, vendor function)
//   7  sea caves        rim cells next to the sea hollowed 1–2 levels deep (step 7)
//   8  features         addFeatures(): overhang lips, natural arches, sea stacks (step 8, vendor function)
//
// The mesh side is untouched pipeline as well (WorldMesh: shape.js level smoothing + cage deform, strata, turf drape,
// soft normals, bake.js AO + bounce), so the only Apostles-specific inputs are where the masses are and how high.
import {carveRivers} from '../vendor/townscaper-rea-refactoring/src/terrain/generate.js';
import {addFeatures} from '../vendor/townscaper-rea-refactoring/src/terrain/features.js';
import {fbm,ridged,clamp01,smoothstep,makeRng} from '../vendor/townscaper-rea-refactoring/src/core/noise.js';

export const APOSTLES_TERRAIN_REVISION='apostles-terrain-pipeline-r1';

/**
 * @param {import('../vendor/townscaper-rea-refactoring/src/core/world.js').World} world  the mass's own grid
 * @param {object} o
 * @param {(cell)=>number} o.mask      composition coverage 0..1 (1 inside the approved footprint core)
 * @param {(cell)=>number} o.cap       approved height at the cell, in levels (lobe hierarchy)
 * @param {(cell)=>number} o.limit     clearance cap (rail / town / protected), in levels
 */
export function generateApostleTerrain(world,{seed=7,mask,cap,limit,spire=false,towers=1,canyons=true,rivers=1,caves=2,overhangs=3,arches=1,stacks=0,beach=true}={}){
 const cells=world.cells,rng=makeRng(seed),nb=(c,i)=>(c.edgeNeighbors[i]>=0?cells[c.edgeNeighbors[i]]:null);
 let span=0;for(const c of cells)span=Math.max(span,Math.hypot(c.cx,c.cz));
 // 1) height field: generate.js noise (same warp / octaves / ridge mix), composition mask instead of radial falloff
 const raw=new Float32Array(cells.length);
 for(const c of cells){const m=mask(c);if(m<=0)continue;
  const u=c.cx/(span*2)+.5,v=c.cz/(span*2)+.5;
  const wx=fbm(u*2.6+3.1,v*2.6+8.4,{octaves:3,freq:2,seed:seed+11}),wy=fbm(u*2.6+12.7,v*2.6+1.9,{octaves:3,freq:2,seed:seed+29});
  const x=u+(wx-.5)*.22,y=v+(wy-.5)*.22;
  let e=fbm(x*1.7,y*1.7,{octaves:4,freq:2.1,gain:.52,seed});e=e*.78+ridged(x*2.1,y*2.1,{octaves:3,freq:2.3,seed:seed+3})*.22;
  // e ≈ 0.5 ± 0.2: inside the footprint the noise decides which terraces drop a step, the mask shapes the flanks
  raw[c.id]=clamp01(m*(.9+(e-.5)*(spire?.5:1.1)));}
 // 2) even layers (+ thin shelf at the sea), capped by the approved hierarchy
 const level=new Int32Array(cells.length);
 for(const c of cells){const t=raw[c.id];if(t<.3)continue;const top=Math.max(2,cap(c));
  if(beach&&t<.35){level[c.id]=1;continue;}
  const k=clamp01((t-.35)/.6);let lv=Math.max(2,Math.round(Math.pow(k,.62)*(top/2))*2);
  level[c.id]=Math.min(lv,top%2?top+1:top);}
 // 3) towers: pillars off the platforms (two levels above the local cap)
 for(let n=0;n<towers;n++){const ang=rng()*Math.PI*2,dist=(.15+rng()*.45)*span*.6,tx=Math.cos(ang)*dist,tz=Math.sin(ang)*dist,rad=.9+rng()*1.3;
  for(const c of cells)if(level[c.id]>=4&&Math.hypot(c.cx-tx,c.cz-tz)<rad)level[c.id]=Math.min(12,Math.max(level[c.id],cap(c)+2));}
 // 4) de-spike (generate.js rule)
 for(let pass=0;pass<2;pass++){const copy=level.slice();
  for(const c of cells){const h=copy[c.id];if(!h)continue;let maxN=0,minN=Infinity;
   for(let i=0;i<c.n;i++){const o=nb(c,i);if(!o)continue;maxN=Math.max(maxN,copy[o.id]);minN=Math.min(minN,copy[o.id]);}
   if(minN!==Infinity&&maxN-h>=3)level[c.id]=maxN-2;if(minN!==Infinity&&h-minN>=4)level[c.id]=minN+2;}}
 // 5) canyons: narrow ridged bands (lower frequency than the demo island: one or two cuts per mass)
 if(canyons)for(const c of cells){if(!level[c.id])continue;const ch=ridged(c.cx*.075+7.3+seed*.013,c.cz*.075+2.1,{octaves:2,freq:1.5,seed:seed+91});
  if(ch<.13)level[c.id]=0;else if(ch<.19)level[c.id]=Math.min(level[c.id],1);}
 // clearance before any carving so rivers and caves follow the final ground
 for(const c of cells)if(level[c.id])level[c.id]=Math.min(level[c.id],limit(c));
 world.reset();for(const c of cells)if(level[c.id]>0)world.fill(c,level[c.id],{rock:true});
 // 6) rivers (vendor carveRivers)
 const riverCells=rivers>0?carveRivers(world,{seed:seed+5,count:rivers}):[];
 // 7) sea caves (generate.js step 7)
 let caveCount=0;const rim=cells.filter(c=>world.top(c)>=4&&c.edgeNeighbors.some((_,i)=>{const o=nb(c,i);return!o||world.top(o)===0;}));
 for(let n=0;n<caves&&rim.length;n++){let cur=rim[(rng()*rim.length)|0];const carved=new Set();
  for(let step=0;step<3&&cur&&!carved.has(cur.id);step++){carved.add(cur.id);world.setSolid(cur,1,false);world.setSolid(cur,2,false);
   let best=null,score=-1;for(let i=0;i<cur.n;i++){const o=nb(cur,i);if(!o||carved.has(o.id)||world.top(o)<4)continue;if(world.top(o)>score){score=world.top(o);best=o;}}cur=best;}
  caveCount++;}
 // 8) features (vendor addFeatures)
 const features=addFeatures(world,{seed,overhangs,arches,stacks});
 world.touch();
 return{revision:APOSTLES_TERRAIN_REVISION,rivers:riverCells.length,caves:caveCount,features,levels:[...new Set(level)].sort((a,b)=>a-b)};
}
