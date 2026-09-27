// Export the current default Web tram system (global line + holy-city coastal leg,
// stone arcade, stations, parked cars) for Godot, plus curve/station data.
// World frame (planet centre at origin), matching original-world-v1.glb.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=metal']});
try {
  const p = await b.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://localhost:8931/TigerMessenger/?autostart=1', {waitUntil: 'domcontentloaded'});
  await p.waitForFunction(() => window.__tm?.scene.getObjectByName('highland-west-city') && window.__tm?.messenger?.landmarks?.tramSystem, null, {timeout: 240000});
  await p.waitForTimeout(1500);
  const data = await p.evaluate(async () => {
    const t = window.__tm, T = t.THREE, sys = t.messenger.landmarks.tramSystem;
    t.scene.updateMatrixWorld(true);
    const src = sys.group, copy = src.clone(true), scene = new T.Scene();
    src.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
    copy.name = 'christchurch-tram-system-coastal';
    copy.traverse(o => { o.visible = true; });
    scene.add(copy);
    const {exportWorldGLB} = await import('/TigerMessenger/tools/world/export_world_glb.js');
    const r = exportWorldGLB(scene, T, {});
    let s = ''; for (let i = 0; i < r.bytes.length; i += 8192) s += String.fromCharCode(...r.bytes.subarray(i, i + 8192));
    const {COASTAL_TRAM_STATIONS} = await import('/TigerMessenger/src/world/citadel/coastalTramStructures.js');
    const {citadelCoastalFrame, COASTAL_TRAM_CONTROLS} = await import('/TigerMessenger/src/world/citadel/coastalTramRoute.js');
    const F = citadelCoastalFrame(), R = 160;
    const curve = sys.curve, N = 1200, pts = [];
    for (let i = 0; i < N; i++) pts.push(curve.getPointAt(i / N).toArray().map(v => Math.round(v * 1000) / 1000));
    const castle = t.scene.getObjectByName('castleContainer');
    const stations = COASTAL_TRAM_STATIONS.map(st => ({
      id: st.id, name: st.name, radius: 20,
      world: new T.Vector3(st.x, 0, st.z).applyMatrix4(F).normalize().multiplyScalar(R).toArray(),
      exitWorld: new T.Vector3(st.exit.x, 0, st.exit.z).applyMatrix4(F).normalize().multiplyScalar(R + st.exit.h).toArray(),
      castleLocal: [st.x, st.z], exitCastleLocal: [st.exit.x, st.exit.z], exitAltitude: st.exit.h,
    }));
    return {glb: btoa(s), manifest: r.manifest, route: {
      source: 'Web default tram curve (citadelCoastalTram default since 2026-09-24)', radius: R, closed: true,
      centreline: pts, controlsCastleLocal: COASTAL_TRAM_CONTROLS, castleFrame: F.toArray(),
      webCastleMatrix: castle?.matrixWorld.toArray() || null, stations,
      rule: 'Holy-city leg: alight only within station radius; rider lands at exitWorld.',
    }};
  });
  await writeFile('TigerMessenger/godot/assets/art-pilots/tram-system-coastal-v1.glb', Buffer.from(data.glb, 'base64'));
  await writeFile('TigerMessenger/godot/data/tram-coastal-route-v1.json', JSON.stringify(data.route));
  await writeFile('TigerMessenger/artifacts/pipeline/citadel-tram-iterations/godot-tram-export.json', JSON.stringify({...data.manifest, errors}, null, 2));
  console.log(JSON.stringify({bytes: data.manifest.bytes, meshes: data.manifest.meshes, nodes: data.manifest.nodes, stations: data.route.stations.length, errors}));
} finally { await b.close(); }
