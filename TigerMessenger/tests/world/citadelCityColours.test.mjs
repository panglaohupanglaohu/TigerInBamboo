import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cityColourRole,applyCityColourStudy} from '../../src/world/citadel/cityColourStudy.js';
function city(){const root=new THREE.Group();root.name='castleContainer';const district=new THREE.Group();district.name='highland-west-city';root.add(district);return {root,district};}
test('merged cathedral walls stay limestone when their sources include window openings and stone roofs',()=>{
 const {district}=city(),m=new THREE.MeshStandardMaterial({color:0xd4c6a3}),o=new THREE.Mesh(new THREE.BoxGeometry(),m);o.name='target-castle-exterior';o.userData.materialSourceNames=['left-tower-wfc-window','left-tower-wfc-arch','left-tower-roof','left-tower-side-panel'];district.add(o);
 assert.deepEqual(cityColourRole(o,m),{district:'new',role:'stone'});
 o.userData.materialSourceNames=['holy-main-cathedral-dome','holy-dome-lantern-cap'];assert.equal(cityColourRole(o,m).role,'lead');
});
test('palette clones shared materials without tinting terrain or changing geometry, and is idempotent',()=>{
 const {root,district}=city(),shared=new THREE.MeshStandardMaterial({color:0xd4c6a3}),g=new THREE.BoxGeometry();
 const building=new THREE.Mesh(g,shared);building.name='new-city-wall';district.add(building);
 const rock=new THREE.Mesh(g,shared);rock.name='new-city-rock-shoulder';district.add(rock);
 const initial=shared.color.getHex();applyCityColourStudy(root);const painted=building.material;
 assert.notEqual(painted,shared);assert.equal(rock.material,shared);assert.equal(shared.color.getHex(),initial);assert.equal(building.geometry,g);
 applyCityColourStudy(root);assert.equal(building.material,painted);
});
