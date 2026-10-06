import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {coastalStackGeometry} from '../../src/world/seaStackCoastalGeometry.js';
import {plantSeaStackTerraces} from '../../src/world/seaStackVegetation.js';
test('turf and scrub stay supported by approved upward rock surfaces without changing rock geometry',()=>{
 for(let seed=0;seed<12;seed++){
 const rock=new THREE.Mesh(coastalStackGeometry(12,48,seed),new THREE.MeshBasicMaterial());rock.userData.seaStack={height:48};
 const original=Array.from(rock.geometry.attributes.position.array);const roots=plantSeaStackTerraces(rock);rock.updateMatrixWorld(true);
 assert.deepEqual(Array.from(rock.geometry.attributes.position.array),original);
 const ray=new THREE.Raycaster(),turf=rock.getObjectByName('sea-stack-terrace-turf').geometry.attributes.position;
 assert.ok(turf.count>0);assert.ok(roots.length>0);
 for(let i=0;i<turf.count;i+=3){const c=new THREE.Vector3();for(let j=0;j<3;j++)c.add(new THREE.Vector3().fromBufferAttribute(turf,i+j));c.divideScalar(3);ray.set(c.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0));ray.far=2;const hit=ray.intersectObject(rock,false)[0];assert.ok(hit&&Math.abs(c.y-hit.point.y-.045)<1e-4);assert.ok(hit.face.normal.y>=.86);}
 const shrubs=rock.getObjectByName('sea-stack-terrace-shrubs'),m=new THREE.Matrix4();
 for(let n=0;n<shrubs.count;n++){shrubs.getMatrixAt(n,m);for(let angle=0;angle<Math.PI*2;angle+=Math.PI/4){const v=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)).applyMatrix4(m);ray.set(v.clone().add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0));ray.far=2;const hit=ray.intersectObject(rock,false)[0];assert.ok(hit&&hit.face.normal.y>=.85,'scrub footprint must be supported');}}
 for(const root of roots){ray.set(new THREE.Vector3(...root).add(new THREE.Vector3(0,1,0)),new THREE.Vector3(0,-1,0));ray.far=2;const hit=ray.intersectObject(rock,false)[0];assert.ok(hit&&Math.abs(root[1]-hit.point.y)<1e-4);}
 }
});
