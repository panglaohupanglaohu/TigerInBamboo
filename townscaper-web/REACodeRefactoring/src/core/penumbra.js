/** 1305951750638231552 "draw the shadow thrice, once normal, once pulled in slightly and once with big voxels".
 * Height-field projections. Heights and ray distances use world units, including after coarse pooling.
 * Receivers: a constant plane (water, the original View layer) OR the height field itself (terrain self-receive,
 * REACode src/penumbra.js castShadow uses hc = own height). Caves/overhangs need the voxel variant in
 * src/light/penumbra.js (bakeVoxelPenumbra); this file stays 2.5D.
 *
 * 裁判（REACode/src/penumbra.js composite，只读）可量化参数：
 *   三遍权重 [.80,.34,.44]（正常/内收/大体素各自的最大贡献）、pull = +0.7 体素高度的遮挡门槛、
 *   coarse = 3 均值降采样、粗格 3×3 均值模糊（其 blurMask r=1 的圆判据 i²+j²≤r²+1 恰好取满 9 格，与盒式相同）、
 *   半影带 = .10<alpha<.50、带宽 = 到最近硬阴影格的 chamfer 距离均值（封顶 12 格）、composite 默认 tanE=.52。
 *   裁判粗格 castShadow 把 tanE 留在粗格单位 → 世界空间有效坡率 ÷coarse（大体素影足迹约 3×4.4 倍、带宽
 *   ~4.5–5.7 格 vs 正确坡率 ~1.5–2.0）；这是裁判 2D 诊断的尺度差，本库默认保持世界单位坡率
 *   （bigSlopeScale=1），要复现裁判足迹显式传 bigSlopeScale:1/coarse。normal/pulled 两遍与裁判逐格一致。
 */
export const PENUMBRA_THRICE = Object.freeze({ weights: [.8, .34, .44], pull: .7, coarse: 3, blurCell: 1, band: [.1, .5], cap: 12 });
export function coarsenHeights(field, factor=3, {pool='max'}={}) {
  if(!Number.isInteger(factor)||factor<1||factor>16)throw new RangeError('coarse factor');
  if(pool!=='max'&&pool!=='mean')throw new RangeError('pool');
  const {nx,nz,heights,res}=field,W=Math.ceil(nx/factor),H=Math.ceil(nz/factor),out=new Float32Array(W*H),n=new Uint16Array(W*H);
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const k=Math.floor(z/factor)*W+Math.floor(x/factor);if(pool==='max')out[k]=Math.max(out[k],heights[z*nx+x]);else{out[k]+=heights[z*nx+x];n[k]++}}
  if(pool==='mean')for(let k=0;k<out.length;k++)out[k]=n[k]?out[k]/n[k]:0;
  return {...field,nx:W,nz:H,res:res*factor,heights:out};
}
export function castHeightShadow(field,sun,{bias=0,receiver=0,depth=null}={}) {
  const {nx,nz,res,heights}=field,n=nx*nz;
  const perCell=receiver instanceof Float32Array||Array.isArray(receiver);
  if(!Number.isInteger(nx)||!Number.isInteger(nz)||nx<1||nz<1||n>100000||heights.length!==n||!Number.isFinite(res)||res<=0||!Array.isArray(sun)||sun.length!==3||!sun.every(Number.isFinite)||sun[1]<=0||!Number.isFinite(bias)||bias<0||(perCell?receiver.length!==n:!Number.isFinite(receiver)))throw new RangeError('height shadow input');
  let maxH=0;for(const h of heights){if(!Number.isFinite(h)||h<0)throw new RangeError('shadow height');maxH=Math.max(maxH,h)}
  const len=Math.hypot(sun[0],sun[2]),out=new Float32Array(n);if(len<1e-9)return out;
  const dx=sun[0]/len,dz=sun[2]/len,slope=sun[1]/len,step=res*.5,lowest=perCell?0:receiver;
  const reach=Math.min(Math.hypot(nx,nz)*res,Math.max(0,(maxH-lowest-bias)/slope));
  if(Math.ceil(reach/step)*n>30000000)throw new RangeError('shadow ray budget');
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const k=z*nx+x,r=perCell?receiver[k]:receiver;
    // self-receive starts one half cell out so a flat top never shadows itself
    for(let t=perCell?Math.max(step*.5,res*.6):step*.5;t<=reach;t+=step){
      const ix=Math.floor(x+.5+dx*t/res),iz=Math.floor(z+.5+dz*t/res);
      if(ix<0||iz<0||ix>=nx||iz>=nz)break;
      if(perCell&&ix===x&&iz===z)continue;
      if(heights[iz*nx+ix]>r+t*slope+bias){out[k]=1;if(depth)depth[k]=t;break}
    }
  }
  return out;
}
/** weights/pull/coarse 默认取裁判值（PENUMBRA_THRICE）；pool 'mean' 同裁判（max-pool 会放大第三遍）。
 * pull 的单位 = 场高度单位：裁判场用体素层数故 0.7；世界单位场由调用方传 L*0.7（light/penumbra.js 已做）。
 * bigSlopeScale：第三遍投影的有效坡率缩放；1=世界单位坡率（默认），1/coarse=复现裁判粗格足迹。 */
export function threeShadow(field,sun,{coarse=PENUMBRA_THRICE.coarse,pull=PENUMBRA_THRICE.pull,pool='mean',weights=PENUMBRA_THRICE.weights,onTerrain=false,bigSlopeScale=1}={}) {
  if(!Array.isArray(weights)||weights.length!==3||weights.some(w=>!(w>=0&&w<=1)))throw new RangeError('penumbra weights');
  if(!Number.isFinite(bigSlopeScale)||bigSlopeScale<=0)throw new RangeError('penumbra bigSlopeScale');
  const receiver=onTerrain?field.heights:0,bigSun=bigSlopeScale===1?sun:[sun[0],sun[1]*bigSlopeScale,sun[2]];
  const normal=castHeightShadow(field,sun,{receiver}),pulled=castHeightShadow(field,sun,{bias:pull,receiver});
  const bigField=coarsenHeights(field,coarse,{pool}),bigRaw=castHeightShadow(bigField,bigSun,{receiver:onTerrain?coarsenHeights(field,coarse,{pool:'mean'}).heights:0}),blur=new Float32Array(bigRaw.length);
  for(let z=0;z<bigField.nz;z++)for(let x=0;x<bigField.nx;x++){let v=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,zz=z+j;if(xx>=0&&zz>=0&&xx<bigField.nx&&zz<bigField.nz){v+=bigRaw[zz*bigField.nx+xx];n++}}blur[z*bigField.nx+x]=v/n}
  const big=new Float32Array(normal.length),alpha=new Float32Array(normal.length);
  for(let z=0;z<field.nz;z++)for(let x=0;x<field.nx;x++){const k=z*field.nx+x;big[k]=blur[Math.floor(z/coarse)*bigField.nx+Math.floor(x/coarse)];alpha[k]=1-(1-weights[0]*normal[k])*(1-weights[1]*pulled[k])*(1-weights[2]*big[k]);if(!onTerrain&&field.heights[k]>0)alpha[k]=0;}
  return {normal,pulled,big,alpha};
}
/** Chamfer distance (cells) to the nearest hard-shadow cell — REACode distToMask. */
export function distToMask(mask,nx,nz){
  const d=new Float32Array(nx*nz);for(let i=0;i<d.length;i++)d[i]=mask[i]?0:1e9;
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*nx+x;if(!d[i])continue;let m=d[i];if(x>0)m=Math.min(m,d[i-1]+1);if(z>0)m=Math.min(m,d[i-nx]+1);if(x>0&&z>0)m=Math.min(m,d[i-nx-1]+1.4);if(x<nx-1&&z>0)m=Math.min(m,d[i-nx+1]+1.4);d[i]=m}
  for(let z=nz-1;z>=0;z--)for(let x=nx-1;x>=0;x--){const i=z*nx+x;if(!d[i])continue;let m=d[i];if(x<nx-1)m=Math.min(m,d[i+1]+1);if(z<nz-1)m=Math.min(m,d[i+nx]+1);if(x<nx-1&&z<nz-1)m=Math.min(m,d[i+nx+1]+1.4);if(x>0&&z<nz-1)m=Math.min(m,d[i+nx-1]+1.4);d[i]=m}
  return d;
}
/** Penumbra band (裁判 .10<alpha<.50，带宽=到硬核 chamfer 距离均值，封顶 12 格) in WORLD units.
 * 计数口径与裁判 composite 相同：hard/pulled=1 的格数、big>0.5 的格数。 */
export function penumbraStats(field,r,{lo=PENUMBRA_THRICE.band[0],hi=PENUMBRA_THRICE.band[1],cap=PENUMBRA_THRICE.cap}={}){
  const dist=distToMask(r.normal,field.nx,field.nz);let band=0,width=0,hard=0,pulled=0,big=0;
  for(let i=0;i<r.alpha.length;i++){if(r.normal[i])hard++;if(r.pulled?.[i])pulled++;if(r.big?.[i]>.5)big++;const v=r.alpha[i];if(v>lo&&v<hi){band++;width+=Math.min(dist[i],cap)}}
  return {hard,pulled,big,band,bandWidth:band?width/band*field.res:0,total:r.alpha.length};
}
