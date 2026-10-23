import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');

test('complete flower patrol and moving anatomy stay within triangle-cleared component volumes',()=>{
 const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner,nav=inner.userData.flowerBoyActivities.navigation;
 const v=new T.Vector3(),base=new T.Matrix4(),mat=new T.Matrix4(),pose=new T.Object3D();let samples=0,points=0,minY=Infinity,maxY=-Infinity;const failures=[],maxLocalRadius=nav.records.map(()=>0);
 for(const r of nav.records){assert.ok(r.valid);assert.ok(nav.solids.boxesClear(r.x,r.z,r.angle,r.boxes));if(r.boat.userData.flowerStem){assert.ok(r.stemGround);assert.ok(r.stemGround.point[1]>10);assert.deepEqual(r.boat.userData.flowerStem.userData.flowerStemAnchor.toArray(),r.stemGround.point);}}
 for(let frame=0;frame<=820;frame++){
  const time=frame/10;root.userData.update(.1,time,{});root.updateMatrixWorld(true);
  for(const r of nav.records){if(time>r.period)continue;samples++;
   const dx=r.boat.position.x-r.x,dz=r.boat.position.z-r.z,cx=Math.cos(r.angle)*dx+Math.sin(r.angle)*dz,cz=-Math.sin(r.angle)*dx+Math.cos(r.angle)*dz;
   pose.position.set(r.x,25.1,r.z);pose.rotation.set(0,-r.angle,0);pose.updateMatrix();base.copy(inner.matrixWorld).multiply(pose.matrix).invert();
   r.boat.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;let visible=true;for(let p=o;p&&p!==r.boat;p=p.parent)if(!p.visible)visible=false;if(!visible)return;
    mat.multiplyMatrices(base,o.matrixWorld);const p=o.geometry.attributes.position;
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mat);points++;maxLocalRadius[r.index]=Math.max(maxLocalRadius[r.index],Math.hypot(v.x-cx,v.z-cz));minY=Math.min(minY,v.y+25.1);maxY=Math.max(maxY,v.y+25.1);if(!r.boxes.some(box=>box.containsPoint(v))){if(failures.length<12)failures.push({time,boat:r.index,mesh:o.name,point:v.toArray()});break;}}
   });
  }
 }
 assert.deepEqual(failures,[]);assert.ok(minY>=nav.solids.low&&maxY<=nav.solids.high);assert.ok(samples>3000);console.log('flower-solid-volumes',JSON.stringify({samples,points,minY,maxY,maxLocalRadius,staticClippedPolygons:nav.solids.polygons.length,boats:nav.records.length}));
});
