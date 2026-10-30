import * as T from 'three';
import {createMoonLakeGarden,MOON_LAKE_GARDEN_SITES} from './moonLakeGarden.js';
import {bindMoonLakeShoreToGround} from './moonLakeShore.js?v=shore-r2-20261025';
import {installMoonCoastOwnership} from './moonCoastOwnership.js?v=moon-coast-r4d-20261025';

/** Sample only the final, track-carved hill mesh. No props, water or trees are support. */
export function installMoonLakeSceneGarden({lake,hills,platforms=[],trackCurves=[],colliders=[]}){
 if(lake.garden)return lake.garden;
 const ground=hills?.mesh;if(!ground?.isMesh)throw new TypeError('Final moon-lake hill surface required');
 bindMoonLakeShoreToGround(lake,ground);
 const coast=installMoonCoastOwnership({platforms,hills,trackCurves,colliders,R:lake.surfaceR-.6});
 if(coast){lake.shore.userData.report.outerCoast=coast;lake.coastOwnership=coast;}
 lake.group.updateWorldMatrix(true,true);ground.updateWorldMatrix(true,false);
 const ray=new T.Raycaster(),up=new T.Vector3(0,1,0).transformDirection(lake.group.matrixWorld),p=new T.Vector3();
 const rails=trackCurves.filter(Boolean).flatMap(c=>c.getSpacedPoints(800));
 const cache=new Map(),groundReport={source:'final-hills-mesh',samples:0,missing:0,trackRejected:0,rootClearance:2.1};
 const surfaceHeightAt=(x,z)=>{const key=x.toFixed(5)+','+z.toFixed(5);if(cache.has(key))return cache.get(key);groundReport.samples++;
  const origin=lake.group.localToWorld(new T.Vector3(x,16,z));ray.set(origin,up.clone().negate());ray.far=42;
  const hit=ray.intersectObject(ground,false)[0];if(!hit){groundReport.missing++;cache.set(key,null);return null;}
  // Preserve train/track space. This sampler is also used for low dressing.
  if(rails.some(q=>{p.copy(hit.point).sub(q);const h=p.dot(up);if(Math.abs(h)>6)return false;p.addScaledVector(up,-h);return p.lengthSq()<2.1**2;})){groundReport.trackRejected++;cache.set(key,null);return null;}
  const y=lake.group.worldToLocal(hit.point.clone()).y;cache.set(key,y);return y;
 };
 // Fit additions around existing occupants. Never move/hide a borrowed tree or prop.
 const occupied=[...colliders];if(lake.ancientPine)occupied.push({position:lake.ancientPine.getWorldPosition(new T.Vector3()),radius:1.1});
 const chosen=[],relocations=[];
 for(const site of MOON_LAKE_GARDEN_SITES){let selected=null;
  const offsets=[[0,0],[-2,0],[2,0],[0,-2],[0,2],[-3,-3],[-3,3],[3,-3],[3,3],[-5,0],[0,-5],[5,0],[0,5],[-6,-4],[6,-4]];
  for(const[dx,dz]of offsets){const x=site.x+dx,z=site.z+dz;if(Math.hypot(x,z)<6.7||chosen.some(s=>Math.hypot(s.x-x,s.z-z)<4))continue;
   const samples=[[x,z],[x+1.2,z],[x-1.2,z],[x,z+1.2],[x,z-1.2]].map(([a,b])=>surfaceHeightAt(a,b));if(samples.some(y=>y===null)||Math.max(...samples)-Math.min(...samples)>.65)continue;
   const world=lake.group.localToWorld(new T.Vector3(x,samples[0],z));
   if(occupied.some(c=>{const delta=world.clone().sub(c.position),h=delta.dot(up);return Math.abs(h)<6&&delta.addScaledVector(up,-h).length()<(c.radius??.6)+1.55;}))continue;
   selected={...site,x,z};break;
  }
  if(selected){chosen.push(selected);relocations.push({id:site.id,requested:[site.x,site.z],placed:[selected.x,selected.z],existingSceneChanged:false});}
 }
 const garden=createMoonLakeGarden(lake.group,{planetRadius:lake.surfaceR-.6,surfaceHeightAt,sites:chosen});
 garden.report.groundBinding=groundReport;garden.report.placement=relocations;garden.report.originalScenePreserved=true;garden.report.requestedAdditions=MOON_LAKE_GARDEN_SITES.length;
 colliders.push(...garden.colliders);
 const owned=new Set(garden.colliders),dispose=garden.dispose;
 garden.dispose=()=>{for(let i=colliders.length-1;i>=0;i--)if(owned.has(colliders[i]))colliders.splice(i,1);dispose();if(lake.garden===garden)delete lake.garden;};
 lake.garden=garden;
 // Configure after final roots are seated: the moon gently rises past the real crowns.
 lake.moonOrb?.setOrbitObstacles?.([lake.ancientPine,...garden.trees].filter(Boolean));
 return garden;
}
