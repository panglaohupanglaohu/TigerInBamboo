import * as THREE from 'three';
import {MOEBIUS_PALETTE as P} from './moebiusPalette.js';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';

// A small maintenance shelf, not a new settlement or an interactive water source.
// All authored dimensions are swamp-inner local; shipped placement scale is .5.
export function installSwampGregHabitation(swamp, {enabled = true} = {}) {
  if (!enabled || new URLSearchParams(globalThis.location?.search || '').get('gregLakeHabitation') === '0') return null;
  if (swamp.userData.gregHabitation) return swamp.userData.gregHabitation;
  const plan = swamp.userData.gregSpatialPlan, constraints = createSwampLivingPathConstraints(swamp);
  if (!plan || !constraints) return null;
  swamp.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster(), candidates = [], rejected = [];
  const top = plan.levels[0], radius = top.radius / plan.worldScale;
  // These are the two existing upper-bank corbels, beyond the full walking slab.
  for (const angle of [.14, .35]) {
    const position = new THREE.Vector3(Math.cos(angle) * (radius + 2.8), top.innerY - .62, Math.sin(angle) * (radius + 2.8));
    const envelope = {position: position.toArray(), radius: .6, height: 5.1};
    const allowance = constraints.inspectPlant(envelope);
    if (!allowance.allowed) { rejected.push({angle, reasons: allowance.reasons}); continue; }
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const support = [];
    for (const [x, z] of [[0, 0], [-.5, -.28], [-.5, .28], [.5, -.28], [.5, .28]]) {
      const foot = position.clone().addScaledVector(tangent, x).addScaledVector(radial, z);
      const origin = swamp.localToWorld(foot.clone().add(new THREE.Vector3(0, .3, 0)));
      const down = new THREE.Vector3(0, -1, 0).transformDirection(swamp.matrixWorld);
      ray.set(origin, down); ray.far = .6 * swamp.getWorldScale(new THREE.Vector3()).y;
      const hit = ray.intersectObjects(plan.walkMeshes, false).find(h => h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(down.clone().negate()) > .95);
      const local = hit && swamp.worldToLocal(hit.point.clone());
      if (!local || Math.abs(local.y - foot.y) > .025) break;
      support.push(local.toArray());
    }
    if (support.length === 5) { candidates.push({angle, position, support, envelope}); break; }
    rejected.push({angle, reasons: ['missing-five-point-support']});
  }
  if (!candidates.length) return {ready: false, reason: 'no-supported-clear-service-shelf', rejected};
  const site = candidates[0], root = new THREE.Group(); root.name = 'greg-swamp-dry-service-shelf';
  const pose = new THREE.Object3D(); pose.position.copy(site.position); pose.rotation.y = -site.angle; pose.scale.set(.5, 2.4, .7);
  // Object local X points radially outward, Z follows the bank. This keeps the
  // entire small roof outside the protected path, not merely its anchoring point.
  pose.updateMatrix();
  const positions = [], colors = [], normals = [], parts = [], edges = [];
  function add(geometry, name, color, x, y, z, rz = 0, outline = false) {
    const transform = new THREE.Object3D(); transform.position.set(x, y, z); transform.rotation.z = rz; transform.updateMatrix();
    const matrix = pose.matrix.clone().multiply(transform.matrix);
    const indexed = geometry, g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.attributes.position, n = g.attributes.normal, normal = new THREE.Matrix3().getNormalMatrix(matrix), c = new THREE.Color(color);
    const start = positions.length / 9;
    for (let i = 0; i < p.count; i++) {
      positions.push(...new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix));
      normals.push(...new THREE.Vector3().fromBufferAttribute(n, i).applyMatrix3(normal).normalize()); colors.push(c.r, c.g, c.b);
    }
    if (outline) {
      const e = new THREE.EdgesGeometry(indexed, 35), a = e.attributes.position;
      for (let i = 0; i < a.count; i++) edges.push(...new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(matrix));
      e.dispose();
    }
    parts.push({name, firstTriangle: start, triangleCount: p.count / 3});
    if (g !== indexed) g.dispose(); indexed.dispose();
  }
  const box = (w,h,d,name,color,x,y,z,rz=0,line=false) => add(new THREE.BoxGeometry(w,h,d),name,color,x,y,z,rz,line);
  box(1.02,.12,1.22,'dry-tool-shelf',P.bark,0,.86,0,0,true);
  for (const z of [-.51,.51]) box(.13,1.84,.13,'shelf-upright',P.bark,.32,.92,z);
  box(1.15,.12,1.48,'sloped-rain-cap',P.cream,0,1.94,0,-.09,true);
  box(.14,.55,.9,'rear-tool-board',P.leaf,.35,1.25,0,0,true);
  // Closed sample jars signify dry storage. No claim of filtered drinking water.
  for (const z of [-.3,.25]) {
    add(new THREE.CylinderGeometry(.17,.2,.38,8),'closed-sample-jar',P.glass,-.18,1.1,z);
    add(new THREE.CylinderGeometry(.19,.19,.065,8),'sample-jar-lid',P.brass,-.18,1.322,z);
  }
  box(.05,.62,.055,'folded-water-observation-rule',P.brass,.24,1.3,0);
  for (const y of [1.05,1.19,1.33,1.47]) box(.035,.025,.16,'rule-graduation',P.cream,.205,y,0);
  const geometry = new THREE.BufferGeometry();
  for (const [name, values] of [['position',positions],['normal',normals],['color',colors]]) geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true}));
  mesh.name='greg-dry-service-shelf-batch'; mesh.userData.gregVisualRole='habitation'; mesh.userData.parts=parts; root.add(mesh);
  const inkGeometry = new THREE.BufferGeometry(); inkGeometry.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));
  const ink = new THREE.LineSegments(inkGeometry,new THREE.LineBasicMaterial({color:P.ink,transparent:true,opacity:.65}));
  ink.name='greg-dry-service-structure-lines'; root.add(ink); swamp.add(root);
  const report = {version:1, ready:true, root, frame:'inner-swamp-local', worldScale:plan.worldScale, renderMeshes:2,
    site: {...site,envelope:site.envelope,position:site.position.toArray()}, rejected,
    dimensionsWorld:{tableTopAbovePath:(.92*2.4-.62)*plan.worldScale,roofCenterAbovePath:(1.94*2.4-.62)*plan.worldScale,tableWidth:1.02*.5*plan.worldScale,tableDepth:1.22*.7*plan.worldScale},
    function:'dry tool and closed sample storage; observation stop, no dwelling or new interaction',
    clearWidthWorld:constraints.clearWidthWorld, parts,
    dispose() { root.removeFromParent(); root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();}); if(swamp.userData.gregHabitation===report)delete swamp.userData.gregHabitation; }
  };
  swamp.userData.gregHabitation=report; return report;
}
