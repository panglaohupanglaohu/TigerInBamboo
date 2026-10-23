import assert from 'node:assert/strict';
import * as T from 'three';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas,GlobalFonts}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
GlobalFonts.registerFromPath('/System/Library/Fonts/Supplemental/Songti.ttc','Songti SC');
const element=name=>{const c=createCanvas(1024,1024);c.style={};c.addEventListener=()=>{};c.removeEventListener=()=>{};return c;};
globalThis.document={createElement:element,createElementNS:element,getElementById:()=>null,querySelector:()=>null};globalThis.location={search:''};globalThis.window={location,addEventListener(){}};
const {createBookshopFreighterHull,createLeeBaiNameTexture}=await import('../../src/world/bookshopFreighterHull.js');
const {buildBookshopFactoryBase}=await import('../../src/world/bookshopFactoryBase.js');
const {bookshopTownPose}=await import('../../src/world/bookshopTownSite.js');
const root=new T.Group(),pose=bookshopTownPose(160);root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);
const started=performance.now();buildBookshopFactoryBase({root,districts:[],R:160,colliders:[]});
const buildMs=performance.now()-started;
const ship=root.getObjectByName('bookshop-steam-parts-freighter'),hull=ship.getObjectByName('freighter-solid-deep-hull'),deck=ship.getObjectByName('freighter-deck-equipment');
const records=deck.userData.hullFittings.records,localHull=new T.Mesh(hull.geometry,new T.MeshBasicMaterial());localHull.updateMatrixWorld();
const ray=new T.Raycaster(),stats={};
const gap=(v,side)=>{ray.set(new T.Vector3(side*10,v.y,v.z),new T.Vector3(-side,0,0));const hit=ray.intersectObject(localHull)[0];assert.ok(hit);return (v.x-hit.point.x)*side*hit.face.normal.x*side;};
for(const r of records){
 const p=new T.Vector3().fromArray(r.centre),n=new T.Vector3().fromArray(r.normal),contact=new T.Vector3().fromArray(r.point);
 assert.ok(n.x*r.side>0);assert.ok(p.clone().sub(contact).dot(n)>0);
 const samples=[];
 if(r.kind==='rivet'){
  const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),n);
  for(let i=0;i<12;i++)for(const y of[-r.height/2,r.height/2])samples.push(new T.Vector3(r.radius*Math.cos(i*Math.PI/6),y,r.radius*Math.sin(i*Math.PI/6)).applyQuaternion(q).add(p));
 }else if(r.kind==='porthole'){
  const q=new T.Quaternion().fromArray(r.quaternion);
  for(let i=0;i<32;i++)for(const z of[-.035,.035])samples.push(new T.Vector3(.18*Math.cos(i*Math.PI/16),.18*Math.sin(i*Math.PI/16),z).applyQuaternion(q).add(p));
  for(const x of[-.14,.14])for(const y of[-.14,.14])for(const z of[-.029,-.011])samples.push(new T.Vector3(x,y,z).applyQuaternion(q).add(p));
 }else{samples.push(p.clone().addScaledVector(n,-r.radius),p.clone().addScaledVector(n,r.radius));}
 const st=stats[r.kind] ||= {count:0,minGap:Infinity,maxGap:-Infinity};st.count++;
 for(const v of samples){const g=gap(v,r.side);st.minGap=Math.min(st.minGap,g);st.maxGap=Math.max(st.maxGap,g);}
}
// Chords between sampled rail centres must also seat near the curved shell.
let railMidMin=Infinity,railMidMax=-Infinity;
for(let i=1;i<records.length;i++){const a=records[i-1],b=records[i];if(a.kind!=='rub-rail'||b.kind!=='rub-rail'||a.side!==b.side||Math.abs(a.point[1]-b.point[1])>.01)continue;
 const pa=new T.Vector3().fromArray(a.centre),pb=new T.Vector3().fromArray(b.centre),axis=pb.clone().sub(pa).normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),axis);
 for(const t of[0,.25,.5,.75,1])for(let j=0;j<12;j++){const v=new T.Vector3(.065*Math.cos(j*Math.PI/6),0,.065*Math.sin(j*Math.PI/6)).applyQuaternion(q).add(pa.clone().lerp(pb,t)),g=gap(v,a.side);railMidMin=Math.min(railMidMin,g);railMidMax=Math.max(railMidMax,g);}

}
assert.equal(stats['rub-rail'].count,252);assert.equal(stats.porthole.count,18);assert.equal(stats.rivet.count,104);
assert.ok(stats.rivet.minGap>-.006&&stats.rivet.maxGap<.05);assert.ok(stats.porthole.minGap>-.01&&stats.porthole.maxGap<.12);assert.ok(railMidMin>0&&railMidMax<.15);
assert.equal(ship.userData.hullName.chinese,'年');assert.equal(ship.userData.hullName.english,'LeeBai');
const snapshots=[];for(const t of[0,5,10,20]){root.userData.update(.1,t);snapshots.push({t,position:ship.position.toArray(),scale:ship.scale.toArray()});}
console.log(JSON.stringify({productionShip:ship.name,buildMs,actualHullTriangles:hull.geometry.index.count/3,stats,railMidMin,railMidMax,mergedDeckMeshes:deck.children.filter(o=>o.isMesh).length,snapshots,GPU:'not checked; controller unavailable'},null,2));
