import {threeShadow,penumbraStats,PENUMBRA_THRICE} from '../core/penumbra.js';
import {firstVoxelHit} from '../core/voxel-ray.js';
/** Derived sampling of the existing editable World, never a second World.
 * pull 默认 L*裁判值.7（原 bias=0.7 个体素高度；世界单位场 = L*0.7），weights 默认 PENUMBRA_THRICE。 */
export function bakeWaterPenumbra(world,index,sun,{L=.5,res=.3,coarse=3,pool='mean',onTerrain=false,pull=null}={}) {
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxH=0;
  for(const c of world.cells)if(world.top(c)){minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ);maxH=Math.max(maxH,world.top(c)*L)}
  if(!Number.isFinite(minX))return null;
  if(!Number.isFinite(res)||res<=0||!Number.isFinite(L)||L<=0||sun[1]<=0)throw new RangeError('water penumbra options');
  const pad=Math.min(12,Math.max(2,maxH*Math.hypot(sun[0],sun[2])/sun[1]));minX-=pad;minZ-=pad;maxX+=pad;maxZ+=pad;
  const nx=Math.ceil((maxX-minX)/res),nz=Math.ceil((maxZ-minZ)/res);if(nx*nz>100000)throw new RangeError('water penumbra size');
  const heights=new Float32Array(nx*nz);for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const c=index.cellAt(minX+(x+.5)*res,minZ+(z+.5)*res);if(c)heights[z*nx+x]=world.top(c)*L;}
  const field={nx,nz,res,heights,minX,minZ},r=threeShadow(field,sun,{coarse,pull:pull??L*PENUMBRA_THRICE.pull,pool,onTerrain});return {...field,...r,stats:penumbraStats(field,r),version:world.version};
}

/**
 * 3D voxel version of "draw the shadow thrice" on the shared World occupancy (World.isSolid per level):
 * every upward-facing empty voxel above a solid one (and the sea at y=0) is a receiver, so ground under
 * overhangs/arches and the slab top above them are separate receivers — the 2.5D height field cannot do that.
 *   normal: DDA from the receiver toward the sun;  pulled: same ray started `pull` higher;
 *   big: occupancy mean-pooled over coarse×coarse columns (≥0.5 solid), marched, then 3×3 blurred per level.
 */
export function bakeVoxelPenumbra(world,index,sun,{L=.5,res=.25,coarse=3,pull=null,weights=PENUMBRA_THRICE.weights,pad=null,maxVoxels=1500000}={}){
  if(!Array.isArray(sun)||sun.length!==3||!sun.every(Number.isFinite)||sun[1]<=0)throw new RangeError('voxel penumbra sun');
  if(!(L>0)||!(res>0)||!Number.isInteger(coarse)||coarse<1||coarse>8)throw new RangeError('voxel penumbra options');
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,top=0;
  for(const c of world.cells){const t=world.top(c);if(!t)continue;minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ);top=Math.max(top,t)}
  if(!Number.isFinite(minX))return null;
  const sl=Math.hypot(...sun),S=sun.map(v=>v/sl),reachXZ=(top*L)*Math.hypot(S[0],S[2])/S[1],p0=pad??Math.min(12,Math.max(1,reachXZ));
  minX-=p0;minZ-=p0;maxX+=p0;maxZ+=p0;
  const nx=Math.ceil((maxX-minX)/res),nz=Math.ceil((maxZ-minZ)/res),ny=top+2,N=nx*ny*nz;if(N>maxVoxels)throw new RangeError('voxel penumbra budget');
  const id=(x,y,z)=>(z*ny+y)*nx+x,solid=new Uint8Array(N),colCell=new Int32Array(nx*nz).fill(-1);
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const c=index.cellAt(minX+(x+.5)*res,minZ+(z+.5)*res);if(!c)continue;colCell[z*nx+x]=c.id;for(let y=0;y<ny;y++)if(world.isSolid(c,y+1))solid[id(x,y,z)]=1}
  const receivers=[];for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){if(solid[id(x,y,z)])continue;if(y===0||solid[id(x,y-1,z)])receivers.push({x,y,z,cell:colCell[z*nx+x],wy:y*L})}
  const vd=[S[0]/res,S[1]/L,S[2]/res],far=(ny+1)/vd[1];
  const ray=(x,y0,z)=>firstVoxelHit(solid,{nx,ny,nz},[x+.5,y0,z+.5],[x+.5+vd[0]*far,y0+vd[1]*far,z+.5+vd[2]*far])>=0?1:0;
  const pullV=(pull??L*PENUMBRA_THRICE.pull)/L;
  // big voxels: mean pooled occupancy per coarse column block, same vertical levels
  const cx=Math.ceil(nx/coarse),cz=Math.ceil(nz/coarse),big=new Uint8Array(cx*ny*cz),bid=(x,y,z)=>(z*ny+y)*cx+x;
  for(let z=0;z<cz;z++)for(let x=0;x<cx;x++)for(let y=0;y<ny;y++){let s=0,n=0;for(let j=0;j<coarse;j++)for(let i=0;i<coarse;i++){const xx=x*coarse+i,zz=z*coarse+j;if(xx<nx&&zz<nz){s+=solid[id(xx,y,zz)];n++}}big[bid(x,y,z)]=n&&s/n>=.5?1:0}
  const bvd=[vd[0]/coarse,vd[1],vd[2]/coarse],bigRaw=new Float32Array(cx*ny*cz);
  for(let z=0;z<cz;z++)for(let x=0;x<cx;x++)for(let y=0;y<ny;y++){
    // start at the floor of this coarse voxel; skip the start voxel itself (a pooled block may be solid)
    let px=x+.5,py=y+.02,pz=z+.5,hit=0;const st=.5/Math.max(Math.abs(bvd[0]),Math.abs(bvd[1]),Math.abs(bvd[2]));
    for(let t=st;t<far;t+=st){const ix=Math.floor(px+bvd[0]*t),iy=Math.floor(py+bvd[1]*t),iz=Math.floor(pz+bvd[2]*t);if(ix<0||iz<0||ix>=cx||iz>=cz||iy>=ny)break;if(ix===x&&iy===y&&iz===z)continue;if(big[bid(ix,iy,iz)]){hit=1;break}}
    bigRaw[bid(x,y,z)]=hit;
  }
  const bigBlur=new Float32Array(bigRaw.length);for(let z=0;z<cz;z++)for(let x=0;x<cx;x++)for(let y=0;y<ny;y++){let s=0,n=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const xx=x+i,zz=z+j;if(xx>=0&&zz>=0&&xx<cx&&zz<cz){s+=bigRaw[bid(xx,y,zz)];n++}}bigBlur[bid(x,y,z)]=s/n}
  let hard=0,band=0;
  for(const r of receivers){r.normal=ray(r.x,r.y+.02,r.z);r.pulled=ray(r.x,r.y+.02+pullV,r.z);r.big=bigBlur[bid(Math.floor(r.x/coarse),r.y,Math.floor(r.z/coarse))];r.alpha=1-(1-weights[0]*r.normal)*(1-weights[1]*r.pulled)*(1-weights[2]*r.big);hard+=r.normal;if(r.alpha>.1&&r.alpha<.5)band++}
  const byColumn=new Map();for(const r of receivers){const k=r.z*nx+r.x;if(!byColumn.has(k))byColumn.set(k,[]);byColumn.get(k).push(r)}
  /** alpha of the receiver directly under (or at) world point (x,y,z): the floor you'd stand on. */
  const sampleAt=(x,y,z)=>{const i=Math.floor((x-minX)/res),j=Math.floor((z-minZ)/res),list=byColumn.get(j*nx+i);if(!list||i<0||j<0||i>=nx||j>=nz)return 0;let best=null;for(const r of list)if(r.wy<=y+1e-6&&(!best||r.wy>best.wy))best=r;return best?best.alpha:0};
  return {nx,ny,nz,res,L,minX,minZ,receivers,sampleAt,stats:{receivers:receivers.length,hard,band,multiReceiverColumns:[...byColumn.values()].filter(l=>l.length>1).length},version:world.version};
}
