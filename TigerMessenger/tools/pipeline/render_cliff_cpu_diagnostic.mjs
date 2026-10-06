// Geometry diagnostic only: painter projection, NOT a game GPU screenshot.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as T from 'three';
import {actualCliffTransitFixture} from '../../tests/world/targetCliffTransitStructure.fixture.mjs';
import {createTargetCityDetailCandidate} from '../../src/world/citadel/targetCityDetailCandidate.js';
const require=createRequire(import.meta.url),{createCanvas}=require(process.env.CITADEL_CANVAS_MODULE||'@napi-rs/canvas');
const f=actualCliffTransitFixture(),c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,fitSunShadow:false});f.castle.add(c.root);f.scene.updateMatrixWorld(true);
const reference=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r47-arches-clouds-target-front-plants-terrain.json',import.meta.url))).camera;
const W=1600,H=Math.round(W/reference.aspect),camera=new T.PerspectiveCamera(reference.fov,W/H,.1,1000);camera.position.fromArray(reference.position);camera.quaternion.fromArray(reference.quaternion);camera.updateMatrixWorld(true);
const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');ctx.fillStyle='#88c7e7';ctx.fillRect(0,0,W,H);
const polys=[],model=new T.Matrix4(),instance=new T.Matrix4(),normal=new T.Vector3(),sun=new T.Vector3(.5,1,.3).normalize(),v=new T.Vector3();
function collect(o,matrix){
 const g=o.geometry,p=g.attributes.position,idx=g.index,vc=g.attributes.color;
 if(!p)return; const materials=Array.isArray(o.material)?o.material:[o.material];
 for(let i=0;i<(idx?.count??p.count);i+=3){
  const indices=[0,1,2].map(j=>idx?idx.getX(i+j):i+j),world=indices.map(j=>new T.Vector3().fromBufferAttribute(p,j).applyMatrix4(matrix));
  const cameraPoints=world.map(q=>q.clone().applyMatrix4(camera.matrixWorldInverse));if(cameraPoints.some(q=>q.z>-.1))continue;
  const screen=world.map(q=>q.clone().project(camera));if(screen.every(q=>q.x< -1)||screen.every(q=>q.x>1)||screen.every(q=>q.y< -1)||screen.every(q=>q.y>1))continue;
  const group=g.groups.find(group=>i>=group.start&&i<group.start+group.count),mat=materials[group?.materialIndex||0];if(!mat||mat.visible===false||mat.opacity<.2)continue;
  const color=mat.color?.clone()||new T.Color('#d7cfbd');if(mat.vertexColors&&vc){const avg=new T.Color(0,0,0);for(const j of indices){avg.r+=vc.getX(j)/3;avg.g+=vc.getY(j)/3;avg.b+=vc.getZ(j)/3;}color.multiply(avg);}
  new T.Triangle(...world).getNormal(normal);const shade=mat.isMeshBasicMaterial?1:.58+.42*Math.max(0,normal.dot(sun));color.multiplyScalar(shade);polys.push({z:cameraPoints.reduce((n,q)=>n+q.z,0)/3,xy:screen.map(q=>[(q.x+1)*W/2,(1-q.y)*H/2]),color:color.getStyle()});
 }
}
f.scene.traverse(o=>{if(!o.isMesh)return;for(let a=o;a;a=a.parent)if(!a.visible)return;if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,instance);collect(o,model.multiplyMatrices(o.matrixWorld,instance));}}else collect(o,o.matrixWorld);});
polys.sort((a,b)=>a.z-b.z);for(const p of polys){ctx.beginPath();ctx.moveTo(...p.xy[0]);ctx.lineTo(...p.xy[1]);ctx.lineTo(...p.xy[2]);ctx.closePath();ctx.fillStyle=p.color;ctx.fill();}
ctx.fillStyle='rgba(12,28,36,.9)';ctx.fillRect(0,H-35,W,35);ctx.fillStyle='white';ctx.font='18px sans-serif';ctx.fillText('CPU geometry projection — not gameplay / no GPU, shadows, textures or visual score',16,H-12);
const output=new URL('../../artifacts/pipeline/citadel-rail-cliffs-20261006/integrated-cpu-geometry.png',import.meta.url);fs.writeFileSync(output,canvas.toBuffer('image/png'));console.log(JSON.stringify({output:output.pathname,triangles:polys.length,structure:c.report.cliffTransit.performance,issues:c.report.cliffTransit.issues}));c.dispose();f.dispose();
