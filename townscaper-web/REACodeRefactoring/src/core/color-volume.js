// H/S/L authoring ranges observed in 1710031224838771027.
// The video does not establish terrain height/slope/moisture axes or OKLab.
export function makeColorVolume({h=[.18,.35],s=[.2,.5],l=[.35,.65]}={}) {
 for(const [name,a]of Object.entries({h,s,l}))if(!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||a.some(v=>v<0||v>1)||(name!=='h'&&a[0]>a[1]))throw new RangeError('color range');
 return Object.freeze({h:Object.freeze([...h]),s:Object.freeze([...s]),l:Object.freeze([...l])});
}
// 离散采样（queue 残差）：原作 Inspector 的每条色带是 ~12 个离散格，不是连续渐变。
// steps>=2 时把每个坐标吸附到 i/(steps-1) 的格点上（与原版 strip(vol,12) 同一粒度）；steps=0 连续。
export function sampleColorVolume(vol,u,v,w,{steps=0}={}){if(![u,v,w].every(Number.isFinite)||!Number.isFinite(steps)||steps<0||steps===1||!Number.isInteger(steps))throw new RangeError('finite coordinates');const q=x=>{const c=Math.max(0,Math.min(1,x));return steps>=2?Math.round(c*(steps-1))/(steps-1):c};const end=vol.h[1]<vol.h[0]?vol.h[1]+1:vol.h[1],h=(vol.h[0]+(end-vol.h[0])*q(u))%1,s=vol.s[0]+(vol.s[1]-vol.s[0])*q(v),l=vol.l[0]+(vol.l[1]-vol.l[0])*q(w);const f=n=>{const k=(n+h*12)%12;return l-s*Math.min(l,1-l)*Math.max(-1,Math.min(k-3,9-k,1))};return [f(0),f(8),f(4)];}
/** 面板上那一条离散色带（HSL 版，对应原版 strip(vol,n=12,v,w)）：固定 v、w，沿 u 取 n 格。 */
export function colorVolumeStrip(vol,n=12,v=.5,w=.5){if(!Number.isInteger(n)||n<1||n>256)throw new RangeError('strip size');return Array.from({length:n},(_,i)=>sampleColorVolume(vol,n===1?.5:i/(n-1),v,w));}
// 其他特征（queue 残差）：色域不只属于地面顶面 —— 每个表面特征各有一段 HSL 范围。
// 键对应 view.js 的 vField.z 分桶：ground(.5–1.5 地形顶面)、roof(|z|<.5 建筑顶面)、cliff(z<-.5 崖/层理壁)。
export const COLOR_VOLUME_FEATURES=Object.freeze(['ground','roof','cliff']);
export function makeFeatureColorVolumes(map){
 if(!map||typeof map!=='object'||Array.isArray(map))throw new RangeError('feature volume map');
 const out={};for(const [k,o]of Object.entries(map)){if(!COLOR_VOLUME_FEATURES.includes(k))throw new RangeError('unknown feature '+k);out[k]=makeColorVolume(o)}
 if(!Object.keys(out).length)throw new RangeError('no feature volumes');
 return Object.freeze(out);
}
export function sampleFeatureColorVolume(feature,vols,u,v,w,opts){const vol=vols&&vols[feature];if(!vol)throw new RangeError('missing feature '+feature);return sampleColorVolume(vol,u,v,w,opts);}
export const COLOR_VOLUME_GLSL=`
uniform float uColorVolumeOn;
uniform vec3 uColorVolumeMin;
uniform vec3 uColorVolumeMax;
uniform float uColorVolumeSteps;
uniform vec3 uFeatVolOn;
uniform vec3 uFeatVolMin[3];
uniform vec3 uFeatVolMax[3];
vec3 cvHslToRgb(vec3 hsl){vec3 k=mod(vec3(0.,8.,4.)+fract(hsl.x)*12.,12.);vec3 rgb=hsl.z-hsl.y*min(hsl.z,1.-hsl.z)*max(vec3(-1.),min(min(k-3.,9.-k),vec3(1.)));return mix(rgb/12.92,pow((rgb+.055)/1.055,vec3(2.4)),step(vec3(.04045),rgb));}
vec3 cvQuant(vec3 uvw){uvw=clamp(uvw,0.,1.);if(uColorVolumeSteps<1.5)return uvw;float n=uColorVolumeSteps-1.;return floor(uvw*n+.5)/n;}
vec3 colorVolumeSample(vec3 uvw){vec3 hi=uColorVolumeMax;if(hi.x<uColorVolumeMin.x)hi.x+=1.;vec3 hsl=mix(uColorVolumeMin,hi,cvQuant(uvw));return cvHslToRgb(hsl);}
vec3 featVolumeSample(int f,vec3 uvw){vec3 mn=uFeatVolMin[f],hi=uFeatVolMax[f];if(hi.x<mn.x)hi.x+=1.;vec3 hsl=mix(mn,hi,cvQuant(uvw));return cvHslToRgb(hsl);}
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
export function makeCornerVolume(name,corners,{space='oklab',...opts}={}){
 if(typeof name!=='string'||!Array.isArray(corners)||corners.length!==8||!SPACES[space])throw new RangeError('corner volume');
 const rgb=corners.map(toRgb);if(rgb.some(c=>!Array.isArray(c)||c.length!==3||c.some(v=>!Number.isFinite(v)||v<0||v>1)))throw new RangeError('corner colour');
 return{name,space,rgb,corners:rgb.map(SPACES[space].to),...opts};
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

// ---------- 原版完整接口（queue 残差）：REACode/src/colorvolume.js 的完整签名 ----------
// 原版对照表：makeVolume→makeCornerVolume、sample→sampleCornerVolumeSpace、
// strip→volumeStrip、volumeSheet→volumeSheet、volumeStats→cornerVolumeStats、
// terrain→colorVolumeTerrain、css→css、dE→dE、oklabToRgb→oklabToRgb。
/** 原版 sample 的原始契约：三线性插值后**不**转 sRGB —— 返回体积自己的插值空间坐标
 *  （space='oklab' 时就是 OKLab）。消费端自行转换 + 钳色域。 */
export function sampleCornerVolumeSpace(vol,u,v,w){if(![u,v,w].every(Number.isFinite))throw new RangeError('finite coordinates');const q=[u,v,w].map(x=>Math.max(0,Math.min(1,x))),out=[0,0,0];
 for(let i=0;i<8;i++){const wt=(i&1?q[0]:1-q[0])*(i&2?q[1]:1-q[1])*(i&4?q[2]:1-q[2]);for(let k=0;k<3;k++)out[k]+=vol.corners[i][k]*wt}
 return out;}
/** 原版 css：OKLab 色 → 'rgb(r,g,b)'（色域外分量钳到 0..1）。 */
export function css(oklab){const[r,g,b]=oklabToSrgb(...oklab);const q=v=>Math.round(Math.min(1,Math.max(0,v))*255);return `rgb(${q(r)},${q(g)},${q(b)})`;}
/** 原版 dE：两个 OKLab 色的欧氏距离 ×100（>8 才算特征分得开，<4 是一块死色）。 */
export {oklabToSrgb as oklabToRgb, deltaE as dE};

// 预览用的地形分类器 —— 原版 terrain() 的忠实移植（同样的岛形高度场 + fbm +
// 阈值：Beach hh<0.13、Cliff slope>0.55、Flowers wob>0.90&&hh>0.30、其余 Grass；
// Roof 不在地形预览里 —— 原版也没有）。确定性：同 seed 同输出。
const cvHash2=(x,y)=>{let h=x*374761393+y*668265263;h=(h^(h>>13))*1274126177;return(((h^(h>>16))>>>0)%2147483648)/2147483648};
const cvVnoise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,s=t=>t*t*(3-2*t),
 a=cvHash2(xi,yi),b=cvHash2(xi+1,yi),c=cvHash2(xi,yi+1),d=cvHash2(xi+1,yi+1),u=s(xf),v=s(yf);
 return(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v};
const cvFbm=(x,y,oct=4)=>{let s=0,amp=.5,f=1;for(let i=0;i<oct;i++){s+=amp*cvVnoise(x*f,y*f);f*=2;amp*=.5}return s};
/** 原版 terrain(w,h,vols,{scale,seed,out})：岛坡高度场 → 坡度 → 特征 → 各特征空间取色。 */
export function colorVolumeTerrain(w,h,vols,{scale=6,seed=1,out=new Float32Array(w*h*3)}={}){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||!vols||out.length<w*h*3)throw new RangeError('terrain args');
 const hs=new Float32Array(w*h);let lo=1e9,hi=-1e9;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=x/w,ny=y/h,
  d=Math.hypot((nx-.5)*1.6,(ny-.46)*1.9),base=Math.max(0,1-d*d*1.05),
  v=base*.9+(cvFbm(nx*scale+seed*7.3,ny*scale+seed*3.1)-.5)*.55;
  hs[y*w+x]=v;lo=Math.min(lo,v);hi=Math.max(hi,v)}
 const span=Math.max(1e-6,hi-lo);for(let i=0;i<hs.length;i++)hs[i]=(hs[i]-lo)/span;
 const at=(x,y)=>hs[Math.min(h-1,Math.max(0,y))*w+Math.min(w-1,Math.max(0,x))];
 let gmax=1e-6;
 for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const gx=(at(x+1,y)-at(x-1,y))*.5,gy=(at(x,y+1)-at(x,y-1))*.5;gmax=Math.max(gmax,Math.hypot(gx,gy))}
 const used={Beach:0,Cliff:0,Grass:0,Flowers:0};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const hh=at(x,y),
  gx=(at(x+1,y)-at(x-1,y))*.5,gy=(at(x,y+1)-at(x,y-1))*.5,
  slope=Math.min(1,Math.hypot(gx,gy)/gmax),u=hh,wob=cvHash2(x*3+seed,y*5-seed);
  let vol;
  if(hh<.13){vol=vols.Beach;used.Beach++}
  else if(slope>.55){vol=vols.Cliff;used.Cliff++}
  else if(wob>.90&&hh>.30){vol=vols.Flowers;used.Flowers++}
  else{vol=vols.Grass;used.Grass++}
  if(!vol)throw new RangeError('missing volume for classified feature');
  const[r,g,b]=sampleCornerVolume(vol,u,slope,wob),i=(y*w+x)*3;
  out[i]=r;out[i+1]=g;out[i+2]=b}
 return{rgb:out,used,w,h};}
