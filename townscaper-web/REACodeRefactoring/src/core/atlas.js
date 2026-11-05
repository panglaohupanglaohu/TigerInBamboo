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
  place(key,w,h,{attempts=64,rng=Math.random,trace=false}={}) {
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
