/** REACode/engine/spritepack.js -> shared Atlas.
 * Public insert/update/free/slots/occupancy lifecycle, bounded transactional growth.
 * Repacking can move EVERY live slot, as in the original; consumers must refresh their UVs.
 * Internal tree shape and tie placements are deliberately not a serialization contract.
 */
import {Atlas} from './atlas.js';
const pixels=n=>Number.isSafeInteger(n)&&n>0;
export class SpriteAtlas{
 constructor(size=256,{maxSize=4096}={}){if(!pixels(size)||!pixels(maxSize)||size>maxSize||maxSize>8192||Math.log2(size)%1||Math.log2(maxSize)%1)throw new RangeError('power-of-two atlas bounds');this.size=size;this.maxSize=maxSize;this.items=new Map();this.slots=new Map();this.atlas=new Atlas(size,size);}
 #layout(items,start){for(let size=start;size<=this.maxSize;size*=2){const atlas=new Atlas(size,size),slots=new Map();let ok=true;for(const [key,it]of [...items].sort((a,b)=>b[1].w*b[1].h-a[1].w*a[1].h)){const r=atlas.allocate(it.w+it.pad*2,it.h+it.pad*2);if(!r){ok=false;break;}slots.set(key,{x:r.x+it.pad,y:r.y+it.pad,w:it.w,h:it.h});}if(ok)return{atlas,slots,size};}throw new RangeError('sprite atlas budget exceeded');}
 insert(key,w,h,pad=2){if(typeof key!=='string'||!key||!pixels(w)||!pixels(h)||!Number.isSafeInteger(pad)||pad<0||pad>64||w+2*pad>this.maxSize||h+2*pad>this.maxSize)throw new RangeError('sprite allotment');const items=new Map(this.items);items.set(key,{w,h,pad});const next=this.#layout(items,this.size);this.items=items;Object.assign(this,next);return this.slots.get(key);}
 free(key){if(!this.items.has(key))return false;const items=new Map(this.items);items.delete(key);const next=this.#layout(items,this.size);this.items=items;Object.assign(this,next);return true;}
 get root(){return this.atlas.root;}
 occupancy(){let area=0;for(const s of this.slots.values())area+=s.w*s.h;return area/(this.size*this.size);}
}
/** Source's aesthetic radial ordering, backed by shared tree collision queries rather than a size² mask. */
export function radialPack(items,{size=256,gap=2,maxCandidates=200000}={}){
 if(!pixels(size)||size>8192||!Number.isSafeInteger(gap)||gap<0||gap>64||!Number.isSafeInteger(maxCandidates)||maxCandidates<1||maxCandidates>2000000||!Array.isArray(items)||items.length>2000||items.some(it=>!pixels(it.w)||!pixels(it.h)))throw new RangeError('bounded radial packing options');
 const atlas=new Atlas(size,size),placed=[],sorted=[...items].sort((a,b)=>b.w*b.h-a.w*a.h),center=size/2;let candidates=0;
 for(const it of sorted){const W=it.w+2*gap,H=it.h+2*gap;if(W>size||H>size)continue;let slot=null;
  const attempt=(x,y)=>{if(candidates++>=maxCandidates)return null;return atlas.allocateAt(x,y,W,H);};
  if(!placed.length)slot=attempt(Math.round(center-W/2),Math.round(center-H/2));
  const dr=Math.max(2,Math.min(W,H)*.28);
  for(let r=0;r<size*.75&&!slot&&candidates<maxCandidates;r+=dr){const steps=Math.max(8,Math.round(2*Math.PI*Math.max(r,1)/dr));for(let i=0;i<steps&&!slot&&candidates<maxCandidates;i++){const a=i/steps*2*Math.PI;slot=attempt(Math.round(center+Math.cos(a)*r-W/2),Math.round(center+Math.sin(a)*r-H/2));}}
  if(slot)placed.push({...it,x:slot.x+gap,y:slot.y+gap});
 }
 const big=placed[0],occupancy=placed.reduce((n,r)=>n+r.w*r.h,0)/(size*size);return{placed,skipped:items.length-placed.length,occupancy,bigOffset:big?+Math.hypot(big.x+big.w/2-center,big.y+big.h/2-center).toFixed(2):null,candidates,budgetExhausted:candidates>=maxCandidates};
}
