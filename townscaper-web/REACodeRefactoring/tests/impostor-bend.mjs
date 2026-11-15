// r53 G4: REACode engine/impostor.js `bend` — tree impostor cards get the anchored centre vertex
// (5 verts / 4 tris, pushed toward the camera by 6% of card size); clouds stay flat.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { ImpostorField } = await import('../src/life/impostor.js');
const baked = { frames: new Array(32).fill(0).map((_, i) => (i % 4 < 2 ? 0 : .125)), size: 1.2, center: new THREE.Vector3(0, .5, 0) };
const tree = new ImpostorField(new THREE.Texture(), baked, 4), cloud = new ImpostorField(new THREE.Texture(), baked, 4, { cloud: true });
const g = tree.mesh?.geometry ?? tree.geometry ?? Object.values(tree).find((v) => v?.isInstancedMesh)?.geometry;
assert.ok(g, 'field exposes its instanced geometry');
assert.equal(g.getAttribute('position').count, 5); assert.equal(g.index.count, 12);
const zs = [...g.getAttribute('position').array].filter((_, i) => i % 3 === 2);
assert.deepEqual(zs, [0, 0, 0, 0, 1], 'only the centre vertex carries the bend flag');
const xy = [...g.getAttribute('position').array].filter((_, i) => i % 3 !== 2);
assert.deepEqual(xy.slice(8), [0, 0], 'centre vertex at card centre → vUv (.5,.5), no texture distortion');
assert.equal(tree.material.uniforms.uBend.value, .06); assert.equal(cloud.material.uniforms.uBend.value, 0);
assert.ok(tree.material.vertexShader.includes('hdir * position.z * uBend'), 'bend along the horizontal camera direction');
console.log('PASS impostor centre bend', { tree: tree.material.uniforms.uBend.value, cloud: cloud.material.uniforms.uBend.value });
