import * as THREE from 'three';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';

export function createTargetStairSurfaceSampler(castle,meshes){castle.updateWorldMatrix(true,true);const index=buildMountainSurfaceIndex(meshes),frame=castle.matrixWorld.clone(),inverse=frame.clone().invert(),down=new THREE.Vector3(0,-1,0).transformDirection(frame),ray=new THREE.Ray();return(x,z)=>{ray.set(new THREE.Vector3(x,220,z).applyMatrix4(frame),down);const h=index.sample(ray,0,1000);return h?{height:h.point.clone().applyMatrix4(inverse).y,faceIndex:h.faceIndex,mesh:h.object.name}:null;};}

/** Finite deterministic polyline search, not a global pathfinder. Samples the
 * final surface across each entire tread footprint. Never mutates terrain. */
export function solveTargetNewCityStairRoute({sampleSurface,start=[63.3838,12,40.4336],end=[62,3,64],width=4.4,maxSlope=.25,step=.65,waypointRoutes=null}={}){
 if(typeof sampleSurface!=='function')throw new TypeError('actual surface sampler required');
 if(![...start,...end,width,maxSlope,step].every(Number.isFinite)||width<=0||step<=0||maxSlope<=0||maxSlope>.28)throw new RangeError('invalid route dimensions');
 const routes=waypointRoutes||[[],...[43,48,53,68,73,78,83,88].flatMap(x=>[53,59,65,71,77].map(z=>[[x,start[2]+5],[x,z],[end[0],z]]))];
 const cache=new Map(),failures={};const sample=(x,z)=>{const key=x.toFixed(6)+','+z.toFixed(6);if(!cache.has(key)){const v=sampleSurface(x,z);cache.set(key,typeof v==='number'?{height:v}:v);}return cache.get(key);};let best=null;
 for(const waypoints of routes){const points=[[start[0],start[2]],...waypoints,[end[0],end[2]]],treads=[];let reason=null,length=0;
  for(let s=1;s<points.length&&!reason;s++){const a=points[s-1],b=points[s],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<1e-8)continue;const count=Math.ceil(len/step),ds=len/count,ux=dx/len,uz=dz/len;
   for(let i=0;i<count;i++){const x=a[0]+dx*(i+.5)/count,z=a[1]+dz*(i+.5)/count,samples=[];for(const along of[-.5,0,.5])for(const across of[-.5,-.25,0,.25,.5]){const px=x+ux*along*ds-uz*across*width,pz=z+uz*along*ds+ux*across*width,h=sample(px,pz);if(!h||!Number.isFinite(h.height)){reason='surface-miss';break;}samples.push({x:px,z:pz,...h});}if(reason)break;
    const groundMax=Math.max(...samples.map(v=>v.height)),bottom=Math.min(...samples.map(v=>v.height))-.2;
    if(groundMax>start[1]+.025){reason='terrain-above-entry';break;}
    treads.push({x,z,ds,yaw:Math.atan2(ux,uz),groundMax,bottom,samples,distance:length+ds*(i+.5)});
   }length+=len;
  }
  if(!reason&&!treads.length)reason='empty-route';
  if(!reason){let future=end[1];for(let i=treads.length-1;i>=0;i--){future=Math.max(future,treads[i].groundMax);treads[i].required=future;}
   let y=start[1];for(const t of treads){y=Math.max(t.required,y-maxSlope*t.ds);t.top=y;}
   if(y>end[1]+.025)reason='insufficient-descent-length';
   else if(treads.some(t=>t.top-t.bottom>30))reason='foundation-too-tall';
  }
  if(reason){failures[reason]=(failures[reason]||0)+1;continue;}
  const score=length;if(!best||score<best.length)best={points,treads,length};
 }
 return{version:'target-stair-route-1',status:best?'solved-sampled':'no-route',start,end,width,maxSlope,step,selected:best,failures,surfaceSamples:cache.size,terrainMutation:false,validation:{continuousCollision:false,gpuReviewed:false},limitations:['Finite sampled route search; not continuous collision or navigation certification.','15 surface probes per tread; narrow unsampled features remain possible.','Building and landmark collision must be checked by integration.']};
}
export function createTargetNewCityStairRoute(options={}){const report=solveTargetNewCityStairRoute(options),group=new THREE.Group();group.name='target-new-city-surveyed-stair-route';group.userData.preserveCitadelMaterials=true;const material=new THREE.MeshStandardMaterial({color:options.color||'#eee0bd',roughness:.94});material.userData.preserveCitadelMaterial=true;const geometry=[];
 for(const [i,t]of(report.selected?.treads||[]).entries()){const g=new THREE.BoxGeometry(report.width,Math.max(.02,t.top-t.bottom),t.ds+.012);geometry.push(g);const m=new THREE.Mesh(g,material);m.name='surveyed-route-tread-'+i;m.position.set(t.x,(t.top+t.bottom)/2,t.z);m.rotation.y=t.yaw;m.receiveShadow=true;m.castShadow=true;group.add(m);}
 group.userData.routeReport=report;let disposed=false;return{group,report,dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometry.forEach(g=>g.dispose());material.dispose();group.clear();}};
}
