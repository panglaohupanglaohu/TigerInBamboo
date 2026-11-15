// H/S/L authoring ranges observed in 1710031224838771027.
// The video does not establish terrain height/slope/moisture axes or OKLab.
export function makeColorVolume({h=[.18,.35],s=[.2,.5],l=[.35,.65]}={}) {
 for(const [name,a]of Object.entries({h,s,l}))if(!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||a.some(v=>v<0||v>1)||(name!=='h'&&a[0]>a[1]))throw new RangeError('color range');
 return Object.freeze({h:Object.freeze([...h]),s:Object.freeze([...s]),l:Object.freeze([...l])});
}
export function sampleColorVolume(vol,u,v,w){if(![u,v,w].every(Number.isFinite))throw new RangeError('finite coordinates');const clamp=x=>Math.max(0,Math.min(1,x)),end=vol.h[1]<vol.h[0]?vol.h[1]+1:vol.h[1],h=(vol.h[0]+(end-vol.h[0])*clamp(u))%1,s=vol.s[0]+(vol.s[1]-vol.s[0])*clamp(v),l=vol.l[0]+(vol.l[1]-vol.l[0])*clamp(w);const f=n=>{const k=(n+h*12)%12;return l-s*Math.min(l,1-l)*Math.max(-1,Math.min(k-3,9-k,1))};return [f(0),f(8),f(4)];}
export const COLOR_VOLUME_GLSL=`
uniform float uColorVolumeOn;
uniform vec3 uColorVolumeMin;
uniform vec3 uColorVolumeMax;
vec3 colorVolumeSample(vec3 uvw){vec3 hi=uColorVolumeMax;if(hi.x<uColorVolumeMin.x)hi.x+=1.;vec3 hsl=mix(uColorVolumeMin,hi,clamp(uvw,0.,1.));vec3 k=mod(vec3(0.,8.,4.)+fract(hsl.x)*12.,12.);vec3 rgb=hsl.z-hsl.y*min(hsl.z,1.-hsl.z)*max(vec3(-1.),min(min(k-3.,9.-k),vec3(1.)));return mix(rgb/12.92,pow((rgb+.055)/1.055,vec3(2.4)),step(vec3(.04045),rgb));}
`;

// ---- 1710031224838771027 / 1712088611934371876: 8-corner colour volumes ----
// Port of the original colorvolume.js: each feature owns a trilinear volume with
// 8 authored corners (u,v,w binary index order 000..111). Interpolation space is
// selectable (oklab default as in the original; 'srgb' / 'linear' for comparison).
// Features are classified from the SHARED World (not a separate noise island).
import {srgbToOklab,oklabToSrgb,hexToSrgb,deltaE} from './oklab.js';
import {TERRAIN,BUILD} from './palette.js';
const lin=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4,unlin=c=>c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;
const SPACES={oklab:{to:rgb=>srgbToOklab(...rgb),from:c=>oklabToSrgb(...c)},srgb:{to:rgb=>[...rgb],from:c=>[...c]},linear:{to:rgb=>rgb.map(lin),from:c=>c.map(v=>unlin(Math.max(0,v)))}};
const toRgb=c=>typeof c==='string'?hexToSrgb(c):c;
export function makeCornerVolume(name,corners,{space='oklab'}={}){
 if(typeof name!=='string'||!Array.isArray(corners)||corners.length!==8||!SPACES[space])throw new RangeError('corner volume');
 const rgb=corners.map(toRgb);if(rgb.some(c=>!Array.isArray(c)||c.length!==3||c.some(v=>!Number.isFinite(v)||v<0||v>1)))throw new RangeError('corner colour');
 return{name,space,rgb,corners:rgb.map(SPACES[space].to)};
}
/** Free-drag a single corner (the authoring operation); returns a new volume. */
export function setVolumeCorner(vol,index,colour){if(!Number.isInteger(index)||index<0||index>7)throw new RangeError('corner index');const rgb=vol.rgb.slice();rgb[index]=toRgb(colour);return makeCornerVolume(vol.name,rgb,{space:vol.space})}
/** Trilinear sample in the volume's own space → clamped sRGB 0..1. */
export function sampleCornerVolume(vol,u,v,w){if(![u,v,w].every(Number.isFinite))throw new RangeError('finite coordinates');const q=[u,v,w].map(x=>Math.max(0,Math.min(1,x))),out=[0,0,0];
 for(let i=0;i<8;i++){const wt=(i&1?q[0]:1-q[0])*(i&2?q[1]:1-q[1])*(i&4?q[2]:1-q[2]);for(let k=0;k<3;k++)out[k]+=vol.corners[i][k]*wt}
 return SPACES[vol.space].from(out).map(x=>Math.max(0,Math.min(1,x)));}
export function volumeStrip(vol,n=12,v=.5,w=.5){if(!Number.isInteger(n)||n<1||n>256)throw new RangeError('strip size');return Array.from({length:n},(_,i)=>sampleCornerVolume(vol,n===1?.5:i/(n-1),v,w))}
export function volumeSheet(vol,n=12,rows=5){return Array.from({length:rows},(_,r)=>volumeStrip(vol,n,rows===1?.5:r/(rows-1),.5))}
/** Separation between volumes (min OKLab ΔE across n³ samples) and each one's extent. */
export function cornerVolumeStats(vols,n=5){const pts=vols.map(vol=>{const a=[];for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let k=0;k<n;k++)a.push(srgbToOklab(...sampleCornerVolume(vol,i/(n-1),j/(n-1),k/(n-1))));return a});
 const extents=pts.map(a=>{let m=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)m=Math.max(m,deltaE(a[i],a[j]));return m});let minGap=Infinity,closestPair=[0,1];
 for(let a=0;a<pts.length;a++)for(let b=a+1;b<pts.length;b++){let m=Infinity;for(const p of pts[a])for(const q of pts[b])m=Math.min(m,deltaE(p,q));if(m<minGap){minGap=m;closestPair=[a,b]}}
 return{extents,minGap,closestPair};}
/** The five features shown in the clip's inspector, seeded from the shared palette. */
export function defaultFeatureVolumes({space='oklab'}={}){const v=(name,lo,hi,dry,wet)=>makeCornerVolume(name,[lo,hi,dry,hi,lo,wet,dry,wet],{space});return{
 Grass:v('Grass',TERRAIN.grassDeep,'#9cbf5a','#7aa04e','#5f8a4c'),
 Roof:v('Roof',BUILD.roofAlt,BUILD.roof,'#b8583e','#e99467'),
 Cliff:v('Cliff','#767a84','#a3a8b3','#6a6e78','#8f95a2'),
 Beach:v('Beach',TERRAIN.sand,TERRAIN.sandBright,'#e6d6ae','#cdb88c'),
 Flowers:v('Flowers','#b04fa0','#d77ad0','#8a62c8','#c070e0')}}
const hash=(a,b)=>{let h=Math.imul(a|0,374761393)^Math.imul(b|0,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
/** Classify a World cell into one feature + (u height, v slope, w variation). */
export function classifyWorldFeature(world,c,{maxLevel=null,flowerRate=.1,seed=1}={}){
 const t=world.top(c);if(!t)return null;const top=maxLevel??world.cells.reduce((m,x)=>Math.max(m,world.top(x)),1);let drop=0,water=false;
 for(const nid of c.edgeNeighbors){if(nid<0){water=true;continue}const h=world.top(world.cells[nid]);if(!h)water=true;drop=Math.max(drop,t-h)}
 const u=Math.min(1,t/Math.max(1,top)),v=Math.min(1,drop/4),w=hash(c.id*3+seed,c.id*5-seed);let feature;
 if(world.isBuilt(c,t))feature='Roof';else if(water&&t<=2)feature='Beach';else if(drop>=3)feature='Cliff';else if(w>1-flowerRate&&u>.3)feature='Flowers';else feature='Grass';
 return{feature,u,v,w};}
/** Per-cell sRGB colours for every non-empty World cell (discrete feature, continuous sample). */
export function colorWorldFeatures(world,vols=defaultFeatureVolumes(),opts={}){const maxLevel=world.cells.reduce((m,x)=>Math.max(m,world.top(x)),1),rgb=new Float32Array(world.cells.length*3),feature=new Array(world.cells.length).fill(null),used={};
 for(const c of world.cells){const k=classifyWorldFeature(world,c,{maxLevel,...opts});if(!k)continue;const vol=vols[k.feature];if(!vol)throw new RangeError('missing volume '+k.feature);rgb.set(sampleCornerVolume(vol,k.u,k.v,k.w),c.id*3);feature[c.id]=k.feature;used[k.feature]=(used[k.feature]||0)+1}
 return{rgb,feature,used,version:world.version};}
