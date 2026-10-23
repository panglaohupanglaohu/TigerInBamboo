import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
globalThis.location={search:'?bookshopRaise=0'};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
const {installBookshopJakubPass}=await import('../../src/world/bookshopJakubPass.js');
const {bookshopTownPose,townSurfacePoint}=await import('../../src/world/bookshopTownSite.js');
test('Jakub pass dresses the town additively and keeps clear of existing rails',()=>{
  const R=160,scene=new T.Scene(),root=new T.Group();root.name='bookshop-steampunk-robots';
  const pose=bookshopTownPose(R);root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);scene.add(root);
  const ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:0x97978b}));ground.name='bookshop-spherical-ground';root.add(ground);
  // a raised rail running across the wooded rear slope
  const rail=new T.Mesh(new T.BoxGeometry(160,.4,1.4,80,1,1),new T.MeshBasicMaterial());rail.position.copy(townSurfacePoint(root,0,-80,R,1.1));root.add(rail);
  const colliders=[];scene.updateMatrixWorld(true);
  const api=installBookshopJakubPass({scene,root,R,colliders});
  assert.ok(api.stats.trees>40,'trees '+api.stats.trees);assert.ok(api.stats.lamps>10);assert.ok(api.stats.crates>5);
  const trunks=api.group.getObjectByName('jakub-tree-trunks'),m=new T.Matrix4(),p=new T.Vector3(),G=R+.9;
  for(let i=0;i<trunks.count;i++){trunks.getMatrixAt(i,m);p.setFromMatrixPosition(m);const z=p.z*G/(p.y+G);const x=p.x*G/(p.y+G);assert.ok(Math.abs(z+80)>1.5,'tree on rail at z='+z+' x='+x+' h='+(p.length()-G));}
  assert.equal(ground.material.color.getHex(),0xa99c83,'warm ground');
  assert.ok(colliders.every(c=>c.kind==='bookshop-jakub-tree'));
  assert.equal(installBookshopJakubPass({scene,root,R}),api,'idempotent');
  api.remove();
  assert.equal(ground.material.color.getHex(),0x97978b,'restored');assert.equal(colliders.length,0);assert.equal(api.group.parent,null);
});
