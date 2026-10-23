import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
globalThis.location={search:''};
const {replaceLegacyCrystalSpires}=await import('../../src/world/crystalV9.js');
test('old glass spires are hidden and each replaced in place by a v9 crystal cluster of matching height',()=>{
  const scene=new T.Scene(),city=new T.Group();scene.add(city);
  const geo=new T.CylinderGeometry(.12,1,1,5);geo.translate(0,.5,0);
  const inst=new T.InstancedMesh(geo,new T.MeshBasicMaterial(),3);inst.name='moebius-crystal-instances';
  const shell=new T.InstancedMesh(geo,new T.MeshBasicMaterial(),3);city.add(inst,shell);
  const up=new T.Vector3(.3,.9,.2).normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),up);
  for(let i=0;i<3;i++){const m=new T.Matrix4().compose(up.clone().multiplyScalar(160).add(new T.Vector3(i*4,0,0)),q,new T.Vector3(2,12+i,2));inst.setMatrixAt(i,m);shell.setMatrixAt(i,m);}
  const r=replaceLegacyCrystalSpires(scene);
  assert.equal(r.replaced,3);assert.equal(inst.visible,false);assert.equal(shell.visible,false);
  const towers=city.children.filter(o=>o.name==='v9-legacy-spire-replacement');assert.equal(towers.length,3);
  scene.updateMatrixWorld(true);
  for(const [i,t] of towers.entries()){
    const b=new T.Box3().setFromObject(t),h=b.getSize(new T.Vector3()).length();
    assert.ok(t.position.distanceTo(up.clone().multiplyScalar(160).add(new T.Vector3(i*4,0,0)))<1e-3,'stands where the old spire stood '+t.position.toArray()+' vs '+up.clone().multiplyScalar(160).add(new T.Vector3(i*4,0,0)).toArray());
    assert.ok(new T.Vector3(0,1,0).applyQuaternion(t.quaternion).dot(up)>.999,'upright on the planet');
    assert.ok(h>12&&h<30,`similar size ${h}`);
    assert.equal(t.children.filter(c=>c.name==='v9-crystal-prism').length,5);
  }
  assert.equal(replaceLegacyCrystalSpires(scene).replaced,0,'idempotent');
});
