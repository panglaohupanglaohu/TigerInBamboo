import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {clipRearShipVolume}from'../../src/world/citadel/targetRearShipVolumeClip.js';
import {clipShipHeadlandGeometry}from'../../src/world/citadel/targetShipHeadlandClip.js';
test('near cut-plane corners remain distinct at output precision across tiny chart transforms',()=>{
 for(const cx of [17,18,19])for(const cz of [-11,-10,-9])for(const shift of [1e-8,-1e-8,1e-6,-1e-6,1e-5,-1e-5,1e-4,-1e-4]){
  const source=new T.BoxGeometry(2,2,2).translate(cx,0,cz),before=source.attributes.position.array.slice(),toChart=new T.Matrix4().makeTranslation(shift,0,-shift);
  const result=clipRearShipVolume(source,{toChart});assert.equal(result.report.closedCutContours,true,`cut ${cx},${cz},${shift}`);assert.equal(result.report.openCapEndpoints,0);assert.deepEqual(source.attributes.position.array,before);
  const repeated=clipRearShipVolume(source,{toChart});assert.deepEqual(repeated.geometry.attributes.position.array,result.geometry.attributes.position.array);result.geometry.dispose();repeated.geometry.dispose();source.dispose();
 }
});
test('formal west-then-rear clipping order closes under the same near-corner transform',()=>{
 const source=new T.BoxGeometry(2,2,2).translate(17,0,-9),toChart=new T.Matrix4().makeTranslation(1e-5,0,-1e-5);
 const west=clipShipHeadlandGeometry(source,{toChart,castleMatrix:new T.Matrix4(),seaAt:()=>-5,cutX:-91,keepX:-90});
 const rear=clipRearShipVolume(west.geometry,{toChart});assert.equal(rear.report.closedCutContours,true);assert.equal(rear.report.openCapEndpoints,0);assert.ok(rear.report.capTriangles>0);
});
test('genuinely open input reports an unclosed contour without crashing its graph walk',()=>{
 const source=new T.PlaneGeometry(4,4);source.rotateX(-Math.PI/2);source.translate(18,0,-10);
 const result=clipRearShipVolume(source,{toChart:new T.Matrix4()});assert.equal(result.report.closedCutContours,false);assert.ok(result.report.openCapEndpoints>0);
});
test('rear exterior is physically removed, both cut planes capped, fixed corner normals retained',()=>{const g=new T.BoxGeometry(60,40,60).translate(20,0,-10),copy=g.attributes.position.array.slice(),r=clipRearShipVolume(g,{toChart:new T.Matrix4()}),p=r.geometry.attributes.position;assert.ok(r.report.removedTriangles>0);assert.ok(r.report.capTriangles>0);assert.equal(r.report.openCapEndpoints,0);assert.deepEqual(g.attributes.position.array,copy);const edges=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(4)).join(',');for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2),center=a.clone().add(b).add(c).multiplyScalar(1/3);assert.ok(!(center.x>18.00001&&center.z< -10.00001));assert.ok(new T.Triangle(a,b,c).getArea()>1e-9);for(let k=0;k<3;k++){const a=key(i+k),b=key(i+(k+1)%3),id=a<b?a+'|'+b:b+'|'+a;edges.set(id,(edges.get(id)||0)+1);}}assert.ok([...edges.values()].every(v=>v===2));const n=r.geometry.attributes.normal;assert.ok([...n.array].every(Number.isFinite));assert.deepEqual(clipRearShipVolume(g,{toChart:new T.Matrix4()}).geometry.attributes.position.array,p.array);});

function authoredOpenSkirt(){
 const box=new T.BoxGeometry(60,40,60).translate(20,0,-10).toNonIndexed(),p=box.attributes.position,positions=[],normals=[],bottom=[];
 for(let i=0;i<p.count;i+=3){if([0,1,2].every(k=>p.getY(i+k)===-20))continue;for(let k=0;k<3;k++){positions.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));normals.push(...new T.Vector3().fromBufferAttribute(box.attributes.normal,i+k));bottom.push(p.getY(i+k)===-20?1:0);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('shoreBoundaryBottom',new T.Float32BufferAttribute(bottom,1));g.userData={gridMethod:'primary-grid+dual-grid+alternating-triangles',sideSkirt:true,flatBase:false};box.dispose();return g;
}
test('authored WFC open underside gets actual lower cut-wall edges, while unknown open shells are rejected',()=>{
 const g=authoredOpenSkirt(),saved=g.attributes.position.array.slice(),result=clipRearShipVolume(g,{toChart:new T.Matrix4()});
 assert.equal(result.report.closedCutContours,true);assert.equal(result.report.openCapEndpoints,0);assert.equal(result.report.authoredSkirtPanels,2);assert.equal(result.report.skirtBase,-20.25);assert.ok(result.report.capTriangles>0);assert.deepEqual(g.attributes.position.array,saved);
 const p=result.geometry.attributes.position;let baseVertices=0;for(let i=0;i<p.count;i++){if(Math.abs(p.getY(i)+20.25)<1e-6){baseVertices++;assert.ok(p.getX(i)===18||p.getZ(i)===-10,'new lower edges lie on exact cut planes');}}
 assert.ok(baseVertices>=6);assert.deepEqual(clipRearShipVolume(g,{toChart:new T.Matrix4()}).geometry.attributes.position.array,p.array);
 const unknown=g.clone();unknown.userData={};assert.equal(clipRearShipVolume(unknown,{toChart:new T.Matrix4()}).report.closedCutContours,false);
 const plane=new T.PlaneGeometry(4,4).rotateX(-Math.PI/2).translate(18,0,-10);plane.userData={...g.userData};plane.setAttribute('shoreBoundaryBottom',new T.Float32BufferAttribute(new Float32Array(plane.attributes.position.count),1));assert.equal(clipRearShipVolume(plane,{toChart:new T.Matrix4()}).report.closedCutContours,false,'metadata alone cannot authorize an unmeasured skirt base');
});
