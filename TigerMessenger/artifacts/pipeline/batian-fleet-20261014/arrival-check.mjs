import assert from 'node:assert/strict';
import * as T from 'three';
import {installCrystalColossus} from '../../../src/assets/crystalColossus.js';
import {createBatianFleet} from '../../../src/world/batianFleet.js';
import {batianObstacleRadius} from '../../../src/world/batianDestination.js';
const scene=new T.Scene(),flagship=installCrystalColossus(scene),squad=new T.Group();scene.add(squad);
squad.userData.members=Array.from({length:5},()=>{const m=new T.Group();squad.add(m);return m;});
const dir=new T.Vector3(.7,-.4,.6).normalize();
const surface=new T.Mesh(new T.SphereGeometry(176,32,16));scene.add(surface);
const actual=batianObstacleRadius(surface,dir);const aabb=new T.Box3().setFromObject(surface);assert(actual<=176.001);assert(aabb.max.length()>300);
const fleet=createBatianFleet({scene,flagship,squad,targets:[{id:'bookshop',dir,safeRadius:actual}]});fleet.start('bookshop');let firstShot=null;
for(let i=0;i<2000;i++){fleet.update(.1,i*.1);const s=fleet.snapshot();if(s.shots&&!firstShot){firstShot=s;assert(s.arrival.inRange);assert(s.arrival.distance<60);assert(s.arrival.altitude<=75);}if(['assemble','transit'].includes(s.phase))assert.equal(s.shots,0);}
assert(firstShot);assert.equal(fleet.snapshot().phase,'idle');assert.equal(squad.children.length,5);
console.log(JSON.stringify({obstacleRadius:actual,falseAabbRadius:aabb.max.length(),firstShot:{phase:firstShot.phase,arrival:firstShot.arrival,position:firstShot.flagshipPosition},final:fleet.snapshot().phase}));fleet.dispose();flagship.dispose();
