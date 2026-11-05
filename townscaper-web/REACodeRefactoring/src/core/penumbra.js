/** Three heightfield projections onto a horizontal receiver. Heights and ray
 * distances use world units, including after coarse max pooling.
 * This intentionally cannot represent caves, overhangs or deformed surfaces.
 */
export function coarsenHeights(field, factor=3) {
  if(!Number.isInteger(factor)||factor<1||factor>16)throw new RangeError('coarse factor');
  const {nx,nz,heights,res}=field,W=Math.ceil(nx/factor),H=Math.ceil(nz/factor),out=new Float32Array(W*H);
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)out[Math.floor(z/factor)*W+Math.floor(x/factor)]=Math.max(out[Math.floor(z/factor)*W+Math.floor(x/factor)],heights[z*nx+x]);
  return {...field,nx:W,nz:H,res:res*factor,heights:out};
}
export function castHeightShadow(field,sun,{bias=0,receiver=0}={}) {
  const {nx,nz,res,heights}=field,n=nx*nz;
  if(!Number.isInteger(nx)||!Number.isInteger(nz)||nx<1||nz<1||n>100000||heights.length!==n||!Number.isFinite(res)||res<=0||!Array.isArray(sun)||sun.length!==3||!sun.every(Number.isFinite)||sun[1]<=0||!Number.isFinite(bias)||bias<0)throw new RangeError('height shadow input');
  let maxH=0;for(const h of heights){if(!Number.isFinite(h)||h<0)throw new RangeError('shadow height');maxH=Math.max(maxH,h)}
  const len=Math.hypot(sun[0],sun[2]),out=new Float32Array(n);if(len<1e-9)return out;
  const dx=sun[0]/len,dz=sun[2]/len,slope=sun[1]/len,step=res*.5;
  const reach=Math.min(Math.hypot(nx,nz)*res,Math.max(0,(maxH-receiver-bias)/slope));
  if(Math.ceil(reach/step)*n>30000000)throw new RangeError('shadow ray budget');
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    for(let t=step*.5;t<=reach;t+=step){
      const ix=Math.floor(x+.5+dx*t/res),iz=Math.floor(z+.5+dz*t/res);
      if(ix<0||iz<0||ix>=nx||iz>=nz)break;
      if(heights[iz*nx+ix]>receiver+t*slope+bias){out[z*nx+x]=1;break}
    }
  }
  return out;
}
export function threeShadow(field,sun,{coarse=3,pull=.18}={}) {
  const normal=castHeightShadow(field,sun),pulled=castHeightShadow(field,sun,{bias:pull});
  const bigField=coarsenHeights(field,coarse),bigRaw=castHeightShadow(bigField,sun),blur=new Float32Array(bigRaw.length);
  for(let z=0;z<bigField.nz;z++)for(let x=0;x<bigField.nx;x++){let v=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,zz=z+j;if(xx>=0&&zz>=0&&xx<bigField.nx&&zz<bigField.nz){v+=bigRaw[zz*bigField.nx+xx];n++}}blur[z*bigField.nx+x]=v/n}
  const big=new Float32Array(normal.length),alpha=new Float32Array(normal.length);
  for(let z=0;z<field.nz;z++)for(let x=0;x<field.nx;x++){const k=z*field.nx+x;big[k]=blur[Math.floor(z/coarse)*bigField.nx+Math.floor(x/coarse)];alpha[k]=1-(1-.65*normal[k])*(1-.25*pulled[k])*(1-.3*big[k]);if(field.heights[k]>0)alpha[k]=0;}
  return {normal,pulled,big,alpha};
}
