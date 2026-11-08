import{MAX_LEVEL}from'../core/world.js';
import{depressionFill}from'../core/depression-fill.js';
export function fillTerrainDepressions(world){
 if(world.cells.some(c=>{for(let l=1;l<=MAX_LEVEL;l++)if(world.isBuilt(c,l))return true;return false;}))throw new RangeError('terrain-only World required');
 const heights=world.cells.map(c=>world.ground(c)),r=depressionFill(world.cells,heights);
 // If filling raises any river bed, invalidate its whole connected marked
 // reach rather than leaving decorative waterfalls/navigation on a broken river.
 const affected=new Set(),queue=[];
 for(const c of world.cells)if(r.filled[c.id]>heights[c.id]&&world.river[c.id]){affected.add(c.id);queue.push(c.id);}
 for(let k=0;k<queue.length;k++)for(const id of world.cells[queue[k]].edgeNeighbors)if(id>=0&&world.river[id]&&!affected.has(id)){affected.add(id);queue.push(id);}
 for(const c of world.cells)for(let l=heights[c.id]+1;l<=r.filled[c.id];l++)world.setSolid(c,l,true,{rock:true});
 for(const id of affected)world.river[id]=0;
 r.invalidatedRiverCells=affected.size;r.version=world.version;
 world.drainage=r;return r;
}
