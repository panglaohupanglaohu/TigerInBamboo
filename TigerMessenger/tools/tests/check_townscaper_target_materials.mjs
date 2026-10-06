import assert from 'node:assert/strict';
import {register} from 'node:module';
const threeURL=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const T=await import('three');const {applyTownscaperTargetMaterials}=await import('../../src/world/citadel/townscaperTargetMaterials.js');
const root=new T.Group(),city=new T.Group();city.name='highland-west-city';root.add(city);
const items=['castle-wall','castle-roof','main-gate-stair','citadel-plaza-hero-statue','citadel-trojan-horse','cypress-canopy'];
for(const name of items){const m=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:0xaabbcc}));m.name=name;if(name.includes('statue'))m.material.userData.preserveCitadelMaterial=true;city.add(m);}
const originals=city.children.map(m=>m.material),geometries=city.children.map(m=>m.geometry),positions=city.children.map(m=>m.position.toArray());
globalThis.location={search:''};assert.equal(applyTownscaperTargetMaterials(root),null);assert.deepEqual(city.children.map(m=>m.material),originals);
globalThis.location.search='?citadelTargetArchitecture=1';const result=applyTownscaperTargetMaterials(root);assert.equal(result.meshes,3);
assert.equal(city.children[1].material.color.getHexString(),'e98a51');assert.equal(city.children[2].material.color.getHexString(),'e7d9b7');for(const i of [3,4,5])assert.equal(city.children[i].material,originals[i]);assert.deepEqual(city.children.map(m=>m.geometry),geometries);assert.deepEqual(city.children.map(m=>m.position.toArray()),positions);
console.log(JSON.stringify({passed:true,changed:result.meshes,statueHorseTreesUnchanged:true,geometryUnchanged:true,defaultDisabled:true}));
