/** 798580832906739712: sampled 3D openness. Shared polygon-column World;
 * fixed stepping can miss thin walls. Diagnostic only, not exact optical LOS.
 */
export function fibonacciDirections(count=32){
 if(!Number.isInteger(count)||count<1||count>512)throw new RangeError('direction count 1..512');
 const angle=Math.PI*(3-Math.sqrt(5));return Array.from({length:count},(_,i)=>{const y=1-(i+.5)*2/count,r=Math.sqrt(1-y*y);return{x:Math.cos(i*angle)*r,y,z:Math.sin(i*angle)*r}});
}
export function sampleWorldVisibility(world,index,origin,{count=32,maxDist=5,step=.08,levelHeight=.5}={}){
 if(![origin?.x,origin?.y,origin?.z,maxDist,step,levelHeight].every(Number.isFinite)||maxDist<=0||step<=0||levelHeight<=0||Math.ceil(maxDist/step)>10000)throw new RangeError('visibility settings');
 const dirs=fibonacciDirections(count),at=p=>{const c=index.cellAt(p.x,p.z);return !!(c&&p.y>=0&&world.isSolid(c,Math.floor(p.y/levelHeight)+1));};
 if(at(origin))return{value:0,rays:[],insideSolid:true,samples:1};
 const rays=[];let sum=0,samples=1;const steps=Math.ceil(maxDist/step);
 for(const dir of dirs){let distance=maxDist,hit=false,end;for(let i=1;i<=steps;i++){const t=Math.min(i*step,maxDist);end={x:origin.x+dir.x*t,y:origin.y+dir.y*t,z:origin.z+dir.z*t};samples++;if(at(end)){distance=t;hit=true;break;}}sum+=distance/maxDist;rays.push({...end,distance,hit});}
 return{value:sum/count,rays,insideSolid:false,samples};
}
