import {createTargetCityEntityEditor,TARGET_CITY_ENTITY_SCHEMA} from './targetCityEntityEditor.js?revision=realm-r38';
import {solveTargetOldCityRoofWfc,TARGET_OLD_CITY_ROOF_WFC_VERSION,TARGET_OLD_CITY_HOUSE_IDS,validateTargetOldCityRoofRoles} from './targetOldCityRoofWfc.js?revision=realm-r38';

export const TARGET_OLD_CITY_ROOF_SESSION_SCHEMA='target-old-city-roof-session-v1';
const copy=o=>JSON.parse(JSON.stringify(o));
// Accept genuine plain records across iframe realms, but reject class/custom prototypes.
const plain=o=>{if(o===null||typeof o!=='object'||Object.prototype.toString.call(o)!=='[object Object]')return false;const p=Object.getPrototypeOf(o);return p===null||(Object.getPrototypeOf(p)===null&&Object.hasOwn(p,'constructor')&&typeof p.constructor==='function'&&p.constructor.prototype===p&&Function.prototype.toString.call(p.constructor)===Function.prototype.toString.call(Object));};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exactKeys=(o,keys)=>plain(o)&&Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const ids=TARGET_OLD_CITY_HOUSE_IDS;
function fullRoles(value){const roles=validateTargetOldCityRoofRoles(value);if(Object.keys(roles).length!==15||ids.some(id=>!Object.hasOwn(roles,id)))throw new Error('complete 15-house roofRoles map required');return roles;}
function fullOccupied(value){if(!exactKeys(value,ids)||Object.values(value).some(v=>typeof v!=='boolean'))throw new Error('complete boolean occupied map required');return Object.fromEntries(ids.map(id=>[id,value[id]]));}
function assetRoles(asset){if(!asset?.group?.isGroup||typeof asset.dispose!=='function'||!Array.isArray(asset.report?.houses)||asset.report.houses.length!==15||new Set(asset.report.houses.map(h=>h.id)).size!==15)throw new TypeError('owned 15-house factory asset required');return fullRoles(Object.fromEntries(asset.report.houses.map(h=>[h.id,h.roofRole])));}
const publicLayout=report=>({entry:report.entry,exits:report.exits,stairs:report.stairs,footprints:report.footprints?.map(f=>{const out=copy(f);if(ids.includes(f.id))delete out.roofY;return out;})});
/** Synchronous transaction owner. No UI is installed.
 * createAsset({roofRoles}) MUST create an independently owned, detached asset,
 * with the same placement as the live asset. It cleans up internally on throw.
 * commitAsset(next,previous) MUST atomically update scene/report/forest and
 * return true/{ok:true}; false/{ok:false} or throw means no external commit.
 * It must not dispose previous; resource retirement belongs to this session.
 * The session can restore the old scene parent on failure, but cannot undo an
 * arbitrary callback's external report/forest side effects.
 *
 * Ownership: after successful construction the session owns initialAsset.
 * After commit it disposes previous editor (clones first), then previous asset.
 * root.close calls session.close() ONLY; it must not dispose initialAsset or
 * currentAsset separately. Reading currentAsset/currentEditor grants no dispose
 * or mutation ownership. All edits must go through the session facade.
 */
export function createTargetOldCityRoofSession({initialAsset,createAsset,editorOptions={},commitAsset}={}){
 for(const[name,fn]of Object.entries({createAsset,commitAsset}))if(typeof fn!=='function'||fn.constructor.name==='AsyncFunction')throw new TypeError(`${name} must be synchronous`);
 let roofRoles=assetRoles(initialAsset),asset=initialAsset,editor=null,provenance=null,closed=false,busy=false,revision=0;
 const assetFactoryVersion=initialAsset.report.version;if(typeof assetFactoryVersion!=='string'||!assetFactoryVersion)throw new TypeError('factory asset version required');
 const fixedLayout=copy(publicLayout(initialAsset.report)),options={...editorOptions},limit=options.historyLimit??100,entityPast=[],entityFuture=[],roofPast=[],roofFuture=[],disposedAssets=new WeakSet();
 if(options.validate!=null&&typeof options.validate!=='function')throw new TypeError('editorOptions.validate must be a function');
 const meta={targetId:options.targetId,terrainVersion:options.terrainVersion,factoryVersion:options.factoryVersion};
 const fail=error=>({ok:false,error:String(error?.message||error),revision});
 const validate=(next,previous,context)=>{if(!options.validate)return;const result=options.validate(freeze(copy(next)),freeze(copy(previous)),context);if(result?.then||result!==true&&result?.ok!==true)throw new Error(result?.error||result?.reason||(result?.then?'asynchronous validation is not supported':'candidate validation rejected'));};
 function makeEditor(owner,staged=false){const stage={pending:staged};return{stage,editor:createTargetCityEntityEditor({...options,root:owner.group,validate:options.validate?(next,previous)=>{if(!stage.pending)validate(next,previous,{asset:owner,previousAsset:owner,reason:'entity-edit'});return true;}:null})};}
 editor=makeEditor(asset).editor;if(editor.size!==15){editor.dispose();throw new Error('editor must register exactly 15 old-city entities');}
 function canonicalEntities(input){
  if(!exactKeys(input,['schema','targetId','terrainVersion','factoryVersion','entities'])||input.schema!==TARGET_CITY_ENTITY_SCHEMA)throw new Error('invalid entitySnapshot schema or fields');
  for(const[k,v]of Object.entries(meta))if(input[k]!==v)throw new Error(`entitySnapshot ${k} mismatch`);
  if(!Array.isArray(input.entities)||input.entities.length!==15)throw new Error('complete entitySnapshot required');const rows=new Map();
  for(const e of input.entities){if(!exactKeys(e,['id','occupied','wallColor'])||!ids.includes(e.id)||rows.has(e.id)||typeof e.occupied!=='boolean'||typeof e.wallColor!=='string'||!/^#[a-f\d]{6}$/i.test(e.wallColor))throw new Error('invalid entitySnapshot entity');rows.set(e.id,{id:e.id,occupied:e.occupied,wallColor:e.wallColor.toLowerCase()});}
  return{schema:TARGET_CITY_ENTITY_SCHEMA,...meta,entities:ids.map(id=>rows.get(id))};
 }
 const roofState=()=>({roofRoles:copy(roofRoles),solverProvenance:copy(provenance)});
 const snapshot=()=>({schema:TARGET_OLD_CITY_ROOF_SESSION_SCHEMA,...meta,assetFactoryVersion,solverVersion:TARGET_OLD_CITY_ROOF_WFC_VERSION,roofRoles:copy(roofRoles),entitySnapshot:editor.exportSnapshot(),solverProvenance:copy(provenance)});
 function canonicalProvenance(input,roles){
  if(input===null)return null;
  if(!exactKeys(input,['version','seed','maxBacktrack','locks','domains','occupiedAtSolve','inputRoofRoles','solutionHash'])||input.version!==TARGET_OLD_CITY_ROOF_WFC_VERSION)throw new Error('invalid solverProvenance schema/version');
  const prior=fullRoles(input.inputRoofRoles),occupied=fullOccupied(input.occupiedAtSolve),report={...asset.report,houses:asset.report.houses.map(h=>({...h,roofRole:prior[h.id]}))};
  const result=solveTargetOldCityRoofWfc({report,occupied,locks:input.locks,domains:input.domains,seed:input.seed,maxBacktrack:input.maxBacktrack});
  if(!result.ok||result.solutionHash!==input.solutionHash||!same(result.roofRoles,roles))throw new Error('solverProvenance replay mismatch or conflicting locks');
  return copy({...input,inputRoofRoles:prior,occupiedAtSolve:occupied});
 }
 function canonicalSnapshot(input){const data=typeof input==='string'?JSON.parse(input):input;
  if(!exactKeys(data,['schema','targetId','terrainVersion','factoryVersion','assetFactoryVersion','solverVersion','roofRoles','entitySnapshot','solverProvenance']))throw new Error('invalid roof session snapshot fields');
  for(const[k,v]of Object.entries({schema:TARGET_OLD_CITY_ROOF_SESSION_SCHEMA,...meta,assetFactoryVersion,solverVersion:TARGET_OLD_CITY_ROOF_WFC_VERSION}))if(data[k]!==v)throw new Error(`snapshot ${k} mismatch`);
  const roles=fullRoles(data.roofRoles),entities=canonicalEntities(data.entitySnapshot),source=canonicalProvenance(data.solverProvenance,roles);return{roofRoles:roles,entitySnapshot:entities,solverProvenance:source};
 }
 function boundedPush(stack,value){stack.push(copy(value));if(stack.length>limit)stack.shift();}
 function cleanup(owner,ed,warnings){try{ed?.dispose();}catch(error){warnings.push('editor cleanup: '+error.message);}if(owner&&typeof owner==='object'&&owner!==asset&&!disposedAssets.has(owner)){disposedAssets.add(owner);try{owner.dispose();}catch(error){warnings.push('asset cleanup: '+error.message);}}}
 function restorePlacement(group,parent,index){if(group.parent!==parent){group.removeFromParent();if(parent)parent.add(group);}if(parent){const now=parent.children.indexOf(group);if(now!==index&&index>=0){parent.children.splice(now,1);parent.children.splice(Math.min(index,parent.children.length),0,group);}}}
 function rebuild(target,reason){
  const roles=fullRoles(target.roofRoles),entities=canonicalEntities(target.entitySnapshot),source=canonicalProvenance(target.solverProvenance,roles),previous=asset,previousEditor=editor,previousEntities=editor.exportSnapshot(),parent=previous.group.parent,index=parent?.children.indexOf(previous.group)??-1;
  let staged=null,pair=null;const warnings=[];
  try{
   staged=createAsset({roofRoles:copy(roles)});if(staged?.then)throw new Error('createAsset returned a Promise');if(staged===previous||staged?.group===previous.group){staged=null;throw new Error('createAsset must create an independent asset');}
   const actualRoles=assetRoles(staged);if(staged.group.parent)throw new Error('staged asset must be detached');if(staged.report.version!==assetFactoryVersion)throw new Error('staged factory version mismatch');if(!same(actualRoles,roles))throw new Error('staged factory ignored roofRoles');if(!same(publicLayout(staged.report),fixedLayout))throw new Error('staged asset changed protected public layout or footprints');
   if(previous.group.matrixAutoUpdate)previous.group.updateMatrix();if(staged.group.matrixAutoUpdate)staged.group.updateMatrix();if(staged.group.matrix.elements.some((n,i)=>Math.abs(n-previous.group.matrix.elements[i])>1e-8))throw new Error('staged placement mismatch');
   pair=makeEditor(staged,true);if(pair.editor.size!==15)throw new Error('staged editor identity mismatch');const imported=pair.editor.importSnapshot(entities);if(!imported.ok)throw new Error(imported.error);
   // Always validate geometry, even when colours/occupancy equal factory defaults
   // and the low-level editor would otherwise consider import a no-op.
   validate(entities,previousEntities,{asset:staged,previousAsset:previous,reason});
   staged.report.roofSolverProvenance=copy(source);
   const committed=commitAsset(staged,previous);if(committed?.then||committed!==true&&committed?.ok!==true)throw new Error(committed?.error||committed?.reason||(committed?.then?'commitAsset returned a Promise':'commitAsset rejected'));
   if(staged.group.parent!==parent)throw new Error('commitAsset did not publish the staged asset at the previous parent');
  }catch(error){if(staged&&staged!==previous)cleanup(staged,pair?.editor,warnings);restorePlacement(previous.group,parent,index);return{...fail(error),cleanupWarnings:warnings};}
  asset=staged;editor=pair.editor;pair.stage.pending=false;roofRoles=roles;provenance=source;revision++;cleanup(previous,previousEditor,warnings);
  return{ok:true,changed:true,revision,operation:reason,cleanupWarnings:warnings,solverProvenance:copy(provenance)};
 }
 function run(action){if(closed)return fail('session closed');if(busy)return fail('session transaction already in progress');busy=true;try{return action();}catch(error){return fail(error);}finally{busy=false;}}
 function entityOperation(apply,{record=true}={}){const before=editor.exportSnapshot(),result=apply();if(result.ok&&result.changed){if(record){boundedPush(entityPast,before);entityFuture.length=0;}revision++;}return{...result,revision,historyDomain:'entities'};}
 function entityUndo(redo){return run(()=>{const from=redo?entityFuture:entityPast,to=redo?entityPast:entityFuture;if(!from.length)return fail(redo?'empty entity redo':'empty entity undo');const before=editor.exportSnapshot(),result=entityOperation(()=>editor.importSnapshot(from.at(-1)),{record:false});if(result.ok){from.pop();boundedPush(to,before);}return result;});}
 function roofUndo(redo){return run(()=>{const from=redo?roofFuture:roofPast,to=redo?roofPast:roofFuture;if(!from.length)return fail(redo?'empty roof redo':'empty roof undo');const before=roofState(),result=rebuild({...copy(from.at(-1)),entitySnapshot:editor.exportSnapshot()},redo?'roof-redo':'roof-undo');if(result.ok){from.pop();boundedPush(to,before);}return result;});}
 function solveEntities(entities,input,reason){
  if(!plain(input)||Object.keys(input).some(k=>!['locks','domains','seed','maxBacktrack'].includes(k)))return fail('unsupported roof solve input');
  const occupied=Object.fromEntries(entities.entities.map(e=>[e.id,e.occupied])),locks=input.locks??{},domains=input.domains??{},seed=input.seed??20261006,maxBacktrack=input.maxBacktrack??32;
  const solved=solveTargetOldCityRoofWfc({report:asset.report,occupied,locks,domains,seed,maxBacktrack});if(!solved.ok)return{...fail(solved.reason),solver:solved};
  const before=roofState(),source={version:TARGET_OLD_CITY_ROOF_WFC_VERSION,seed,maxBacktrack,locks:copy(locks),domains:copy(domains),occupiedAtSolve:occupied,inputRoofRoles:copy(roofRoles),solutionHash:solved.solutionHash};
  const result=rebuild({roofRoles:solved.roofRoles,entitySnapshot:entities,solverProvenance:source},reason);if(result.ok){boundedPush(roofPast,before);roofFuture.length=0;}return{...result,solver:solved};
 }
 return{
  schema:TARGET_OLD_CITY_ROOF_SESSION_SCHEMA,mode:'fixed-old-city-roof-wfc-session',get currentAsset(){return asset;},get currentEditor(){return editor;},get revision(){return revision;},get size(){return editor?.size??0;},get closed(){return closed;},
  get history(){return{undo:entityPast.length,redo:entityFuture.length,limit};},get roofHistory(){return{undo:roofPast.length,redo:roofFuture.length,limit};},get solverProvenance(){return copy(provenance);},
  get roofConstraintStatus(){return{source:provenance?'wfc':'authored-or-explicit',occupancyMatchesSolve:provenance&&editor?same(Object.fromEntries(editor.list().map(e=>[e.id,e.occupied])),provenance.occupiedAtSolve):null};},
  list(){return editor?.list()??[];},edit(patch){return run(()=>entityOperation(()=>editor.edit(patch)));},undo(){return entityUndo(false);},redo(){return entityUndo(true);},undoRoof(){return roofUndo(false);},redoRoof(){return roofUndo(true);},
  pick(hits){return editor?.pick(hits)??null;},intersectClosestVisible(raycaster,scene){return editor?.intersectClosestVisible(raycaster,scene??asset.group)??null;},
  solve(input={}){return run(()=>solveEntities(editor.exportSnapshot(),input,'roof-solve'));},
  // Both changes publish in one rebuild. Independent entity/roof undo domains
  // deliberately remain separate; undoing occupancy can mark constraints stale.
  editAndSolve(patch,input={}){return run(()=>{
   if(!plain(patch)||Object.keys(patch).some(k=>!['id','occupied','wallColor'].includes(k))||!ids.includes(patch.id)||typeof patch.occupied!=='boolean'||(Object.hasOwn(patch,'wallColor')&&(typeof patch.wallColor!=='string'||!/^#[a-f\d]{6}$/i.test(patch.wallColor))))return fail('editAndSolve requires a valid occupancy patch');
   if(!plain(input))return fail('unsupported roof solve input');
   const before=editor.exportSnapshot(),next=copy(before),row=next.entities.find(e=>e.id===patch.id);row.occupied=patch.occupied;if(Object.hasOwn(patch,'wallColor'))row.wallColor=patch.wallColor.toLowerCase();
   // Omitted options retain the last solver constraints. Deleting a plot clears
   // only its own lock; locks on every other plot still participate in solving.
   const effective={locks:provenance?.locks??{},domains:provenance?.domains??{},seed:provenance?.seed??20261006,maxBacktrack:provenance?.maxBacktrack??32,...input};
   if(!plain(effective.locks))return fail('invalid locks map');effective.locks={...effective.locks};const clearedLocks=[];if(!patch.occupied&&Object.hasOwn(effective.locks,patch.id)){delete effective.locks[patch.id];clearedLocks.push(patch.id);}
   const result=solveEntities(next,effective,'entity-and-roof-solve');if(result.ok&&!same(before,next)){boundedPush(entityPast,before);entityFuture.length=0;}return{...result,clearedLocks:result.ok?clearedLocks:[],historyDomain:'entities-and-roofs'};
  });},
  exportSnapshot(){if(closed)throw new Error('session closed');return snapshot();},exportJSON(){if(closed)throw new Error('session closed');return JSON.stringify(snapshot(),null,2);},
  importSnapshot(input){return run(()=>{const target=canonicalSnapshot(input),result=rebuild(target,'snapshot-import');if(result.ok){entityPast.length=entityFuture.length=roofPast.length=roofFuture.length=0;result.historyReset=true;}return result;});},
  // Successful import starts a new document history baseline; failed imports
  // preserve both histories. Normal roof undo never undoes residential edits.
  close(){if(closed)return{ok:true,changed:false,revision};if(busy)return fail('cannot close during transaction');closed=true;const old=asset,oldEditor=editor,warnings=[];asset=editor=null;cleanup(old,oldEditor,warnings);entityPast.length=entityFuture.length=roofPast.length=roofFuture.length=0;return{ok:true,changed:true,revision,cleanupWarnings:warnings};}
 };
}
