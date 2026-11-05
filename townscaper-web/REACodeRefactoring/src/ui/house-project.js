/** Project envelope around the unchanged v5 voxel format. Instance metadata is
 * not a second occupancy field; every receipt must agree with the saved World.
 */
import {World,MAX_LEVEL} from '../core/world.js';
import {encodeWorld,decodeWorld} from '../world/save.js';
const fields=['solid','rock','color','river'],mask=(1<<MAX_LEVEL)-1;
const scenes=['town','terrain','fusion'];
function gridKey(world){return JSON.stringify(world.cells.map(c=>[c.id,c.pts.map(p=>[p.x,p.z]),c.edgeNeighbors,c.edgeTwins]));}
function column(value,id){
  if(!value||value.id!==id||!fields.every(k=>Number.isInteger(value[k]))||value.solid<0||value.solid>mask||value.rock<0||(value.rock&value.solid)!==value.rock||value.color< -1||value.color>30||![0,1].includes(value.river))throw Error('Invalid project column');
  return Object.freeze({id,...Object.fromEntries(fields.map(k=>[k,value[k]]))});
}
function instances(world,records){
  if(!Array.isArray(records)||records.length>128)throw Error('Invalid instance list');
  const names=new Set(),used=new Set();
  return records.map(record=>{
    if(!record||typeof record.id!=='string'||!/^[A-Za-z0-9:_-]{1,80}$/.test(record.id)||names.has(record.id))throw Error('Invalid instance identity');
    names.add(record.id);if(record.entry===null)return Object.freeze({id:record.id,entry:null});
    const source=record.entry,p=source?.placement;
    if(!p||!Array.isArray(p.cells)||p.cells.length!==2||p.cells[0]===p.cells[1]||p.cells.some(id=>!Number.isInteger(id)||id<0||id>=world.cells.length||used.has(id))||!Number.isInteger(p.floor)||p.floor<1||!Number.isInteger(p.stories)||p.stories<1||p.floor+p.stories>MAX_LEVEL)throw Error('Invalid house footprint');
    const[a,b]=p.cells.map(id=>world.cells[id]);if(!a.edgeNeighbors.includes(b.id)||!b.edgeNeighbors.includes(a.id))throw Error('Disconnected house footprint');
    if(!Array.isArray(source.before)||!Array.isArray(source.after)||source.before.length!==2||source.after.length!==2)throw Error('Invalid edit receipt');
    const before=p.cells.map((id,i)=>column(source.before[i],id)),after=p.cells.map((id,i)=>column(source.after[i],id)),built=((1<<p.stories)-1)<<p.floor;
    for(let i=0;i<2;i++){
      const old=before[i],now=after[i];
      if((old.solid>>>p.floor)!==0||!(old.rock&(1<<(p.floor-1)))||old.river!==0||now.river!==0||now.solid!==(old.solid|built)||now.rock!==old.rock||now.color<0||fields.some(k=>world[k][now.id]!==now[k]))throw Error('Receipt does not match saved house');
      used.add(now.id);
    }
    const placement=Object.freeze({id:`${p.cells.join('+')}@${p.floor}:${p.stories}`,cells:Object.freeze([...p.cells]),floor:p.floor,stories:p.stories,kinds:Object.freeze([a.n,b.n])});
    return Object.freeze({id:record.id,entry:Object.freeze({placement,before:Object.freeze(before),after:Object.freeze(after)})});
  });
}
function decodeVoxels(world,voxel,scene){
  if(!scenes.includes(scene)||typeof voxel!=='string')throw Error('Invalid project scene');
  const staged=new World(world.grid);
  if(decodeWorld(voxel,staged)!==scene||encodeWorld(staged,scene)!==voxel)throw Error('Noncanonical voxel data');
  return staged;
}
export function exportHouseProject(world,entries,{scene='fusion',instanceIds}={}){
  if(!Array.isArray(entries))throw Error('Invalid project instances');
  instanceIds??=entries.map((_,i)=>`house:${i+1}`);
  if(!Array.isArray(instanceIds)||entries.length!==instanceIds.length)throw Error('Invalid project instances');
  const voxel=encodeWorld(world,scene),staged=decodeVoxels(world,voxel,scene);
  if(fields.some(k=>world[k].some((v,i)=>v!==staged[k][i])))throw Error('World cannot roundtrip through v5');
  const records=instances(world,entries.map((entry,i)=>({id:instanceIds[i],entry})));
  const text=JSON.stringify({kind:'rea-house-project',version:1,scene,grid:gridKey(world),voxel,instances:records});
  if(text.length>2_000_000)throw Error('Project exceeds supported size');
  return text;
}
export function importHouseProject(world,text,{expectedScene=null}={}){
  if(typeof text!=='string'||text.length>2_000_000)throw Error('Invalid project size');
  const data=JSON.parse(text);
  if(!data||data.kind!=='rea-house-project'||data.version!==1||data.grid!==gridKey(world))throw Error('Project version or grid mismatch');
  if(expectedScene!==null&&data.scene!==expectedScene)throw Error('Project scene mismatch');
  const staged=decodeVoxels(world,data.voxel,data.scene),records=instances(staged,data.instances);
  // Every parse/geometry/receipt check finishes before the single live commit.
  world.restore(staged.snapshot());
  return {scene:data.scene,entries:records.map(r=>r.entry),instanceIds:records.map(r=>r.id)};
}
