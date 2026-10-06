import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetCliffTransitRelease} from '../../src/world/citadel/targetCliffTransitRelease.js';
import {createFreightVehicle,FREIGHT_WAGONS} from '../../src/assets/freightTrain.js';
import {productionTransportRobots} from './robotTransportEnvelope.fixture.mjs';

// Finite static opposing-car placements, not a continuous train simulation.
// Includes the widest heavy flatcar and locomotive envelope from production.
async function vehicleEnvelope(){
 const box=new T.Box3();
 for(let wagon=-1;wagon<FREIGHT_WAGONS;wagon++){
  const car=createFreightVehicle({wagon});car.updateMatrixWorld(true);box.union(new T.Box3().setFromObject(car));
  car.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 }
 for(const{box:cargo}of await productionTransportRobots()){
  cargo.translate(new T.Vector3(0,.65-cargo.min.y,0));box.union(cargo);
 }
 return box;
}
function pose(curve,u,body,direction=1){
 const p=curve.getPointAt(u),f=curve.getTangentAt(u).normalize().multiplyScalar(direction),right=p.clone().normalize().cross(f).normalize(),up=f.clone().cross(right).normalize();
 const axes=[f,up,right],localCenter=body.getCenter(new T.Vector3()),size=body.getSize(new T.Vector3()).multiplyScalar(.5);
 const center=p.clone().addScaledVector(up,.12).addScaledVector(f,localCenter.x).addScaledVector(up,localCenter.y).addScaledVector(right,localCenter.z);
 return{center,axes,half:[size.x,size.y,size.z]};
}
function separate(a,b){
 const delta=b.center.clone().sub(a.center),axes=[...a.axes,...b.axes];
 for(const x of a.axes)for(const y of b.axes){const cross=x.clone().cross(y);if(cross.lengthSq()>1e-12)axes.push(cross.normalize());}
 for(const axis of axes){const radius=p=>p.axes.reduce((sum,v,i)=>sum+Math.abs(v.dot(axis))*p.half[i],0);if(Math.abs(delta.dot(axis))>radius(a)+radius(b)+1e-5)return true;}
 return false;
}
test('opposing loaded production envelopes do not overlap on sampled narrowest new bends',async()=>{
 const {curves}=createTargetCliffTransitRelease(),body=await vehicleEnvelope(),count=Math.ceil(curves.red.getLength());
 const blueCount=Math.ceil(curves.blue.getLength()*2);
 const blue=Array.from({length:blueCount+1},(_,i)=>pose(curves.blue,i/blueCount,body,-1));
 for(let i=0;i<=count;i++){
  const red=pose(curves.red,i/count,body);
  for(const b of blue)if(red.center.distanceToSquared(b.center)<100)assert.ok(separate(red,b),'Opposing bodies intersect near red progress '+i/count);
 }
});
