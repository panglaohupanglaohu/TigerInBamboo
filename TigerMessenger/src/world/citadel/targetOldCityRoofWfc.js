import {BitSet} from '../../procgen/core/bitSet.js';
import {solveWfc} from '../../procgen/wfc/solver.js';
import {partialObservation} from '../../procgen/wfc/partialObservation.js';

/** Pure-data adapter for ONLY the 15 existing authored old-city roof plots.
 * Uses the shared WFC engine; does not place buildings, solve terrain, install
 * navigation, edit a scene, or change occupancy. Deleted plots break adjacency. */
export const TARGET_OLD_CITY_ROOF_WFC_VERSION='target-old-city-roof-wfc-1';
export const TARGET_OLD_CITY_ROOF_ROLES=Object.freeze(['hip-roof','open-terrace-pavilion','setback-upper-room','outer-edge-short-tower','upper-street-cupola']);
export const TARGET_OLD_CITY_HOUSE_IDS=Object.freeze(Array.from({length:3},(_,row)=>[-1,1].flatMap(side=>Array.from({length:row===2?2:3},(_,col)=>row===2&&side===1&&col===1?null:`house-${row}-${side}-${col}`).filter(Boolean))).flat().sort());
const ids=new Set(TARGET_OLD_CITY_HOUSE_IDS),roles=new Set(TARGET_OLD_CITY_ROOF_ROLES),tower=new Set(['outer-edge-short-tower','upper-street-cupola']);
// Accept genuine plain records across iframe realms, but reject class/custom prototypes.
const record=o=>{if(o===null||typeof o!=='object'||Object.prototype.toString.call(o)!=='[object Object]')return false;const p=Object.getPrototypeOf(o);return p===null||(Object.getPrototypeOf(p)===null&&Object.hasOwn(p,'constructor')&&typeof p.constructor==='function'&&p.constructor.prototype===p&&Function.prototype.toString.call(p.constructor)===Function.prototype.toString.call(Object));};
const weights={'hip-roof':6,'open-terrace-pavilion':2,'setback-upper-room':2,'outer-edge-short-tower':1,'upper-street-cupola':.6};
/** Conservative plan envelope of the actual factory parts, including eaves,
 * drip edge and terrace rail; never scales a building to fit a smaller plot. */
export function targetOldCityRoofRequirements(role,width,height,floorY){
 if(!roles.has(role)||![width,height,floorY].every(Number.isFinite)||width<=0||height<=0)throw new TypeError('invalid roof geometry requirements');
 const base=role==='hip-roof'?height:Math.max(4.6,height-1.3),rise={'hip-roof':1.25,'open-terrace-pavilion':3.47,'setback-upper-room':4.37,'outer-edge-short-tower':5.07,'upper-street-cupola':7.08}[role];
 return{width:width+(role==='hip-roof'?.4:.3),depth:role==='hip-roof'?5.1:5,roofY:floorY+base+rise};
}
export function validateTargetOldCityRoofRoles(overrides){
 if(!record(overrides))throw new TypeError('roofRoles must be a plain ID-to-role object');
 for(const[id,role]of Object.entries(overrides))if(!ids.has(id)||!roles.has(role))throw new TypeError(`invalid roofRoles entry: ${id}=${String(role)}`);
 return Object.fromEntries(Object.entries(overrides).sort(([a],[b])=>a.localeCompare(b)));
}
/** Both terrace roles may border each other; their decks have independent
 * railings and are NOT claimed to be walkable connections between buildings. */
export function targetOldCityRoofCompatible(a,b,kind){
 if(!roles.has(a)||!roles.has(b)||!['street','slope'].includes(kind))throw new TypeError('invalid roof compatibility query');
 return !(tower.has(a)&&tower.has(b))&&!(kind==='slope'&&a==='hip-roof'&&b==='hip-roof');
}
function prepare({report,houses=report?.houses,footprints=report?.footprints,occupied={},locks={},domains={}}={}){
 if(!Array.isArray(houses)||houses.length!==15||new Set(houses.map(h=>h?.id)).size!==15||houses.some(h=>!ids.has(h?.id)||!roles.has(h.roofRole)))throw new TypeError('exactly 15 known houses with current roofRole required');
 if(!Array.isArray(footprints))throw new TypeError('actual footprint report required');
 for(const[name,map]of Object.entries({occupied,locks,domains}))if(!record(map)||Object.keys(map).some(id=>!ids.has(id)))throw new TypeError(`invalid ${name} map or unknown house ID`);
 if(Object.values(occupied).some(v=>typeof v!=='boolean'))throw new TypeError('occupied values must be boolean');
 if(Object.values(locks).some(v=>v!==null&&!roles.has(v)))throw new TypeError('locks must contain a roof role, or null for a deleted plot');
 if(Object.values(domains).some(v=>!Array.isArray(v)||new Set(v).size!==v.length||v.some(r=>!roles.has(r))))throw new TypeError('domains must be arrays of unique implemented roof roles');
 const plots=TARGET_OLD_CITY_HOUSE_IDS.map(id=>{const h=houses.find(h=>h.id===id),matches=footprints.filter(f=>f.id===id);if(matches.length!==1)throw new TypeError(`one actual footprint required for ${id}`);const f=matches[0];
  if(!Array.isArray(f.polygon)||f.polygon.length!==4||f.polygon.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))||!Number.isFinite(f.floorY))throw new TypeError(`invalid plot polygon ${id}`);
  const x=f.polygon.map(p=>p[0]),z=f.polygon.map(p=>p[1]),min=[Math.min(...x),Math.min(...z)],max=[Math.max(...x),Math.max(...z)],area=Math.abs(f.polygon.reduce((sum,p,i)=>{const q=f.polygon[(i+1)%4];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;if(max.some((n,i)=>n-min[i]<=0)||new Set(f.polygon.map(p=>p.join(','))).size!==4||Math.abs(area-(max[0]-min[0])*(max[1]-min[1]))>1e-6||f.polygon.some(p=>p.some((v,i)=>Math.abs(v-min[i])>1e-7&&Math.abs(v-max[i])>1e-7)))throw new TypeError(`authored axis-aligned rectangle required: ${id}`);
  const baseWidth=h.volumes?.find(v=>v.id==='base')?.w??(id.endsWith('-1')?6.7:4.85),height=h.authoredHeight??(h.roofRole==='hip-roof'?h.height:h.height+1.3);
  if(!Number.isFinite(height)||height<=0)throw new TypeError(`authored house height required: ${id}`);
  return{id,roofRole:h.roofRole,occupied:occupied[id]??true,floorY:f.floorY,polygon:f.polygon.map(p=>[...p]),min,max,baseWidth,height};});
 const edges=[];for(let i=0;i<plots.length;i++)for(let j=i+1;j<plots.length;j++){
  const a=plots[i],b=plots[j],overlap=[0,1].map(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k])),gap=overlap.map(n=>Math.max(0,-n)),levelDelta=Math.abs(a.floorY-b.floorY);
  let kind=null;if(levelDelta<.05&&gap[0]<=.8&&overlap[1]>1)kind='street';else if(levelDelta>.05&&levelDelta<=4.05&&overlap[0]>.1&&gap[1]<=6)kind='slope';
  if(kind)edges.push({a:a.id,b:b.id,kind,active:a.occupied&&b.occupied,source:'actual-footprint-proximity',gap,projectedOverlap:overlap,levelDelta});
 }
 const active=plots.filter(p=>p.occupied),indices=new Map(active.map((p,i)=>[p.id,i])),adjacency=active.map(()=>[]);
 for(const e of edges)if(e.active){const a=indices.get(e.a),b=indices.get(e.b);adjacency[a].push({to:b,direction:e.kind});adjacency[b].push({to:a,direction:e.kind});}
 const graph={kind:'target-old-city-roof-plots',cellCount:active.length,cells:()=>active.map((p,index)=>({id:p.id,index})),cellId:i=>active[i]?.id,indexOfId:id=>indices.get(id)??-1,neighborsOf:i=>adjacency[i]||[]};
 const variants=TARGET_OLD_CITY_ROOF_ROLES.slice().sort().map((key,index)=>({key,index,weight:weights[key]})),compiled={variants,variantIndex:new Map(variants.map(v=>[v.key,v.index]))},compatible={};
 for(const kind of['street','slope'])compatible[kind]=variants.map(a=>{const set=new BitSet(variants.length,false);for(const b of variants)if(targetOldCityRoofCompatible(a.key,b.key,kind))set.set(b.index);return set;});
 const pins=[],bans=[],inputConflicts=[],geometryBans=[];
 for(const p of plots){const lock=locks[p.id];if(Object.hasOwn(locks,p.id)){if(p.occupied&&lock===null||!p.occupied&&lock!==null)inputConflicts.push({id:p.id,reason:'lock-occupancy-conflict'});else if(p.occupied)pins.push({cell:p.id,variant:lock,source:'user-roof-lock'});}
  if(p.occupied&&Object.hasOwn(domains,p.id))for(const v of variants)if(!domains[p.id].includes(v.key))bans.push({cell:p.id,variant:v.key,reason:'user-domain'});
  if(p.occupied)for(const v of variants){const required=targetOldCityRoofRequirements(v.key,p.baseWidth,p.height,p.floorY);if(required.width>p.max[0]-p.min[0]+1e-7||required.depth>p.max[1]-p.min[1]+1e-7||required.roofY>=33){geometryBans.push({id:p.id,role:v.key,required,reason:'role-envelope-exceeds-plot-or-main-tower'});bans.push({cell:p.id,variant:v.key,reason:'geometry-envelope'});}}
 }
 return{plots,edges,active,model:{graph,compiled,table:{compatible,directions:['street','slope']}},pins,bans,inputConflicts,geometryBans};
}
const base=()=>({version:TARGET_OLD_CITY_ROOF_WFC_VERSION,scope:'15 fixed old-city roof roles only',solver:'src/procgen/wfc/solver.js',sceneMutation:false,terrainMutation:false,fallbackUsed:false});
const failed=(reason,extra={})=>({...base(),ok:false,reason,assignments:null,roofRoles:null,changeSet:[],...extra});
/** Initial constraint propagation without observations. Useful for proving a
 * selected roof genuinely removes neighboring roof options before any random
 * choice. Returns Shannon entropy, never labels candidate count as entropy. */
export function inspectTargetOldCityRoofWfc(options={}){
 try{const p=prepare(options);if(p.inputConflicts.length)return failed('lock-occupancy-conflict',{conflicts:p.inputConflicts,edges:p.edges});
  const r=partialObservation({model:p.model,pins:p.pins,bans:p.bans}),empty=r.cells.find(c=>!c.domainSize);if(!r.ok||empty)return failed('unsatisfiable',{conflictCell:r.contradiction||empty?.id,edges:p.edges,geometryBans:p.geometryBans});
  return{...base(),ok:true,edges:p.edges,cells:r.cells,geometryBans:p.geometryBans,deletedIds:p.plots.filter(p=>!p.occupied).map(p=>p.id),stats:r.stats};
 }catch(error){return failed('invalid-input',{message:error.message});}
}
/** Solve is pure: on contradiction/budget exhaustion no partial assignments
 * escape. roofRoles retains the previous geometry role for deleted plots;
 * assignments[id] is null there and occupancy remains caller-owned. Rebuild a
 * detached factory with roofRoles, validate geometry, then publish atomically. */
export function solveTargetOldCityRoofWfc(options={}){
 try{const seed=options.seed??20261006,maxBacktrack=options.maxBacktrack??32;if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new TypeError('seed must be uint32');if(!Number.isInteger(maxBacktrack)||maxBacktrack<1||maxBacktrack>10000)throw new TypeError('maxBacktrack must be an integer 1..10000');
  const p=prepare(options);if(p.inputConflicts.length)return failed('lock-occupancy-conflict',{conflicts:p.inputConflicts,edges:p.edges});
  const result=solveWfc({...p.model,seed,maxBacktrack,pins:p.pins,bans:p.bans,mode:'bitset'});
  if(!result.ok)return failed(result.reason,{seed,maxBacktrack,conflict:result.conflict,conflictCell:result.cell,stats:result.stats,edges:p.edges,geometryBans:p.geometryBans});
  const assignments={},roofRoles={},changeSet=[],occupancy={};for(const p0 of p.plots){const role=p0.occupied?result.assignmentByCellId[p0.id]:null;assignments[p0.id]=role;roofRoles[p0.id]=role??p0.roofRole;occupancy[p0.id]=p0.occupied;if(p0.occupied&&role!==p0.roofRole)changeSet.push({id:p0.id,from:p0.roofRole,to:role});}
  return{...base(),ok:true,reason:'solved',seed,maxBacktrack,assignments,roofRoles,occupied:occupancy,changeSet,edges:p.edges,geometryBans:p.geometryBans,stats:result.stats,solutionHash:result.solutionHash,deletedIds:p.plots.filter(p=>!p.occupied).map(p=>p.id),rules:['No neighboring pair of short/cupola towers.','Slope-aligned neighboring plots cannot both retain plain hip roofs.','Two setback/terrace roofs are compatible; no shared roof passage is generated.']};
 }catch(error){return failed('invalid-input',{message:error.message});}
}
