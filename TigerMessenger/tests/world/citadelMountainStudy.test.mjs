import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {refineRockFaces,cragGeometry} from '../../src/world/citadel/mountainRockGeometry.js';

test('rock face detail preserves perimeter, source attributes and protected faces',()=>{
 const source=new THREE.BufferGeometry();source.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,12,0,0,0,12,0],3));
 source.setAttribute('terrainTile',new THREE.Float32BufferAttribute([2,2,2],1));source.computeVertexNormals();
 const saved=source.attributes.position.array.slice(),refined=refineRockFaces(source,{maxEdge:3,amplitude:.65});
 assert.deepEqual(source.attributes.position.array,saved);assert(refined.attributes.position.count>3);
 const p=refined.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert(Number.isFinite(x+y+z));assert(Math.abs(z)<=.65001);
  if(x<1e-5||y<1e-5||Math.abs(x+y-12)<1e-5)assert(Math.abs(z)<1e-5);
  assert.equal(refined.attributes.terrainTile.getX(i),2);
 }
 const protectedFace=refineRockFaces(source,{selectTriangle:()=>false});
 assert.deepEqual(protectedFace.attributes.position.array,saved);
 assert.deepEqual(refined.attributes.position.array,refineRockFaces(source,{maxEdge:3,amplitude:.65}).attributes.position.array);
});

test('fractured blocks remain closed and outward-facing over varied deterministic seeds',()=>{
 for(let seed=0;seed<20;seed++){
  const g=cragGeometry(seed),p=g.attributes.position,index=g.index,edges=new Map();let volume=0;
  for(let i=0;i<index.count;i+=3){
   const ids=[0,1,2].map(k=>index.getX(i+k));
   const [a,b,c]=ids.map(id=>new THREE.Vector3().fromBufferAttribute(p,id));
   volume+=a.dot(b.clone().cross(c))/6;
   assert(b.clone().sub(a).cross(c.clone().sub(a)).length()>1e-8);
   for(let j=0;j<3;j++){const key=[ids[j],ids[(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert(volume>0);assert([...edges.values()].every(n=>n===2));
  assert.deepEqual(p.array,cragGeometry(seed).attributes.position.array);
 }
});

import {raiseCitadelMountainCoastRail} from '../../src/world/citadel/mountainRailCoast.js';
import {citadelCoastalFrame} from '../../src/world/citadel/coastalTramRoute.js';
import {officialOceanLevelAt} from '../../src/world/waterV8/officialOcean.js';
test('rear-coast rail shares a dry radial floor while remote track and high rails stay fixed',()=>{
 const frame=citadelCoastalFrame(),low=new THREE.Vector3(65,-64,-49).applyMatrix4(frame).setLength(160.3),high=low.clone().setLength(172),remote=new THREE.Vector3(-160,0,0);
 const originalHigh=high.clone(),originalRemote=remote.clone(),direction=low.clone().normalize();
 raiseCitadelMountainCoastRail([low,high,remote],160);
 assert(low.length()>=160+officialOceanLevelAt(low)+.64);assert(low.clone().normalize().distanceTo(direction)<1e-12);
 assert(high.distanceTo(originalHigh)<1e-12);assert(remote.distanceTo(originalRemote)<1e-12);
});
