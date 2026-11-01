// Morris Lake mountain: the refactor's own terrain pipeline (REACodeRefactoring/src/terrain/generate.js,
// unchanged: height field -> even layers -> towers -> de-spike -> rivers -> caves -> overhangs / arches /
// sea stacks) run on the lake's central cells, then a castle on the summit plateau and a quay causeway
// from the beach to the lake shore. Everything is written into the same World as player buildings.
import {World} from '../vendor/townscaper-rea-refactoring/src/core/world.js';
import {carveRivers} from '../vendor/townscaper-rea-refactoring/src/terrain/generate.js';
import {addFeatures} from '../vendor/townscaper-rea-refactoring/src/terrain/features.js';
import {fbm,ridged,makeRng,clamp01,smoothstep} from '../vendor/townscaper-rea-refactoring/src/core/noise.js';
import {pointInQuad} from '../vendor/townscaper-rea-refactoring/src/core/spatial.js';
export const MORRIS_MOUNTAIN_REVISION='morris-mountain-r2';
const CASTLE_WALLS=[7,0,7,13,7,6],TOWER_COLOR=0;
/** Re-indexed copy of a subset of grid cells, so the vendor generator can treat it as a whole grid. */
function subGrid(grid,keep){const map=new Map(keep.map((c,i)=>[c.id,i]));
 const cells=keep.map((c,i)=>({...c,id:i,edgeNeighbors:c.edgeNeighbors.map(id=>map.has(id)?map.get(id):-1),cornerNeighbors:(c.cornerNeighbors||[]).filter(id=>map.has(id)).map(id=>map.get(id))}));
 return{map,grid:{...grid,cells,cellCount:cells.length}};}
export function buildMorrisMountain(world,{allowed=()=>true,radius=11,seed=20261031,causewayAngle=Math.PI*.62}={}){
 const cells=world.grid.cells,keep=cells.filter(c=>Math.hypot(c.cx,c.cz)<=radius&&allowed(c));
 const {map,grid}=subGrid(world.grid,keep),sub=new World(grid);sub.palette=world.palette;
 // Morris mountain height field (designed here, refactor noise): a domed massif with a flat summit plateau,
 // warped fbm + ridged flanks, quantised to even layers (2..10) like generate.js, a beach rim, two pinnacles.
 const rng=makeRng(seed),levels=new Int32Array(keep.length),R=radius*.9;
 keep.forEach((c,i)=>{const u=c.cx/R,v=c.cz/R,wx=fbm(u*1.3+3.1,v*1.3+8.4,{octaves:3,freq:2,seed:seed+11}),wy=fbm(u*1.3+12.7,v*1.3+1.9,{octaves:3,freq:2,seed:seed+29});
  const r=Math.hypot(u+(wx-.5)*.35,v+(wy-.5)*.35),dome=1-smoothstep(.0,1,r)**1.35;
  const t=clamp01(dome*1.08+(fbm(u*2.2,v*2.2,{octaves:4,freq:2.1,gain:.52,seed})-.5)*.42+(ridged(u*2.8,v*2.8,{octaves:3,freq:2.3,seed:seed+3})-.5)*.18);
  levels[i]=t<.14?0:t<.22?1:Math.min(10,Math.max(2,Math.round(Math.pow((t-.22)/.78,.72)*5)*2));
  if(Math.hypot(c.cx,c.cz)<radius*.24&&levels[i]>=6)levels[i]=10;});
 for(let n=0;n<2;n++){const a=rng()*Math.PI*2,d=(.45+rng()*.2)*radius,tx=Math.cos(a)*d,tz=Math.sin(a)*d;keep.forEach((c,i)=>{if(levels[i]>=2&&Math.hypot(c.cx-tx,c.cz-tz)<1.1)levels[i]=Math.min(12,levels[i]+4);});}
 for(let pass=0;pass<2;pass++){const copy=levels.slice();grid.cells.forEach((c,i)=>{const h=copy[i];if(!h)return;let maxN=0,minN=Infinity;for(const id of c.edgeNeighbors){if(id<0)continue;maxN=Math.max(maxN,copy[id]);minN=Math.min(minN,copy[id]);}if(minN!==Infinity&&maxN-h>=3)levels[i]=maxN-2;if(minN!==Infinity&&h-minN>=4&&copy[i]<10)levels[i]=minN+2;});}
 sub.reset();grid.cells.forEach((c,i)=>{if(levels[i])sub.fill(c,levels[i],{rock:true});});
 const rivers=carveRivers(sub,{seed:seed+5,count:1}).length;
 const feats=addFeatures(sub,{seed,overhangs:5,arches:1,stacks:3});
 const result={rivers,features:feats};
 world.reset();
 for(const c of keep){const i=map.get(c.id);world.solid[c.id]=sub.solid[i];world.rock[c.id]=sub.rock[i];world.river[c.id]=sub.river[i];world.color[c.id]=sub.color[i];}
 const nb=c=>c.edgeNeighbors.filter(id=>id>=0).map(id=>cells[id]);
 // Summit castle: the flattest high plateau near the centre becomes the courtyard; its rim gets walls, one keep tower.
 const land=keep.filter(c=>world.ground(c)>0);let castle=null;
 if(land.length){const maxG=Math.max(...land.map(c=>world.ground(c)));
  const score=c=>{const g=world.ground(c);return nb(c).filter(o=>world.ground(o)===g).length*3+g*2-Math.hypot(c.cx,c.cz)*.6;};
  const seedCell=land.filter(c=>world.ground(c)>=maxG-2&&!world.river[c.id]).sort((a,b)=>score(b)-score(a))[0];
  if(seedCell){const g=world.ground(seedCell),court=new Set([seedCell.id,...nb(seedCell).filter(o=>world.ground(o)===g).map(o=>o.id)]);const ring=new Set();
   for(const id of court)for(const o of nb(cells[id]))if(!court.has(o.id)&&world.ground(o)>=g-2&&world.ground(o)>0)ring.add(o.id);
   let k=0,tower=null;for(const id of ring){const c=cells[id],base=world.top(c),h=k%3===0?3:2;for(let lv=base+1;lv<=Math.min(12,base+h);lv++)world.setSolid(c,lv,true);world.color[id]=CASTLE_WALLS[k%CASTLE_WALLS.length];if(!tower||Math.hypot(c.cx,c.cz)<Math.hypot(tower.cx,tower.cz))tower=c;k++;}
   if(tower){const base=world.top(tower);for(let lv=base+1;lv<=Math.min(12,base+3);lv++)world.setSolid(tower,lv,true);world.color[tower.id]=TOWER_COLOR;}
   castle={court:court.size,walls:ring.size,summitLevel:g};}}
 // Causeway: from the mountain's beach outwards to the last cell inside the lake, as level-1 quay.
 const at=(x,z)=>{for(const c of cells){if(Math.abs(c.cx-x)>1.6||Math.abs(c.cz-z)>1.6)continue;if(pointInQuad(c.pts,x,z))return c;}return null;};
 let causeway=0,lastLand=null;const dx=Math.cos(causewayAngle),dz=Math.sin(causewayAngle);
 for(let t=0;t<40;t+=.35){const c=at(dx*t,dz*t);if(!c)break;if(!allowed(c))break;if(world.top(c)>0){lastLand=c;continue;}if(!lastLand)continue;world.fill(c,1);world.color[c.id]=6;causeway++;}
 world.touch();
 return{revision:MORRIS_MOUNTAIN_REVISION,seed,radius,cells:land.length,maxLevel:land.length?Math.max(...land.map(c=>world.top(c))):0,rivers:result.rivers,features:result.features?Object.fromEntries(Object.entries(result.features).map(([k,v])=>[k,Array.isArray(v)?v.length:v])):null,castle,causeway};
}
