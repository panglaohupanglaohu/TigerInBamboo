import assert from 'node:assert/strict';
import * as T from 'three';
import {createBookshopMedicalTrain} from '../../../src/world/bookshopMedicalTrain.js';
const scene=new T.Scene(),base=new T.Group();scene.add(base);base.position.y=160;
const train=new T.Group();base.add(train);train.position.set(0,0,0);base.userData.plazaRescueTrain=train;
const crate=new T.Group();train.add(crate);train.userData.freightCrates=[crate];
base.userData.bookshopMedicalRoute=[new T.Vector3(8,160,0),new T.Vector3(12,162,0),new T.Vector3(18,165,0)];
const actors=Array.from({length:3},(_,id)=>{const m=new T.Group();base.add(m);m.position.set(2+id,0,0);m.userData.bookshopDowned=true;m.userData.bookshopHealth=0;return{id,m,path:[]};});const ids=actors.map(a=>a.m.uuid);
const routeWorld=(a,b)=>[b.clone()];const chart=p=>({x:p.x,z:p.z});const seatActor=a=>{a.m.position.set(a.x,0,a.z);a.m.quaternion.identity();};
const med=createBookshopMedicalTrain({base,actors,routeWorld,chart,seatActor});const stages=new Set();let highestStep=0,firstTreatmentTime=null,firstHealthyTime=null;
for(let i=0;i<2000;i++){const before=train.getWorldPosition(new T.Vector3());med.update(.1);highestStep=Math.max(highestStep,before.distanceTo(train.getWorldPosition(new T.Vector3())));const s=med.snapshot();stages.add(s.stage);assert.ok(s.patients.length<=2);if(s.stage==='treatment'&&firstTreatmentTime===null){firstTreatmentTime=i*.1;assert.equal(s.recovered,0);assert.ok(train.getWorldPosition(new T.Vector3()).distanceTo(base.userData.bookshopMedicalRoute.at(-1))<1e-6);assert.equal(crate.visible,false);}if(s.recovered>0&&firstHealthyTime===null)firstHealthyTime=i*.1;if(s.recovered===3&&s.stage==='idle')break;}
assert.equal(med.snapshot().recovered,3);assert.equal(med.snapshot().trips,2);assert.ok(highestStep<=.24000001);assert.ok(firstHealthyTime-firstTreatmentTime>=17.8);assert.equal(crate.visible,true);assert.equal(train.userData.medicalOwned,false);assert.ok(actors.every((a,i)=>a.m.uuid===ids[i]&&!a.m.userData.bookshopDowned&&a.m.userData.bookshopHealth===100&&!a.m.userData.bookshopMedical));assert.deepEqual([...stages].sort(),['idle','pickup','return','transport','treatment'].sort());med.dispose();
console.log(JSON.stringify({passed:true,scope:'production medical controller CPU lifecycle, not complete game visual acceptance',stages:[...stages],snapshot:med.snapshot(),highestStep,firstTreatmentTime,firstHealthyTime,originalActorUUIDsPreserved:true},null,2));
