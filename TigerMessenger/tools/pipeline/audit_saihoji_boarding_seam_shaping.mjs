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
const objects=source.nodes.filter(s=>s.mesh!==undefined&&s.sourceId).map(s=>({source:s,node:api.nodes.get(s.sourceId),parts:resources.geometry[s.mesh]})).map(o=>{
  o.dynamic=false;
  for(let n=o.node;n&&n!==boat;n=n.parent)if(animated.has(n.userData.sourceNodeId)){o.dynamic=true;break;}
  return o;
});
// Bounded authoring experiment only. Original candidate module and ship remain unchanged.
seam.geometry.dispose();seam.geometry=new THREE.BoxGeometry(.44,.045,.832-.47);
seam.position.set(1.94,.66,(.47+.832)/2);
const hinge=new THREE.Group();hinge.position.set(1.94,.6825,.47);boat.add(hinge);
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
const samples=[];
for(const pitch of [null,-25*Math.PI/180,25*Math.PI/180]){
  samples.push({variant:'short-fixed',phase:'fully-deployed',pitch,progress:1,seamAngle:0});
  for(let step=0;step<=40;step++)samples.push({variant:'folding-inner',phase:'main-deploy',pitch,progress:step/40,seamAngle:-Math.PI/2});
  for(let step=0;step<=40;step++)samples.push({variant:'folding-inner',phase:'inner-deploy',pitch,progress:1,seamAngle:(-1+step/40)*Math.PI/2});
}
for(const {variant,phase,pitch,progress,seamAngle} of samples){
  api.setBoarding(progress);api.setBoardingPitch(pitch);api.update(0,0);
  if(variant==='short-fixed'){
    boat.add(seam);seam.position.set(1.94,.66,(.47+.832)/2);seam.quaternion.identity();
  }else{
    hinge.add(seam);seam.position.set(0,-.0225,(.832-.47)/2);seam.quaternion.identity();hinge.rotation.x=seamAngle;
  }
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
    if(penetratingTriangles||touchTriangles||containsSeamCenter)rows.push({variant,phase,pitch,progress,seamAngle,dynamic:o.dynamic,node:o.source.sourceId,name:o.source.name,
      classification:penetratingTriangles||containsSeamCenter?'volume-overlap':'surface-contact-only',
      penetratingTriangles,touchTriangles,intersectionArea,maxSurfaceInset,containsSeamCenter,
      objectBoundsInSeamFrame:{min:objectBox.min.toArray(),max:objectBox.max.toArray()}});
  }
}
const penetrations=rows.filter(r=>r.classification==='volume-overlap');
const report={source:source.source,sha256:source.sourceSHA256,seam:{x:[1.72,2.16],y:[.6375,.6825],z:[.47,.832]},
  foldingHinge:[1.94,.6825,.47],sampling:{poses,progressStep:.025,pitches:[null,-25*Math.PI/180,25*Math.PI/180],sourceMeshNodes:objects.length},
  sequence:'Short fixed plate: main fully deployed. Folding plate: inner held -90deg while main moves 0 to 1; main held 1 while inner moves -90deg to 0. Retraction follows these same static configurations in reverse. No source geometry or asset modification.',
  method:'Production V11 pose interpolation; exact source primitive triangles against candidate box interior (10 micrometre inset), contact box (+1 micrometre), plus closed-mesh center containment. All visible source primitives, including static deck/landing/hull and dynamic rails, are checked. Discrete 2.5% samples, not continuous certification.',
  passed:penetrations.length===0,rows};
const out=new URL('../../artifacts/pipeline/saihoji-evacuation-boarding/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('seam-shaping-audit.json',out),JSON.stringify(report,null,2)+'\n');
const summary={};
for(const row of rows){
  const key=row.variant+'/'+row.phase+'/'+row.node;
  const entry=summary[key]??={dynamic:row.dynamic,count:0,penetrations:0,firstProgress:row.progress,lastProgress:row.progress,minAngle:row.seamAngle,maxAngle:row.seamAngle,maxSurfaceInset:0};
  entry.count++;entry.penetrations+=Number(row.classification==='volume-overlap');entry.firstProgress=Math.min(entry.firstProgress,row.progress);entry.lastProgress=Math.max(entry.lastProgress,row.progress);entry.minAngle=Math.min(entry.minAngle,row.seamAngle);entry.maxAngle=Math.max(entry.maxAngle,row.seamAngle);entry.maxSurfaceInset=Math.max(entry.maxSurfaceInset,row.maxSurfaceInset);
}
console.log(JSON.stringify({passed:report.passed,poses,summary,report:new URL('seam-shaping-audit.json',out).pathname},null,2));
assert(area(clip([new THREE.Vector3(-.1,0,-.1),new THREE.Vector3(.1,0,-.1),new THREE.Vector3(0,0,.1)],inner))>0);
assert.equal(area(clip([new THREE.Vector3(-.1,seamBox.max.y,-.1),new THREE.Vector3(.1,seamBox.max.y,-.1),new THREE.Vector3(0,seamBox.max.y,.1)],inner)),0);
if(!report.passed)process.exitCode=1;
