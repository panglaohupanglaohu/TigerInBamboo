import { BATIAN_PALETTE, colourBatianGeometry, installBatianColourPlanes } from './batianPalette.js';
import * as THREE from 'three';
import { cityLocalToDir, getCityFrame } from '../world/crystalCityLayout.js';
import { canyonOffsetDir } from '../world/canyon.js';
import { officialOceanLevelAt } from '../world/waterV8/officialOcean.js';

// Reference shuttle: wide swept forebody, narrow waist, broad tail. +Z is forward.
export const COLOSSUS_LENGTH = 70; // Existing moebiusAircraft hull LEN=7, ten times linear length.
const outline = [[0,35],[9,32],[18,22],[30,12],[29,7],[17,2],[9,-8],[7,-22],[18,-29],[17,-33],[0,-35],[-17,-33],[-18,-29],[-7,-22],[-9,-8],[-17,2],[-29,7],[-30,12],[-18,22],[-9,32]];
export function createCrystalColossus() {
  const root = new THREE.Group(); root.name = 'crystal-city-colossus';
  const shape = new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,z)));
  let geometry = new THREE.ExtrudeGeometry(shape,{depth:3.8,bevelEnabled:true,bevelThickness:1.1,bevelSize:1.15,bevelSegments:1,steps:1});
  geometry.rotateX(Math.PI/2); geometry.translate(0,1.9,0);
  geometry.computeBoundingBox(); const lengthScale=COLOSSUS_LENGTH/(geometry.boundingBox.max.z-geometry.boundingBox.min.z); geometry.scale(1,1,lengthScale);
  const originalGeometry=geometry; geometry=colourBatianGeometry(originalGeometry); originalGeometry.dispose();
  // Preserve planform while tapering thickness continuously toward every rim segment.
  const vertices=geometry.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i)/lengthScale;let distance=Infinity;
    for(let j=0;j<outline.length;j++){const a=outline[j],b=outline[(j+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));}
    vertices.setY(i,vertices.getY(i)*(.16+.84*THREE.MathUtils.smoothstep(distance,0,7)));
  }
  geometry.computeVertexNormals();geometry.computeBoundingBox();
  const crystal = new THREE.MeshPhysicalMaterial({color:0xffffff,vertexColors:true,roughness:.38,metalness:.04,clearcoat:.65,clearcoatRoughness:.22,transparent:true,opacity:.94,flatShading:true,fog:false});
  installBatianColourPlanes(crystal);
  const hull = new THREE.Mesh(geometry,crystal); hull.name='black-grey-crystal-hull'; hull.castShadow=true; hull.receiveShadow=true; root.add(hull);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry,24),new THREE.LineBasicMaterial({color:0x222a38,transparent:true,opacity:.45}));root.add(edge);
  const spineMaterial=crystal.clone();spineMaterial.onBeforeCompile=()=>{};spineMaterial.customProgramCacheKey=()=>'batian-spine';spineMaterial.vertexColors=false;spineMaterial.color.setHex(BATIAN_PALETTE.charcoal);const spine = new THREE.Mesh(new THREE.OctahedronGeometry(1,0),spineMaterial); spine.name='crystal-dorsal-spine';spine.scale.set(4,2.3,28);spine.position.y=1.2;spine.castShadow=true;root.add(spine);
  const dark = new THREE.MeshStandardMaterial({color:0x080d15,roughness:.3,metalness:.3});
  for(const side of [-1,1])for(const z of [6,12]){
    const intake=new THREE.Mesh(new THREE.CylinderGeometry(2.0,1.5,2.5,10),dark);intake.name='recessed-intake';intake.rotation.x=Math.PI/2;intake.position.set(side*12,-.5,z);root.add(intake);
  }
  const lampMat=new THREE.MeshBasicMaterial({color:BATIAN_PALETTE.coral});
  for(const side of [-1,1])for(const z of [-22,-12,0,12,24]){const lamp=new THREE.Mesh(new THREE.OctahedronGeometry(.28),lampMat);lamp.position.set(side*3.5,4,z);root.add(lamp);}
  root.userData={kind:'crystal-colossus',displayName:'霸天',referenceHullLength:7,lengthMultiplier:10,material:'blue-charcoal crystal with violet, sand and turquoise planes',paletteVersion:'moebius-colour-v2',footprintZScale:lengthScale,parts:{hull,spine}};
  return root;
}

export function installCrystalColossus(scene,{radius=160,sun=null,city=null,altitude=40}={}){
  const aircraft=createCrystalColossus();scene.add(aircraft);
  const shape=new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,z)));
  // Subdivide footprint triangles so the moving silhouette follows the spherical domain.
  const raw=new THREE.ShapeGeometry(shape).toNonIndexed(); const samples=[];
  const p=raw.attributes.position; const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  function subdivide(a,b,c,n){if(n===0){samples.push(a.clone(),b.clone(),c.clone());return;}const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);subdivide(a,ab,ca,n-1);subdivide(ab,b,bc,n-1);subdivide(ca,bc,c,n-1);subdivide(ab,bc,ca,n-1);}
  for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);subdivide(a,b,c,2);}raw.dispose();
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(samples.length*3),3));
  const shadow=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:BATIAN_PALETTE.shadow,transparent:true,opacity:.52,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,fog:false}));shadow.name='crystal-colossus-domain-shadow';shadow.frustumCulled=false;shadow.renderOrder=6;scene.add(shadow);
  const frame=getCityFrame(),up=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),matrix=new THREE.Matrix4(),world=new THREE.Vector3(),direction=new THREE.Vector3(),hit=new THREE.Vector3();
  let shadowTime=-Infinity;const groundRay=new THREE.Raycaster();
  function update(t){
    const phase=t*.014;cityLocalToDir(Math.cos(phase)*.13,Math.sin(phase)*.09,up);
    let flightRadius = radius + altitude;
    // Keep the underside above nearby crystal tips across the full 70 m footprint.
    for (const tower of city?.crystals || []) {
      if (tower.dir?.angleTo(up) < .28 && Number.isFinite(tower.root) && Number.isFinite(tower.h))
        flightRadius = Math.max(flightRadius, tower.root + tower.h + 9);
    }
    aircraft.position.copy(up).multiplyScalar(flightRadius);
    aircraft.userData.flightAltitude = flightRadius - radius;
    aircraft.userData.baseCruiseAltitude = altitude;
    aircraft.userData.towerClearanceAllowance = 9;
    forward.copy(frame.east).multiplyScalar(-Math.sin(phase)*.13).addScaledVector(frame.north,Math.cos(phase)*.09);forward.addScaledVector(up,-forward.dot(up)).normalize();right.crossVectors(up,forward).normalize();matrix.makeBasis(right,up,forward);aircraft.quaternion.setFromRotationMatrix(matrix);aircraft.updateMatrixWorld(true);
    updateShadow(t);
  }
  function updateShadow(t,receivers=null){
    up.copy(aircraft.position).normalize();
    if(t-shadowTime<.2)return;shadowTime=t;
    direction.copy(sun?.position||up).normalize().negate();
    const daylight=Math.max(0,-direction.dot(up));shadow.visible=daylight>.12;shadow.material.opacity=.52*Math.min(1,daylight*2);
    if(!shadow.visible)return;
    const attr=sg.attributes.position;
    samples.forEach((s,i)=>{
      world.set(s.x,0,s.y*aircraft.userData.footprintZScale).applyMatrix4(aircraft.matrixWorld);
      let r=radius,travel=0,valid=true;
      for(let j=0;j<3;j++){const dot=world.dot(direction),disc=dot*dot-world.lengthSq()+r*r;if(disc<0){valid=false;break;}travel=-dot-Math.sqrt(disc);if(travel<0){valid=false;break;}hit.copy(world).addScaledVector(direction,travel);const surfaceDir=hit.clone().normalize();r=radius+Math.max(canyonOffsetDir(surfaceDir),officialOceanLevelAt(surfaceDir))+.22;}
      if(!valid)hit.copy(world).normalize().multiplyScalar(radius+.22);
      const sampledHeight=receivers?.userData.groundHeightAt?.(hit.clone().normalize());
      if(Number.isFinite(sampledHeight))hit.normalize().multiplyScalar(sampledHeight+.16);
      else if(receivers&&!receivers.userData.groundHeightAt){
        groundRay.set(world,direction);groundRay.far=250;
        const solids=[];receivers.traverse(o=>{if(o.isMesh&&!o.isSprite)solids.push(o);});const h=groundRay.intersectObjects(solids,false).find(h=>h.object.isMesh&&h.object.visible&&!h.object.userData.isOutline&&!/shadow|steam|smoke|robot|weapon|beam/.test(h.object.name||'')&&!h.object.material?.transparent);
        if(h)hit.copy(h.point).addScaledVector(hit.clone().normalize(),.16);
      }
      attr.setXYZ(i,hit.x,hit.y,hit.z);
    });attr.needsUpdate=true;
  }
  update(0);
  return {aircraft,shadow,frame,update,updateShadow,dispose(){scene.remove(aircraft,shadow);const geos=new Set(),mats=new Set();aircraft.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)mats.add(o.material);});geos.add(sg);mats.add(shadow.material);geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
