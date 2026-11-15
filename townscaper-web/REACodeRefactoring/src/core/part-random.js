/** 958371606350454784: "content agnostic ... similar hierarchy".
 * Local deterministic rendering helpers, not a reconstruction of source assets.
 * Streams expose a mutable integer state. Mirrored branches replay one stream
 * and consume its samples once; temporary rendering never advances its caller.
 */
export function withRandomState(stream,state,draw){
 if(!Number.isSafeInteger(state)||state<=0||typeof draw!=='function')throw new RangeError('Invalid part seed');
 const saved=stream.state;stream.state=state;try{return draw()}finally{stream.state=saved;}
}
export function mirroredRandom(stream,left,right){
 if(typeof left!=='function'||typeof right!=='function')throw new TypeError('Invalid mirror branches');
 const before=stream.state;let after=before;
 try{const a=left();after=stream.state;stream.state=before;return[a,right()]}finally{stream.state=after;}
}
/** Stable identity for a visible slot, independent of responsive column count. */
export function partSeed(base,index){
 if(!Number.isSafeInteger(base)||base<1||base>2147483646||!Number.isInteger(index)||index<0||index>1000000)throw new RangeError('Invalid part identity');
 let h=(base>>>0)^Math.imul(index+1,2654435761);h=Math.imul(h^(h>>>16),2246822507);return((h^(h>>>13))>>>0)%2147483646+1;
}

/** REACode portrait.js SLOTS / samplePortrait / silhouetteDiversity as pure data + math.
 * "content agnostic": the sampler only knows an ordered slot table (variants, provides/needs);
 * swapping the table swaps the content. Silhouette shapes are local ellipse/polygon stand-ins
 * in a unit box (not the original artwork) so diversity is measurable without a canvas.
 */
export const PORTRAIT_SLOTS=Object.freeze([
 {key:'bg',variants:['flat','vignette']},
 {key:'head',variants:['oval','narrow'],provides:'head'},
 {key:'ear',variants:['small','big'],needs:'head'},
 {key:'hair',variants:['sidePart','buzz','bald','receding','hood'],needs:'head'},
 {key:'brow',variants:['thin','thick'],needs:'head'},
 {key:'eye',variants:['heavy','wide'],needs:'head'},
 {key:'nose',variants:['long','short'],needs:'head'},
 {key:'mouth',variants:['line','open'],needs:'head'},
 {key:'marks',variants:['none','freckles'],needs:'head'},
].map(Object.freeze));
function mulberry(a){return()=>{a|=0;a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
export function sampleSlots(seed,slots=PORTRAIT_SLOTS){
 if(!Number.isSafeInteger(seed)||seed<1||!Array.isArray(slots)||!slots.length)throw new RangeError('Invalid slot sample');
 const provided=new Set(),rnd=mulberry(Math.imul(seed,2654435761)),parts={};
 for(const s of slots){
  if(typeof s.key!=='string'||!Array.isArray(s.variants)||!s.variants.length)throw new TypeError('Invalid slot');
  if(s.needs&&!provided.has(s.needs))throw new RangeError(`Slot ${s.key} needs ${s.needs} before it`);
  parts[s.key]=s.variants[(rnd()*s.variants.length)|0];if(s.provides)provided.add(s.provides);
 }
 return{seed,parts,params:{wide:.9+rnd()*.26,long:.9+rnd()*.26,drop:(rnd()-.5)*.06}};
}
/** Head/ear/hair silhouette mask (size²) of a portrait spec. */
export function portraitSilhouette(spec,size=64){
 if(!Number.isInteger(size)||size<8||size>512)throw new RangeError('Invalid silhouette size');
 const m=new Uint8Array(size*size),{wide,long,drop}=spec.params,P=spec.parts;
 const hw=(P.head==='narrow'?.25:.3)*wide,hh=.36*long,cx=.5,cy=.55+drop;
 const ell=(x,y,ex,ey,rx,ry)=>((x-ex)/rx)**2+((y-ey)/ry)**2<=1;
 const er=P.ear==='big'?.07:.045;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const x=(i+.5)/size,y=(j+.5)/size;let on=ell(x,y,cx,cy,hw,hh)||ell(x,y,cx-hw,cy,er,er*1.4)||ell(x,y,cx+hw,cy,er,er*1.4);
  const top=cy-hh;
  if(P.hair==='sidePart')on||=ell(x,y,cx-.02,top+.08,hw*1.08,.13)&&y<cy-.05;
  else if(P.hair==='buzz')on||=ell(x,y,cx,top+.05,hw*1.02,.08)&&y<cy-.1;
  else if(P.hair==='receding')on||=ell(x,y,cx,top+.12,hw*1.05,.1)&&y<cy-.08&&Math.abs(x-cx)>hw*.45;
  else if(P.hair==='hood')on||=ell(x,y,cx,cy-.02,hw*1.35,hh*1.18)&&!(ell(x,y,cx,cy+.04,hw*.8,hh*.78));
  m[j*size+i]=on?1:0;
 }
 return m;
}
/** 1 − mean pairwise IoU of silhouettes: ~0 = identical faces, ~1 = unrelated noise. */
export function silhouetteDiversity(masks){
 if(!Array.isArray(masks)||masks.length<2)throw new RangeError('Need at least two masks');
 let sum=0,n=0;for(let a=0;a<masks.length;a++)for(let b=a+1;b<masks.length;b++){let i=0,u=0;for(let k=0;k<masks[a].length;k++){i+=masks[a][k]&masks[b][k];u+=masks[a][k]|masks[b][k];}sum+=i/Math.max(1,u);n++;}
 return{pairs:n,meanIoU:sum/n,diversity:1-sum/n};
}
