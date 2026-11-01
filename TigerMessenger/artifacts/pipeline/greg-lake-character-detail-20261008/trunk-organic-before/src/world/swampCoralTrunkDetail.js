import * as THREE from 'three';
import {GREG_LAKE_PALETTE as P} from './swampGregVisuals.js';

// Real, small silhouette changes in mesh-local coordinates. End rings, existing
// roots, transforms and branches stay fixed, including final V7 tree scaling.
export function installSwampCoralTrunkDetail(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregTrunkDetail')!=='0'}={}){
 const inner=swamp.userData.inner||swamp;if(inner.userData.gregTrunkDetail)return inner.userData.gregTrunkDetail;if(!enabled)return null;
 const records=[];
 inner.traverse(mesh=>{
  if(!mesh.isMesh||(mesh.name!=='world-tree-trunk'&&mesh.userData.swampTreePart!=='trunk'))return;
  const original=mesh.geometry,geometry=original.clone(),p=geometry.attributes.position;geometry.computeBoundingBox();const box=geometry.boundingBox,height=box.max.y-box.min.y;
  if(height<.5){geometry.dispose();return;}
  let maxOffset=0;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=(y-box.min.y)/height,a=Math.atan2(z,x),r=Math.hypot(x,z),fade=Math.sin(Math.PI*t)**2;
   if(r<1e-7)continue;
   const offset=Math.min(.13,r*.055)*fade*(.63*Math.sin(a*5+y*.2)+.37*Math.sin(a*9-y*.14));
   p.setXYZ(i,x+x/r*offset,y,z+z/r*offset);maxOffset=Math.max(maxOffset,Math.abs(offset));
  }
  p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({color:P.bark,toneMapped:false});
  material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 coralBarkP;').replace('#include <begin_vertex>','#include <begin_vertex>\ncoralBarkP=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 coralBarkP;').replace('#include <color_fragment>',`#include <color_fragment>
    float angle=atan(coralBarkP.z,coralBarkP.x);
    float groove=sin(angle*15.+sin(coralBarkP.y*.19+angle*3.)*.9);
    float aa=max(fwidth(groove),.008);
    float line=smoothstep(.982-aa,1.+aa,groove);
    float gaps=smoothstep(-.38,.2,sin(coralBarkP.y*.42+angle*8.));
    float broad=sin(angle*4.+coralBarkP.y*.025)*.045;
    diffuseColor.rgb*=1.+broad-line*gaps*.36;`);
  };
  material.customProgramCacheKey=()=> 'greg-coral-bark-detail-1';
  records.push({mesh,originalGeometry:original,originalMaterial:mesh.material,geometry,material,maxOffset,height});mesh.geometry=geometry;mesh.material=material;
 });
 let disposed=false;const report={version:1,records,changedTrunks:records.length,extraDrawCalls:0,maxOffset:Math.max(0,...records.map(r=>r.maxOffset)),dispose(){if(disposed)return;disposed=true;for(const r of records){if(r.mesh.geometry===r.geometry)r.mesh.geometry=r.originalGeometry;if(r.mesh.material===r.material)r.mesh.material=r.originalMaterial;r.geometry.dispose();r.material.dispose();}if(inner.userData.gregTrunkDetail===report)delete inner.userData.gregTrunkDetail;}};
 inner.userData.gregTrunkDetail=report;return report;
}
