/** Shared World rock diagnostic. Counts actual voxel spans and rock-only
 * connectivity to level 1; supports through buildings are deliberately excluded.
 * This does not replace shape-aware collision or an erosion-valid terrain solver.
 */
import {MAX_LEVEL} from './world.js';
export function rockTopology(world,{maxVoxels=200000}={}){
  const cells=world.cells,byId=new Map(cells.map(c=>[c.id,c]));
  if(cells.length*MAX_LEVEL>maxVoxels)throw new RangeError('rock topology budget');
  const rock=new Set(),roots=[],spans=[];let undersides=0,exposedFaces=0,cavityColumns=0;
  const key=(id,lv)=>id*(MAX_LEVEL+1)+lv;
  for(const c of cells){let start=0,runs=[];for(let lv=1;lv<=MAX_LEVEL+1;lv++){
    const on=lv<=MAX_LEVEL&&world.isRock(c,lv);
    if(on){const k=key(c.id,lv);rock.add(k);if(lv===1)roots.push(k);if(!start)start=lv;
      if(lv>1&&!world.isSolid(c,lv-1))undersides++;
      if(!world.isSolid(c,lv-1))exposedFaces++;if(!world.isSolid(c,lv+1))exposedFaces++;
      for(let i=0;i<c.n;i++){const o=world.neighbor(c,i);if(!o||!world.isSolid(o,lv))exposedFaces++;}
    }else if(start){runs.push([start,lv-1]);start=0;}
  }if(runs.length>1)cavityColumns++;if(runs.length)spans.push({cellId:c.id,runs});}
  const seen=new Set(roots),queue=[...roots];for(let i=0;i<queue.length;i++){
    const k=queue[i],id=Math.floor(k/(MAX_LEVEL+1)),lv=k%(MAX_LEVEL+1),c=byId.get(id);
    const next=[...(lv>1?[key(id,lv-1)]:[]),...(lv<MAX_LEVEL?[key(id,lv+1)]:[])];
    for(let j=0;j<c.n;j++){const o=world.neighbor(c,j);if(o)next.push(key(o.id,lv));}
    for(const n of next)if(rock.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}
  }
  return {rockVoxels:rock.size,groundConnected:seen.size,unsupported:rock.size-seen.size,undersides,exposedFaces,cavityColumns,spans};
}

/** REACode/overhangterrain measure() on the shared World (1671808851895627776 overhangs):
 * overhangAboveWater = rock voxels above level 1 with empty below and solid above (eaves/cave roofs);
 * soffits = downward rock faces above water; caves = covered air voxels (rock somewhere above in the
 * same column) flood-filled from the open-air side, reporting how many cells deep the air reaches.
 * Logical columns only: no cage-deformed side-wall intersection or collision is measured here.
 */
export function measureOverhang(world){
  const cells=world.cells,byId=new Map(cells.map(c=>[c.id,c]));
  let overhangAboveWater=0,soffits=0,rockVoxels=0;const covered=new Set(),key=(id,lv)=>id*(MAX_LEVEL+1)+lv;
  for(const c of cells){const topRock=world.ground(c);
    for(let lv=1;lv<=MAX_LEVEL;lv++){
      if(world.isRock(c,lv)){rockVoxels++;if(lv>1&&!world.isSolid(c,lv-1)){soffits++;if(world.isSolid(c,lv+1))overhangAboveWater++;}}
      else if(!world.isSolid(c,lv)&&lv<topRock)covered.add(key(c.id,lv));
    }}
  // Entrances: covered air touching uncovered air sideways (or the open sea edge).
  const depth=new Map(),queue=[];
  for(const k of covered){const id=Math.floor(k/(MAX_LEVEL+1)),lv=k%(MAX_LEVEL+1),c=byId.get(id);
    for(const nb of c.edgeNeighbors){const o=nb>=0?byId.get(nb):null;if(!o||(!world.isSolid(o,lv)&&!covered.has(key(o.id,lv)))){depth.set(k,1);queue.push(k);break;}}}
  for(let i=0;i<queue.length;i++){const k=queue[i],id=Math.floor(k/(MAX_LEVEL+1)),lv=k%(MAX_LEVEL+1),c=byId.get(id),d=depth.get(k);
    const next=[...c.edgeNeighbors.filter(x=>x>=0).map(x=>key(x,lv)),key(id,lv-1),key(id,lv+1)];
    for(const n of next)if(covered.has(n)&&!depth.has(n)){depth.set(n,d+1);queue.push(n);}}
  let caveDepth=0;for(const d of depth.values())caveDepth=Math.max(caveDepth,d);
  return{version:world.version,rockVoxels,overhangAboveWater,soffits,coveredAir:covered.size,reachableCoveredAir:depth.size,sealedAir:covered.size-depth.size,caveDepth};
}
