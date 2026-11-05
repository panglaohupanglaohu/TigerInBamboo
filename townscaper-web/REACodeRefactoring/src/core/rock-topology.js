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
