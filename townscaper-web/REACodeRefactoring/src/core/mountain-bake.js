/** 1786014232594485497: mountains need lighting/normals but blending is costly.
 * A local vertex-normal bake hypothesis, NOT an inferred original texture bake.
 * No image/height-map sampling or device performance claim.
 */
export const MOUNTAIN_LIGHT=Object.freeze([-.62,.62,-.48]);
export function bakeNormalLight(normals,{light=MOUNTAIN_LIGHT,base=.66,strength=.42}={}) {
  if(!normals||!Number.isInteger(normals.length)||normals.length%3||!Array.from(normals).every(Number.isFinite)||!Array.isArray(light)||light.length!==3||!light.every(Number.isFinite)||!Number.isFinite(base)||!Number.isFinite(strength)||base<0||base>1||strength<0||strength>1)throw new RangeError('normal bake inputs');
  const length=Math.hypot(...light);if(length===0)throw new RangeError('nonzero bake light required');
  const L=light.map(x=>x/length),tone=new Float32Array(normals.length/3);
  for(let i=0;i<tone.length;i++) {
    const x=normals[i*3],y=normals[i*3+1],z=normals[i*3+2],n=Math.hypot(x,y,z);
    tone[i]=base+strength*(n?Math.max(0,(x*L[0]+y*L[1]+z*L[2])/n):0);
  }
  return tone;
}

// ---- Port of REACode src/mountainlight.js onto the SHARED World ----
// none / baked (N·L folded into albedo once, 0 runtime taps) / runtime (per-texel
// normal, +2 taps) measured on a height field rasterised from the real World,
// with the original's high/groove white streaks and percentile ridge outline.
// Still a CPU raster study: no texture atlas, sphere blend or device timing.
import {fbm as noiseFbm} from './noise.js';
export const MOUNTAIN_RASTER_LIGHT=Object.freeze((()=>{const v=[-.62,-.48,.62],l=Math.hypot(...v);return v.map(c=>c/l)})());
/** Rasterise World tops (terrain only) into a height field; box-blurred so terraces read as slopes. */
export function worldMountainField(world,index,{res=.25,levelHeight=.5,smooth=2,normalize=true}={}){
 if(!Number.isFinite(res)||res<=0||!Number.isFinite(levelHeight)||levelHeight<=0||!Number.isInteger(smooth)||smooth<0||smooth>8)throw new RangeError('mountain field');
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const c of world.cells){minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ)}
 const w=Math.ceil((maxX-minX)/res),h=Math.ceil((maxZ-minZ)/res);if(w*h>1000000||w<3||h<3)throw new RangeError('mountain field size');
 let z=new Float32Array(w*h);const terrain=new Uint8Array(w*h),cellOf=new Int32Array(w*h).fill(-1);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=index.cellAt(minX+(x+.5)*res,minZ+(y+.5)*res);if(!c)continue;const i=y*w+x,g=world.ground(c);cellOf[i]=c.id;z[i]=g*levelHeight;terrain[i]=g>0&&!world.isBuilt(c,world.top(c))?1:0}
 for(let pass=0;pass<smooth;pass++){const o=new Float32Array(z.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=Math.max(0,Math.min(w-1,x+i)),yy=Math.max(0,Math.min(h-1,y+j));s+=z[yy*w+xx];n++}o[y*w+x]=s/n}z=o}
 // Original: scale so the 90th percentile slope ≈ 45° (otherwise N·L barely varies).
 let gain=1;if(normalize){const g=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,v=Math.hypot((z[i+1]-z[i-1])*.5,(z[i+w]-z[i-w])*.5);if(v>1e-6)g.push(v)}g.sort((a,b)=>a-b);const p90=g[Math.floor(g.length*.9)];gain=p90?1/p90:1;for(let i=0;i<z.length;i++)z[i]*=gain}
 return{w,h,z,terrain,cellOf,minX,minZ,res,gain,version:world.version};
}
export function mountainNormalAt(m,x,y){const{w,h,z}=m,xi=Math.min(w-2,Math.max(1,x|0)),yi=Math.min(h-2,Math.max(1,y|0)),dx=(z[yi*w+xi+1]-z[yi*w+xi-1])/2,dy=(z[(yi+1)*w+xi]-z[(yi-1)*w+xi])/2,l=Math.hypot(dx,dy,1);return[-dx/l,-dy/l,1/l]}
export function renderMountainShade(m,mode='baked',{light=MOUNTAIN_RASTER_LIGHT,seed=61}={}){
 if(!['none','baked','runtime'].includes(mode))throw new RangeError('mountain mode');
 const{w,h,z,terrain}=m,n=w*h,nl=new Float32Array(n),luma=new Float32Array(n),rgb=new Float32Array(n*3),rock=new Uint8Array(n),edges=[],edge=new Float32Array(n);let taps=0;
 const ridge=i=>{const sx1=(z[i+1]+z[i]+z[i-1])/3,sx0=(z[i-1]+z[i-2]+z[i-3])/3,sy1=(z[i+w]+z[i]+z[i-w])/3,sy0=(z[i-w]+z[i-2*w]+z[i-3*w])/3;return Math.abs(sx1-sx0)+Math.abs(sy1-sy0)};
 let zmax=0;for(const v of z)zmax=Math.max(zmax,v);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,N=mountainNormalAt(m,x,y);nl[i]=Math.max(0,N[0]*light[0]+N[1]*light[1]+N[2]*light[2]);rock[i]=terrain[i]&&(1-N[2]>.22||z[i]>.42*zmax)?1:0;if(x>2&&y>2&&x<w-3&&y<h-3){edge[i]=ridge(i);if(terrain[i])edges.push(edge[i])}}
 edges.sort((a,b)=>a-b);const thr=edges[Math.floor(edges.length*.997)]??Infinity;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!terrain[i]){luma[i]=NaN;continue}let c;
  if(rock[i]){const streak=noiseFbm(x*.06,y*.018,{octaves:4,freq:1,seed}),height=Math.min(1,(z[i]/(zmax||1))*1.4),white=Math.max(0,streak-.55)*2.2+Math.max(0,height-.55)*.9;c=[.72+white*.22,.63+white*.24,.58+white*.26]}
  else{const b=noiseFbm(x*.02,y*.02,{octaves:4,freq:1,seed:seed+22});c=[.56+b*.12,.70+b*.10,.42+b*.10]}
  if(mode==='baked'){const k=.66+.42*nl[i];c=c.map(v=>v*k)}else if(mode==='runtime'){const N=mountainNormalAt(m,x,y);taps+=2;const k=.56+.54*Math.max(0,N[0]*light[0]+N[1]*light[1]+N[2]*light[2]);c=c.map(v=>v*k)}
  if(edge[i]>thr)c=c.map(v=>v*.28);
  c=c.map(v=>Math.min(1,v));rgb.set(c,i*3);luma[i]=c[0]*.299+c[1]*.587+c[2]*.114}
 return{w,h,rgb,luma,nl,rock,edgeThreshold:thr,runtimeTaps:taps,mode};
}
function pearson(a,b){const n=a.length;if(!n)return 0;let sa=0,sb=0;for(let i=0;i<n;i++){sa+=a[i];sb+=b[i]}const ma=sa/n,mb=sb/n;let num=0,da=0,db=0;for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;db+=y*y}return da>0&&db>0?num/Math.sqrt(da*db):0}
export function mountainShadeStats(r){const a=[],b=[];for(let i=0;i<r.w*r.h;i++)if(r.rock[i]&&Number.isFinite(r.luma[i])){a.push(r.luma[i]);b.push(r.nl[i])}const mean=a.reduce((s,v)=>s+v,0)/(a.length||1);return{px:a.length,meanLuma:mean,stdLuma:Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/(a.length||1)),rVsNL:pearson(a,b)}}
/** Three modes + sampling cost ledger (4 blend layers × 2 taps; runtime normal +2). */
export function compareMountainModes(m,opts){const out={};for(const mode of['none','baked','runtime'])out[mode]=mountainShadeStats(renderMountainShade(m,mode,opts));const base=8;out.cost={blendSamples:base,runtimeNormalSamples:base+2,extraPct:25,bakedExtraPct:0};return out}
