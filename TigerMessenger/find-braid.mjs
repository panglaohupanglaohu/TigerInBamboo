import * as THREE from 'three';
import { buildHumanCourier } from './src/assets/characters/humanCourier.js';
const root = buildHumanCourier({});
root.updateMatrixWorld(true);
var meshes = [];
root.traverse(function (o) { if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
var report = [];
for (var m = 0; m < meshes.length; m++) {
  var o = meshes[m];
  var box = new THREE.Box3().setFromObject(o);
  var size = new THREE.Vector3(); box.getSize(size);
  var maxe = Math.max(size.x, size.y, size.z);
  report.push({ name: o.name, parent: o.parent ? o.parent.name : '?', ext: [+size.x.toFixed(2), +size.y.toFixed(2), +size.z.toFixed(2)], verts: o.geometry.attributes.position.count });
}
report.sort(function (a, b) { return Math.max(...b.ext) - Math.max(...a.ext); });
console.log('total meshes:', meshes.length);
console.log('top-12 by extent:');
for (var r of report.slice(0, 12)) console.log(JSON.stringify(r));
