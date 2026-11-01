import * as THREE from 'three';
import {CRYSTAL_V7_SHORES} from '../assets/crystalV7ShoresData.js';
import {getCityFrame} from './crystalCityLayout.js';

// Apply the same r03 edits to live factory nodes: keep animation/story identity.
export function finishCrystalV7Towers(city) {
 const gem=[0x2c7199,0x54a9cc,0xa4deea,0xd3f0ef,0x577da7,0x8eb9d9].map(c=>new THREE.MeshStandardMaterial({color:c,metalness:.18,roughness:.28,flatShading:true}));
 const warm=new THREE.MeshStandardMaterial({color:0xf1ca85,metalness:.25,roughness:.22,emissive:0xa25b29,emissiveIntensity:.2});
 for(const r of city.crystals){
  const root=r.group;root.scale.multiply(new THREE.Vector3(1.8,.82,1.8));r.h*=.82;
  // Keep the measured port landing radius and root; widening is visual only.
  let layer=0;
  root.traverse(o=>{
   if(o.name==='bio-dome-layer'){o.scale.multiply(new THREE.Vector3(1.6,3,1.6));o.rotation.y=[0,-1.3,1.1][layer++%3];}
   if(!o.isMesh)return;
   if(o.name==='neon-dome-shell'){o.material=warm;return;}
   const materials=Array.isArray(o.material)?o.material:[o.material];
   if(!materials.some(m=>m.transparent&&m.opacity<.95))return;
   o.geometry.computeBoundingBox();const size=o.geometry.boundingBox.getSize(new THREE.Vector3());
   if(size.y>3&&size.y>size.x*1.1){
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.clearGroups();
    const n=g.attributes.normal;for(let i=0;i<g.attributes.position.count;i+=3){const angle=Math.atan2(n.getZ(i),n.getX(i));g.addGroup(i,3,Math.min(5,Math.floor((angle+Math.PI)/Math.PI/2*6)));}
    o.geometry=g;o.material=gem;
   }else o.material=new THREE.MeshStandardMaterial({color:0x80c7e2,metalness:.22,roughness:.26});
  });
  root.userData.crystalV7Round=3;
 }
}
export function installCrystalV7Shores(scene,city,swamp){
 const root=new THREE.Group();root.name='crystal-v7-shores';scene.add(root);
 const frame=getCityFrame(),walk=[];
 // Authored shore owners 0..2 are the original towers; owner 3 is ALWAYS the swamp.
 const siteFor=r=>({dir:r.dir,radius:r.root});
 const sites=[...city.crystals.slice(0,3).map(siteFor),{dir:swamp.position.clone().normalize(),radius:swamp.position.length()},...city.crystals.slice(3).map(siteFor)];
 const bases=sites.map(s=>{const x=frame.east.clone().addScaledVector(s.dir,-frame.east.dot(s.dir)).normalize();return {x,z:x.clone().cross(s.dir).normalize()};});
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,flatShading:true});
 for(const p of CRYSTAL_V7_SHORES){
  const s=sites[p.owner],b=bases[p.owner],positions=[];
  for(let i=0;i<p.positions.length;i+=3){const [x,y,z]=p.positions.slice(i,i+3);const v=s.dir.clone().multiplyScalar(s.radius).addScaledVector(b.x,x).addScaledVector(b.z,z).normalize().multiplyScalar(s.radius+y);positions.push(...v.toArray());}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(p.colors,3));g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name='v7-'+p.name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);if(p.walk)walk.push(mesh);
 }
 // A continuous stone rim connects the three bridges around the original open bowl.
 const rimGeo=new THREE.RingGeometry(18,21.5,96);rimGeo.rotateX(-Math.PI/2);
 const rimPos=rimGeo.attributes.position,swampSite=sites[3],rimBasis=bases[3];
 for(let i=0;i<rimPos.count;i++){
  const v=swampSite.dir.clone().multiplyScalar(swampSite.radius).addScaledVector(rimBasis.x,rimPos.getX(i)).addScaledVector(rimBasis.z,rimPos.getZ(i)).normalize().multiplyScalar(swampSite.radius-1.15);
  rimPos.setXYZ(i,v.x,v.y,v.z);
 }
 rimGeo.computeVertexNormals();const rim=new THREE.Mesh(rimGeo,new THREE.MeshStandardMaterial({color:0xf0dabc,roughness:.85,side:THREE.DoubleSide}));rim.name='v7-continuous-swamp-promenade';root.add(rim);walk.push(rim);
 // Bridges follow the real spherical placement instead of the flat review coordinates.
 const water=136;
 for(let i=0;i<3;i++){
  const a=sites[3],b=sites[i],angle=a.dir.angleTo(b.dir),start=20/a.radius/angle,end=1-(i?9.13:10.79)/b.radius/angle;
  const steps=Math.max(2,Math.ceil(angle*144*(end-start)/2));
  for(let k=0;k<steps;k++){
   const point=t=>a.dir.clone().lerp(b.dir,t).normalize().multiplyScalar(THREE.MathUtils.lerp(a.radius-1.2,b.radius-.12,(t-start)/(end-start)));
   const u=start+(end-start)*k/steps,v=start+(end-start)*(k+1)/steps,p=point(u),q=point(v),mid=p.clone().add(q).multiplyScalar(.5),forward=q.clone().sub(p).normalize(),right=mid.clone().normalize().cross(forward).normalize(),up=forward.clone().cross(right).normalize();
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(3.8,.44,p.distanceTo(q)+.04),new THREE.MeshStandardMaterial({color:0xeee0c3,roughness:.78}));mesh.name='v7-garden-connector';mesh.position.copy(mid).addScaledVector(up,-.22);mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));root.add(mesh);walk.push(mesh);
   if(k%4===0){const h=mid.length()-water+3,pier=new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,h,6),mesh.material);pier.position.copy(mid).normalize().multiplyScalar(water-3+h/2);pier.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),mid.clone().normalize());root.add(pier);}
  }
 }
 swamp.traverse(o=>{if(o.name.startsWith('swamp-towering-tree'))o.scale.y*=.55;});
 root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),up=new THREE.Vector3();
 root.userData.sampleGroundRadius=position=>{
  up.copy(position).normalize();if(!sites.some(s=>s.dir.angleTo(up)<.5))return null;
  ray.set(position.clone().addScaledVector(up,.4),up.clone().negate());ray.far=3;
  for(const hit of ray.intersectObjects(walk,false))if(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).dot(up)>.5)return hit.point.length();return null;
 };
 root.userData.rotateCoreSite=q=>sites[3].dir.applyQuaternion(q);
 root.userData.walkMeshes=walk;root.userData.round=3;return root;
}

// Regrade only the authored canyon shoulders where they overlap the city cove.
// Keep gate architecture, footpaths, rail deck and its supports at their measured poses.
export function shapeCrystalV7Cove(gate,swamp){
 const site=gate.getObjectByName('gate-canyon-site-blender');if(!site)return;
 const center=swamp.position.clone().normalize(),point=new THREE.Vector3();let changed=0;
 site.updateWorldMatrix(true,true);
 for(const mesh of site.children){
  if(!mesh.name.startsWith('canyon-shoulder'))continue;
  mesh.geometry=subdivideCliff(mesh.geometry,8);const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i);mesh.localToWorld(point);const radius=point.length(),distance=center.angleTo(point.clone().normalize())*144;
   const influence=1-THREE.MathUtils.smoothstep(distance,40,65);
   if(influence<=0||radius<=133)continue;
   const cut=THREE.MathUtils.lerp(radius,133,influence);
   const band=(cut-133)/3.5,base=Math.floor(band),fraction=band-base;
   const terrace=133+3.5*(base+THREE.MathUtils.smoothstep(fraction,.60,.96));
   point.setLength(THREE.MathUtils.lerp(cut,terrace,.75));mesh.worldToLocal(point);p.setXYZ(i,point.x,point.y,point.z);changed++;
  }
  p.needsUpdate=true;mesh.geometry.computeVertexNormals();paintWarmCliff(mesh);mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
 }
 site.userData.crystalV7RegradedVertices=changed;
}

// Subdivide before regrading so the cut cove does not create continent-sized triangles.
function subdivideCliff(source,maxEdge){
 const g=source.index?source.toNonIndexed():source;
 const positions=[],p=g.attributes.position;
 const midpoint=(a,b)=>a.clone().add(b).multiplyScalar(.5);
 function triangle(a,b,c,depth){
  if(depth<4&&Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))>maxEdge){
   const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
   triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);
  }else positions.push(...a.toArray(),...b.toArray(),...c.toArray());
 }
 for(let i=0;i<p.count;i+=3)triangle(new THREE.Vector3().fromBufferAttribute(p,i),new THREE.Vector3().fromBufferAttribute(p,i+1),new THREE.Vector3().fromBufferAttribute(p,i+2),0);
 const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));return result;
}
function paintWarmCliff(mesh){
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,colors=[];
 const palette=[0xe5c5a1,0xd9b08e,0xf1ddbb,0xcba58c,0xe7cdb2].map(h=>new THREE.Color(h));
 const grass=new THREE.Color(0x8b9d68),a=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<p.count;i+=3){
  a.fromBufferAttribute(p,i);mesh.localToWorld(a);normal.fromBufferAttribute(n,i).transformDirection(mesh.matrixWorld);
  const band=Math.abs(Math.floor((a.length()-130)/3.5)),color=palette[band%palette.length].clone();
  if(normal.dot(a.clone().normalize())>.72&&a.length()>138)color.lerp(grass,.65);
  for(let j=0;j<3;j++)colors.push(color.r,color.g,color.b);
 }
 g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 mesh.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,flatShading:true,emissive:0x9c7354,emissiveIntensity:.12});
}
