import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyTargetLandscapePalette,CITADEL_TARGET_PALETTE} from '../../src/world/citadel/targetLandscapePalette.js';
const castle=new THREE.Group(),make=(name,material=new THREE.MeshStandardMaterial({color:'#456789'}))=>{const o=new THREE.Mesh(new THREE.BoxGeometry(2,3,4),material);o.name=name;castle.add(o);return o;};
const rock=make('citadel-oskar-grid-mountain-surface');rock.material.onBeforeCompile=s=>{s.uniforms.mtBase={value:new THREE.Color('#778899')};};castle.userData.mountainStudy={surfaces:[rock.name]};
const grass=make('citadel-study-groundcover');grass.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(grass.geometry.attributes.position.count*3).fill(.3),3));
const trees=new THREE.Group();trees.name='citadel-mountain-canopy-candidate';castle.add(trees);const tree=make('tree');tree.material.name='canopy-slate-teal';trees.add(tree);
const statue=make('citadel-plaza-hero-statue'),horse=make('citadel-trojan-horse'),originals=[statue.material,horse.material];const positions=[rock,grass,tree,statue,horse].map(o=>[o,[...o.geometry.attributes.position.array],o.position.clone(),o.quaternion.clone()]);
assert.equal(applyTargetLandscapePalette(castle,{enabled:false}),null);const r=applyTargetLandscapePalette(castle,{enabled:true});assert.deepEqual(r.counts,{rock:1,grass:1,trees:1});assert.equal(applyTargetLandscapePalette(castle,{enabled:true}),r);
for(const[o,array,pos,q]of positions){assert.deepEqual([...o.geometry.attributes.position.array],array);assert.ok(o.position.equals(pos)&&o.quaternion.equals(q));}
assert.equal(statue.material,originals[0]);assert.equal(horse.material,originals[1]);assert.equal(grass.material.color.getHexString(),'ffffff');assert.equal(tree.material.color.getHexString(),CITADEL_TARGET_PALETTE.crown.slice(1));
const s={uniforms:{}};rock.material.onBeforeCompile(s);assert.equal(s.uniforms.mtBase.value.getHexString(),CITADEL_TARGET_PALETTE.rock.slice(1));console.log('Palette: unchanged geometry/transforms, unchanged statue/horse, idempotent, rock shader override and white turf multiplier pass');
