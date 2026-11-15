// Local bounded scalar contrast solver for an explicit adjacency graph.
// Not the original atlas, RGB/OKLab asset pipeline or a convergence guarantee.
export function solveContrastField(count,edges,{iterations=100,target=.3,pull=.2,push=.5,seed=1}={}){
 if(!Number.isInteger(count)||count<1||count>100000||!Number.isInteger(iterations)||iterations<0||iterations>2000||![target,pull,push,seed].every(Number.isFinite)||target<0||target>1||pull<0||pull>1||push<0||push>1||!Array.isArray(edges)||edges.some(e=>!Number.isInteger(e.i)||!Number.isInteger(e.j)||e.i<0||e.j<0||e.i>=count||e.j>=count||e.i===e.j))throw new RangeError('contrast graph');
 let state=seed>>>0;const values=Float64Array.from({length:count},()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296});const initial=values.slice();
 for(let pass=0;pass<iterations;pass++){const delta=new Float64Array(count),degree=new Uint32Array(count);for(const e of edges){const d=values[e.j]-values[e.i],distance=Math.abs(d);let change=e.contrast? (distance<target?-(d===0?((e.i<e.j)?1:-1):Math.sign(d))*(target-distance)*push*.5:0):d*pull*.5;delta[e.i]+=change;delta[e.j]-=change;degree[e.i]++;degree[e.j]++}for(let i=0;i<count;i++)values[i]=Math.max(0,Math.min(1,values[i]+delta[i]/Math.max(1,degree[i])))}
 // Finish with bounded hard-constraint projections. Infeasible graphs or
 // conflicting orientations may still retain violations; report them below.
 if(iterations>0)for(let pass=0;pass<32;pass++){let changed=false;for(const e of edges){if(!e.contrast)continue;const a=values[e.i],b=values[e.j];if(Math.abs(a-b)+1e-9>=target)continue;const lo=Math.max(0,Math.min(1-target,(a+b-target)*.5));if(a<=b){values[e.i]=lo;values[e.j]=lo+target}else{values[e.j]=lo;values[e.i]=lo+target}changed=true}if(!changed)break}
 const measure=a=>{let same=0,contrast=0,ns=0,nc=0,violations=0;for(const e of edges){const d=Math.abs(a[e.i]-a[e.j]);if(e.contrast){contrast+=d;nc++;if(d+1e-6<target)violations++}else{same+=d;ns++}}return {sameMean:ns?same/ns:0,contrastMean:nc?contrast/nc:0,violations}};
 return {values,initial,before:measure(initial),after:measure(values)};
}

// ---- 1482346496460828674: OKLab colour relaxation on real triangles ----
// Port of the original contrasttex.js solver (Gauss-Seidel edge sweep, feature
// mean anchor, early annealing noise, sRGB gamut clip each pass) but run on a
// triangle mesh derived from the shared World grid instead of a stand-alone decal.
import {srgbToOklab,oklabToSrgb,clampOklabToGamut,hexToOklab,deltaE} from './oklab.js';
import {TERRAIN,BUILD} from './palette.js';
function mulberry32(a){return()=>{a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
/** Default feature of a World cell: water / ground (rock top) / built, plus level. */
export function worldCellFeature(world,c){const t=world.top(c);if(!t)return'water';return(world.isBuilt(c,t)?'built':world.river[c.id]?'river':'ground')+':'+t}
const KIND_BASE={water:TERRAIN.river,river:TERRAIN.river,ground:TERRAIN.grass,built:BUILD.plaster};
/** Fan-triangulate every cell (centre + edge). Interior fan edges are never contrast;
 * edges shared between cells are contrast iff the two features differ. */
export function worldContrastMesh(world,{featureOf=worldCellFeature}={}){
 const tris=[],edges=[],open=new Map(),featureIds=new Map();
 for(const c of world.cells){const key=featureOf(world,c);if(typeof key!=='string')throw new RangeError('feature key');if(!featureIds.has(key))featureIds.set(key,featureIds.size);const feature=featureIds.get(key),first=tris.length;
  for(let i=0;i<c.n;i++){const a=c.pts[i],b=c.pts[(i+1)%c.n],id=tris.length;tris.push({cell:c.id,feature,key,pts:[[c.cx,c.cz],[a.x,a.z],[b.x,b.z]]});const k=a.id<b.id?a.id+':'+b.id:b.id+':'+a.id;
   if(open.has(k)){const j=open.get(k);open.delete(k);edges.push({i:j,j:id,contrast:tris[j].feature!==feature})}else open.set(k,id)}
  for(let i=0;i<c.n;i++)edges.push({i:first+i,j:first+(i+1)%c.n,contrast:false})}
 return{tris,edges,features:[...featureIds.keys()],version:world.version};
}
/** Base OKLab colour per feature key: palette colour of the kind, lightened by level. */
export function featureBaseColors(features,{baseOf=null}={}){return features.map((key,i)=>{if(baseOf){const c=baseOf(key,i);if(!Array.isArray(c)||c.length!==3||!c.every(Number.isFinite))throw new RangeError('feature base');return[...c]}const [kind,lv]=key.split(':'),lab=hexToOklab(KIND_BASE[kind]??TERRAIN.rock);lab[0]=Math.min(.95,lab[0]+.015*(+lv||0));return lab})}
export function initContrastColors(mesh,{seed=3,spread=.16,random=false,bases=featureBaseColors(mesh.features)}={}){const rnd=mulberry32(seed),j=random?.34:spread;return mesh.tris.map(t=>{const b=bases[t.feature];return[b[0]+(rnd()-.5)*j,b[1]+(rnd()-.5)*j*1.6,b[2]+(rnd()-.5)*j*1.6]})}
export function relaxContrastColors(mesh,colors,{target=.17,pull=.24,push=.42,anchor=.02,noise=0,rnd=Math.random}={}){
 const F=mesh.features.length,mean=new Float64Array(F*4);
 for(let i=0;i<colors.length;i++){const f=mesh.tris[i].feature*4;mean[f]+=colors[i][0];mean[f+1]+=colors[i][1];mean[f+2]+=colors[i][2];mean[f+3]++}
 for(let f=0;f<F;f++)if(mean[f*4+3])for(let k=0;k<3;k++)mean[f*4+k]/=mean[f*4+3];
 for(const e of mesh.edges){const A=colors[e.i],B=colors[e.j],dx=B[0]-A[0],dy=B[1]-A[1],dz=B[2]-A[2],d=Math.hypot(dx,dy,dz)||1e-6;let s=0;if(e.contrast){if(d<target)s=-push*(target-d)/d*.5}else s=pull*.5;A[0]+=dx*s;A[1]+=dy*s;A[2]+=dz*s;B[0]-=dx*s;B[1]-=dy*s;B[2]-=dz*s}
 for(let i=0;i<colors.length;i++){const c=colors[i],f=mesh.tris[i].feature*4;for(let k=0;k<3;k++){c[k]+=(mean[f+k]-c[k])*anchor;if(noise)c[k]+=(rnd()-.5)*noise}clampOklabToGamut(c)}
 return colors;
}
export function measureContrastColors(mesh,colors){let sc=0,nc=0,ss=0,ns=0,min=Infinity;for(const e of mesh.edges){const d=deltaE(colors[e.i],colors[e.j]);if(e.contrast){sc+=d;nc++;min=Math.min(min,d)}else{ss+=d;ns++}}
 const g=new Map();colors.forEach((c,i)=>{const f=mesh.tris[i].feature;if(!g.has(f))g.set(f,[]);g.get(f).push(c)});let spread=0;for(const arr of g.values()){const m=[0,1,2].map(k=>arr.reduce((s,c)=>s+c[k],0)/arr.length);spread+=arr.reduce((s,c)=>s+deltaE(c,m),0)/arr.length}
 return{contrastEdges:nc,sameEdges:ns,contrastDE:nc?sc/nc:0,sameDE:ns?ss/ns:0,minContrastDE:nc?min:0,withinFeatureSpread:g.size?spread/g.size:0};
}
/** Full solve. Returns OKLab colours, clamped sRGB per triangle, before/after metrics. */
export function solveContrastColors(mesh,{iters=220,seed=3,...opts}={}){
 if(!mesh||!Array.isArray(mesh.tris)||!Array.isArray(mesh.edges)||!Number.isInteger(iters)||iters<0||iters>5000)throw new RangeError('contrast colour solve');
 for(const e of mesh.edges)if(!Number.isInteger(e.i)||!Number.isInteger(e.j)||e.i<0||e.j<0||e.i>=mesh.tris.length||e.j>=mesh.tris.length)throw new RangeError('contrast edge');
 const colors=initContrastColors(mesh,{seed,...opts});colors.forEach(c=>clampOklabToGamut(c));const before=measureContrastColors(mesh,colors),rnd=mulberry32(seed);
 for(let it=0;it<iters;it++){const t=it/iters;relaxContrastColors(mesh,colors,{...opts,noise:t<.35?.012*(1-t/.35):0,rnd})}
 return{colors,rgb:colors.map(c=>oklabToSrgb(...c).map(v=>Math.min(1,Math.max(0,v)))),before,after:measureContrastColors(mesh,colors)};
}
/** Per-cell average colour of the solved triangles (what a vertex-colour bake would read). */
export function cellContrastColors(mesh,solved,cellCount){const out=new Float32Array(cellCount*3),n=new Uint32Array(cellCount);mesh.tris.forEach((t,i)=>{for(let k=0;k<3;k++)out[t.cell*3+k]+=solved.rgb[i][k];n[t.cell]++});for(let c=0;c<cellCount;c++)if(n[c])for(let k=0;k<3;k++)out[c*3+k]/=n[c];return out}
export {srgbToOklab};
