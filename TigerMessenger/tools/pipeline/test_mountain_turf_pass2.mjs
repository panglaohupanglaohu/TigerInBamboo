import assert from 'node:assert/strict';
import * as T from '../../vendor/three.module.js';
import {addMountainGrass} from '../../src/world/citadel/mountainGrass.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
import {woodlandCell} from '../../src/world/citadel/mountainWoodland.js';
const root=new T.Group();root.position.y=175;root.updateMatrixWorld(true);
function plane(y){const g=new T.PlaneGeometry(20,20);g.rotateX(-Math.PI/2);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.position.y=y;mesh.updateMatrixWorld(true);return mesh;}
const lower=plane(175),upper=plane(176),tri=new T.Triangle(new T.Vector3(-8,175,-8),new T.Vector3(-8,175,8),new T.Vector3(8,175,-8));
globalThis.location={search:'?citadelTurfPass=2'};
const visible=addMountainGrass(root,[tri],{surfaceIndex:buildMountainSurfaceIndex([lower])});assert(visible.blades>0);assert(visible.firstSurfaceChecked);assert.equal(visible.hiddenBaseRejects,0);
const hidden=addMountainGrass(root,[tri],{surfaceIndex:buildMountainSurfaceIndex([lower,upper])});assert.equal(hidden.blades,0);assert(hidden.hiddenBaseRejects>0);
assert.throws(()=>addMountainGrass(root,[tri]),/requires final surface index/);
let oldTrees=0,newTrees=0;for(let z=0;z<70;z++)for(let x=0;x<70;x++){const old=woodlandCell(x,z,1),next=woodlandCell(x,z,2);assert.equal(old.jitterX,next.jitterX);assert.equal(old.yaw,next.yaw);if(old.eligible&&old.isTree)oldTrees++;if(next.eligible&&next.isTree){newTrees++;assert(next.size>=.45&&next.size<=.68);}}assert(newTrees>oldTrees);
console.log(JSON.stringify({ok:true,visibleBlades:visible.blades,hiddenRejected:hidden.hiddenBaseRejects,oldTrees,newTrees,checks:['radial first surface rejects hidden lower sheet','visible roots supported','missing index explicit failure','fixed-cell coordinates unchanged','bounded intermediate tree scale']}));
