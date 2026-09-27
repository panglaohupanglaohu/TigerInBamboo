import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../../vendor/three.module.js';
import source from '../../src/assets/warshipV6Data.js';
const shipCode=(await readFile(new URL('../../src/assets/warshipV6.js',import.meta.url),'utf8')).replace(/^import .*\n/gm,'').replace('export function createWarshipV6','function createWarshipV6');
const seamCode=(await readFile(new URL('../../src/world/saihojiBoardingSeam.js',import.meta.url),'utf8')).replace(/^import .*\n/gm,'').replace('export function installSaihojiBoardingSeam','function installSaihojiBoardingSeam');
const context=vm.createContext({THREE,source,atob,getToonGradient:()=>null});
vm.runInContext(shipCode+'\n'+seamCode,context);
const boat=context.createWarshipV6(),api=boat.userData.warshipV6,seam=context.installSaihojiBoardingSeam(boat).mesh;
const resources=vm.runInContext('resources()',context);
const animated=new Set(source.poseKeys);
const objects=source.nodes.filter(s=>s.mesh!==undefined&&s.sourceId).map(s=>({source:s,node:api.nodes.get(s.sourceId),parts:resources.geometry[s.mesh]})).filter(o=>{
  for(let n=o.node;n&&n!==boat;n=n.parent)if(animated.has(n.userData.sourceNodeId))return true;
  return false;
});
seam.geometry.computeBoundingBox();const seamBox=seam.geometry.boundingBox.clone();
const inner=seamBox.clone().expandByScalar(-1e-5),outer=seamBox.clone().expandByScalar(1e-6);
function clip(points,box){
  let polygon=points.map(p=>p.clone());
  for(const axis of ['x','y','z'])for(const side of [-1,1]){
    const value=side<0?box.min[axis]:box.max[axis],inside=p=>side*(p[axis]-value)<=0;
    const next=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],ia=inside(a),ib=inside(b);
      if(ia)next.push(a);
      if(ia!==ib)next.push(a.clone().lerp(b,(value-a[axis])/(b[axis]-a[axis])));
    }
    polygon=next;if(!polygon.length)return [];
  }
  return polygon;
}
function area(poly){let area=0;for(let i=1;i+1<poly.length;i++)area+=poly[i].clone().sub(poly[0]).cross(poly[i+1].clone().sub(poly[0])).length()*.5;return area;}
function visible(o){for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;}
function insideSolid(triangles){
  const ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(.893,.431,.153).normalize()),hits=[],v=new THREE.Vector3();
  for(const tri of triangles)if(ray.intersectTriangle(...tri,false,v)){
    const distance=v.length();if(distance>1e-6&&!hits.some(d=>Math.abs(d-distance)<1e-6))hits.push(distance);
  }
  return hits.length%2===1;
}
const rows=[];let poses=0;
for(const pitch of [null,-25*Math.PI/180,25*Math.PI/180])for(let step=0;step<=40;step++){
  const progress=step/40;api.setBoarding(progress);api.setBoardingPitch(pitch);api.update(0,0);
  boat.updateWorldMatrix(true,true);const inverse=seam.matrixWorld.clone().invert();poses++;
  for(const o of objects){
    if(!visible(o.node))continue;
    const transform=inverse.clone().multiply(o.node.matrixWorld);
    let penetratingTriangles=0,touchTriangles=0,intersectionArea=0,maxSurfaceInset=0,allTriangles=[];
    const objectBox=new THREE.Box3();
    for(const part of o.parts){
      const box=part.g.boundingBox.clone().applyMatrix4(transform);objectBox.union(box);
      if(!box.intersectsBox(outer))continue;
      const p=part.g.attributes.position,index=part.g.index;
      for(let k=0;k<(index?.count??p.count);k+=3){
        const tri=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(k+j):k+j).applyMatrix4(transform));
        allTriangles.push(tri);
        if(!new THREE.Box3().setFromPoints(tri).intersectsBox(outer))continue;
        const clipped=clip(tri,inner),a=area(clipped);
        if(a>1e-10){
          penetratingTriangles++;intersectionArea+=a;
          const center=clipped.reduce((v,p)=>v.add(p),new THREE.Vector3()).multiplyScalar(1/clipped.length);
          maxSurfaceInset=Math.max(maxSurfaceInset,...clipped.concat([center]).map(p=>Math.min(...['x','y','z'].flatMap(axis=>[p[axis]-seamBox.min[axis],seamBox.max[axis]-p[axis]]))));
        }else if(area(clip(tri,outer))>1e-12)touchTriangles++;
      }
    }
    if(!objectBox.intersectsBox(outer))continue;
    const containsSeamCenter=allTriangles.length?insideSolid(allTriangles):false;
    if(penetratingTriangles||touchTriangles||containsSeamCenter)rows.push({pitch,progress,node:o.source.sourceId,name:o.source.name,
      classification:penetratingTriangles||containsSeamCenter?(progress>0&&progress<1?'intermediate-sweep-penetration':'endpoint-volume-overlap'):'surface-contact-only',
      penetratingTriangles,touchTriangles,intersectionArea,maxSurfaceInset,containsSeamCenter,
      objectBoundsInSeamFrame:{min:objectBox.min.toArray(),max:objectBox.max.toArray()}});
  }
}
const penetrations=rows.filter(r=>r.classification==='intermediate-sweep-penetration');
const nominal=rows.filter(r=>r.pitch===null);
const report={source:source.source,sha256:source.sourceSHA256,seam:{position:seam.position.toArray(),size:seam.geometry.parameters},
  sampling:{poses,progressStep:.025,pitches:[null,-25*Math.PI/180,25*Math.PI/180],dynamicMeshNodes:objects.length},
  method:'Production V11 pose interpolation and candidate mesh; exact source primitive triangles transformed to seam local frame, clipped against box interior (10 micrometre inset), contact box (+1 micrometre), plus closed-mesh center containment. Area/inset measured in unscaled model units; world scale 1.7 multiplies lengths.',
  scope:'Discrete 2.5% sweep samples, including deployed pitch extremes. Not a continuous collision proof; existing ship-vs-ship contacts excluded. No browser, runtime scene or asset modification.',
  passed:penetrations.length===0,intermediatePenetrations:penetrations.length,nominalPenetrations:nominal.filter(r=>r.classification==='intermediate-sweep-penetration').length,rows};
const out=new URL('../../artifacts/pipeline/saihoji-evacuation-boarding/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('seam-sweep-audit.json',out),JSON.stringify(report,null,2)+'\n');
const byNode={};for(const row of rows){const k=row.node;const entry=byNode[k]??={frames:0,first:row.progress,last:row.progress,penetrationFrames:0,maxSurfaceInset:0};entry.frames++;entry.first=Math.min(entry.first,row.progress);entry.last=Math.max(entry.last,row.progress);entry.penetrationFrames+=Number(row.classification==='intermediate-sweep-penetration');entry.maxSurfaceInset=Math.max(entry.maxSurfaceInset,row.maxSurfaceInset);}
console.log(JSON.stringify({passed:report.passed,poses,nominalPenetrations:report.nominalPenetrations,intermediatePenetrations:penetrations.length,byNode,report:new URL('seam-sweep-audit.json',out).pathname},null,2));
// Sanity check the classifier: a triangle inside the seam must intersect; a
// coplanar triangle on the top surface must not count as interior penetration.
assert(area(clip([new THREE.Vector3(-.1,0,-.1),new THREE.Vector3(.1,0,-.1),new THREE.Vector3(0,0,.1)],inner))>0);
assert.equal(area(clip([new THREE.Vector3(-.1,seamBox.max.y,-.1),new THREE.Vector3(.1,seamBox.max.y,-.1),new THREE.Vector3(0,seamBox.max.y,.1)],inner)),0);
if(!report.passed)process.exitCode=1;
