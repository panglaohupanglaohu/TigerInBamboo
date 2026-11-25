/** 1579483114178768898: "house tiles even cover both a square tile AND a triangular tile".
 * Explicit two-cell footprints on the shared polygon graph. These are procedural
 * house templates, not a reconstruction of the author's prefab/socket library.
 */
import {MAX_LEVEL} from '../core/world.js';
const order=(a,b)=>a-b;
export function enumerateHouseTiles(world,{kinds=[4,3],stories=1}={}){
  if(kinds.length!==2||kinds.some(n=>!Number.isInteger(n)||n<3)||!Number.isInteger(stories)||stories<1)throw new RangeError('Invalid house template');
  const out=[],byId=new Map(world.cells.map(c=>[c.id,c]));
  for(const a of [...world.cells].sort((a,b)=>a.id-b.id)){
    if(a.n!==kinds[0])continue;
    for(let edge=0;edge<a.n;edge++){
      const b=byId.get(a.edgeNeighbors[edge]);if(!b||b.n!==kinds[1]||kinds[0]===kinds[1]&&a.id>b.id)continue;
      const twin=a.edgeTwins?.[edge]??b.edgeNeighbors.indexOf(a.id);
      if(twin<0||b.edgeNeighbors[twin]!==a.id)throw Error('Nonreciprocal footprint edge');
      const floor=world.ground(a);if(floor<1||floor!==world.ground(b)||floor+stories>MAX_LEVEL)continue;
      if([a,b].some(c=>world.top(c)!==floor||world.river[c.id]))continue;
      const cells=[a.id,b.id].sort(order),inside=new Set(cells),boundary=[];
      for(const c of [a,b])for(let e=0;e<c.n;e++)if(!inside.has(c.edgeNeighbors[e]))boundary.push({cell:c.id,edge:e,neighbor:c.edgeNeighbors[e]});
      const placement={id:`${cells.join('+')}@${floor}:${stories}`,cells,floor,stories,kinds:[a.n,b.n],join:[{cell:a.id,edge},{cell:b.id,edge:twin}],boundary};
      if(validateHouseTiles(world,[placement]).ok)out.push(placement);
    }
  }return out.sort((a,b)=>a.cells[0]-b.cells[0]||a.cells[1]-b.cells[1]);
}
/** Instance identity (1579483114178768898): every committed footprint carries a
 * stable `placement.instance` id on its frozen receipt. A replace on the same
 * cells inherits the id automatically; a move passes the old id explicitly via
 * `placement.instance`. Minted ids are never reused: world.houseInstances keeps
 * live entries and null tombstones, rides world.snapshot()/restore() (unified
 * undo — one stack entry restores voxels and identity together) and is what the
 * project JSON (ui/house-project.js) round-trips across reloads.
 */
const INSTANCE_ID=/^[A-Za-z0-9:_-]{1,80}$/;
const sameCells=(a,b)=>{if(a.length!==b.length)return false;const x=[...a].sort(order),y=[...b].sort(order);return x.every((v,i)=>v===y[i]);};
const mintHouseInstance=world=>{const reg=world.houseInstances??(world.houseInstances=new Map());let n=1;while(reg.has(`house:${n}`))n++;return`house:${n}`;};
/** Validate the entire transaction before writing any voxel. Boundary is derived,
 * never trusted as an occupancy mask. No second editable occupancy field exists.
 */
export function validateHouseTiles(world,placements){
  const byId=new Map(world.cells.map(c=>[c.id,c])),occupied=new Set();
  for(const p of placements){
    if(p.cells?.length!==2||new Set(p.cells).size!==2||!Number.isInteger(p.floor)||p.floor<1||!Number.isInteger(p.stories)||p.stories<1||p.floor+p.stories>MAX_LEVEL)return {ok:false,reason:'template'};
    const cells=p.cells.map(id=>byId.get(id));if(cells.some(c=>!c))return {ok:false,reason:'cell'};
    const [a,b]=cells,e=a.edgeNeighbors.indexOf(b.id),t=e<0?-1:(a.edgeTwins?.[e]??b.edgeNeighbors.indexOf(a.id));if(e<0||t<0||b.edgeNeighbors[t]!==a.id)return {ok:false,reason:'disconnected'};
    for(const c of cells){if(occupied.has(c.id))return {ok:false,reason:'overlap'};occupied.add(c.id);
      if(world.ground(c)!==p.floor||world.top(c)!==p.floor||world.river[c.id])return {ok:false,reason:'support-or-occupied'};
      if(!world.isRock(c,p.floor))return {ok:false,reason:'support'};
    }
  }return {ok:true};
}
// Immutable receipts describe expected columns, not another occupancy model.
const column=(world,id)=>({id,solid:world.solid[id],rock:world.rock[id],color:world.color[id],river:world.river[id]});
const fields=['solid','rock','color','river'];
const freezeReceipt=entries=>Object.freeze({entries:Object.freeze(entries.map(e=>Object.freeze({placement:Object.freeze({...e.placement,cells:Object.freeze([...e.placement.cells])}),before:Object.freeze(e.before.map(Object.freeze)),after:Object.freeze(e.after.map(Object.freeze))})))});
/** 1579483114178768898 "multi-cell tiles": remove/replace whole footprints.
 * A receipt can be used after unrelated edits, undo or a voxel save roundtrip,
 * but any edit to its exact columns rejects the entire operation. Receipts are
 * session data; v5 saves encode voxel appearance, not instance identity —
 * identity lives in world.houseInstances and the project JSON envelope.
 */
export function editHouseTiles(world,{remove={entries:[]},placements=[],color=0}={}){
  // v5 share saves use 5 bits for color+1, so the representable range is 0..30.
  if(!Number.isInteger(color)||color<0||color>30)throw new RangeError('Invalid palette index');
  const entries=remove?.entries;if(!Array.isArray(entries))return {ok:false,reason:'receipt'};
  const removed=new Set();
  for(const entry of entries){
    if(!entry?.placement?.cells||entry.before?.length!==entry.placement.cells.length||entry.after?.length!==entry.before.length)return {ok:false,reason:'receipt'};
    if(entry.placement.instance!==undefined&&(typeof entry.placement.instance!=='string'||!INSTANCE_ID.test(entry.placement.instance)))return {ok:false,reason:'receipt'};
    for(let i=0;i<entry.after.length;i++){const a=entry.after[i],b=entry.before[i];if(!a||!b||a.id!==b.id||a.id!==entry.placement.cells[i]||!Number.isInteger(a.id)||a.id<0||a.id>=world.solid.length||removed.has(a.id))return {ok:false,reason:'receipt'};
      removed.add(a.id);if(fields.some(k=>world[k][a.id]!==a[k]))return {ok:false,reason:'stale-receipt'};
    }
  }
  // Identity resolution before any write: explicit ids may only collide with an
  // instance being removed in the same transaction (that's a move); two
  // placements may never claim one id. Unmarked replacements on the exact same
  // cells inherit the removed instance so edits keep identity.
  const removedIds=new Set(entries.map(e=>e.placement.instance).filter(Boolean)),claimed=new Set(),resolved=[];
  for(const p of placements){
    let id=p.instance;
    if(id!==undefined){
      if(typeof id!=='string'||!INSTANCE_ID.test(id))return{ok:false,reason:'instance'};
      if(claimed.has(id)||(world.houseInstances?.has(id)&&!removedIds.has(id)))return{ok:false,reason:'instance-conflict'};
    }else id=entries.find(e=>e.placement.instance&&sameCells(e.placement.cells,p.cells))?.placement.instance??null;
    claimed.add(id);resolved.push(id);
  }
  // Temporary transaction snapshot, like undo: the live World never changes
  // until all support/occupancy checks pass. It shares the original grid.
  const staged=Object.create(world);for(const k of fields)staged[k]=world[k].slice();
  for(const entry of entries)for(const b of entry.before)for(const k of fields)staged[k][b.id]=b[k];
  const check=validateHouseTiles(staged,placements);if(!check.ok)return check;
  const next=[];
  for(let i=0;i<placements.length;i++){const p=placements[i];const before=p.cells.map(id=>column(staged,id));for(const id of p.cells){const mask=((1<<p.stories)-1)<<p.floor;staged.solid[id]|=mask;staged.color[id]=color;}next.push({placement:{...p,instance:resolved[i]??mintHouseInstance(world)},before,after:p.cells.map(id=>column(staged,id))});}
  const changed=new Set([...removed,...placements.flatMap(p=>p.cells)]);for(const id of changed)for(const k of fields)world[k][id]=staged[k][id];
  if(changed.size)world.touch();
  const receipt=freezeReceipt(next);
  if(receipt.entries.length||removedIds.size){const reg=world.houseInstances??(world.houseInstances=new Map()),kept=new Set(receipt.entries.map(e=>e.placement.instance));
    for(const id of removedIds)if(!kept.has(id))reg.set(id,null);for(const e of receipt.entries)reg.set(e.placement.instance,e);}
  return {ok:true,count:placements.length,receipt};
}
export function commitHouseTiles(world,placements,options={}){return editHouseTiles(world,{...options,placements});}
export function placeHouseTiles(world,{seed=7,count=6,stories=1}={}){
  if(!Number.isInteger(count)||count<0)throw new RangeError('Invalid tile count');
  const kinds=world.cells.some(c=>c.n===3)?[4,3]:[4,4],candidates=enumerateHouseTiles(world,{kinds,stories});
  const score=p=>{let h=seed|0;for(const id of p.cells)h=Math.imul(h^id,16777619);return h>>>0;};
  candidates.sort((a,b)=>score(a)-score(b)||a.cells[0]-b.cells[0]||a.cells[1]-b.cells[1]);
  const placements=[],reserved=new Set(),byId=new Map(world.cells.map(c=>[c.id,c]));
  for(const p of candidates){if(placements.length>=count)break;if(p.cells.some(id=>reserved.has(id)))continue;placements.push(p);for(const id of p.cells){reserved.add(id);for(const nb of byId.get(id).edgeNeighbors)if(nb>=0)reserved.add(nb);}}
  const committed=commitHouseTiles(world,placements,{color:Math.abs(seed%8)});
  if(committed.ok)committed.receipt.entries.forEach((e,i)=>{placements[i].instance=e.placement.instance;});
  return {...committed,placements,reserved};
}
