import {buildHarborBoardingLanding} from './harborBoardingLanding.js';
import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// Resolve ocean height after the spherical castle and composition transforms exist.
export function alignCitadelHarborToOcean(castle,radius){
 const city=castle.getObjectByName('highland-west-city');if(!city)return;
 castle.updateWorldMatrix(true,true);
 const world=new THREE.Vector3();
 const surface=(x,z)=>{
  let low=-100,high=80;
  for(let i=0;i<44;i++){
   const y=(low+high)/2;world.set(x,y,z);city.localToWorld(world);
   if(world.length()>radius+officialOceanLevelAt(world))high=y;else low=y;
  }
  return (low+high)/2;
 };
 const channel=city.getObjectByName('west-city-water-channel');
 const vertices=channel.geometry.getAttribute('position');
 for(let i=0;i<vertices.count;i++)vertices.setY(i,surface(vertices.getX(i),vertices.getZ(i))+.025);
 vertices.needsUpdate=true;channel.geometry.computeVertexNormals();channel.geometry.computeBoundingSphere();
 const dockY=Math.max(...[30.5,43].flatMap(x=>[56,60].map(z=>surface(x,z))))+.9;
 city.getObjectByName('west-city-harbor-quay').position.y=dockY-.25;
 const steps=[];city.traverse(o=>{if(o.isMesh&&o.name.startsWith('west-city-stair-harbor-'))steps.push(o);});
 steps.sort((a,b)=>Number(a.name.split('-').pop())-Number(b.name.split('-').pop()));
 const route=[[45.5,4,78],[42,4,78]];
 steps.forEach((step,i)=>{const y=4+(dockY-4)*(i+1)/steps.length;step.position.y=y-.1;route.push([42,y,step.position.z]);});
 route.push([42,dockY,58],[36.75,dockY,58]);
 for(const x of [31.5,36.75,42])for(const z of [56.6,59.4]){
  const pile=city.getObjectByName('west-city-harbor-pile-'+x+'-'+z),bottom=surface(x,z)-2;
  pile.position.y=(dockY+bottom)/2;pile.scale.y=(dockY-bottom)/pile.geometry.parameters.height;
  city.getObjectByName('west-city-harbor-bollard-'+x+'-'+z).position.y=dockY+.28;
 }
 const toCastle=p=>castle.worldToLocal(city.localToWorld(new THREE.Vector3(...p))).toArray();
 city.userData.harborRoute=route.map(toCastle);city.userData.harborAnchor=toCastle([36.75,dockY,58]);
 city.userData.harborOceanAlignment={source:'officialOceanLevelAt in final world frame',dockY,minFreeboard:.9};
 buildHarborBoardingLanding(city,surface,dockY,toCastle);
 city.updateWorldMatrix(true,true);
}
