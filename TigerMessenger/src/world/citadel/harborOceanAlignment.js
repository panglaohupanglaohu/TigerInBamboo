import {buildHarborBoardingLanding} from './harborBoardingLanding.js';
import * as THREE from 'three';
import {createOceanHeightSampler} from './oceanSurface.js';
import {buildHarborArchitecture} from './harborArchitecture.js';
import {buildHarborReflections} from './harborReflections.js';
import {harborStairHeight} from './harborStairProfile.js';
import {buildHarborStairWalls} from './harborStairWalls.js';

// Resolve ocean height after the spherical castle and composition transforms exist.
export function alignCitadelHarborToOcean(castle,radius){
 const city=castle.getObjectByName('highland-west-city');if(!city)return;
 castle.updateWorldMatrix(true,true);
 const surface=createOceanHeightSampler(city,radius);
 const channel=city.getObjectByName('west-city-water-channel');
 const vertices=channel.geometry.getAttribute('position');
 for(let i=0;i<vertices.count;i++)vertices.setY(i,surface(vertices.getX(i),vertices.getZ(i))+.025);
 vertices.needsUpdate=true;channel.geometry.computeVertexNormals();channel.geometry.computeBoundingSphere();
 // Preserve the legacy node as a diagnostic sample surface only. The global
 // ocean is the sole visible water mesh; a render callback must never restore
 // the old, translated lake sphere from its cached waveBase.
 channel.visible=false;channel.onBeforeRender=()=>{};
 channel.userData.retiredWaterCap=true;
 channel.userData.waveBase=Float32Array.from(vertices.array);
 const lake=castle.getObjectByName('highland-waterfront-water');
 if(lake){lake.visible=false;lake.userData.retiredWaterCap=true;}
 // Older light strips were shaped around the retired local lake sphere.
 const oldReflections=castle.getObjectByName('highland-water-light-reflections');
 if(oldReflections){oldReflections.visible=false;oldReflections.userData.retiredWaterCap=true;}
 const dockY=Math.max(...[30.5,43].flatMap(x=>[56,60].map(z=>surface(x,z))))+.9;
 city.getObjectByName('west-city-harbor-quay').position.y=dockY-.25;
 const steps=[];city.traverse(o=>{if(o.isMesh&&o.name.startsWith('west-city-stair-harbor-'))steps.push(o);});
 steps.sort((a,b)=>Number(a.name.split('-').pop())-Number(b.name.split('-').pop()));
 const route=[[45.5,4,78],[42,4,78]];
 steps.forEach((step,i)=>{const y=harborStairHeight(dockY,78-20*(i+1)/steps.length);step.position.y=y-.1;route.push([42,y,step.position.z]);});
 const middleLanding=city.getObjectByName('west-city-harbor-middle-landing');
 if(middleLanding)middleLanding.position.y=(4+dockY)/2-.1;
 const watergate=city.getObjectByName('citadel-harbor-watergate');
 if(watergate)watergate.position.y=harborStairHeight(dockY,60.5);
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
 city.userData.oceanSurfaceHeight=surface;
 const oldWalls=city.getObjectByName('citadel-harbor-stair-walls');
 if(oldWalls){const mats=new Set();oldWalls.traverse(m=>{if(m.isMesh){m.geometry.dispose();mats.add(m.material);}});oldWalls.removeFromParent();for(const mat of mats)mat.dispose();}
 city.add(buildHarborStairWalls(dockY,surface));
 // Build coastal fittings only once their final world-frame sea level exists.
 if(!city.getObjectByName('citadel-harbor-architecture'))city.add(buildHarborArchitecture(()=>dockY-.9,{shops:[]}));
 if(!city.getObjectByName('citadel-harbor-reflections'))city.add(buildHarborReflections(surface));
 city.updateWorldMatrix(true,true);
}
