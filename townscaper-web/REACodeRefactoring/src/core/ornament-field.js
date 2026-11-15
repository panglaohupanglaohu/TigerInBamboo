/** 1104771432440049664: one distance-field texture, mirrored UVs, independent
 * border/centre cutoff. 1105131621391495176 adds animation; exact source artwork
 * and animation curves are unknown. This canonical line art is a local sample.
 */
export function bakeOrnamentField(size=128) {
  if(!Number.isInteger(size)||size<32||size>256)throw new RangeError('ornament field size must be 32..256');
  const paths=[];
  for(const [cx,cy,r,a0,a1]of [[.48,.36,.29,-.15,1.6],[.28,.72,.18,.1,1.7],[.77,.73,.13,.4,2.1]]) {
    paths.push(Array.from({length:33},(_,i)=>{const a=(a0+(a1-a0)*i/32)*Math.PI;return[cx+Math.cos(a)*r,cy+Math.sin(a)*r]}));
  }
  paths.push([[.07,.08],[.2,.16],[.27,.1],[.38,.19],[.45,.11]]);
  const maxDistance=.25,field=new Float32Array(size*size),rgba=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const px=(x+.5)/size,py=(y+.5)/size;let d=Infinity;
    for(const path of paths)for(let k=1;k<path.length;k++) {
      const [ax,ay]=path[k-1],[bx,by]=path[k],dx=bx-ax,dy=by-ay;
      const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));
      d=Math.min(d,Math.hypot(px-ax-t*dx,py-ay-t*dy));
    }
    const id=y*size+x,v=Math.round(Math.min(1,d/maxDistance)*255);field[id]=d;rgba.set([v,v,v,255],id*4);
  }
  return{size,field,rgba,maxDistance};
}

/** REACode squigglefield.js (1105131621391495176 "now with animation"): capsule segments in one
 * folded quadrant (four-way mirror), a two-wave wobble whose phase t crawls the edge along its
 * normal, and bucket acceleration so each pixel tests only nearby segments. CPU diagnostics
 * (probeEdge, inkShare) measure what the wobble changes; the source artwork is unknown.
 */
const distSeg=(px,py,s)=>{const dx=s.x1-s.x0,dy=s.y1-s.y0,t=Math.max(0,Math.min(1,((px-s.x0)*dx+(py-s.y0)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-s.x0-t*dx,py-s.y0-t*dy);};
const wobble=(u,v,{amp=.01,freq=19,t=0})=>{const a1=.62,a2=-.35;return amp*(.66*Math.sin((u*Math.cos(a1)+v*Math.sin(a1))*freq*2*Math.PI+t*2.1)+.34*Math.sin((u*Math.cos(a2)+v*Math.sin(a2))*freq*3.7*Math.PI-t*3.3));};
export function squiggleSdf(segs,x,y,opt={}){
 if(![x,y].every(Number.isFinite))throw new RangeError('Invalid squiggle sample');
 const u=Math.abs(x),v=Math.abs(y);let d=1e9,tests=0;for(const s of segs){d=Math.min(d,distSeg(u,v,s)-s.r);tests++;}
 return{d:(opt.amp??.01)===0?d:d-wobble(u,v,opt),tests};
}
export function bucketSegments(segs,{width=.6,height=.6,cell=.05,pad=.03}={}){
 if(!segs.length||!(cell>0))throw new RangeError('Invalid buckets');
 const nx=Math.ceil(width/cell),ny=Math.ceil(height/cell),buckets=Array.from({length:nx*ny},()=>[]);
 segs.forEach((s,i)=>{const p=s.r+pad,bx0=Math.max(0,Math.floor((Math.min(s.x0,s.x1)-p)/cell)),bx1=Math.min(nx-1,Math.floor((Math.max(s.x0,s.x1)+p)/cell)),by0=Math.max(0,Math.floor((Math.min(s.y0,s.y1)-p)/cell)),by1=Math.min(ny-1,Math.floor((Math.max(s.y0,s.y1)+p)/cell));for(let by=by0;by<=by1;by++)for(let bx=bx0;bx<=bx1;bx++)buckets[by*nx+bx].push(i);});
 return{nx,ny,cell,buckets,pad};
}
/** Bucketed SDF: exact inside the ink band (|d| < pad), far field returns a lower-bounded proxy. */
export function squiggleSdfBucketed(segs,bk,x,y,opt={}){
 const u=Math.abs(x),v=Math.abs(y),bx=Math.min(bk.nx-1,Math.max(0,Math.floor(u/bk.cell))),by=Math.min(bk.ny-1,Math.max(0,Math.floor(v/bk.cell))),list=bk.buckets[by*bk.nx+bx];
 let d=bk.pad;for(const i of list)d=Math.min(d,distSeg(u,v,segs[i])-segs[i].r);
 return{d:(opt.amp??.01)===0||d>=bk.pad?d:d-wobble(u,v,opt),tests:list.length};
}
/** Edge probe on a straight capsule: RMS / max edge displacement and arc ratio of the wobbled edge. */
export function probeSquiggleEdge(opt={},scale=760){
 const edge=[{x0:0,y0:0,x1:.3,y1:0,r:.014}],cols=160,ys=[];
 for(let i=0;i<cols;i++){const x=.3*i/(cols-1);let lo=.06,hi=.0005;for(let k=0;k<26;k++){const m=(lo+hi)/2;if(squiggleSdf(edge,x,m,opt).d>0)lo=m;else hi=m;}ys.push((lo+hi)/2);}
 let s2=0,max=0,arc=0;for(const y of ys){const e=Math.abs(y-.014);s2+=e*e;max=Math.max(max,e);}for(let i=1;i<cols;i++)arc+=Math.hypot(.3/(cols-1),ys[i]-ys[i-1]);
 return{rmsPx:Math.sqrt(s2/cols)*scale,maxPx:max*scale,arcRatio:arc/.3};
}
/** r55: REACode squigglefield buildOrnament() layout (plaque double frame, end posts, big scrolls,
 * corner scrolls, wing + dashes), written once in the u≥0,v≥0 quadrant; fold gives the other three.
 * Layout coordinates follow REACode (plaque half 0.30×0.085). The original "Victory" artwork is not
 * available — this is REACode's hand-placed capsule reconstruction, not traced art. */
const capsule=(x0,y0,x1,y1,r)=>({x0,y0,x1,y1,r});
function spiralCapsules(cx,cy,r0,r1,a0,a1,n,r){const out=[];let px=cx+r0*Math.cos(a0),py=cy+r0*Math.sin(a0);for(let i=1;i<=n;i++){const k=i/n,rr=r0*Math.pow(r1/r0,k),a=a0+(a1-a0)*k,x=cx+rr*Math.cos(a),y=cy+rr*Math.sin(a);out.push(capsule(px,py,x,y,r));px=x;py=y;}return out;}
export const SQUIGGLE_EXTENT=Object.freeze({w:.52,h:.26});
export function squiggleOrnament(){
 const P=[],W=.30,H=.085,fr=.014;
 P.push(capsule(0,H,W-fr,H,fr),capsule(W,H-fr,W,0,fr),capsule(0,H-.026,W-.026,H-.026,.006));
 P.push(capsule(W+.004,0,W+.004,.052,.020),capsule(W+.030,0,W+.030,.038,.008));
 P.push(capsule(W+.030,0,.395,0,.012),...spiralCapsules(.415,.012,.082,.020,Math.PI*.5,Math.PI*.5-1.55*Math.PI,18,.012));
 P.push(capsule(.215,.10,.215,.135,.010),...spiralCapsules(.240,.155,.048,.012,Math.PI*1.15,Math.PI*1.15+1.35*Math.PI,14,.010));
 P.push(capsule(.012,H+.020,.052,H+.058,.011),capsule(.052,H+.058,.104,H+.030,.011),capsule(.104,H+.030,.104,H+.010,.008),capsule(0,H+.012,0,H+.046,.007),capsule(.132,H+.062,.132,H+.062,.013),capsule(.176,H+.040,.176,H+.040,.009));
 P.push(capsule(.150,H+.012,.176,H+.028,.006),capsule(.196,H+.020,.222,H+.032,.006),capsule(.238,H+.058,.238,H+.076,.006),capsule(.272,H+.045,.272,H+.062,.005));
 return P;
}
/** Bake the undistorted quadrant SDF once (bucketed, exact in the ink band) into an 8-bit texture.
 * d is encoded as (d-SQUIGGLE_D0)/SQUIGGLE_DR; wobble + phase are added per pixel in the shader, so
 * the animation never re-bakes. Returns stats (bucket tests vs brute force). */
export const SQUIGGLE_D0=-.03,SQUIGGLE_DR=.12;
export function bakeSquiggleField(segs=squiggleOrnament(),{w=256,h=128,extent=SQUIGGLE_EXTENT}={}){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<16||h<16||w>1024||h>1024)throw new RangeError('squiggle bake size 16..1024');
 const pad=SQUIGGLE_D0+SQUIGGLE_DR,bk=bucketSegments(segs,{width:extent.w,height:extent.h,cell:.026,pad});
 const field=new Float32Array(w*h),rgba=new Uint8Array(w*h*4);let tests=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=(x+.5)/w*extent.w,v=(y+.5)/h*extent.h,r=squiggleSdfBucketed(segs,bk,u,v,{amp:0});tests+=r.tests;const id=y*w+x;field[id]=r.d;const q=Math.round(Math.max(0,Math.min(1,(r.d-SQUIGGLE_D0)/SQUIGGLE_DR))*255);rgba.set([q,q,q,255],id*4);}
 return{w,h,extent,segs,field,rgba,bucketShare:tests/(w*h*segs.length)};
}
/** CPU mirror of the shader's per-pixel evaluation (bilinear decode + wobble), for tests/diagnostics. */
export function squiggleShadeSdf(baked,x,y,{amp=.01,freq=19,t=0}={}){
 const u=Math.abs(x),v=Math.abs(y),{w,h,extent}=baked;if(u>extent.w||v>extent.h)return SQUIGGLE_D0+SQUIGGLE_DR;
 const fx=Math.max(0,Math.min(w-1,u/extent.w*w-.5)),fy=Math.max(0,Math.min(h-1,v/extent.h*h-.5)),x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),ax=fx-x0,ay=fy-y0;
 const q=(i,j)=>baked.rgba[(j*w+i)*4]/255*SQUIGGLE_DR+SQUIGGLE_D0;
 const d=(q(x0,y0)*(1-ax)+q(x1,y0)*ax)*(1-ay)+(q(x0,y1)*(1-ax)+q(x1,y1)*ax)*ay;
 return amp===0||d>=SQUIGGLE_D0+SQUIGGLE_DR-1e-6?d:d-wobble(u,v,{amp,freq,t});
}
export const SQUIGGLE_WOBBLE_GLSL=`
float squiggleWobble(vec2 p,float amp,float freq,float t){
  const float a1=.62;const float a2=-.35;
  return amp*(.66*sin(dot(p,vec2(cos(a1),sin(a1)))*freq*6.28318530718+t*2.1)
            +.34*sin(dot(p,vec2(cos(a2),sin(a2)))*freq*3.7*3.14159265359-t*3.3));
}`;
