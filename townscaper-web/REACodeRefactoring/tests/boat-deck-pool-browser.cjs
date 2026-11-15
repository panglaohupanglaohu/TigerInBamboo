// 第 54 轮：946660607008403456 船舱整片血池 + 984813819280191488 盾面浸血 / 血泊外渗的视觉取证。
// 只拍一条船：先强制上船的人连续中箭把 gore 打满，再把相机压到船侧近景。
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const out = {};
  try {
    await p.goto('http://localhost:8769/index.html?scene=badnorth');
    await p.waitForFunction(() => window.rea?.battle?.running);
    out.gore = await p.evaluate(async () => {
      const T = await import('three'), b = rea.battle;
      b.paused = true; b.nextWave = Infinity;
      // 把镜头挪开，避免相机在船还没到时就把人打散
      let boat = b.boats[0];
      if (!boat) { b.nextWave = 0; b.paused = false; for (let i = 0; i < 5; i++) b.update(1 / 60); b.paused = true; boat = b.boats[0]; }
      if (!boat) throw Error('no boat');
      // 等它靠岸、人下船（船上流血才计入船体 gore）
      b.nextWave = Infinity; b.paused = false;
      for (let i = 0; i < 1200 && boat.state !== 'unload'; i++) b.update(1 / 60);
      b.paused = true;
      const shoot = (tg) => { const y = tg.y + .08; b.arrows.push({ mesh: new T.Mesh(), from: [tg.x, y, tg.z], to: [tg.x, y, tg.z], t: 0, dur: 1e-3, shot: { v: 0, th: 0 }, target: tg, stuck: false }); b.paused = false; b.update(1 / 60); b.paused = true; };
      for (const u of boat.crew.slice(0, 6)) { for (let k = 0; k < 3; k++) if (!u.dead) shoot(u); }
      const pool = boat.mesh.userData.deckPool;
      const hull = boat.mesh.userData.hullMat.color;
      // 相机压到船侧
      rea.view.target.set(boat.mesh.position.x, boat.mesh.position.y + .08, boat.mesh.position.z);
      rea.view.distance = 2.1; rea.view.pitch = 0.85; rea.view.yaw = 0.9; rea.view.updateCamera();
      if (b.view.smoke) b.view.smoke.sources = [];
      return { gore: +boat.gore.toFixed(3), poolOpacity: +pool.material.opacity.toFixed(3), poolScaleX: +pool.scale.x.toFixed(3), hull: '#' + hull.getHexString(), crew: boat.crew.length, dead: boat.crew.filter(u => u.dead).length };
    });
    await p.waitForTimeout(400);
    await p.screenshot({ path: 'artifacts/coverage/boat-deck-pool-r54.png' });
    out.errors = errors;
    fs.writeFileSync('artifacts/coverage/boat-deck-pool-r54.json', JSON.stringify(out, null, 2));
    if (!(out.gore.gore > 0.8)) throw Error('gore not saturated: ' + out.gore.gore);
    if (!(out.gore.poolOpacity > 0.8)) throw Error('deck pool not filled: ' + out.gore.poolOpacity);
    console.log('PASS boat deck pool', JSON.stringify(out.gore));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
