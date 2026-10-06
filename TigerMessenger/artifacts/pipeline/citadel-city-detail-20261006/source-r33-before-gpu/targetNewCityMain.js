import * as THREE from 'three';

// Hand-authored target-v3 architecture; local +Z is the entrance, Y is up.
// No terrain, light, texture, or scene-global material is owned by this factory.
export const TARGET_NEW_CITY_MAIN_PALETTE = Object.freeze({
  stone: '#efdcaf', trim: '#f8e9c8', blue: '#67adc8', blueShade: '#5898b7',
  roof: '#e77c45', roofLight: '#f79855', dome: '#296392', domeLight: '#3473a2',
  domeShade: '#245983', rib: '#739daf', window: '#f8f4dc', glass: '#426477', gold: '#dba957',
});

export function createTargetNewCityMain({ seed = 17, palette = {} } = {}) {
  const colours = { ...TARGET_NEW_CITY_MAIN_PALETTE, ...palette };
  const group = new THREE.Group(); group.name = 'citadel-target-new-city-main';
  group.userData.preserveCitadelMaterials = true;
  group.userData.targetArchitecture = 'new-city-main-v1';
  const geometries = new Set(), materials = new Set(), footprints = [];
  const mats = Object.fromEntries(Object.entries(colours).map(([key, color]) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: key === 'dome' ? .67 : .85, metalness: key === 'gold' ? .2 : 0 });
    material.name = `target-new-city-${key}`;
    material.userData.preserveCitadelMaterials = true;
    material.userData.preserveCitadelMaterial = true;
    materials.add(material); return [key, material];
  }));
  function mesh(name, geometry, material, x = 0, y = 0, z = 0) {
    geometries.add(geometry);
    const m = new THREE.Mesh(geometry, typeof material === 'string' ? mats[material] : material);
    m.name = name; m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    m.userData.preserveCitadelMaterials = true; group.add(m); return m;
  }
  function box(name, w, h, d, x, y, z, mat = 'stone', bevel = .07) {
    const r = Math.min(bevel, w / 6, h / 6, d / 6);
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2 + r); s.lineTo(w / 2 - r, -h / 2 + r);
    s.lineTo(w / 2 - r, h / 2 - r); s.lineTo(-w / 2 + r, h / 2 - r); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 1, steps: 1, curveSegments: 1 });
    g.translate(0, 0, -d / 2 + r); return mesh(name, g, mat, x, y, z);
  }
  function footprint(id, x, z, w, d, floorY, roofY, extra = {}) {
    footprints.push({ id, polygon: [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]], floorY, roofY, ...extra });
  }
  // A hip roof is a closed six-vertex solid with a short ridge, not a box cap.
  function roof(name, x, y, z, w, d, rise = 1.25) {
    const v = [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w * .25, rise, 0], [w * .25, rise, 0]];
    const ids = [0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0, 0, 1, 2, 0, 2, 3];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ids.flatMap(i => v[i]), 3)); g.computeVertexNormals();
    mesh(name, g, 'roof', x, y, z); box(`${name}-eave`, w, .2, d, x, y, z, 'roofLight', .04);
    box(`${name}-ridge`, w * .51, .16, .2, x, y + rise, z, 'roofLight', .06);
  }
  function window(name, x, y, z, yaw = 0, w = .64, h = 1.0) {
    const root = new THREE.Group(); root.name = name; root.position.set(x, y, z); root.rotation.y = yaw; group.add(root);
    // Four raised plaster members leave an inset glass face and sill readable in shadow.
    for (const [tag, bw, bh, px, py] of [['left', .095, h, -w / 2, 0], ['right', .095, h, w / 2, 0], ['top', w + .09, .1, 0, h / 2], ['sill', w + .2, .13, 0, -h / 2]]) {
      const p = box(`${name}-${tag}`, bw, bh, .12, px, py, .035, 'window', .025); group.remove(p); root.add(p);
    }
    const glass = mesh(`${name}-recess`, new THREE.PlaneGeometry(w, h), 'glass'); group.remove(glass); root.add(glass);
    const mullion = box(`${name}-mullion`, .055, h, .065, 0, 0, .04, 'window', .012); group.remove(mullion); root.add(mullion);
  }
  function archWall(name, w, h, depth, z, material = 'stone', radius = 2.05, spring = 4.5) {
    // The outline runs up and around the void from the floor, so the opening
    // contains no invisible door plane, central box or backface plug.
    const floor = 1.2, s = new THREE.Shape();
    s.moveTo(-w / 2, floor); s.lineTo(-w / 2, floor + h); s.lineTo(w / 2, floor + h); s.lineTo(w / 2, floor); s.lineTo(radius, floor); s.lineTo(radius, spring);
    for (let i = 1; i <= 20; i++) { const a = Math.PI * i / 20; s.lineTo(radius * Math.cos(a), spring + radius * Math.sin(a)); }
    s.lineTo(-radius, floor); s.closePath();
    return mesh(name, new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 20, steps: 1 }), material, 0, 0, z);
  }
  // Solid floor only below the passage. Four shallow approach treads end at 1.2m.
  box('main-hall-floor', 12, 1.2, 15.2, 0, .6, -.4, 'trim');
  footprint('main-hall-floor', 0, -.4, 12, 15.2, 0, 1.2, { support: true });
  for (let i = 0; i < 4; i++) {
    const top = (i + 1) * .3, z = 12.3 - i * 1.3;
    box(`entrance-stair-${i}`, 6.2, top, 1.32, 0, top / 2, z, 'trim', .025);
    footprint(`entrance-stair-${i}`, 0, z, 6.2, 1.32, 0, top, { support: true, walkable: true });
  }
  box('entrance-landing', 6.2, 1.2, 1.55, 0, .6, 7.1, 'trim');
  footprint('entrance-landing', 0, 7.1, 6.2, 1.55, 0, 1.2, { support: true, walkable: true });
  archWall('main-entry-real-arch', 11.5, 10.0, .95, 5.5);
  archWall('main-hall-rear-real-arch', 11.5, 10.0, .8, -7.8);
  // Tunnel sides and roof support the upper drum without filling its nave.
  for (const x of [-5.3, 5.3]) {
    box('main-hall-side-wall', .9, 10, 13, x, 6.2, -.65, 'stone');
    footprint(`main-side-${x}`, x, -.65, .9, 13, 1.2, 11.2);
  }
  box('main-hall-ceiling', 11.5, .55, 13.3, 0, 10.95, -.7, 'stone');
  box('main-hall-front-cornice', 12, .45, 1.4, 0, 11.35, 5.65, 'trim');
  roof('main-hall-orange-frieze', 0, 11.66, 4.25, 12.2, 4.2, .65);
  // Contrasting limestone archivolt: wedge voussoirs follow the actual opening.
  for (let i = 0; i < 17; i++) {
    const a0 = i * Math.PI / 17 + .012, a1 = (i + 1) * Math.PI / 17 - .012;
    const s = new THREE.Shape();
    s.moveTo(2.08 * Math.cos(a0), 4.5 + 2.08 * Math.sin(a0)); s.lineTo(2.48 * Math.cos(a0), 4.5 + 2.48 * Math.sin(a0));
    s.absarc(0, 4.5, 2.48, a0, a1, false); s.lineTo(2.08 * Math.cos(a1), 4.5 + 2.08 * Math.sin(a1)); s.absarc(0, 4.5, 2.08, a1, a0, true);
    mesh(`entry-arch-stone-${i}`, new THREE.ExtrudeGeometry(s, { depth: .22, bevelEnabled: false, curveSegments: 3 }), 'trim', 0, 0, 6.43);
  }
  for (const x of [-2.3, 2.3]) box('entry-arch-pier', .4, 3.3, .25, x, 2.85, 6.53, 'trim');
  for (const x of [-5.0, 5.0]) {
    box('facade-corner-pilaster', .48, 9.5, .25, x, 5.95, 6.5, 'trim');
    for (const y of [2, 4.7, 7.4, 10]) box('facade-quoin', .67, .38, .32, x, y, 6.57, 'trim');
  }
  // Behind the entrance block: warm twelve-sided drum and a hemispherical roof.
  mesh('dome-drum', new THREE.CylinderGeometry(6.15, 6.15, 6.3, 12), 'stone', 0, 14.55, -1.4);
  mesh('dome-drum-upper-cornice', new THREE.CylinderGeometry(6.4, 6.4, .3, 48), 'trim', 0, 17.8, -1.4);
  mesh('dome-drum-lower-belt', new THREE.CylinderGeometry(6.22, 6.22, .24, 12), 'trim', 0, 12.3, -1.4);
  for (let i = 0; i < 12; i++) {
    const a = (i + .5) * Math.PI * 2 / 12;
    window(`drum-window-${i}`, Math.sin(a) * 5.965, 15.75, -1.4 + Math.cos(a) * 5.965, a, .62, 1.06);
  }
  const domeBase = 17.99, domeH = 5.15, domeR = 6.3, sectors = 16, subdivisions = 4, rings = 14;
  for (let sector = 0; sector < sectors; sector++) {
    const vertices = [], indices = [];
    for (let j = 0; j <= rings; j++) {
      const t = .5 * Math.PI * j / rings, radius = domeR * Math.cos(t), y = domeH * Math.sin(t);
      for (let k = 0; k <= subdivisions; k++) {
        const a = 2 * Math.PI * (sector + k / subdivisions) / sectors;
        vertices.push(radius * Math.sin(a), y, radius * Math.cos(a));
      }
    }
    for (let j = 0; j < rings; j++) for (let k = 0; k < subdivisions; k++) {
      const a = j * (subdivisions + 1) + k, b = a + subdivisions + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
    mesh(`blue-dome-panel-${sector}`, g, sector % 4 === 0 ? 'domeLight' : sector % 4 === 2 ? 'domeShade' : 'dome', 0, domeBase, -1.4);
    const a = 2 * Math.PI * sector / sectors, points = [];
    for (let j = 0; j <= 22; j++) { const t = .5 * Math.PI * j / 22; points.push(new THREE.Vector3((domeR + .015) * Math.cos(t) * Math.sin(a), domeH * Math.sin(t) + .012, (domeR + .015) * Math.cos(t) * Math.cos(a))); }
    mesh(`dome-raised-rib-${sector}`, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 22, .025, 4, false), 'rib', 0, domeBase, -1.4);
  }
  mesh('dome-finial-foot', new THREE.SphereGeometry(.24, 12, 8), 'gold', 0, 23.36, -1.4);
  mesh('dome-finial-spire', new THREE.ConeGeometry(.14, 1.05, 10), 'gold', 0, 23.975, -1.4);
  footprint('main-drum', 0, -1.4, 12.8, 12.8, 11.2, 24.5, { supportedBy: 'main-hall', elevated: true });
  footprint('main-hall', 0, -.65, 11.5, 14.3, 1.2, 11.6, { opening: { minX: -2.05, maxX: 2.05, floorY: 1.2, springY: 4.5, crownY: 6.55, frontZ: 6.65, rearZ: -7.8 } });
  // Flanking blue towers and staggered cream wings create a continuous frontage.
  for (const side of [-1, 1]) {
    const x = side * 8.05, z = .5, top = side < 0 ? 13.1 : 12.7;
    box(`blue-tower-${side}`, 4.8, top - 1.2, 6.4, x, (top + 1.2) / 2, z, side < 0 ? 'blue' : 'blueShade', .14);
    box(`blue-tower-base-${side}`, 5.05, 1.7, 6.6, x, .85, z, 'trim');
    roof(`blue-tower-roof-${side}`, x, top, z, 5.4, 7, 1.05);
    footprint(`blue-tower-${side}`, x, z, 5.4, 7, 0, top + 1.15);
    for (const y of [4.2, 7.4, 10.65]) {
      window(`blue-front-${side}-${y}`, x, y, 3.715, 0, .65, 1.04);
      window(`blue-side-${side}-${y}`, x + side * 2.415, y, 1, side * Math.PI / 2, .65, 1.04);
    }
    const wx = side * 12, wz = -2.2, wtop = side < 0 ? 9.6 : 10.1;
    box(`cream-wing-${side}`, 4.4, wtop - 1.2, 7, wx, (wtop + 1.2) / 2, wz, 'stone', .12);
    box(`cream-wing-base-${side}`, 4.6, 1.45, 7.15, wx, .725, wz, 'trim');
    roof(`cream-wing-roof-${side}`, wx, wtop, wz, 5.05, 7.6, .9);
    footprint(`cream-wing-${side}`, wx, wz, 5.05, 7.6, 0, wtop + 1);
    for (const y of [3.5, 6.7]) {
      window(`wing-front-${side}-${y}`, wx, y, 1.315, 0, .68, .98);
      window(`wing-side-${side}-${y}`, wx + side * 2.215, y, -1, side * Math.PI / 2, .68, .98);
    }
    // A small cream lantern peeks behind each blue roof.
    const tx = side * 8.05, tz = -1.4;
    mesh(`rear-lantern-${side}`, new THREE.CylinderGeometry(1.05, 1.15, 3.05, 12), 'trim', tx, top + .45, tz);
    mesh(`rear-lantern-orange-cap-${side}`, new THREE.SphereGeometry(1.27, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'roof', tx, top + 1.98, tz);
    mesh(`rear-lantern-pin-${side}`, new THREE.ConeGeometry(.09, .48, 8), 'gold', tx, top + 3.44, tz);
    window(`rear-lantern-window-${side}`, tx, top + .6, tz + 1.12, 0, .4, .72);
    footprint(`rear-lantern-${side}`, tx, tz, 2.54, 2.54, top - 1.08, top + 3.68, { elevated: true, supportedBy: `blue-tower-${side}` });
  }
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group), size = bounds.getSize(new THREE.Vector3());
  let triangles = 0, meshes = 0;
  group.traverse(o => { if (o.isMesh) { meshes++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; } });
  const report = {
    version: 'target-new-city-main-v1', seed, palette: colours, origin: 'platform centre at ground, +Z entrance',
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() }, footprints,
    entry: { position: [0, 1.2, 6.7], inward: [0, 0, -1], clearWidth: 4.1, clearHeightAtCentre: 5.35, rectangularClearHeight: 3.3 },
    passage: { from: [0, 1.2, 6.7], to: [0, 1.2, -8], clearWidth: 4.1, rectangularClearHeight: 3.3, through: true },
    stairs: { bottom: [0, 0, 12.96], top: [0, 1.2, 7.8], width: 6.2, steps: 4, maxRise: .3 },
    performance: { meshes, triangles, materials: materials.size, geometries: geometries.size },
    targetSource: 'artifacts/pipeline/citadel-architecture-target-20261005/target-v3-landmarks.png',
    validation: { gpuIntegrated: false, visualScore: null, note: 'Geometry factory only; final terrain seating, connected approach, GPU lighting and independent target review remain integration responsibilities.' },
  };
  group.userData.targetArchitectureReport = report;
  let disposed = false;
  return { group, report, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); group.clear(); } };
}
