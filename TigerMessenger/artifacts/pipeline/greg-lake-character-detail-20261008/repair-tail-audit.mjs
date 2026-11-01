import * as T from 'three';
import fs from 'node:fs';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../../src/world/moebiusSwamp.js');
const wrap=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=wrap.userData.inner,ship=inner.userData.shipyard.dock,workers=inner.userData.shipyard.workers;
const actors=[];inner.traverse(o=>{if(o.name==='swamp-longtail-monkey'||o.name==='swamp-pink-hanger')actors.push(o)});
wrap.userData.update(1/60,0,{});wrap.updateMatrixWorld(true);
const origin=inner.worldToLocal(workers[0].getWorldPosition(new T.Vector3())),camera=new T.PerspectiveCamera(60,1280/614,.05,300);camera.position.copy(inner.localToWorld(origin.clone().add(new T.Vector3(3,2,4))));camera.lookAt(inner.localToWorld(origin.clone().add(new T.Vector3(0,.2,0))));camera.updateMatrixWorld(true);
function tailPoints(actor){const m=actor.getObjectByName('swamp-monkey-anatomy'),r=actor.userData.monkeyTail,p=m.geometry.attributes.position;return Array.from({length:r.vertexCount},(_,i)=>m.localToWorld(new T.Vector3().fromBufferAttribute(p,r.vertexStart+i)));}
const projected=actors.map((a,i)=>{let points=[];if(a.userData.monkeyTail)points=tailPoints(a);else a.traverse(m=>{if(m.isMesh&&!m.userData.isOutline){const p=m.geometry.attributes.position;for(let j=0;j<p.count;j++)points.push(m.localToWorld(new T.Vector3().fromBufferAttribute(p,j)));}});const b=new T.Box3().setFromPoints(points.map(p=>p.clone().project(camera)));return {index:i,name:a.name,worker:workers.indexOf(a),pose:a.userData.monkeyTail?.pose,innerOrigin:inner.worldToLocal(a.getWorldPosition(new T.Vector3())).toArray(),shipBounds:new T.Box3().setFromPoints(points.map(p=>ship.worldToLocal(p.clone()))),screen:{min:[(b.min.x+1)*640,186+(1-b.max.y)*307],max:[(b.max.x+1)*640,186+(1-b.min.y)*307]}}});
const render=ship.getObjectByName('blender-v6-render'),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0).transformDirection(ship.matrixWorld);
function deckHits(p){ray.set(ship.localToWorld(new T.Vector3(p.x,4,p.z)),down);ray.far=20;const hits=ray.intersectObjects(render.children.filter(m=>!m.isInstancedMesh),false);return hits.map(h=>({y:ship.worldToLocal(h.point.clone()).y,material:h.object.material.name,normal:h.face.normal.y})).filter(h=>h.normal>.5);}
const workerData=[];
for(let index=0;index<2;index++){
 const actor=workers[index],points=tailPoints(actor).map(p=>ship.worldToLocal(p)),foot=ship.worldToLocal(actor.getWorldPosition(new T.Vector3()));
 workerData.push({index,foot:foot.toArray(),tailBounds:new T.Box3().setFromPoints(points),deckAtFoot:deckHits(foot).slice(0,12),tailMinBelowFoot:Math.min(...points.map(p=>p.y-foot.y)),tailSamples:points.filter((_,i)=>i%120===0).map(p=>({point:p.toArray(),deck:deckHits(p).slice(0,5)}))});
}
const result={t:0,cameraCanvas:[1280,614],canvasOffsetTop:186,projected,workerData};
fs.writeFileSync(new URL('./repair-tail-audit.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({projected,workerData:workerData.map(({tailSamples,...x})=>x)},null,2));
const pixels=[];
for(let x=342;x<=410;x+=4)for(let y=746;y<=792;y+=4){
 ray.setFromCamera(new T.Vector2(x/1280*2-1,1-(y-186)/614*2),camera);ray.far=300;
 for(const hit of ray.intersectObject(wrap,true)){
  let visible=true;for(let a=hit.object;a;a=a.parent)if(!a.visible)visible=false;if(!visible)continue;
  const c=hit.object.geometry?.attributes.color,col=c&&hit.face?new T.Color(c.getX(hit.face.a),c.getY(hit.face.a),c.getZ(hit.face.a)):hit.object.material?.color;
  if(!col||!(col.r>col.g*1.12&&col.b>col.g*1.03))continue;
  const chain=[];for(let a=hit.object;a&&a!==inner;a=a.parent)chain.push(a.name||'(unnamed)');
  pixels.push({pixel:[x,y],chain,point:inner.worldToLocal(hit.point.clone()).toArray(),color:col.getHexString()});break;
 }
}
const groups=Object.groupBy(pixels,p=>p.chain.join('/'));const summaries=Object.entries(groups).map(([chain,list])=>({chain,count:list.length,sample:list[0]}));result.ringRayHits=summaries;fs.writeFileSync(new URL('./repair-tail-audit.json',import.meta.url),JSON.stringify(result,null,2));console.log('RING',JSON.stringify(summaries));
