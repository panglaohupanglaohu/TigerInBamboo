/** Reversible editing of authored residential entities, NOT WFC. Geometry,
 * adjacency, terrain and protected public structures are never regenerated. */
export const TARGET_CITY_ENTITY_SCHEMA='target-city-entity-edit-v1';
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
const keysOnly=(o,keys)=>Object.keys(o).every(k=>keys.includes(k));
const hex=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)?value.toLowerCase():null;
const cloneEntries=a=>a.map(e=>({...e}));
const frozenSnapshot=s=>Object.freeze({...s,entities:Object.freeze(s.entities.map(e=>Object.freeze({...e})))});

export function createTargetCityEntityEditor({root,targetId,terrainVersion,factoryVersion,validate=null,historyLimit=100}={}){
 if(!root?.isObject3D)throw new TypeError('candidate root required');
 for(const [key,value]of Object.entries({targetId,terrainVersion,factoryVersion}))if(typeof value!=='string'||!value.trim())throw new TypeError(`${key} must be a nonempty version/ID string`);
 if(validate!==null&&typeof validate!=='function')throw new TypeError('validate must be a synchronous function');
 if(!Number.isInteger(historyLimit)||historyLimit<1||historyLimit>100)throw new RangeError('historyLimit must be 1..100');
 const registry=new Map(),owners=new WeakMap(),undoStack=[],redoStack=[];let disposed=false,revision=0;
 root.traverse(group=>{
  const metadata=group.userData?.targetEditableHouse;if(!group.isGroup||metadata?.city!=='old')return;
  if(typeof metadata.id!=='string'||!metadata.id||group.name!==metadata.id||registry.has(metadata.id))throw new Error('duplicate or unstable old-city house ID');
  const walls=[];group.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.targetWall===true){const original=mesh.material,list=Array.isArray(original)?original:[original];if(!list.length||list.some(m=>!m?.isMaterial||!m.color?.isColor))throw new Error('editable wall requires colour materials');walls.push({mesh,original,list});}});
  if(!walls.length)throw new Error(`house ${metadata.id} has no marked wall`);
  const colours=new Set(walls.flatMap(w=>w.list.map(m=>'#'+m.color.getHexString())));if(colours.size!==1)throw new Error('one wall colour per editable house required');
  const initial={id:metadata.id,occupied:group.visible,wallColor:[...colours][0]},entity={id:metadata.id,group,walls,initial,state:{...initial},owned:new Set(),colour:metadata.colour};registry.set(entity.id,entity);owners.set(group,entity);
 });
 const sorted=[...registry.values()].sort((a,b)=>a.id.localeCompare(b.id));
 const list=()=>sorted.map(e=>({...e.state}));
 const snapshot=entries=>({schema:TARGET_CITY_ENTITY_SCHEMA,targetId,terrainVersion,factoryVersion,entities:cloneEntries(entries??list())});
 const failure=error=>({ok:false,error:String(error?.message||error),revision});
 function canonicalSnapshot(input){
  const data=typeof input==='string'?JSON.parse(input):input;
  if(!plain(data)||!keysOnly(data,['schema','targetId','terrainVersion','factoryVersion','entities']))throw new Error('invalid snapshot fields');
  for(const [key,value]of Object.entries({schema:TARGET_CITY_ENTITY_SCHEMA,targetId,terrainVersion,factoryVersion}))if(data[key]!==value)throw new Error(`snapshot ${key} mismatch`);
  if(!Array.isArray(data.entities)||data.entities.length!==registry.size)throw new Error('snapshot requires every registered entity exactly once');
  const byId=new Map();for(const e of data.entities){if(!plain(e)||!keysOnly(e,['id','occupied','wallColor'])||typeof e.id!=='string'||!registry.has(e.id)||byId.has(e.id)||typeof e.occupied!=='boolean'||!hex(e.wallColor))throw new Error('invalid, duplicate or unknown entity snapshot');byId.set(e.id,{id:e.id,occupied:e.occupied,wallColor:hex(e.wallColor)});}
  return sorted.map(e=>byId.get(e.id));
 }
 function publish(entries,{record=true}={}){
  if(disposed)return failure('editor disposed');
  const before=list();if(JSON.stringify(before)===JSON.stringify(entries))return{ok:true,changed:false,revision};
  if(validate){try{const result=validate(frozenSnapshot(snapshot(entries)),frozenSnapshot(snapshot(before)));if(result?.then)throw new Error('asynchronous validate is not supported');if(result!==true&&result?.ok!==true)throw new Error(result?.error||result?.reason||'candidate validation rejected');}catch(error){return failure(error);}}
  const prepared=[];try{
   for(const state of entries){const e=registry.get(state.id),changeColor=state.wallColor!==e.state.wallColor,owned=new Set(),bindings=[];const plan={e,state,changeColor,owned,bindings,previousVisible:e.group.visible};prepared.push(plan);
    if(changeColor){const clones=new Map();for(const wall of e.walls){const next=wall.list.map(original=>{if('#'+original.color.getHexString()===state.wallColor)return original;if(!clones.has(original)){const clone=original.clone();owned.add(clone);clone.color.set(state.wallColor);clone.needsUpdate=true;clones.set(original,clone);}return clones.get(original);});bindings.push({mesh:wall.mesh,previous:wall.mesh.material,next:Array.isArray(wall.original)?next:next[0]});}}
   }
  }catch(error){prepared.forEach(p=>p.owned.forEach(m=>m.dispose()));return failure(error);}
  try{for(const p of prepared){for(const binding of p.bindings)binding.mesh.material=binding.next;p.e.group.visible=p.state.occupied;}}
  catch(error){for(const p of prepared){for(const b of p.bindings)b.mesh.material=b.previous;p.e.group.visible=p.previousVisible;p.owned.forEach(m=>m.dispose());}return failure(error);}
  for(const p of prepared){if(p.changeColor){p.e.owned.forEach(m=>m.dispose());p.e.owned=p.owned;}p.e.state={...p.state};}
  if(record){undoStack.push(before);if(undoStack.length>historyLimit)undoStack.shift();redoStack.length=0;}revision++;
  return{ok:true,changed:true,revision,entities:list(),mode:'authored-entity-edit',wfc:false};
 }
 function importSnapshot(input){if(disposed)return failure('editor disposed');try{return publish(canonicalSnapshot(input));}catch(error){return failure(error);}}
 function edit(patch){if(disposed)return failure('editor disposed');if(!plain(patch)||!keysOnly(patch,['id','occupied','wallColor'])||typeof patch.id!=='string'||!registry.has(patch.id))return failure('unknown entity or unsupported edit field');
  if('occupied'in patch&&typeof patch.occupied!=='boolean')return failure('occupied must be boolean');if('wallColor'in patch&&!hex(patch.wallColor))return failure('wallColor must be #RRGGBB');
  const next=list();const state=next.find(e=>e.id===patch.id);if('occupied'in patch)state.occupied=patch.occupied;if('wallColor'in patch)state.wallColor=hex(patch.wallColor);return publish(next);
 }
 function visible(hit){const object=hit?.object;if(!object?.isMesh)return false;for(let node=object;node;node=node.parent)if(!node.visible)return false;const mats=Array.isArray(object.material)?object.material:[object.material],m=Array.isArray(object.material)&&Number.isInteger(hit.face?.materialIndex)?mats[hit.face.materialIndex]:null;return(m?[m]:mats).some(m=>m&&m.visible!==false&&!(m.transparent&&m.opacity<=0));}
 function pick(hits=[]){if(disposed)return null;const hit=hits.filter(visible).slice().sort((a,b)=>(a.distance??Infinity)-(b.distance??Infinity))[0];if(!hit)return null;let entity=null;for(let node=hit.object;node;node=node.parent){const owner=owners.get(node);if(owner){entity=owner;break;}}
  return entity&&entity.state.occupied?{kind:'entity',id:entity.id,entity:{...entity.state},hit,object:hit.object}:{kind:'protected',id:null,reason:'nearest-visible-surface-protected',hit,object:hit.object};
 }
 return{
  schema:TARGET_CITY_ENTITY_SCHEMA,mode:'authored-entity-edit',wfc:false,get revision(){return revision;},get size(){return registry.size;},get history(){return{undo:undoStack.length,redo:redoStack.length,limit:historyLimit};},list,edit,
  exportSnapshot(){return snapshot();},exportJSON(){return JSON.stringify(snapshot(),null,2);},importSnapshot,
  undo(){if(disposed)return failure('editor disposed');if(!undoStack.length)return failure('empty undo');const current=list(),result=publish(cloneEntries(undoStack.at(-1)),{record:false});if(result.ok){undoStack.pop();redoStack.push(current);}return result;},
  redo(){if(disposed)return failure('editor disposed');if(!redoStack.length)return failure('empty redo');const current=list(),result=publish(cloneEntries(redoStack.at(-1)),{record:false});if(result.ok){redoStack.pop();undoStack.push(current);if(undoStack.length>historyLimit)undoStack.shift();}return result;},
  pick,intersectClosestVisible(raycaster,scene=root){if(disposed)return null;if(!raycaster?.intersectObject||!scene?.isObject3D)throw new TypeError('Raycaster and scene required');scene.updateWorldMatrix(true,true);return pick(raycaster.intersectObject(scene,true));},
  dispose(){if(disposed)return;disposed=true;for(const e of sorted){e.group.visible=e.initial.occupied;for(const b of e.walls)b.mesh.material=b.original;e.owned.forEach(m=>m.dispose());e.owned.clear();e.state={...e.initial};}undoStack.length=redoStack.length=0;}
 };
}
