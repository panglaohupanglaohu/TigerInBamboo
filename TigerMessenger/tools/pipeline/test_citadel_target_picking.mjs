import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {nearestCitadelTarget,isCitadelClick} from '../../src/ui/citadelTargetPicking.js';
const scene=new THREE.Scene(),far=new THREE.Group(),near=new THREE.Group(),hidden=new THREE.Group();scene.add(far,near,hidden);
function box(root,z){const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());mesh.position.z=z;root.add(mesh);return mesh;}
box(far,-15);box(near,-6);box(hidden,-3);hidden.visible=false;scene.updateMatrixWorld(true);
const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,0,-1));
const a={id:null,get:()=>far},b={id:'canal-junction',get:()=>near},c={id:'hidden',get:()=>hidden};
assert.equal(nearestCitadelTarget(ray,[a,c,b]).target,b);assert.equal(nearestCitadelTarget(ray,[b,a,c]).target,b);
near.visible=false;assert.equal(nearestCitadelTarget(ray,[a,b,c]).target,a);near.visible=true;
assert(isCitadelClick({button:2,x:100,y:100},{button:2,clientX:102,clientY:101}));assert(!isCitadelClick({button:2,x:100,y:100},{button:2,clientX:130,clientY:100}));assert(!isCitadelClick({button:0,x:100,y:100},{button:2,clientX:100,clientY:100}));
console.log('PASS nearest-instance independent of registration order, hidden ancestors excluded, click/drag/button discrimination');
