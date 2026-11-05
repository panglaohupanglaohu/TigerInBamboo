import {voxelDistance} from '../core/voxel-distance.js';
/** Derived 2D land-centre distances, not a 3D SDF or deformed surface distance.
 * Different X/Z pixel pitches retain their actual world-unit metric.
 */
export function waterDistance(world,index,{resolution=192,pad=4,maxDistance=4}={}){
  if(!Number.isInteger(resolution)||resolution<8||resolution>512||!Number.isFinite(pad)||pad<=0||!Number.isFinite(maxDistance)||maxDistance<=0)throw new RangeError('water distance options');
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const c of world.cells)if(world.isSolid(c,1)){minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ)}
  if(!Number.isFinite(minX))return null;
  minX-=pad;minZ-=pad;maxX+=pad;maxZ+=pad;
  const R=resolution,sx=(maxX-minX)/R,sz=(maxZ-minZ)/R,land=new Uint8Array(R*R);
  for(let z=0;z<R;z++)for(let x=0;x<R;x++){const c=index.cellAt(minX+(x+.5)*sx,minZ+(z+.5)*sz);land[z*R+x]=c&&world.isSolid(c,1)?1:0;}
  const field=voxelDistance(land,{nx:R,ny:1,nz:R,spacing:[sx,1,sz],maxDistance,maxVoxels:512*512});
  const distance=Float32Array.from(field.toSolid,d=>Math.min(maxDistance,Math.sqrt(d)));
  return {land,distance,R,sx,sz,minX,minZ,width:maxX-minX,depth:maxZ-minZ,maxDistance,version:world.version};
}
