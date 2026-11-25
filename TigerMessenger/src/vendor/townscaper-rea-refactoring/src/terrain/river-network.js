import {MAX_LEVEL} from '../core/world.js';
import {planRiverNetwork} from '../core/river-network.js';
/** Destructive terrain tool, deliberately rejects buildings/caves instead of
 * silently replacing them with solid columns. Default generation is unchanged.
 */
export function rebuildRiverNetwork(world,options={}){
 const threshold=options.threshold??8,depth=options.depth??1,key=JSON.stringify([threshold,depth]);
 if(world.riverNetwork?.version===world.version&&world.riverNetwork.key===key)return world.riverNetwork;
 const heights=world.cells.map(c=>world.ground(c));
 for(const c of world.cells){const h=heights[c.id],mask=h?(1<<h)-1:0;if(world.solid[c.id]!==world.rock[c.id]||world.rock[c.id]!==mask)throw new RangeError('river rebuild requires continuous terrain-only columns; buildings/caves preserved');}
 const result=planRiverNetwork(world.cells,heights,{threshold,depth});
 if(Array.from(result.bed).some(h=>!Number.isInteger(h)||h<0||h>MAX_LEVEL))throw new RangeError('river height outside World');
 let changed=0;for(const c of world.cells){const id=c.id,h=result.bed[id];if(h!==heights[id]){world.fill(c,h,{rock:true});changed++;}}
 // Replace stale reaches only after the whole proposal passes validation.
 world.river.set(result.river);world.touch();world.drainage=null;
 result.version=world.version;result.key=key;result.changed=changed;world.riverNetwork=result;return result;
}
