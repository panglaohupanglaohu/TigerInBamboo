import * as THREE from 'three';
const active=new WeakMap();
/** Project-authored 3D crown silhouette. No root/instance relocation or impostors.
 * The original placement envelope remains an upper bound, not a growth target. */
export function applyTargetCanopyAppearance(castle){
 if(active.has(castle))return active.get(castle);
 const started=performance.now(),changes=[],report={version:'target-lobed-canopies-2',rootsMoved:false,instancesChanged:false,crowns:[],accepted:false,shade:'subtle local-height albedo gradient; not baked sun shadow or Oskar GI'};
 for(let variant=0;variant<3;variant++){
  const mesh=castle.getObjectByName('citadel-canopy-broadleaf-'+variant);if(!mesh?.isInstancedMesh)continue;
  const original=mesh.geometry,originalMaterial=mesh.material;original.computeBoundingBox();const box=original.boundingBox,center=box.getCenter(new THREE.Vector3()),half=box.getSize(new THREE.Vector3()).multiplyScalar(.5);
  const g=new THREE.SphereGeometry(1,24,16),p=g.attributes.position,dir=new THREE.Vector3(),colours=[];
  // An off-centre high leader and unequal lower shoulders rather than a ring
  // of equal bubbles. All component balls overlap the compact central body.
  const specifications=[
   [[-.17,.31,.02,.64],[.30,-.07,.15,.52],[-.34,-.13,-.10,.49],[.06,-.04,-.32,.48]],
   [[.20,.22,-.08,.65],[-.30,.06,.21,.53],[.13,-.21,.31,.48],[-.13,-.13,-.28,.53]],
   [[-.08,.34,-.17,.62],[.33,-.02,-.04,.54],[-.32,-.05,.23,.52],[.08,-.20,.27,.48]],
  ][variant];
  const lobes=[{p:new THREE.Vector3(0,-.12,0),r:.56},...specifications.map(([x,y,z,r])=>({p:new THREE.Vector3(x,y,z),r}))];
  for(let i=0;i<p.count;i++){
   dir.fromBufferAttribute(p,i).normalize();let r=0;
   for(const l of lobes){const b=dir.dot(l.p),disc=b*b-l.p.lengthSq()+l.r*l.r;if(disc>=0)r=Math.max(r,b+Math.sqrt(disc));}
   // Narrow the lower body and preserve a few asymmetric notches in the crown.
   const lower=THREE.MathUtils.smoothstep(dir.y,-.8,.25),horizontal=.88+.1*lower;
   const x=center.x+dir.x*r*half.x*horizontal,y=center.y+dir.y*r*half.y,z=center.z+dir.z*r*half.z*horizontal;
   p.setXYZ(i,THREE.MathUtils.clamp(x,box.min.x,box.max.x),THREE.MathUtils.clamp(y,box.min.y,box.max.y),THREE.MathUtils.clamp(z,box.min.z,box.max.z));
   const t=THREE.MathUtils.smoothstep((y-box.min.y)/(box.max.y-box.min.y),.12,.88),shade=.79+.21*t;
   colours.push(shade*.99,shade,shade*(1.015-.015*t));
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  const originals=Array.isArray(originalMaterial)?originalMaterial:[originalMaterial],materials=originals.map(m=>{const clone=m.clone();clone.vertexColors=true;clone.userData={...m.userData,preserveCitadelMaterial:true};clone.needsUpdate=true;return clone;});
  mesh.geometry=g;mesh.material=Array.isArray(originalMaterial)?materials:materials[0];mesh.computeBoundingBox();mesh.computeBoundingSphere();changes.push({mesh,original,originalMaterial,g,materials});
  report.crowns.push({name:mesh.name,instances:mesh.count,lobes:lobes.length,triangles:g.index.count/3,boundsBefore:{min:box.min.toArray(),max:box.max.toArray()},boundsAfter:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()},vertexShade:[.79,1]});
 }
 report.drawCallsAdded=0;report.geometryTriangles=report.crowns.reduce((n,c)=>n+c.triangles,0);report.buildMs=performance.now()-started;
 let disposed=false;const handle={report,dispose(){if(disposed)return;disposed=true;for(const {mesh,original,originalMaterial,g,materials}of changes){if(mesh.geometry===g){mesh.geometry=original;mesh.computeBoundingBox();mesh.computeBoundingSphere();}if(materials.includes(mesh.material)||(Array.isArray(mesh.material)&&mesh.material.every(m=>materials.includes(m))))mesh.material=originalMaterial;g.dispose();for(const m of materials)m.dispose();}active.delete(castle);report.disposed=true;}};active.set(castle,handle);return handle;
}
