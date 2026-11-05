/** Finite segment traversal in voxel coordinates. Cell interiors are visited;
 * zero-length corner contacts are not treated as volumes. Includes start cell,
 * excludes a zero-length contact at the end; never marches beyond the light.
 */
export function firstVoxelHit(solid,{nx,ny,nz},A,B){
 if(![nx,ny,nz].every(n=>Number.isInteger(n)&&n>0)||solid.length!==nx*ny*nz||!Array.isArray(A)||!Array.isArray(B)||A.length!==3||B.length!==3||![...A,...B].every(Number.isFinite))throw new RangeError('invalid voxel ray');
 const dims=[nx,ny,nz],d=B.map((v,i)=>v-A[i]);let enter=0,exit=1;
 for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-14){if(A[i]<0||A[i]>=dims[i])return-1;continue}let lo=-A[i]/d[i],hi=(dims[i]-A[i])/d[i];if(lo>hi)[lo,hi]=[hi,lo];enter=Math.max(enter,lo);exit=Math.min(exit,hi);if(enter>exit)return-1}
 if(d.every(v=>Math.abs(v)<1e-14)){const p=A.map(Math.floor);return p.every((v,i)=>v>=0&&v<dims[i])&&solid[(p[2]*ny+p[1])*nx+p[0]]?(p[2]*ny+p[1])*nx+p[0]:-1}
 if(exit-enter<1e-12)return-1;const p=A.map((v,i)=>Math.max(0,Math.min(dims[i]-1,Math.floor(v+d[i]*(enter+Math.min(1e-10,(exit-enter)/2)))))),step=d.map(Math.sign),next=d.map((v,i)=>v===0?Infinity:((step[i]>0?p[i]+1:p[i])-A[i])/v),delta=d.map(v=>v===0?Infinity:Math.abs(1/v));
 for(let n=0;n<nx+ny+nz+3;n++){const k=(p[2]*ny+p[1])*nx+p[0];if(solid[k])return k;const t=Math.min(...next);if(t>=exit-1e-12)return-1;for(let i=0;i<3;i++)if(next[i]<=t+1e-12){p[i]+=step[i];next[i]+=delta[i]}if(p.some((v,i)=>v<0||v>=dims[i]))return-1}throw new Error('voxel ray traversal did not terminate');
}
