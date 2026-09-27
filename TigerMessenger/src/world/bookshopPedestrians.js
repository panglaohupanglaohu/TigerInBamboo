import * as THREE from 'three';
import {seatTownObject,BOOKSHOP_SITE_OUTLINE} from './bookshopTownSite.js';
// Cached walkability grid + breadth-first routes; staggered requests avoid an
// all-crowd pathfinding spike. Seeded random destinations, dwell and train yield.
export function createBookshopPedestrians({base,colliders,tramSystem,R=160,isAlarm=()=>false}){
 const actors=[],wp=new THREE.Vector3();base.updateWorldMatrix(true,true);
 function chart(world){const p=base.worldToLocal(world.clone());const k=(R+.9)/(p.y+R+.9);return{x:p.x*k,z:p.z*k};}
 const obstacles=colliders.filter(c=>c.position&&c.kind?.startsWith('bookshop-')).map(c=>({...chart(c.position),r:(c.radius||.5)+.50}));
 const cell=2,nx=101,nz=101,minX=-100,minZ=-126,walk=new Uint8Array(nx*nz),world=i=>({x:minX+(i%nx)*cell,z:minZ+Math.floor(i/nx)*cell});
 for(let i=0;i<walk.length;i++){const p=world(i);walk[i]=Math.hypot(p.x,p.z-BOOKSHOP_SITE_OUTLINE.centerZ)<96&&!obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r);}
 const idx=(x,z)=>Math.round((z-minZ)/cell)*nx+Math.round((x-minX)/cell),near=p=>{let best=-1,d=Infinity;for(let i=0;i<walk.length;i++)if(walk[i]){const q=world(i),dist=(p.x-q.x)**2+(p.z-q.z)**2;if(dist<d){d=dist;best=i;}}return best;};
 const neighbors=i=>{const x=i%nx,z=Math.floor(i/nx),out=[];for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=z+dz,j=b*nx+a;if(a>=0&&a<nx&&b>=0&&b<nz&&walk[j])out.push(j);}return out;};
 function route(from,to){const start=near(from),goal=near(to),prev=new Int32Array(walk.length).fill(-1),queue=[start];prev[start]=start;for(let k=0;k<queue.length;k++){const i=queue[k];if(i===goal){const path=[];for(let j=goal;j!==start;j=prev[j])path.unshift(world(j));return path;}for(const j of neighbors(i))if(prev[j]<0){prev[j]=i;queue.push(j);}}return[];}
 let seed=7319;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const workers=[];base.traverse(o=>{if(o.userData.townWorker)workers.push(o);});
 for(const [id,m]of workers.entries()){const pos=chart(m.getWorldPosition(wp)),home=world(near(pos));base.attach(m);m.scale.setScalar(1);actors.push({id,m,...home,home,wait:random()*9,path:[],speed:.65+random()*.55,phase:random()*6.28,blocked:0,legs:[m.getObjectByName('worker-leg--1'),m.getObjectByName('worker-leg-1')]});seatTownObject(base,m,home.x,home.z,random()*6.28,R);}
 let tick=0,nextPath=0,time=0,alarm=false;const trainPoints=[];
 function choose(a){let goal;if(alarm){goal={x:a.home.x,z:Math.min(a.home.z,-5)};}else{const destinations=[{x:0,z:32},{x:-20,z:45},{x:20,z:44},{x:-44,z:22},{x:32,z:45},a.home];goal=destinations[Math.floor(random()*destinations.length)];goal={x:goal.x+(random()-.5)*8,z:goal.z+(random()-.5)*8};}a.path=route(a,goal);a.wait=a.path.length?0:2+random()*3;}
 const api={actors,algorithm:'Cached walkability grid + BFS + seeded destinations + reciprocal yielding + staggered replans',update(dt){
  time+=dt;tick+=dt;if(tick<.1)return;dt=Math.min(.2,tick);tick=0;const nowAlarm=!!isAlarm();if(nowAlarm!==alarm){alarm=nowAlarm;actors.forEach(a=>{a.path=[];a.wait=random()*1.5;});}
  trainPoints.length=0;for(const s of tramSystem.freightServices)for(const v of[s.tram,...s.wagons])trainPoints.push(v.getWorldPosition(new THREE.Vector3()));
  for(const a of actors){a.wait-=dt;if(!a.path.length){if(a.wait<=0&&time>=nextPath){choose(a);nextPath=time+.16;}continue;}
   const target=a.path[0],dx=target.x-a.x,dz=target.z-a.z,dist=Math.hypot(dx,dz);if(dist<.2){a.path.shift();if(!a.path.length)a.wait=2+random()*7;continue;}
   const step=Math.min(dist,a.speed*dt*(alarm?1.3:1)),x=a.x+dx/dist*step,z=a.z+dz/dist*step;
   const blocked=actors.some(b=>b!==a&&Math.hypot(x-b.x,z-b.z)<.68&&(b.id<a.id||!b.path.length));
   a.m.getWorldPosition(wp);const trainNear=trainPoints.some(p=>p.distanceTo(wp)<5.0);
   if(blocked||trainNear){a.blocked+=dt;if(a.blocked>6&&!trainNear){a.path=[];a.wait=.5+random()*2;a.blocked=0;}continue;}
   a.blocked=0;a.x=x;a.z=z;a.phase+=dt*a.speed*7;seatTownObject(base,a.m,x,z,Math.atan2(dx,dz),R);for(const[i,leg]of a.legs.entries())if(leg)leg.rotation.x=Math.sin(a.phase+i*Math.PI)*.28;
  }
 },snapshot(){return{count:actors.length,alarm,walking:actors.filter(a=>a.path.length&&a.blocked===0).length,trainYielding:actors.filter(a=>a.blocked>0).length};}};return api;
}
