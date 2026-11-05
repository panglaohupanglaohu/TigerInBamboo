/** 1481661852887265288: local distance-field support on shared occupancy.
 * Exact separable EDT between voxel CENTRES (anisotropic world spacing).
 * Signed centre distances are NOT exact distances to the voxel-box surface.
 * Ray steps use a separate conservative lower bound: centre EDT minus query
 * offset minus the voxel half diagonal; unresolved spans fall back to DDA.
 */
import{firstVoxelHit}from'./voxel-ray.js';
export function voxelDistance(solid,{nx,ny,nz,spacing=[1,1,1],maxDistance=4,maxVoxels=2000000}={}){
 const N=nx*ny*nz;if(![nx,ny,nz].every(n=>Number.isInteger(n)&&n>0)||!Number.isInteger(maxVoxels)||maxVoxels<1||N>maxVoxels||solid.length!==N||spacing.length!==3||!spacing.every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(maxDistance)||maxDistance<=0)throw new RangeError('invalid voxel distance field');
 const dims=[nx,ny,nz],M=Math.max(...dims),v=new Int32Array(M),bounds=new Float64Array(M+1);
 function edt(seedSolid){let src=new Float64Array(N),dst=new Float64Array(N);for(let i=0;i<N;i++)src[i]=!!solid[i]===seedSolid?0:Infinity;
  function line(base,stride,length,weight){let k=-1;for(let q=0;q<length;q++){const f=src[base+q*stride];if(!Number.isFinite(f))continue;let s=-Infinity;while(k>=0){const p=v[k];s=(f-src[base+p*stride]+weight*(q*q-p*p))/(2*weight*(q-p));if(s>bounds[k])break;k--}k++;v[k]=q;bounds[k]=k===0?-Infinity:s;bounds[k+1]=Infinity}if(k<0){for(let q=0;q<length;q++)dst[base+q*stride]=Infinity;return}let j=0;for(let q=0;q<length;q++){while(bounds[j+1]<q)j++;const p=v[j];dst[base+q*stride]=weight*(q-p)**2+src[base+p*stride]}}
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)line((z*ny+y)*nx,1,nx,spacing[0]**2);[src,dst]=[dst,src];
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)line(z*ny*nx+x,nx,ny,spacing[1]**2);[src,dst]=[dst,src];
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)line(y*nx+x,nx*ny,nz,spacing[2]**2);return dst;
 }
 const toSolid=edt(true),toEmpty=edt(false),signed=new Float32Array(N),halfDiag=Math.hypot(...spacing)/2;for(let i=0;i<N;i++)signed[i]=(solid[i]?-1:1)*Math.min(maxDistance,Math.sqrt(solid[i]?toEmpty[i]:toSolid[i]));
 const id=(x,y,z)=>(z*ny+y)*nx+x,inside=p=>Array.isArray(p)&&p.length===3&&p.every((v,i)=>Number.isFinite(v)&&v>=0&&v<dims[i]);
 const stats={queries:0,steps:0,fallbacks:0};
 function lowerBound(p){if(!inside(p))return 0;const c=p.map(Math.floor),offset=Math.hypot(...p.map((v,i)=>(v-c[i]-.5)*spacing[i]));return Math.max(0,Math.min(maxDistance,Math.sqrt(toSolid[id(...c)]))-offset-halfDiag)}
 function rayHit(A,B){stats.queries++;const d=B.map((v,i)=>(v-A[i])*spacing[i]),length=Math.hypot(...d),epsilon=Math.min(...spacing)*.05;let t=0,p=A;
  const fallback=()=>{stats.fallbacks++;return firstVoxelHit(solid,{nx,ny,nz},p,B)};
  if(!Number.isFinite(length)||length===0)return fallback();
  for(let k=0;k<48;k++){if(k>0&&!inside(p))return-1;const bound=lowerBound(p);stats.steps++;if(bound<epsilon)return fallback();t+=bound*.9;if(t>=length)return-1;p=A.map((v,i)=>v+(d[i]/length)*t/spacing[i])}return fallback();
 }
 function gradient(x,y,z){if(![x,y,z].every(Number.isFinite))throw new RangeError('invalid gradient point');const p=[x,y,z].map((v,i)=>Math.max(0,Math.min(dims[i]-1,Math.floor(v)))),out=p.map((v,a)=>{const lo=[...p],hi=[...p];lo[a]=Math.max(0,v-1);hi[a]=Math.min(dims[a]-1,v+1);return(signed[id(...hi)]-signed[id(...lo)])/Math.max(spacing[a],(hi[a]-lo[a])*spacing[a])}),l=Math.hypot(...out);return l?out.map(v=>v/l):out}
 return{nx,ny,nz,spacing:[...spacing],maxDistance,signed,toSolid,lowerBound,rayHit,gradient,stats};
}
