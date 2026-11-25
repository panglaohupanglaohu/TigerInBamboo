/**
 * Incremental pixel atlas; first-fit guillotine leaves, stable live slots.
 * 1765115069837221962: "visualizing the recursive tree parsing"
 * 1765041830461055127: "bin space gets quite fragmented ... interlocked"
 * Sibling coalescing only: deletion does NOT eliminate all fragmentation.
 * Cross-leaf integer candidates are optional; original 3D viewer/API not complete.
 * Shared by grids.html and the real tree/cloud ImpostorBaker.
 */
function size(n) { if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError('atlas sizes must be positive safe integer pixels'); }
function node(x,y,w,h,parent=null) { return {x,y,w,h,used:false,a:null,b:null,parent}; }
function box(n) { return {x:n.x,y:n.y,w:n.w,h:n.h}; }
export class Atlas {
  #handles = new WeakMap();
  #live = new Set();
  #keys = new Map();
  #handleKeys = new WeakMap();
  #rotated = new WeakSet();
  constructor(width,height) {
    size(width); size(height);
    if (!Number.isSafeInteger(width*height)) throw new RangeError('atlas area exceeds safe integer range');
    this.width=width; this.height=height; this.root=node(0,0,width,height);
    this.lastTrace=[]; this.lastSearch={visited:0,found:false};
  }
  /** Optional trace records the actual search, not fabricated growth branches. */
  allocate(w,h,{trace=false}={}) {
    size(w); size(h);
    const stack=[{n:this.root,depth:0,parent:-1}], events=[]; let visited=0,found=null;
    while(stack.length) {
      const {n,depth,parent}=stack.pop(); visited++;
      const decision=w>n.w||h>n.h?'size':n.a?'branch':n.used?'used':'fit';
      const index=events.length;
      if(trace) events.push({...box(n),depth,parent,decision});
      if(decision==='size'||decision==='used') continue;
      if(decision==='fit') {found=n;break;}
      stack.push({n:n.b,depth:depth+1,parent:index},{n:n.a,depth:depth+1,parent:index});
    }
    this.lastTrace=events; this.lastSearch={visited,found:!!found,w,h};
    if(!found) return null;
    let n=found;
    while(w!==n.w||h!==n.h) {
      const dw=n.w-w,dh=n.h-h;
      if(dw>dh) {n.a=node(n.x,n.y,w,n.h,n); n.b=node(n.x+w,n.y,dw,n.h,n);}
      else {n.a=node(n.x,n.y,n.w,h,n); n.b=node(n.x,n.y+h,n.w,dh,n);}
      n=n.a;
    }
    n.used=true;
    const handle=Object.freeze({...box(n),node:n});
    this.#handles.set(handle,[n]); this.#live.add(handle); return handle;
  }
  /** 1764958522398146667: brute-force candidates, tree-pruned collision checks. */
  canPlace(x,y,w,h,{trace=false}={}) {
    size(w);size(h);
    if(!Number.isSafeInteger(x)||!Number.isSafeInteger(y)) throw new RangeError('integer pixel coordinates required');
    const inside=x>=0&&y>=0&&x<=this.width-w&&y<=this.height-h;
    const events=[],stack=inside?[{n:this.root,depth:0,parent:-1}]:[];
    let visited=0,clear=inside;
    while(stack.length) {
      const {n,depth,parent}=stack.pop();visited++;
      const intersects=n.x<x+w&&x<n.x+n.w&&n.y<y+h&&y<n.y+n.h;
      const decision=!intersects?'outside':n.a?'branch':n.used?'used':'free',index=events.length;
      if(trace)events.push({...box(n),depth,parent,decision});
      if(!intersects)continue;
      if(n.a)stack.push({n:n.b,depth:depth+1,parent:index},{n:n.a,depth:depth+1,parent:index});
      else if(n.used){clear=false;break;}
    }
    this.lastTrace=events;this.lastSearch={visited,found:clear,x,y,w,h};return clear;
  }
  /** May span several free leaves. Live slots never move. Integer pixels only. */
  allocateAt(x,y,w,h,options={}) {
    if(!this.canPlace(x,y,w,h,options))return null;
    const hits=[],stack=[this.root];
    while(stack.length) {
      const n=stack.pop();
      if(n.x>=x+w||x>=n.x+n.w||n.y>=y+h||y>=n.y+n.h)continue;
      if(n.a){stack.push(n.b,n.a);continue;}
      let cut=null,vertical=true;
      if(x>n.x)cut=x;else if(x+w<n.x+n.w)cut=x+w;
      else {vertical=false;if(y>n.y)cut=y;else if(y+h<n.y+n.h)cut=y+h;}
      if(cut===null){n.used=true;hits.push(n);continue;}
      if(vertical){n.a=node(n.x,n.y,cut-n.x,n.h,n);n.b=node(cut,n.y,n.x+n.w-cut,n.h,n);}
      else {n.a=node(n.x,n.y,n.w,cut-n.y,n);n.b=node(n.x,cut,n.w,n.y+n.h-cut,n);}
      stack.push(n.b,n.a);
    }
    const handle=Object.freeze({x,y,w,h,node:hits[0]});
    this.#handles.set(handle,hits);this.#live.add(handle);return handle;
  }
  /** Bounded corner/edge/random candidates, not an optimal packing solver. */
  place(key,w,h,{attempts=64,rng=Math.random,trace=false,rotate=false}={}) {
    if(typeof rotate!=='boolean')throw new RangeError('rotate must be boolean');
    const slot=this.#placeOriented(key,w,h,{attempts,rng,trace});
    if(slot||!rotate||w===h)return slot;
    // Optional 90° fallback: same candidate search with swapped extent; consumer must rotate its UVs.
    const turned=this.#placeOriented(key,h,w,{attempts,rng,trace});if(turned)this.#rotated.add(turned);return turned;
  }
  /** True when place(...,{rotate:true}) stored this allotment turned by 90°. */
  isRotated(slot){return this.#rotated.has(slot);}
  #placeOriented(key,w,h,{attempts=64,rng=Math.random,trace=false}={}) {
    size(w);size(h);
    if(typeof key!=='string'||!key||this.#keys.has(key))throw new Error('new nonempty atlas key required');
    if(!Number.isInteger(attempts)||attempts<0||attempts>4096||typeof rng!=='function')throw new RangeError('invalid candidate options');
    const candidates=[[0,0],[this.width-w,0],[0,this.height-h],[this.width-w,this.height-h]];
    for(const p of this.#live)candidates.push([p.x+p.w,p.y],[p.x,p.y+p.h],[p.x+p.w-w,p.y+p.h],[p.x+p.w,p.y+p.h-h]);
    // Generate before any commit; bad RNG values cannot partially allocate a slot.
    for(let i=0;i<attempts;i++) {
      const u=rng(),v=rng();if(!Number.isFinite(u)||u<0||u>=1||!Number.isFinite(v)||v<0||v>=1)throw new RangeError('rng must return [0,1)');
      candidates.push([Math.floor(u*Math.max(1,this.width-w+1)),Math.floor(v*Math.max(1,this.height-h+1))]);
    }
    const seen=new Set();let tried=0,totalVisited=0;
    for(const [x,y] of candidates) {
      const id=x+','+y;if(seen.has(id))continue;seen.add(id);tried++;
      const slot=this.allocateAt(x,y,w,h,{trace});totalVisited+=this.lastSearch.visited;
      if(slot){this.#keys.set(key,slot);this.#handleKeys.set(slot,key);this.lastSearch={...this.lastSearch,tried,totalVisited};return slot;}
    }
    this.lastSearch={...this.lastSearch,tried,totalVisited};return null;
  }
  /** 1765115069837221962 "recursive tree parsing ... the arm tends to have more fingers".
   * Port of REACode RectBin.recursiveFill on the shared atlas: depth-first arm of shrinking
   * allotments. `fingers` = REACode's probe count (integer positions where a smaller rect still fits);
   * `treeFingers` = leaves the committing collision query actually parsed. Measured: on fragmented
   * boards treeFingers rises (the clip's claim) while probe fingers FALL — the probe metric does not
   * reproduce the clip, so both are reported. Keys use `prefix`.
   */
  recursiveFill({seed=1,size:start=14,minSize=3,budget=400,prefix='arm',maxDepth=40}={}) {
    if(![seed,start,minSize,budget,maxDepth].every(Number.isSafeInteger)||start<1||minSize<1||budget<0||maxDepth<0||typeof prefix!=='string')throw new RangeError('invalid recursive fill options');
    let s=seed|0,n=0,fingersTotal=0,treeTotal=0;const arm=[],rnd=()=>{s=(Math.imul(s,1103515245)+12345)|0;return((s>>>8)&0xffff)/0x10000;};
    const step=(w,h,depth)=>{
      w=Math.floor(w);h=Math.floor(h);if(n++>budget||w<minSize||h<minSize)return;
      let key=prefix+n;while(this.#keys.has(key))key+='_';
      const slot=this.place(key,w,h,{attempts:40,rng:rnd,trace:true});if(!slot)return;
      // Tree fingers: leaves touched by the committing collision query (its actual recursive parse).
      const treeFingers=this.lastTrace.filter(e=>e.decision==='free'||e.decision==='used').length;treeTotal+=treeFingers;
      const pw=Math.max(minSize,Math.floor(w*.6)),ph=Math.max(minSize,Math.floor(h*.6));let fingers=0;
      for(const [px,py] of [[slot.x+slot.w,slot.y],[slot.x,slot.y+slot.h],[slot.x+(slot.w>>1),slot.y+slot.h],[slot.x+slot.w,slot.y+(slot.h>>1)]])
        if(px+pw<=this.width&&py+ph<=this.height&&this.canPlace(px,py,pw,ph))fingers++;
      fingersTotal+=fingers;arm.push({key,x:slot.x,y:slot.y,w:slot.w,h:slot.h,depth,fingers,treeFingers});
      if(depth>=maxDepth)return;
      step(w*.72,h*.86,depth+1);if(fingers>=3)step(w*.6,h*.6,depth+1);if(fingers>=4)step(w*.5,h*.5,depth+1);
    };
    step(start,start,0);this.lastTrace=[];
    return{arm,fingers:fingersTotal,avgFingers:arm.length?fingersTotal/arm.length:0,treeFingers:treeTotal,avgTreeFingers:arm.length?treeTotal/arm.length:0};
  }
  /** REACode SpriteAtlas behaviour, opt-in: re-insert every live allotment (largest first) into a
   * new atlas of the given size. Positions change; returns {atlas, moved: Map(old→new)} or null if
   * they do not all fit (this atlas is untouched either way). grow() = repack at twice the size.
   */
  repack(width=this.width,height=this.height) {
    const next=new Atlas(width,height),moved=new Map();
    const live=[...this.#live].sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h||a.y-b.y||a.x-b.x);
    for(const r of live){const slot=next.allocate(r.w,r.h);if(!slot)return null;moved.set(r,slot);const key=this.#handleKeys.get(r);if(key!==undefined){next.#keys.set(key,slot);next.#handleKeys.set(slot,key);}if(this.#rotated.has(r))next.#rotated.add(slot);}
    return{atlas:next,moved};
  }
  grow(){return this.repack(this.width*2,this.height*2);}
  slot(key){return this.#keys.get(key)??null;}
  remove(key){const slot=this.#keys.get(key);return slot?this.free(slot):false;}
  /** Foreign, forged or released handles cannot free a later allocation. */
  free(rect) {
    const nodes=rect&&this.#handles.get(rect);if(!nodes)return false;
    this.#handles.delete(rect);this.#live.delete(rect);
    const key=this.#handleKeys.get(rect);if(key!==undefined){this.#keys.delete(key);this.#handleKeys.delete(rect);}
    // Gather ancestors before merging, then deepest first. No whole-tree scan.
    const parents=new Set();
    for(const n of nodes){n.used=false;let p=n.parent;while(p&&!parents.has(p)){parents.add(p);p=p.parent;}}
    // Nodes from all fragments can have different depths: walk the parent closure
    // once in postorder rather than assuming the distance from a hit is depth.
    const pending=new Set(parents),ready=[];
    for(const p of pending)if(!pending.has(p.a)&&!pending.has(p.b))ready.push(p);
    while(ready.length){const p=ready.pop();if(!pending.delete(p))continue;
      if(p.a&&!p.a.used&&!p.a.a&&!p.b.used&&!p.b.a)p.a=p.b=null;
      const q=p.parent;if(q&&pending.has(q)&&!pending.has(q.a)&&!pending.has(q.b))ready.push(q);
    }
    this.lastTrace=[];this.lastSearch={visited:0,found:false};return true;
  }
  /** Logical allotments, not the multiple leaves belonging to a cross-leaf slot. */
  rects(n=this.root,out=[]) {
    for(const r of this.#live)if(r.x>=n.x&&r.y>=n.y&&r.x+r.w<=n.x+n.w&&r.y+r.h<=n.y+n.h)out.push({x:r.x,y:r.y,w:r.w,h:r.h});return out;
  }
  report() {
    let leaves=0,freeLeaves=0,largestFree=0,freeArea=0,usedArea=0,maxDepth=0;
    const stack=[[this.root,0]];
    while(stack.length) {
      const [n,d]=stack.pop();maxDepth=Math.max(maxDepth,d);
      if(n.a) {stack.push([n.b,d+1],[n.a,d+1]);continue;}
      leaves++;if(n.used)usedArea+=n.w*n.h;
      else {freeLeaves++;freeArea+=n.w*n.h;largestFree=Math.max(largestFree,n.w*n.h);}
    }
    return {leaves,freeLeaves,usedArea,freeArea,largestFree,maxDepth,fill:usedArea/(this.width*this.height),largestShare:freeArea?largestFree/freeArea:1};
  }
}

/** Baseline from REACode rectpack.shelfPack: row-by-row shelves, to show what brute-force
 * candidate placement buys. Integer pixels; stops at the first item that no longer fits. */
export function shelfPack(width,height,sizes){
  size(width);size(height);if(!Array.isArray(sizes))throw new TypeError('sizes array required');
  let x=0,y=0,rowH=0,used=0,placed=0;const rects=[];
  for(const [w,h] of sizes){size(w);size(h);if(x+w>width){x=0;y+=rowH;rowH=0;}if(y+h>height||w>width)break;rects.push({x,y,w,h});x+=w;rowH=Math.max(rowH,h);used+=w*h;placed++;}
  return{placed,fill:used/(width*height),rects};
}
