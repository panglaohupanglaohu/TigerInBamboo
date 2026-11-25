/** 931196707236392960: "virtual voxel space ... soft normals ... simplified
 * collision, wind simulation". Probes read World bits directly; no heightmap
 * filling and no independent editable occupancy volume.
 */
import{MAX_LEVEL}from'./world.js';
export function makeWorldProbes(world,index,{levelHeight=.5}={}){
  if(!Number.isFinite(levelHeight)||levelHeight<=0||typeof index.cellAt!=='function')throw new RangeError('Invalid World probe adapter');
  const finite=(...p)=>{if(!p.every(Number.isFinite))throw new TypeError('Nonfinite probe point');};
  function occupied(x,y,z){finite(x,y,z);if(y<0||y>=MAX_LEVEL*levelHeight)return false;const c=index.cellAt(x,z);return !!(c&&world.isSolid(c,Math.floor(y/levelHeight)+1));}
  function supportBelow(x,z,maxY=Infinity){finite(x,z);if(maxY!==Infinity&&!Number.isFinite(maxY))throw new TypeError('Invalid vertical limit');const c=index.cellAt(x,z);if(!c)return null;for(let lv=MAX_LEVEL;lv>=1;lv--)if(lv*levelHeight<=maxY&&world.isSolid(c,lv))return {cell:c.id,level:lv,y:lv*levelHeight,rock:!!world.isRock(c,lv)};return null;}
  function normalAt(x,y,z,{radius=levelHeight*.5}={}){finite(x,y,z);if(!Number.isFinite(radius)||radius<=0)throw new RangeError('Invalid normal radius');
    const density=(a,b,c)=>{let sum=0;for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++)sum+=occupied(a+i*radius*.5,b+j*radius*.5,c+k*radius*.5)?1:0;return sum/27;};
    const d=[density(x-radius,y,z)-density(x+radius,y,z),density(x,y-radius,z)-density(x,y+radius,z),density(x,y,z-radius)-density(x,y,z+radius)],n=Math.hypot(...d);return n>1e-9?d.map(v=>v/n):null;
  }
  return {occupied,supportBelow,normalAt};
}
