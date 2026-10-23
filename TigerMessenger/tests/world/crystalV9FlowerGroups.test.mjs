import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
globalThis.location={search:'?crystalV9=2'};
const currentURL=new URL('../../src/world/crystalV9.js',import.meta.url);
const backupURL=new URL('../../artifacts/pipeline/greg-lake-character-detail-20261008/v9-flower-groups-before/src/world/crystalV9.js',import.meta.url);
const beforeSource=readFileSync(backupURL,'utf8').replace(/from\s*(['"])(\.[^'"]+)\1/g,(_,quote,path)=>`from '${new URL(path,currentURL).href}'`).replace("from 'three'",`from '${import.meta.resolve('three')}'`);
const before=await import(`data:text/javascript;base64,${Buffer.from(beforeSource).toString('base64')}`);
const after=await import(currentURL.href);
function city(){return{crystals:Array.from({length:12},(_,i)=>{const group=new T.Group();group.scale.setScalar(.9+i*.013);return{group,dir:new T.Vector3(.4,.8,.1).normalize()};})};}
const A=city(),B=city();before.installCrystalV9Towers(A);after.installCrystalV9Towers(B);
const collect=(c,name)=>{const list=[];for(const r of c.crystals)r.group.traverse(o=>{if(o.name===name)list.push(o);});return list;};
const old=collect(A,'v9-coral-flower-canopy'),fresh=collect(B,'v9-coral-flower-canopy');
const materialTriangles=g=>{
 const result=[[],[],[],[]],idx=g.index;
 for(const group of g.groups)for(let i=group.start;i<group.start+group.count;i+=3)result[group.materialIndex].push([idx.getX(i),idx.getX(i+1),idx.getX(i+2)]);
 return result;
};
test('48 real factory canopies retain exact ordered triangles per material with four submissions each',()=>{
 assert.equal(fresh.length,48);assert.equal(old.length,48);let oldGroups=0,newGroups=0;
 for(let i=0;i<48;i++){
  const a=old[i],b=fresh[i];assert.equal(a.geometry.index.count,b.geometry.index.count);assert.equal(a.geometry.groups.length,288);assert.equal(b.geometry.groups.length,4);
  assert.deepEqual(materialTriangles(b.geometry),materialTriangles(a.geometry),'same material, vertex indices, winding, multiplicity and stable order');
  for(const name of Object.keys(a.geometry.attributes))assert.deepEqual(b.geometry.attributes[name].array,a.geometry.attributes[name].array,`${name} bytes remain exact`);
  for(let m=0;m<4;m++)for(const key of ['side','transparent','opacity','depthWrite','depthTest','type'])assert.equal(b.material[m][key],a.material[m][key]);
  assert.deepEqual(b.material.map(m=>m.color.toArray()),a.material.map(m=>m.color.toArray()));
  assert.deepEqual(b.position.toArray(),a.position.toArray());assert.deepEqual(b.quaternion.toArray(),a.quaternion.toArray());assert.deepEqual(b.scale.toArray(),a.scale.toArray());
  let end=0;for(const group of b.geometry.groups){assert.equal(group.start,end);assert.equal(group.count%3,0);end+=group.count;}assert.equal(end,b.geometry.index.count);
  oldGroups+=a.geometry.groups.length;newGroups+=b.geometry.groups.length;
 }
 assert.equal(oldGroups,13824);assert.equal(newGroups,192);console.log('V9 canopy group submissions',JSON.stringify({old:oldGroups,after:newGroups,saved:oldGroups-newGroups}));
});
test('leaf veins and stems remain geometrically identical',()=>{
 for(const name of ['v9-petal-vein','v9-organic-stem']){
  const a=collect(A,name),b=collect(B,name);assert.equal(a.length,b.length);assert.ok(a.length>0);
  for(let i=0;i<a.length;i++){assert.deepEqual(b[i].geometry.attributes.position.array,a[i].geometry.attributes.position.array);assert.deepEqual(b[i].position.toArray(),a[i].position.toArray());assert.deepEqual(b[i].quaternion.toArray(),a[i].quaternion.toArray());}
 }
});
