// Citadel tram probes on the live default game.
//   node citadel_tram_probe.mjs drop '[[x,z],...]'   drop-test walkable landings (castle-local)
//   node citadel_tram_probe.mjs alight               station-only alight rule + exit landings
//   (every run reports page errors and tunnel runs)
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const mode = process.argv[2] || 'alight';
const b = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=metal']});
try {
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await p.goto('http://localhost:8931/TigerMessenger/?autostart=1', {waitUntil: 'domcontentloaded'});
  try {
    await p.waitForFunction(() => window.__tm?.scene.getObjectByName('highland-west-city') && window.__tm?.messenger?.landmarks?.tramSystem, null, {timeout: 240000});
  } catch (e) { console.log(JSON.stringify({loadFailed: true, errors})); process.exit(1); }
  await p.waitForTimeout(2500);
  const out = await p.evaluate(async ([mode, arg]) => {
    const t = window.__tm, T = t.THREE;
    const {citadelCoastalFrame} = await import('/TigerMessenger/src/world/citadel/coastalTramRoute.js');
    const S = await import('/TigerMessenger/src/world/citadel/coastalTramStructures.js');
    const F = citadelCoastalFrame(), inv = F.clone().invert(), R = 160;
    const sys = t.messenger.landmarks.tramSystem;
    const tunnels = sys.group.children.filter(c => /culvert/.test(c.name)).map(c => {
      const box = new T.Box3().setFromObject(c), l = box.getCenter(new T.Vector3()).applyMatrix4(inv);
      return {name: c.name, castleLocal: [Math.round(l.x), Math.round(l.y), Math.round(l.z)], size: Math.round(box.getSize(new T.Vector3()).length())};
    });
    const land = async (x, z, h) => {
      const d = new T.Vector3(x, 0, z).applyMatrix4(F).normalize();
      t.player.position.copy(d).multiplyScalar(R + h); t.player.velocity.set(0, 0, 0);
      await new Promise(r => setTimeout(r, 3000));
      return {x, z, alt: Math.round((t.player.position.length() - R) * 100) / 100, onGround: t.player.onGround};
    };
    const res = {tunnels};
    if (mode === 'drop') { res.drops = []; for (const [x, z] of JSON.parse(arg)) res.drops.push(await land(x, z, 12.5)); }
    if (mode === 'alight') {
      const curve = sys.curve;
      const near = (x, z) => { let best = 0, bd = 1e9; for (let i = 0; i < 3000; i++) { const l = curve.getPointAt(i / 3000).applyMatrix4(inv); const d = Math.hypot(l.x - x, l.z - z) + (l.y < -45 ? 1e6 : 0); if (d < bd) { bd = d; best = i / 3000; } } return curve.getPointAt(best); };
      res.rule = {};
      for (const st of S.COASTAL_TRAM_STATIONS) { const r = S.citadelTramAlight(near(st.x, st.z), R); res.rule[st.id] = r ? (r.blocked ? 'blocked' : r.station.name) : 'outside'; }
      const mid = S.citadelTramAlight(near(-1, 44), R); res.rule.bayMid = mid ? (mid.blocked ? 'blocked' : mid.station.name) : 'outside';
      res.landings = {}; for (const st of S.COASTAL_TRAM_STATIONS) res.landings[st.id] = await land(st.exit.x, st.exit.z, st.exit.h);
    }
    return res;
  }, [mode, process.argv[3] || '[]']);
  console.log(JSON.stringify({...out, errors}));
} finally { await b.close(); }
