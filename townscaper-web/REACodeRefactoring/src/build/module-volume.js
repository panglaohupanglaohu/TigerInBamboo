/** 1751932427272909032: place a validated explicit footprint on shared World.
 * Voxel volume only, not the original prefab/socket library or deformed collision.
 * Undo receipts are session-local, owner-bound and stale-column checked.
 */
import{MAX_LEVEL}from'../core/world.js';
import{fitModuleGeometry}from'../core/module-fit.js';
const receipts=new WeakMap(),fields=['solid','rock','color','river'];
const column=(w,id)=>Object.fromEntries(fields.map(k=>[k,w[k][id]]));
export function placeModuleVolume(world,source,mapping,{floor=1,stories=1,color=3,expectedVersion=world.version}={}){
 if(!Number.isInteger(floor)||floor<1||!Number.isInteger(stories)||stories<1||floor+stories>MAX_LEVEL||!Number.isInteger(color)||color<0||color>30)throw new RangeError('Invalid module volume');
 if(expectedVersion!==world.version)return{ok:false,reason:'stale-version'};
 const fit=fitModuleGeometry(source,world.grid,mapping);if(!fit)return{ok:false,reason:'geometry'};
 // Inspect every column before publishing anything. No partial placement.
 for(const id of mapping){const c=world.cells[id];if(!world.isSolid(c,floor))return{ok:false,reason:'support',cell:id};if(world.river[id])return{ok:false,reason:'river',cell:id};for(let lv=floor+1;lv<=floor+stories;lv++)if(world.isSolid(c,lv))return{ok:false,reason:'occupied',cell:id};}
 const before=mapping.map(id=>column(world,id)),mask=((1<<stories)-1)<<floor;
 for(const id of mapping){world.solid[id]|=mask;world.color[id]=color;}world.touch();
 const receipt=Object.freeze({cells:Object.freeze([...mapping]),floor,stories});receipts.set(receipt,{world,grid:world.grid,before,after:mapping.map(id=>column(world,id))});
 return{ok:true,receipt,fit,version:world.version,scope:'shared-world-voxel-volume'};
}
export function undoModuleVolume(world,receipt){
 const entry=receipt&&receipts.get(receipt);if(!entry||entry.world!==world||entry.grid!==world.grid)return{ok:false,reason:'receipt'};
 for(let i=0;i<receipt.cells.length;i++){const id=receipt.cells[i];if(fields.some(k=>world[k][id]!==entry.after[i][k]))return{ok:false,reason:'stale-column',cell:id};}
 for(let i=0;i<receipt.cells.length;i++)for(const k of fields)world[k][receipt.cells[i]]=entry.before[i][k];world.touch();receipts.delete(receipt);return{ok:true,version:world.version};
}
