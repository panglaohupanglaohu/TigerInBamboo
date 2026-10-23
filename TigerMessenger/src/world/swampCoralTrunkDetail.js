import * as THREE from 'three';
import {GREG_LAKE_PALETTE as P} from './swampGregVisuals.js';
import {installSwampCoralTrunkBatch} from './swampCoralTrunkBatch.js';

// Fixed mesh transforms and fixed end rings are structural anchors. Organic
// shape is authored between them, never by moving trees, branches or perches.
export function installSwampCoralTrunkDetail(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregTrunkDetail')!=='0',organic=new URLSearchParams(globalThis.location?.search||'').get('gregTrunkShape')!=='0'}={}){
 const inner=swamp.userData.inner||swamp;if(inner.userData.gregTrunkDetail)return inner.userData.gregTrunkDetail;if(!enabled)return null;
 inner.updateWorldMatrix(true,true);const inverse=inner.matrixWorld.clone().invert(),records=[];
 const route=inner.userData.gregSpatialPlan?.route||[];
 function nearWalk(v){
  const r=Math.hypot(v.x,v.z);if(v.y>39&&v.y<44&&r>35.1&&r<39.7)return true;
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz,t=d?THREE.MathUtils.clamp(((v.x-a[0])*dx+(v.z-a[2])*dz)/d,0,1):0,y=a[1]+t*(b[1]-a[1]);
   if(v.y>y-.5&&v.y<y+4.5&&Math.hypot(v.x-a[0]-t*dx,v.z-a[2]-t*dz)<2.5)return true;
  }return false;
 }
 inner.traverse(mesh=>{
  const trunk=mesh.name==='world-tree-trunk'||mesh.userData.swampTreePart==='trunk';
  const branch=mesh.name==='v2-world-tree-branch'||mesh.userData.swampTreePart==='branch';
  if(!mesh.isMesh||(!trunk&&!branch))return;
  const original=mesh.geometry,geometry=original.clone(),p=geometry.attributes.position;geometry.computeBoundingBox();const box=geometry.boundingBox.clone(),height=box.max.y-box.min.y;
  if(height<.5){geometry.dispose();return;}
  const matrix=inverse.clone().multiply(mesh.matrixWorld),anchor=new THREE.Vector3().setFromMatrixPosition(matrix),phase=Math.sin(anchor.x*.41+anchor.z*.27)*Math.PI;
  const tube=original.type==='TubeGeometry',ringCount=(original.parameters?.radialSegments||0)+1;
  // Branch bases must stay embedded in the same source wood, not merely keep
  // their own transforms. Freeze the two surrounding source rings as well.
  const attachmentY=[],sourceInverse=mesh.matrixWorld.clone().invert(),attachmentBox=box.clone().expandByScalar(.15);
  for(const sibling of mesh.parent?.children||[]){
   if(sibling===mesh||!sibling.isMesh||sibling.userData.swampTreePart!=='branch'||sibling.geometry.type!=='CylinderGeometry')continue;
   const point=new THREE.Vector3(0,-sibling.geometry.parameters.height/2,0).applyMatrix4(sibling.matrixWorld).applyMatrix4(sourceInverse);
   if(attachmentBox.containsPoint(point))attachmentY.push(point.y);
  }
  const attachmentBand=height/(original.parameters?.heightSegments||6)+.25;
  let maxOffset=0,maxOrganicOffset=0,maxNoduleOffset=0,changedVertices=0,protectedVertices=0;
  // Preserve the earlier small radial surface treatment as the attachment
  // baseline. The added centreline shape must not move any protected cross-section.
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=(y-box.min.y)/height,a=Math.atan2(z,x),r=Math.hypot(x,z),fade=Math.sin(Math.PI*t)**2;
   if(trunk&&r>1e-7){const offset=Math.min(.13,r*.055)*fade*(.63*Math.sin(a*5+y*.2)+.37*Math.sin(a*9-y*.14));p.setXYZ(i,x+x/r*offset,y,z+z/r*offset);maxOffset=Math.max(maxOffset,Math.abs(offset));}
  }
  geometry.computeBoundingBox();const baselineBox=geometry.boundingBox.clone(),baselineCenter=baselineBox.getCenter(new THREE.Vector3());
  const baseline=p.array.slice(),local=new THREE.Vector3(),proposed=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=(y-box.min.y)/height;
   if(!organic)continue;
   if(t<1e-5||t>1-1e-5||(tube&&(i<ringCount||i>=p.count-ringCount)))continue;
   local.set(x,y,z).applyMatrix4(matrix);
   // Existing monkey attachment triangles sit around Y42–47; their full ring
   // neighbourhood and the V7 compressed-tree equivalent remain unchanged.
   // The upper transit bridge band and submerged central roots are also fixed.
   if(attachmentY.some(a=>Math.abs(y-a)<=attachmentBand)||(local.y>=38&&local.y<=68)||(mesh.name==='world-tree-trunk'&&local.y<=25.3)||nearWalk(local)){protectedVertices++;continue;}
   const fade=Math.sin(Math.PI*t)**2,amplitude=Math.min(branch?.30:.72,height*(branch?.045:.046));
   const bend=amplitude*fade*(.78+.22*Math.sin(t*Math.PI*2+phase));
   const flare=t<.34?Math.sin(Math.PI*t/.34)*(branch?.055:.14):0;
   const taper=-.055*fade*THREE.MathUtils.smoothstep(t,.25,.85),scale=1+flare+taper;
   // Tube branches already have a curved path in their coordinates: bend only,
   // rather than scaling them about the world-tree origin.
   const radial=Math.hypot(x,z),angle=Math.atan2(z,x);
   // One broad root/old-limb swelling is sculpted into the existing closed skin.
   // Attachment rings, living paths and submerged roots were excluded above.
   const nodule=trunk?.45*Math.exp(-Math.pow((t-.34)/.10,2))*fade*Math.pow(Math.max(0,Math.cos(angle-phase)),4):0;
   const nx=(tube?x:x*scale)+Math.cos(phase)*bend+(radial?x/radial*nodule:0),nz=(tube?z:z*scale)+Math.sin(phase)*bend*.7+(radial?z/radial*nodule:0);
   proposed.set(nx,y,nz).applyMatrix4(matrix);
   if(nearWalk(proposed)){protectedVertices++;continue;}
   maxNoduleOffset=Math.max(maxNoduleOffset,nodule);p.setXYZ(i,nx,y,nz);const offset=Math.hypot(nx-x,nz-z);maxOrganicOffset=Math.max(maxOrganicOffset,offset);if(offset>1e-6)changedVertices++;
  }
  p.needsUpdate=true;geometry.computeVertexNormals();
  // Perch selection explicitly recomputes boxes later. Keep this valid,
  // conservative bounding-box policy on subsequent recomputations as well.
  const computeActualBox=geometry.computeBoundingBox;
  geometry.computeBoundingBox=function(){
    computeActualBox.call(this);const actual=this.boundingBox.clone(),extent=new THREE.Vector3();
    for(const axis of['x','y','z'])extent[axis]=Math.max(Math.abs(actual.min[axis]-baselineCenter[axis]),Math.abs(actual.max[axis]-baselineCenter[axis]),Math.abs(baselineBox.min[axis]-baselineCenter[axis]),Math.abs(baselineBox.max[axis]-baselineCenter[axis]));
    this.boundingBox.set(baselineCenter.clone().sub(extent),baselineCenter.clone().add(extent));
  };
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({name:'greg-lake-bark',color:P.bark,toneMapped:false});
  material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 coralBarkP;varying float coralBarkDistance;').replace('#include <begin_vertex>','#include <begin_vertex>\ncoralBarkP=position;coralBarkDistance=length((modelViewMatrix*vec4(position,1.)).xyz);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 coralBarkP;varying float coralBarkDistance;').replace('#include <color_fragment>',`#include <color_fragment>
    float angle=atan(coralBarkP.z,coralBarkP.x);
    float groove=sin(angle*9.+sin(coralBarkP.y*.12+angle*2.)*.7);
    float aa=max(fwidth(groove),.008);
    float line=smoothstep(.986-aa,1.+aa,groove);
    float gaps=smoothstep(.12,.45,sin(coralBarkP.y*.31+angle*5.));
    // Keep the large trunks readable beyond the old 40-world cutoff. No
    // screen grid: irregular longitudinal lines and rare short side fissures.
    float nearInk=.58*(1.-smoothstep(18.,58.,coralBarkDistance))
                 +.32*(1.-smoothstep(55.,110.,coralBarkDistance))
                 +.10*(1.-smoothstep(95.,165.,coralBarkDistance));
    float fissure=sin(angle*9.+.38+sin(coralBarkP.y*.21+angle*2.)*.65);
    float crackAA=max(fwidth(fissure),.008);
    float crack=smoothstep(.994-crackAA,1.+crackAA,fissure)
               *smoothstep(.78,.96,sin(coralBarkP.y*.47+angle*3.))
               *smoothstep(.15,.60,sin(angle*3.+1.2));
    float broad=sin(angle*3.+coralBarkP.y*.018);
    diffuseColor.rgb*=mix(.91,1.,smoothstep(-.10,.15,broad));
    // Asymmetric old branch scars, embedded in the wood rather than floating rings.
    float knotCell=floor(coralBarkP.y/13.);
    float knotY=(fract(coralBarkP.y/13.)-.46)*13.;
    float knotAngle=angle-(sin(knotCell*2.13)*2.2+.35);
    knotAngle=atan(sin(knotAngle),cos(knotAngle));
    float oval=length(vec2(knotAngle*3.6,knotY*.62));
    float knotAA=max(fwidth(oval),.012);
    float knotRim=(1.-smoothstep(knotAA,knotAA*2.8,abs(oval-1.)))
                *(1.-smoothstep(1.25,1.55,abs(knotY)));
    float scarCore=(1.-smoothstep(.14,.40,oval))*.18;
    float weather=sin(angle*4.+coralBarkP.y*.14)*.6+sin(angle*7.-coralBarkP.y*.24)*.4;
    diffuseColor.rgb*=.94+.06*smoothstep(-.45,.30,weather);
    float cleftPhase=angle*4.+.20*sin(coralBarkP.y*.15)+.12*sin(coralBarkP.y*.33);
    float cleftEdge=abs(sin(cleftPhase)),cleftAA=max(fwidth(cleftEdge),.006);
    float deepCleft=(1.-smoothstep(.025-cleftAA,.060+cleftAA,cleftEdge))
                    *smoothstep(-.6,-.1,sin(coralBarkP.y*.10+angle));
    vec3 barkInk=vec3(${new THREE.Color(P.ink).toArray().map(v=>v.toFixed(8)).join(',')});
    diffuseColor.rgb=mix(diffuseColor.rgb,barkInk,clamp((line*gaps*.50+crack*.12+knotRim*.36+scarCore+deepCleft*.40)*nearInk,0.,.56));`);
  };
  material.customProgramCacheKey=()=> 'greg-coral-bark-organic-2-aged-clefts-4';
  records.push({mesh,kind:trunk?'trunk':'branch',originalGeometry:original,originalMaterial:mesh.material,geometry,material,maxOffset,maxOrganicOffset,maxNoduleOffset,height,changedVertices,protectedVertices,baselinePositions:baseline,baselineBox});mesh.geometry=geometry;mesh.material=material;
 });
 let disposed=false;const report={version:3,lineRevision:'aged-clefts-4',organic,records,changedTrunks:records.filter(r=>r.kind==='trunk').length,changedBranches:records.filter(r=>r.kind==='branch').length,extraDrawCalls:0,maxOffset:Math.max(0,...records.map(r=>r.maxOffset)),maxOrganicOffset:Math.max(0,...records.map(r=>r.maxOrganicOffset)),maxNoduleOffset:Math.max(0,...records.map(r=>r.maxNoduleOffset)),protectedBand:[38,68],dispose(){if(disposed)return;disposed=true;report.batch?.dispose();for(const r of records){if(r.mesh.geometry===r.geometry)r.mesh.geometry=r.originalGeometry;if(r.mesh.material===r.material)r.mesh.material=r.originalMaterial;r.geometry.dispose();r.material.dispose();}if(inner.userData.gregTrunkDetail===report)delete inner.userData.gregTrunkDetail;}};
 inner.userData.gregTrunkDetail=report;report.batch=installSwampCoralTrunkBatch(inner,records);return report;
}
