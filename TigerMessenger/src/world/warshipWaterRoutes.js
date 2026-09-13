import {findDockConnector,placeDockConnector} from './warshipDockConnector.js';
import * as THREE from 'three';
import { createWarshipClearance } from './warshipClearance.js';
import { orientWarship } from './warshipNavigation.js';

// Route only the story fleet on visible authored water. No terrain mutations.
export function createWarshipWaterRoutes(scene, radius) {
  scene.updateMatrixWorld(true);
  const water=scene.getObjectByName('planet-v8-curved-ocean');
  const roots=new Set();
  for(const name of ['castleContainer','canal-junction-box','citadel-navona-canal-plaza','old-harbor-scene']){const o=scene.getObjectByName(name);if(o)roots.add(o);}
  scene.traverse(o=>{if(o.userData.highlandAssaultAnchors||o.userData.kind==='odyssey-citadel'||o.name==='mossyGround'||o.name==='planet-surface'||/^planet-v[89].*terrain/.test(o.name))roots.add(o);});
  const obstacles=[],seen=new Set();
  function visible(o){for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;}
  for(const root of roots){const meshes=[];root.traverse(o=>{
    if(!o.isMesh||seen.has(o)||!visible(o)||o.parent?.isMesh||!o.geometry?.attributes.position)return;
    if(/water|ocean|reflection|shadow|outline/i.test(o.name)||o.userData.isOutline||o.userData.backlitHighlight)return;
    // The official ocean covers the whole sphere. `planet-surface` is its
    // underwater bed and the player's fallback ground, not a boat collision
    // wall. Region terrain, buildings, quays and authored shore meshes remain
    // in the vessel obstacle set. Player collision ownership is unchanged.
    if(o.name==='planet-surface')return;
    seen.add(o);o.geometry.computeBoundingBox();if(o.isInstancedMesh)o.computeBoundingBox();
    const box=(o.isInstancedMesh?o.boundingBox:o.geometry.boundingBox).clone().applyMatrix4(o.matrixWorld);
    meshes.push({mesh:o,box});
  });if(meshes.length){const box=new THREE.Box3();for(const item of meshes)box.union(item.box);obstacles.push({root,box,meshes});}}
  const ray=new THREE.Raycaster(),cache=new Map(),Y=new THREE.Vector3(0,1,0);
  // Terrain/platform render layers must still participate in navigation support.
  ray.layers.enableAll();
  function surface(direction){
    const d=direction.clone().normalize(),key=d.toArray().map(v=>v.toFixed(6)).join(',');if(cache.has(key))return cache.get(key);
    ray.set(d.clone().multiplyScalar(radius+90),d.clone().negate());ray.far=130;
    const wh=water&&visible(water)?ray.intersectObject(water,false)[0]:null;
    if(!wh){cache.set(key,null);return null;}
    let top=-Infinity,object=null,seabed=-Infinity;
    const planet=scene.getObjectByName('planet-surface');
    if(planet&&visible(planet)){
      const bedHit=ray.intersectObject(planet,false)[0];
      if(bedHit)seabed=bedHit.point.length();
    }
    for(const group of obstacles){if(!ray.ray.intersectsBox(group.box))continue;for(const {mesh,box} of group.meshes){if(!ray.ray.intersectsBox(box))continue;const hit=ray.intersectObject(mesh,false)[0];if(hit&&hit.point.length()>top){top=hit.point.length();object=mesh.name;}}}
    const result={water:wh.point.length(),ground:top,object,seabed};cache.set(key,result);return result;
  }
  // Circular hull/oar reservation is independent of heading and protects turns.
  const envelope=7,clearCache=new Map(),clearFailures=new Map();
  function clear(direction){
    const d=direction.clone().normalize(),key=d.toArray().map(v=>v.toFixed(6)).join(',');if(clearCache.has(key))return clearCache.get(key);
    const e=Y.clone().cross(d).normalize();if(e.lengthSq()<.1)e.set(1,0,0);const n=d.clone().cross(e).normalize();
    const points=[[0,0]];for(let ring=1;ring<=2;ring++)for(let k=0;k<12;k++)points.push([Math.cos(k*Math.PI/6)*envelope*ring/2,Math.sin(k*Math.PI/6)*envelope*ring/2]);
    const valid=points.every(([x,z])=>{const point=d.clone().multiplyScalar(radius).addScaledVector(e,x).addScaledVector(n,z),s=surface(point);if(s&&s.ground<s.water-1.25)return true;clearFailures.set(key,{point:point.toArray(),object:s?.object??'no-water',water:s?.water,ground:s?.ground,requiredDepth:1.25});return false;});
    clearCache.set(key,valid);return valid;
  }
  function berth(target,used=[],options={}){
    const d=target.clone().normalize(),e=Y.clone().cross(d).normalize(),n=d.clone().cross(e).normalize();
    for(let distance=0;distance<=(options.maxDistance??64);distance+=2){const count=Math.max(1,Math.ceil(distance*Math.PI*2/2));for(let i=0;i<count;i++){
      const candidate=d.clone().multiplyScalar(radius).addScaledVector(e,Math.cos(i/count*Math.PI*2)*distance).addScaledVector(n,Math.sin(i/count*Math.PI*2)*distance).normalize();
      if(used.some(p=>candidate.distanceTo(p)*radius<envelope*2+1)||!clear(candidate))continue;
      return candidate;
    }}return null;
  }
  function dock(boat,target,used=[],options={}) {
    const meshCheck=createWarshipClearance(boat,obstacles),scale=boat.scale.x;
    // Read the CURRENT Blender assembly: the V6 deployed hinge moved outward.
    const contract=boat.userData.warshipV6?.boardingContract;
    const [hx,hy,hz]=contract?.rootPoint??[1.94,.664,.48];
    const length=contract?.length??1.35;
    const targetDir=target.clone().normalize(),east=Y.clone().cross(targetDir).normalize(),north=targetDir.clone().cross(east).normalize();
    const frame=new THREE.Group();let attempts=0,lastFailure=null,firstHullPose=null,firstEntryPose=null;const rejected={angle:0,center:0,support:0,hull:0,entry:0,approach:0},hullObstacles={},entryObstacles={};
    function validPose(direction,heading){const point=position(direction);if(!point)return null;orientWarship(frame,direction,heading);const result=meshCheck.clear(point,frame.quaternion,boat.scale);return result.clear?{position:point,quaternion:frame.quaternion.clone()}:null;}
    const shoreStep=Math.max(.25,options.shoreStep??2);
    for(let distance=0;distance<=(options.maxDistance??52);distance+=shoreStep){const count=Math.max(1,Math.ceil(distance*Math.PI*2/shoreStep));for(let i=0;i<count;i++){
      const shoreDir=targetDir.clone().multiplyScalar(radius).addScaledVector(east,Math.cos(i/count*Math.PI*2)*distance).addScaledVector(north,Math.sin(i/count*Math.PI*2)*distance).normalize();
      const shoreSurface=surface(shoreDir);if(!shoreSurface||shoreSurface.ground<shoreSurface.water+.08||shoreSurface.ground>shoreSurface.water+1.7)continue;
      if(options.shoreName&&shoreSurface.object!==options.shoreName)continue;
      const shore=shoreDir.clone().multiplyScalar(shoreSurface.ground);
      for(let orientation=0;orientation<16+(options.headings?.length??0);orientation++){
        attempts++;const hint=options.headings?.[orientation];
        const z=hint?hint.clone().projectOnPlane(shoreDir).normalize().cross(shoreDir).normalize():east.clone().multiplyScalar(Math.cos((orientation-(options.headings?.length??0))*Math.PI/8)).addScaledVector(north,Math.sin((orientation-(options.headings?.length??0))*Math.PI/8)).projectOnPlane(shoreDir).normalize();
        const x=shoreDir.clone().cross(z).normalize();
        let angle=0,d=null,p=null,q=null;
        for(let iteration=0;iteration<4;iteration++){
          d=shore.clone().addScaledVector(x,-hx*scale).addScaledVector(z,-(hz+length*Math.cos(angle))*scale).normalize();
          p=position(d);if(!p)break;orientWarship(frame,d,x);q=frame.quaternion.clone();
          const local=shore.clone().sub(p).applyQuaternion(q.clone().invert()).multiplyScalar(1/scale),ratio=(hy-local.y)/length;
          if(Math.abs(ratio)>1){p=null;break;}angle=Math.asin(ratio);
        }
        if(!p||Math.abs(angle)>25*Math.PI/180||used.some(other=>p.distanceTo(other.position)<13.8)){rejected.angle++;continue;}
        const centerSurface=surface(d);if(centerSurface.ground>=centerSurface.water-.3){rejected.center++;continue;}
        const tip=new THREE.Vector3(hx,hy-length*Math.sin(angle),hz+length*Math.cos(angle)).multiplyScalar(scale).applyQuaternion(q).add(p);
        let supported=true;
        for(const lane of [-.18,0,.18]){const edge=tip.clone().addScaledVector(x,lane*scale),hit=surface(edge);if(!hit||hit.ground<hit.water+.08||Math.abs(edge.length()-hit.ground)>.055){supported=false;break;}}
        if(!supported){rejected.support++;continue;}
        const hull=meshCheck.clear(p,q,boat.scale);if(!hull.clear){firstHullPose??={position:p.toArray(),quaternion:q.toArray(),mesh:hull.mesh};rejected.hull++;hullObstacles[hull.mesh]=(hullObstacles[hull.mesh]||0)+1;lastFailure=hull;continue;}
        if(options.entryDirections?.length){
         const connector=findDockConnector(options.entryDirections,p,x,position,clear,meshCheck,boat.scale,radius);
         if(connector.valid)return {valid:true,direction:d,position:p,quaternion:q,shorePoint:tip,shoreObject:shoreSurface.object,angle,entry:connector.entry,approach:connector,attempts,triangleCount:meshCheck.triangleCount};
         rejected.approach++;lastFailure=connector.lastFailure;
        }
        // Approach along the coastline and finish with +X tangent / +Z toward shore.
        for(const offset of (options.approachOffsets??[9])){
         const entry=p.clone().addScaledVector(x,-14).addScaledVector(z,-offset).normalize();
         if(!clear(entry)){const failure=clearFailures.get(entry.toArray().map(v=>v.toFixed(6)).join(","));if(failure){const item=entryObstacles[failure.object]??={count:0,example:failure};item.count++;}firstEntryPose??={position:p.toArray(),quaternion:q.toArray(),entry:entry.toArray(),failure};rejected.entry++;continue;}
         const points=[entry,p.clone().addScaledVector(x,-9).addScaledVector(z,-offset*5/9).normalize(),p.clone().addScaledVector(x,-4).normalize(),d];
         let safe=true;
         for(let j=1;j<points.length&&safe;j++){const a=points[j-1],b=points[j],span=a.angleTo(b)*radius,h=b.clone().sub(a),steps=Math.ceil(span/.5);for(let k=0;k<=steps;k++)if(!validPose(a.clone().lerp(b,k/Math.max(1,steps)).normalize(),h)){safe=false;break;}}
         if(!safe){rejected.approach++;continue;}
         return {valid:true,direction:d,position:p,quaternion:q,shorePoint:tip,shoreObject:shoreSurface.object,angle,entry,approach:{offset,points,length:points.slice(1).reduce((sum,v,j)=>sum+v.angleTo(points[j])*radius,0)},attempts,triangleCount:meshCheck.triangleCount};
        }
      }
    }}return {valid:false,attempts,reason:'No actual-mesh-clear dock within deployed boarding reach',rejected,hullObstacles,entryObstacles,firstHullPose,firstEntryPose,lastFailure};
  }
  function route(start,end,options={}){
    const angle=start.angleTo(end),length=angle*radius,forward=end.clone().addScaledVector(start,-end.dot(start)).normalize(),side=start.clone().cross(forward).normalize(),step=4;
    const nx=Math.ceil(length/step),dx=length/nx,cells=new Map(),open=[],closed=new Set();let visits=0;
    const lateralSteps=options.lateralSteps??18,maxVisits=options.maxVisits??5000;
    function direction(x,z){return start.clone().multiplyScalar(Math.cos(x*dx/radius)).addScaledVector(forward,Math.sin(x*dx/radius)).addScaledVector(side,z*step/radius).normalize();}
    function cell(x,z){const key=x+','+z;if(cells.has(key))return cells.get(key);const d=direction(x,z);const value=clear(d)?{key,x,z,d,g:Infinity,f:Infinity,prev:null}:null;cells.set(key,value);return value;}
    function edge(a,b){const distance=a.distanceTo(b)*radius,steps=Math.max(1,Math.ceil(distance/1.5));for(let i=1;i<steps;i++)if(!clear(a.clone().lerp(b,i/steps).normalize()))return false;return true;}
    const first=cell(0,0),endClear=clear(end);
    if(!first||!endClear){route.lastFailure={reason:'endpoint',startClear:!!first,endClear,visits:0};return null;}
    first.g=0;first.f=length;open.push(first);
    while(open.length&&visits++<maxVisits){open.sort((a,b)=>a.f-b.f);const current=open.shift();if(current.x===nx&&current.z===0){const points=[];for(let n=current;n;n=n.prev)points.push(n.d);points.reverse();return {points,length:points.slice(1).reduce((s,p,i)=>s+p.angleTo(points[i])*radius,0),visits,search:{lateralSteps,maxVisits}};}closed.add(current.key);
      for(const [x,z]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const xx=current.x+x,zz=current.z+z;if(xx<0||xx>nx||Math.abs(zz)>lateralSteps)continue;const next=cell(xx,zz);if(!next||closed.has(next.key))continue;const cost=current.g+current.d.angleTo(next.d)*radius;if(cost>=next.g||!edge(current.d,next.d))continue;next.g=cost;next.f=cost+next.d.angleTo(end)*radius;next.prev=current;if(!open.includes(next))open.push(next);}
    }
    const reached=[...closed].map(key=>key.split(',').map(Number));
    route.lastFailure={reason:visits>=maxVisits?'visit-budget':'disconnected',visits,closed:closed.size,maxX:Math.max(...reached.map(v=>v[0])),minZ:Math.min(...reached.map(v=>v[1])),maxZ:Math.max(...reached.map(v=>v[1])),nx,lateralSteps,maxVisits};
    return null;
  }
  function position(direction,out=new THREE.Vector3()){const sample=surface(direction);return sample?out.copy(direction).normalize().multiplyScalar(sample.water-.25):null;}
  function place(boat,path,progress){
    if(path.segments?.length){let remaining=THREE.MathUtils.clamp(progress,0,1)*path.length;for(let i=0;i<path.segments.length;i++){const part=path.segments[i];if(remaining<=part.length||i===path.segments.length-1){place(boat,part,part.length?remaining/part.length:1);return;}remaining-=part.length;}return;}
    if(placeDockConnector(boat,path,progress))return;let distance=THREE.MathUtils.clamp(progress,0,1)*path.length;for(let i=1;i<path.points.length;i++){const a=path.points[i-1],b=path.points[i],span=a.angleTo(b)*radius;if(distance<=span||i===path.points.length-1){const d=a.clone().lerp(b,Math.min(1,distance/span)).normalize();position(d,boat.position);orientWarship(boat,d,b.clone().sub(a));return;}distance-=span;}}
  return {surface,clear,berth,dock,route,place,position,obstacles,stats:{envelope,water:water?.name||null,obstacleRoots:obstacles.length,obstacleMeshes:seen.size}};
}
