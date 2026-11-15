/** 777596437534240768: finish the missing mipfilter renderGround / paint / A-B consumer.
 * Refactors onto the existing shared RGB mip-chain rather than copying the legacy RGBA engine.
 * Deliberate differences: IEC sRGB (not gamma 2.2), repeat addressing, actual 2D derivatives
 * for LOD/aniso, quarter-*texel* shimmer displacement (legacy report moved 1/4 UV period).
 * No claim that three opaque reference frames reveal the author's exact filter kernel.
 */
import {buildMips,sampleBilinear,sampleTrilinear,sampleAniso,srgbToLinear} from './mip-chain.js';
function dimensions(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>1048576)throw new RangeError('bounded positive image dimensions required');}
export function makeTestTexture(w=128,h=128,{seed=7}={}){
 dimensions(w,h);if(!Number.isSafeInteger(seed)||seed<1||seed>2147483646)throw new RangeError('positive seed required');
 const data=new Float32Array(w*h*3);let state=seed;const rnd=()=>{state=(state*16807)%2147483647;return state/2147483647;};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const mortar=y%8===0||(x+((y>>3)%2?8:0))%16===0,window=x%37===0&&y%29<11||y%29===0&&x%37<9,tile=(x+y)%3===0;let c=mortar?[92,84,78]:[168+rnd()*12-6,120+rnd()*10-5,96+rnd()*8-4];if(tile)c=c.map((v,k)=>v*[.82,.78,.8][k]);if(window)c=[236,232,220];data.set(c.map(v=>Math.round(v)/255),(y*w+x)*3);}
 return{w,h,data};
}
function coordinates(x,y,W,H,{horizon,tiles,zoom,offsetU,offsetV}){
 const dy=y-H*horizon;
 return[(x/W-.5)*tiles*zoom*H/Math.max(.5,dy)+.5+offsetU,tiles*.5*zoom*H/Math.max(.5,dy)+offsetV];
}
export function renderGround(chain,W=320,H=180,options={}){
 dimensions(W,H);if(!Array.isArray(chain)||!chain.length||chain.some(m=>!m||m.w<1||m.h<1||m.data?.length!==m.w*m.h*3))throw new TypeError('RGB mip chain required');
 const p={mode:'trilinear',horizon:.3,tiles:3,zoom:1,offsetU:0,offsetV:0,maxAniso:8,...options};
 if(!['none','trilinear','aniso'].includes(p.mode)||![p.horizon,p.tiles,p.zoom,p.offsetU,p.offsetV].every(Number.isFinite)||p.horizon<0||p.horizon>=.9||p.tiles<=0||p.zoom<=0||!Number.isInteger(p.maxAniso)||p.maxAniso<1||p.maxAniso>16)throw new RangeError('ground sampling options');
 const data=new Uint8ClampedArray(W*H*4),lodRange=[Infinity,-Infinity];let samples=0;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4;if(y-H*p.horizon<=.5){data.set([30,40,48,255],i);continue;}
  const uv=coordinates(x,y,W,H,p),ux=coordinates(x+1,y,W,H,p),uy=coordinates(x,y+1,W,H,p),du=ux.map((v,k)=>v-uv[k]),dv=uy.map((v,k)=>v-uv[k]);
  const major=Math.max(Math.hypot(du[0]*chain[0].w,du[1]*chain[0].h),Math.hypot(dv[0]*chain[0].w,dv[1]*chain[0].h)),lod=Math.min(chain.length-1,Math.max(0,Math.log2(Math.max(1,major))));lodRange[0]=Math.min(lodRange[0],lod);lodRange[1]=Math.max(lodRange[1],lod);samples++;
  const c=p.mode==='none'?sampleBilinear(chain[0],...uv):p.mode==='aniso'?sampleAniso(chain,...uv,du,dv,{maxTaps:p.maxAniso}):sampleTrilinear(chain,...uv,lod);
  for(let k=0;k<3;k++)data[i+k]=Math.round(Math.max(0,Math.min(1,c[k]))*255);data[i+3]=255;
 }
 return{w:W,h:H,data,horizon:p.horizon,lodRange:samples?lodRange:[0,0]};
}
export function laplacianEnergy(image,{y0=1,y1=image.h-1}={}){
 const {w,h,data}=image,Y=(x,y)=>{const i=(y*w+x)*4;return data[i]*.299+data[i+1]*.587+data[i+2]*.114;};let sum=0,n=0;
 for(let y=Math.max(1,Math.ceil(y0));y<Math.min(h-1,y1);y++)for(let x=1;x<w-1;x++){const l=4*Y(x,y)-Y(x-1,y)-Y(x+1,y)-Y(x,y-1)-Y(x,y+1);sum+=l*l;n++;}return n?sum/n:0;
}
export function compareFilters({size=128,W=320,H=180,filters=['box','linear','kaiser'],...options}={}){
 const texture=makeTestTexture(size,size),rows=[];
 for(const filter of filters){const chain=buildMips(texture,{filter});for(const mode of ['none','trilinear','aniso']){const image=renderGround(chain,W,H,{...options,mode});rows.push({filter,mode,image,levels:chain.length,bytes:chain.reduce((n,m)=>n+m.data.byteLength,0),farEnergy:laplacianEnergy(image,{y0:H*image.horizon+2,y1:H*.58}),nearEnergy:laplacianEnergy(image,{y0:H*.8})});}}
 return{texture,rows};
}
export function shimmerReport({size=128,W=160,H=100,steps=4,filters=['box','linear','kaiser'],...options}={}){
 if(!Number.isInteger(steps)||steps<2||steps>16)throw new RangeError('steps 2..16');
 const texture=makeTestTexture(size,size),rows=[];
 for(const filter of filters){const chain=buildMips(texture,{filter});for(const mode of ['none','trilinear','aniso']){let previous=null,sum=0,n=0;for(let f=0;f<steps;f++){const image=renderGround(chain,W,H,{...options,mode,offsetU:f/(steps*4*size),offsetV:f/(steps*3*size)});if(previous)for(let y=Math.ceil(H*image.horizon+2);y<H*.55;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;for(let k=0;k<3;k++){sum+=Math.abs(image.data[i+k]-previous.data[i+k]);n++;}}previous=image;}rows.push({filter,mode,meanAbsDelta:n?sum/n:0});}}return{rows,offsetUnits:'fraction of a texel'};
}
/** Report both encoded-value drift and true linear-light drift; their meanings differ. */
export function checkMeanPreserved(texture){
 const mean=(m,linear)=>m.data.reduce((n,v)=>n+(linear?srgbToLinear(v):v),0)/m.data.length;
 const base=mean(texture,false),linearBase=mean(texture,true),rows={};for(const filter of ['box','linear','kaiser']){const last=buildMips(texture,{filter}).at(-1);rows[filter]={encodedDrift:mean(last,false)-base,linearDrift:mean(last,true)-linearBase};}return{base,linearBase,rows};
}
export function paint(ctx,image,x=0,y=0,scale=1){if(!Number.isFinite(scale)||scale<=0)throw new RangeError('positive paint scale');const off=ctx.canvas.ownerDocument.createElement('canvas');off.width=image.w;off.height=image.h;const target=off.getContext('2d'),pixels=target.createImageData(image.w,image.h);pixels.data.set(image.data);target.putImageData(pixels,0,0);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(off,x,y,image.w*scale,image.h*scale);ctx.restore();return off;}
