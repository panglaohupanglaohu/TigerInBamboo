import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {clipShipHeadlandGeometry} from '../../src/world/citadel/targetShipHeadlandClip.js';
import {finishMountainRockSurface} from '../../src/world/citadel/mountainRockSurfaceFinish.js';
const source=()=>new T.BoxGeometry(30,40,20).translate(-95,0,0);
test('near-corner cut validates Float32 fan faces without losing the original surface',()=>{
 const s=new T.BufferGeometry();s.setAttribute('position',new T.Float32BufferAttribute([-91,0,0,-92,0,0,-90,1,0],3));s.setAttribute('uv',new T.Float32BufferAttribute([.5,0,0,0,1,1],2));s.computeVertexNormals();
 const original=s.attributes.position.array.slice();
 for(const shift of [1e-6,-1e-6,1e-7,-1e-7]){
  const options={seaAt:()=>100,toChart:new T.Matrix4().makeTranslation(shift,0,0)},a=clipShipHeadlandGeometry(s,options),b=clipShipHeadlandGeometry(s,options),p=a.geometry.attributes.position;
  let area=0;for(let i=0;i<p.count;i+=3){const triangle=new T.Triangle(...[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,i+k)));assert.ok(triangle.getArea()>1e-10);area+=triangle.getArea();}
  assert.ok(Math.abs(area-.5)<1e-6,'all nonzero source area must remain');assert.ok(a.report.quantizedCollapsedCutTriangles>0);assert.equal(a.report.movedVertices,0);
  assert.deepEqual(p.array,b.geometry.attributes.position.array);assert.deepEqual(s.attributes.position.array,original);assert.equal(a.geometry.attributes.uv.count,p.count);
  assert.doesNotThrow(()=>finishMountainRockSurface(a.geometry,{enabled:true,relax:false}));a.geometry.dispose();b.geometry.dispose();
 }
 // The finish safety check remains strict: invalid source faces still reject.
 const invalid=new T.BufferGeometry();invalid.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,0,0,1,0,0],3));assert.throws(()=>finishMountainRockSurface(invalid,{enabled:true,relax:false}),/degenerate triangle/);
});
test('actual triangles split at retreat planes, sea side clears finite hull and fixed side remains',()=>{const s=source(),bytes=s.attributes.position.array.slice(),ship=new T.Box3(new T.Vector3(-104,-1,-1),new T.Vector3(-102,1,1));const {geometry:g,report:r}=clipShipHeadlandGeometry(s,{seaAt:()=>-5,shipWorldBoxes:[ship]});assert.ok(r.movedVertices>0);assert.ok(r.afterTriangles>r.beforeTriangles);assert.ok(r.clearanceVerified);assert.deepEqual(s.attributes.position.array,bytes);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);assert.ok(Number.isFinite(y));if(x<=-91+.00001)assert.ok(y<=-9+.0001);if(x>=-90)assert.ok(Math.abs(y)===20||Math.abs(p.getZ(i))===10||x===-80);}assert.ok(r.shipClearances[0].conservativeHullSeparation>3);
 const edges=new Map();const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(4)).join(',');for(let i=0;i<p.count;i+=3)for(let k=0;k<3;k++){const a=key(i+k),b=key(i+(k+1)%3),e=a<b?a+'|'+b:b+'|'+a;edges.set(e,(edges.get(e)||0)+1);}assert.ok([...edges.values()].every(n=>n===2));});
test('actual protected surface refuses removal; missing ships never claims verified',()=>{const s=source(),box=new T.Box3(new T.Vector3(-111,19,-11),new T.Vector3(-79,21,11));const r=clipShipHeadlandGeometry(s,{seaAt:()=>-5,protectedWorldBoxes:[box]});assert.ok(r.report.rejectedProtectedFaces>0);assert.equal(r.report.clearanceVerified,false);assert.ok([...r.geometry.attributes.position.array].every(Number.isFinite));});
test('fixed source corners keep authored smooth normals; new cut normals finite',()=>{
 const s=source(),normal=s.attributes.normal;
 for(let i=0;i<normal.count;i++)normal.setXYZ(i,.2,.9,.3);
 const {geometry:g,report:r}=clipShipHeadlandGeometry(s,{seaAt:()=>-5});
 const p=g.attributes.position,n=g.attributes.normal;let fixed=0;
 for(let i=0;i<p.count;i++)if(p.getX(i)>=-90){assert.equal(n.getX(i),Math.fround(.2));assert.equal(n.getY(i),Math.fround(.9));assert.equal(n.getZ(i),Math.fround(.3));fixed++;}
 assert.ok(fixed>0);assert.ok(r.normalPolicy.changedTriangles>0);assert.ok([...n.array].every(Number.isFinite));
 const replay=clipShipHeadlandGeometry(s,{seaAt:()=>-5});assert.deepEqual(replay.geometry.attributes.normal.array,n.array);
});
test('rear ship cut uses world radial up, preserves public side and deterministically replays',()=>{
 const s=new T.BoxGeometry(120,12,80,12,2,8).translate(60,5,-30),before=s.attributes.position.array.slice(),castle=new T.Matrix4().makeTranslation(0,160,0);
 const options={seaAt:()=>0,castleMatrix:castle,rearRadialCut:true},a=clipShipHeadlandGeometry(s,options),b=clipShipHeadlandGeometry(s,options);
 assert.deepEqual(s.attributes.position.array,before);assert.deepEqual(a.geometry.attributes.position.array,b.geometry.attributes.position.array);
 assert.ok(a.report.movedVertices>0);assert.ok(a.report.normalPolicy.preservedCorners>0);
 const p=a.geometry.attributes.position;assert.ok([...p.array].every(Number.isFinite));assert.ok([...a.geometry.attributes.normal.array].every(Number.isFinite));
 // Public/front side lies outside the explicitly split cut and is byte-stable.
 const originalFront=new Set();for(let i=0;i<s.attributes.position.count;i++)if(s.attributes.position.getZ(i)>=-10)originalFront.add([s.attributes.position.getX(i),s.attributes.position.getY(i),s.attributes.position.getZ(i)].join(','));
 const remaining=new Set();for(let i=0;i<p.count;i++)remaining.add([p.getX(i),p.getY(i),p.getZ(i)].join(','));for(const k of originalFront)assert.ok(remaining.has(k));
 // Fully affected interior is compressed radially, not toward castle-local Y.
 const original=new T.Vector3(60,11,-60),world=original.clone().applyMatrix4(castle),target=world.clone().setLength(128+.05*world.length()).applyMatrix4(castle.clone().invert());
 let nearest=Infinity;for(let i=0;i<p.count;i++)nearest=Math.min(nearest,new T.Vector3().fromBufferAttribute(p,i).distanceTo(target));assert.ok(nearest<1e-4);
 const protectedBox=new T.Box3(new T.Vector3(49,164,-71),new T.Vector3(71,172,-49));const guarded=clipShipHeadlandGeometry(s,{...options,protectedWorldBoxes:[protectedBox]});assert.ok(guarded.report.movedVertices<a.report.movedVertices);
});
