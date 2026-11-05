import {threeShadow} from '../core/penumbra.js';
/** Derived sampling of the existing editable World, never a second World. */
export function bakeWaterPenumbra(world,index,sun,{L=.5,res=.3,coarse=3}={}) {
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxH=0;
  for(const c of world.cells)if(world.top(c)){minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ);maxH=Math.max(maxH,world.top(c)*L)}
  if(!Number.isFinite(minX))return null;
  if(!Number.isFinite(res)||res<=0||!Number.isFinite(L)||L<=0||sun[1]<=0)throw new RangeError('water penumbra options');
  const pad=Math.min(12,Math.max(2,maxH*Math.hypot(sun[0],sun[2])/sun[1]));minX-=pad;minZ-=pad;maxX+=pad;maxZ+=pad;
  const nx=Math.ceil((maxX-minX)/res),nz=Math.ceil((maxZ-minZ)/res);if(nx*nz>100000)throw new RangeError('water penumbra size');
  const heights=new Float32Array(nx*nz);for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const c=index.cellAt(minX+(x+.5)*res,minZ+(z+.5)*res);if(c)heights[z*nx+x]=world.top(c)*L;}
  const field={nx,nz,res,heights,minX,minZ};return {...field,...threeShadow(field,sun,{coarse,pull:L*.35}),version:world.version};
}
