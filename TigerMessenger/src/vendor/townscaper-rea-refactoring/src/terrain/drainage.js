import{MAX_LEVEL}from'../core/world.js';
import{depressionFill,lakeClusters,localMinima,drainedCells,erodeHeights}from'../core/depression-fill.js';
import{rebuildRiverNetwork}from'./river-network.js';
/** Fill quantized World depressions (REACode/depfill, 1447488323845509121).
 * options.microSlope: continuous drainage surface (kept beside the integer World).
 * options.rivers: 'clear' (default) drops raised reaches; 'replan' re-routes the
 *   whole network on the filled terrain via the shared river planner (terrain-only).
 * options.lakes (r55): 'rock' (default, original behaviour) raises pits to the spill level with rock;
 *   'water' leaves the beds where they are and writes World.lakes — per-cell water level, the lake
 *   clusters, spill cells and a bed/rim snapshot; terrain/terrainmesh.js draws a flat water surface
 *   at that level while the snapshot still matches the voxels.
 * options.erosion (r55): {passes,m,k,talus} integer stream-power erosion (core/depression-fill.js
 *   erodeHeights) applied to the rock columns before filling; the result has no unreported minima.
 */
export function fillTerrainDepressions(world,{microSlope=0,rivers='clear',riverOptions={},lakes='rock',erosion=null}={}){
 if(!['clear','replan'].includes(rivers))throw new RangeError('rivers must be clear or replan');
 if(!['rock','water'].includes(lakes))throw new RangeError('lakes must be rock or water');
 if(world.cells.some(c=>{for(let l=1;l<=MAX_LEVEL;l++)if(world.isBuilt(c,l))return true;return false;}))throw new RangeError('terrain-only World required');
 let eroded=null;
 if(erosion){const h0=world.cells.map(c=>world.ground(c));eroded=erodeHeights(world.cells,h0,erosion===true?{}:erosion);
  for(const c of world.cells)for(let l=eroded.heights[c.id]+1;l<=h0[c.id];l++)world.setSolid(c,l,false);
  eroded={lowered:eroded.lowered,thermal:eroded.thermal,volume:eroded.volume,log:eroded.log,minimaAfterFill:eroded.minimaAfterFill};}
 const heights=world.cells.map(c=>world.ground(c)),r=depressionFill(world.cells,heights,{microSlope});
 const lc=lakeClusters(world.cells,heights,r);r.lakes=lc.lakes;r.minimaBefore=localMinima(world.cells,heights).length;r.erosion=eroded;
 if(lakes==='water'){
  // Water mode: nothing is raised; rivers running into a lake keep their marks (they now end in water).
  const level=new Int16Array(world.cells.length);for(const lake of r.lakes)for(const id of lake.cells)level[id]=lake.level;
  world.lakes={level,lakeOf:lc.lakeOf,lakes:r.lakes.map(l=>({...l,rim:rimOf(world,l)})),parent:r.parent,beds:Int16Array.from(heights)};
  r.invalidatedRiverCells=0;r.waterCells=r.lakes.reduce((a,l)=>a+l.area,0);
  r.minimaAfter=localMinima(world.cells,r.filled).length;r.drained=drainedCells(world.cells,r.filled).share;
  r.version=world.version;world.lakes.version=world.version;world.drainage=r;return r;
 }
 world.lakes=null;
 // If filling raises any river bed, invalidate its whole connected marked
 // reach rather than leaving decorative waterfalls/navigation on a broken river.
 const affected=new Set(),queue=[];
 for(const c of world.cells)if(r.filled[c.id]>heights[c.id]&&world.river[c.id]){affected.add(c.id);queue.push(c.id);}
 for(let k=0;k<queue.length;k++)for(const id of world.cells[queue[k]].edgeNeighbors)if(id>=0&&world.river[id]&&!affected.has(id)){affected.add(id);queue.push(id);}
 for(const c of world.cells)for(let l=heights[c.id]+1;l<=r.filled[c.id];l++)world.setSolid(c,l,true,{rock:true});
 for(const id of affected)world.river[id]=0;
 r.invalidatedRiverCells=affected.size;
 if(rivers==='replan'){world.river.fill(0);world.touch();r.riverNetwork=rebuildRiverNetwork(world,riverOptions);}
 const after=world.cells.map(c=>world.ground(c));r.minimaAfter=localMinima(world.cells,after).length;r.drained=drainedCells(world.cells,after).share;
 r.version=world.version;world.drainage=r;return r;
}
/** Cells bordering a lake (outside it): their ground must stay ≥ the water level for the lake to hold. */
function rimOf(world,lake){const inside=new Set(lake.cells),rim=new Set();for(const id of lake.cells)for(const nb of world.cells[id].edgeNeighbors)if(nb>=0&&!inside.has(nb))rim.add(nb);return[...rim];}
/** A lake is drawable while its beds are unchanged and every rim cell still holds the water. */
export function liveLakes(world){
 const W=world.lakes;if(!W||W.level?.length!==world.cells.length)return[];
 return W.lakes.filter(l=>l.cells.every(id=>world.ground(world.cells[id])===W.beds[id]&&!world.isSolid(world.cells[id],W.beds[id]+1))&&l.rim.every(id=>world.ground(world.cells[id])>=l.level));
}
