/** 1305951750638231552 "draw the shadow thrice, once normal, once pulled in slightly and once with big voxels".
 * Height-field projections. Heights and ray distances use world units, including after coarse pooling.
 * Receivers: a constant plane (water, the original View layer) OR the height field itself (terrain self-receive,
 * REACode src/penumbra.js castShadow uses hc = own height). Caves/overhangs need the voxel variant in
 * src/light/penumbra.js (bakeVoxelPenumbra); this file stays 2.5D.
 */
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
/** weights = max contribution of normal / pulled / big; pool 'mean' follows REACode (max-pool inflates the big pass). */
export function threeShadow(field,sun,{coarse=3,pull=.18,pool='mean',weights=[.65,.25,.3],onTerrain=false}={}) {
  if(!Array.isArray(weights)||weights.length!==3||weights.some(w=>!(w>=0&&w<=1)))throw new RangeError('penumbra weights');
  const receiver=onTerrain?field.heights:0;
  const normal=castHeightShadow(field,sun,{receiver}),pulled=castHeightShadow(field,sun,{bias:pull,receiver});
  const bigField=coarsenHeights(field,coarse,{pool}),bigRaw=castHeightShadow(bigField,sun,{receiver:onTerrain?coarsenHeights(field,coarse,{pool:'mean'}).heights:0}),blur=new Float32Array(bigRaw.length);
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
/** Penumbra band (0.1<alpha<0.5 or custom) and its mean width in WORLD units measured to the hard core. */
export function penumbraStats(field,r,{lo=.1,hi=.5,cap=12}={}){
  const dist=distToMask(r.normal,field.nx,field.nz);let band=0,width=0,hard=0;
  for(let i=0;i<r.alpha.length;i++){if(r.normal[i])hard++;const v=r.alpha[i];if(v>lo&&v<hi){band++;width+=Math.min(dist[i],cap)}}
  return {hard,band,bandWidth:band?width/band*field.res:0,total:r.alpha.length};
}
