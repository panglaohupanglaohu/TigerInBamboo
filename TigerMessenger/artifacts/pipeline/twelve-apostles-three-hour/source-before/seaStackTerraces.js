import * as THREE from 'three';
import {CANYON} from './canyon.js';
import {bookshopTownPose,BOOKSHOP_SITE_OUTLINE} from './bookshopTownSite.js';
import {plantSeaStackTerraces} from './seaStackVegetation.js';
import {coastalStackGeometry} from './seaStackCoastalGeometry.js';

export const seaStackTerracesEnabled = () => new URLSearchParams(globalThis.location?.search || '').get('seaStackTerraces') !== '0';

// Connected coastal-volume geometry; seating and protected layout stay below.
export function terraceStackGeometry(radius,height,seed) {
  return coastalStackGeometry(radius,height,seed);
}

// Finalize after the actual ocean mesh exists. Center anchors use its rendered
// triangles, including the canyon depression, rather than a nominal R sphere.
export function seatTerracedSeaStacks(scene, radius=160, railCurves={}, protectedRoots=[]) {
  if(!seaStackTerracesEnabled())return;
  const ocean=scene.getObjectByName('planet-v8-curved-ocean');if(!ocean)return;
  scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),world=new THREE.Vector3(),audit=[];
  const waterAt=point=>{
    const direction=point.clone().normalize();
    ray.set(direction.clone().multiplyScalar(radius+100),direction.clone().negate());ray.far=radius+100;
    return ray.intersectObject(ocean,false)[0]?.point;
  };
  const rocks=[];scene.traverse(o=>{if(o.geometry?.userData.terraces)rocks.push(o);});
  const lat=THREE.MathUtils.degToRad(CANYON.lat),lon=THREE.MathUtils.degToRad(CANYON.lon);
  const canyonCenter=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
  if(!rocks.length)return;
  // The square world AABB misses the public circle's intended open-space
  // clearance. Test the town's authored spherical footprint in its own chart.
  const townInverse=bookshopTownPose(radius).quaternion.clone().invert();
  const plazaMargin=direction=>{
    const local=direction.clone().applyQuaternion(townInverse);
    if(local.y<=0)return Infinity;
    return Math.hypot(local.x*radius/local.y,local.z*radius/local.y-BOOKSHOP_SITE_OUTLINE.centerZ)-BOOKSHOP_SITE_OUTLINE.radius;
  };
  // Per-mesh bounds avoid a curved city's aggregate box spanning empty sea.
  const protectedBoxes=[];
  for(const root of protectedRoots.filter(Boolean))root.traverse(o=>{
    if(!o.isMesh||!o.geometry)return;
    o.geometry.computeBoundingBox();
    protectedBoxes.push({mesh:o,box:o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)});
  });
  const protectedSurfaceNear=(entry,axisBox,normal,height,footprint)=>{
    if(!entry.box.intersectsBox(axisBox))return false;
    const mesh=entry.mesh,p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    const triangle=new THREE.Triangle(),triangleBox=new THREE.Box3(),closest=new THREE.Vector3();
    const count=index?index.count:p.count;
    for(let i=0;i<count;i+=3){
      [triangle.a,triangle.b,triangle.c].forEach((v,j)=>v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      triangleBox.setFromPoints([triangle.a,triangle.b,triangle.c]);
      if(!triangleBox.intersectsBox(axisBox))continue;
      for(let h=radius-8;h<=radius+height+4;h+=4){
        const at=normal.clone().multiplyScalar(h);
        triangle.closestPointToPoint(at,closest);
        if(closest.distanceToSquared(at)<(footprint+2)**2)return true;
      }
    }
    return false;
  };
  const railPoints=Object.values(railCurves).flatMap(curve=>Array.from({length:2600},(_,i)=>curve.getPointAt(i/2600)));
  const reference=rocks[0].parent.localToWorld(new THREE.Vector3(85,-45,-60)).normalize();
  const rimTangent=reference.clone().addScaledVector(canyonCenter,-reference.dot(canyonCenter)).normalize();
  // Approved screen-left gate sector, mapped in the fixed overview camera.
  // Eight sites in staggered depth rows; never distribute around the full rim.
  const occupied=[];
  const sites=[[21,.99],[23.4,.99],[25.8,.99],[21.6,1.20],[24,1.20],[26.4,1.20],[22.4,1.41],[25,1.41]];
  for(const [stackIndex,rock] of rocks.entries()){
    const data=rock.userData.seaStack, oldSea=new THREE.Vector3(...data.seaAnchor);
    if(stackIndex>=sites.length){rock.visible=false;rock.userData.excludedSeaStack=true;for(const detail of rock.parent.children.filter(o=>o.userData.stackOwner===data.detailId))detail.visible=false;audit.push({seed:rock.geometry.userData.terraces.seed,skipped:'outside-approved-gate-left-group'});continue;}
    const envelope=rock.geometry.userData.terraces.footprintRadius||data.radius*1.5;
    let rimAngle=sites[stackIndex][1];
    const around=rimTangent.clone().applyAxisAngle(canyonCenter,sites[stackIndex][0]*Math.PI/18);
    const normal=new THREE.Vector3();
    let railClear=false;
    for(let attempt=0;attempt<12;attempt++){
      normal.copy(canyonCenter).multiplyScalar(Math.cos(rimAngle)).addScaledVector(around,Math.sin(rimAngle));
      railClear=railPoints.every(point=>{
        const along=THREE.MathUtils.clamp(point.dot(normal),radius-8,radius+data.height+8);
        return point.distanceToSquared(normal.clone().multiplyScalar(along))>(envelope+5)**2;
      });
      railClear=railClear&&plazaMargin(normal)>envelope+20;
      railClear=railClear&&occupied.every(other=>normal.clone().multiplyScalar(radius).distanceTo(other.anchor)>envelope+other.envelope+5);
      if(railClear){
        const footprint=envelope+3;
        const axisBox=new THREE.Box3().setFromPoints([normal.clone().multiplyScalar(radius-8),normal.clone().multiplyScalar(radius+data.height)]).expandByScalar(footprint);
        railClear=protectedBoxes.every(entry=>!protectedSurfaceNear(entry,axisBox,normal,data.height,footprint));
      }
      if(railClear)break;
      rimAngle+=.035;
    }
    // A blocked decorative site must not block startup or occupy a rail corridor.
    if(!railClear){rock.visible=false;rock.userData.excludedSeaStack=true;for(const detail of rock.parent.children.filter(o=>o.userData.stackOwner===data.detailId))detail.visible=false;audit.push({seed:rock.geometry.userData.terraces.seed,skipped:'protected-corridor-or-city'});continue;}
    occupied.push({anchor:normal.clone().multiplyScalar(radius),envelope});
    const worldQ=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
    rock.quaternion.copy(rock.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ));
    data.worldUp=normal.toArray();data.rimAngle=rimAngle;data.placement='approved-gate-left-sector';
    ray.set(normal.clone().multiplyScalar(radius+100),normal.clone().negate());ray.far=200;
    const hit=ray.intersectObject(ocean,false)[0];
    if(!hit)throw new Error('Terraced sea stack has no ocean support');
    const sea=hit.point,center=sea.clone().addScaledVector(normal,data.height*.5-Math.max(6,data.height*.115));
    rock.position.copy(rock.parent.worldToLocal(center));rock.updateWorldMatrix(true,false);
    data.seaAnchor=sea.toArray();data.waterSupport='rendered-ocean-triangle';
    // Check all bottom-ring directions, not just the center anchor.
    let maxBaseAboveWater=-Infinity;
    const position=rock.geometry.attributes.position;
    for(let i=0;i<position.count;i++)if(position.getY(i)<-data.height/2+.001){
      const foot=rock.localToWorld(new THREE.Vector3().fromBufferAttribute(position,i)),water=waterAt(foot);
      if(water)maxBaseAboveWater=Math.max(maxBaseAboveWater,foot.length()-water.length());
    }
    if(maxBaseAboveWater>-.5){
      const shift=maxBaseAboveWater+.5;
      rock.getWorldPosition(world);world.addScaledVector(normal,-shift);rock.position.copy(rock.parent.worldToLocal(world));rock.updateWorldMatrix(true,false);
      maxBaseAboveWater-=shift;
    }
    // Move the existing foam/skerries with their parent stack's shore anchor.
    const ridge=rock.parent,from=oldSea.clone().normalize(),rotation=new THREE.Quaternion().setFromUnitVectors(from,normal);
    for(const detail of ridge.children.filter(o=>o.userData.stackOwner===data.detailId)){
      if(detail.name==='gate-sea-stack-surf'){
        const p=detail.geometry.attributes.position;
        for(let i=0;i<p.count;i++){
          world.fromBufferAttribute(p,i);detail.localToWorld(world);world.applyQuaternion(rotation);detail.worldToLocal(world);p.setXYZ(i,world.x,world.y,world.z);
        }
      }else{detail.getWorldPosition(world);world.applyQuaternion(rotation);detail.position.copy(ridge.worldToLocal(world));}
    }
    const roots=plantSeaStackTerraces(rock);
    audit.push({seed:rock.geometry.userData.terraces.seed,waterRadius:sea.length(),burial:sea.length()-rock.localToWorld(new THREE.Vector3(0,-data.height/2,0)).length(),maxBaseAboveWater,rimAngle,plazaClearance:Number.isFinite(plazaMargin(normal))?plazaMargin(normal)-envelope:null,plazaOppositeHemisphere:!Number.isFinite(plazaMargin(normal)),roots:roots.length});
  }
  // Foam and detached blocks share the same rendered-triangle ocean sampler.
  scene.traverse(o=>{
    if(o.name==='gate-sea-stack-surf'){
      const p=o.geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        world.fromBufferAttribute(p,i);o.localToWorld(world);const water=waterAt(world);if(water)world.copy(water).addScaledVector(water.clone().normalize(),.10);
        o.worldToLocal(world);p.setXYZ(i,world.x,world.y,world.z);
      }
      p.needsUpdate=true;o.geometry.computeBoundingSphere();
    }else if(o.name==='gate-sea-stack-fallen-block'){
      o.getWorldPosition(world);const water=waterAt(world);if(water)world.copy(water).addScaledVector(water.clone().normalize(),-.15);o.position.copy(o.parent.worldToLocal(world));
    }
  });
  scene.userData.seaStackTerraceAudit=audit;
}
