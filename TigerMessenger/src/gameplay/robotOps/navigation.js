// Bounded A* in the tactical area's local tangent plane. Circles are inflated by
// the complete robot radius, not just its centre. No diagonal corner-cutting.
export function makeRobotNavigator({bounds,obstacles,cell=2}){
 const nx=Math.ceil((bounds.maxX-bounds.minX)/cell)+1,nz=Math.ceil((bounds.maxZ-bounds.minZ)/cell)+1;
 const index=(x,z)=>z*nx+x,decode=id=>({x:id%nx,z:Math.floor(id/nx)}),world=(x,z)=>({x:bounds.minX+x*cell,z:bounds.minZ+z*cell});
 return(start,end,radius)=>{
  const valid=(x,z)=>{const p=world(x,z);return x>=0&&z>=0&&x<nx&&z<nz&&p.x>=bounds.minX+radius&&p.x<=bounds.maxX-radius&&p.z>=bounds.minZ+radius&&p.z<=bounds.maxZ-radius&&!obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.radius+radius+.2);};
  const nearest=p=>{const x=Math.round((p.x-bounds.minX)/cell),z=Math.round((p.z-bounds.minZ)/cell);for(let r=0;r<6;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++)if(valid(x+dx,z+dz))return{x:x+dx,z:z+dz};return null;};
  const a=nearest(start),b=nearest(end);if(!a||!b)return[];const sid=index(a.x,a.z),goal=index(b.x,b.z),open=new Set([sid]),cost=new Map([[sid,0]]),prev=new Map();let iter=0;
  while(open.size&&iter++<nx*nz){let current=null,best=Infinity;for(const id of open){const p=decode(id),f=cost.get(id)+Math.hypot(p.x-b.x,p.z-b.z);if(f<best){best=f;current=id;}}if(current===goal){const path=[];let id=current;while(id!==sid){const p=decode(id);path.unshift(world(p.x,p.z));id=prev.get(id);}return path;}
   open.delete(current);const p=decode(current);for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=p.x+dx,z=p.z+dz;if(!valid(x,z)||(dx&&dz&&(!valid(p.x+dx,p.z)||!valid(p.x,p.z+dz))))continue;const id=index(x,z),g=cost.get(current)+Math.hypot(dx,dz);if(g<(cost.get(id)??Infinity)){cost.set(id,g);prev.set(id,current);open.add(id);}}
  }return[];
 };
}
