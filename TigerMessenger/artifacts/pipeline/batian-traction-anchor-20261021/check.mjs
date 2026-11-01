import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as T from 'three';
import {createBatianArsenal} from '../../../src/world/batianArsenal.js';
const scene=new T.Scene(),parent=new T.Group(),craft=new T.Group();scene.add(parent);parent.add(craft);
parent.position.set(7,2,-3);parent.rotation.set(.03,.18,.04);craft.position.set(4,192,12);craft.rotation.set(.06,.25,-.13);
const point=new T.Vector3(12,160,22),arsenal=createBatianArsenal({scene,aircraft:craft});arsenal.fire('traction',point);
const field=scene.getObjectByName('batian-traction-light-field');assert.ok(field);
let disposed=0;field.geometry.addEventListener('dispose',()=>disposed++);
const samples=[];let elapsed=0;const initialMuzzle=craft.localToWorld(new T.Vector3(0,-4.6,0));
for(const [dt,x,angle] of [[0,4,.25],[.25,10,.42],[.5,18,.65],[.75,27,.87],[1.5,34,1.1]]){
 elapsed+=dt;craft.position.x=x;craft.rotation.y=angle;parent.rotation.z+=.025;arsenal.update(dt);field.updateWorldMatrix(true,false);const expected=craft.localToWorld(new T.Vector3(0,-4.6,0));
 const top=field.localToWorld(new T.Vector3(0,.5,0)),bottom=field.localToWorld(new T.Vector3(0,-.5,0));
 const a=top.distanceTo(expected),b=bottom.distanceTo(point);assert.ok(a<1e-9);assert.ok(b<1e-9);samples.push({elapsed,muzzleError:a,groundError:b,sourceDisplacement:expected.distanceTo(initialMuzzle)});
}
assert.equal(field.geometry.parameters.radiusTop,3);assert.equal(field.geometry.parameters.radiusBottom,19);
arsenal.update(2.1);assert.equal(scene.getObjectByName('batian-traction-light-field'),undefined);assert.equal(arsenal.snapshot().activeEffects,0);assert.equal(disposed,1);assert.equal(arsenal.stats.traction,1);arsenal.dispose();
const out={passed:true,scope:'Actual production Three geometry CPU check, not gameplay GPU capture',samples,emitterFollowsMovingRotatedParent:true,groundEndFixed:true,lifetimeSeconds:5,disposedOnce:disposed,effectsAfterExpiry:0};writeFileSync(new URL('verification.json',import.meta.url),JSON.stringify(out,null,2));console.log(JSON.stringify(out));
