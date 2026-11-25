// 943230620242796544 组合验收（浏览器，真页面 index.html?scene=badnorth，默认 quad 网格 seed=7）。
// 原片 306 帧：0–209 安静雪岛，第 210 帧**硬切**为「冬景 + 船群围岸 + 士兵/旗帜 + 血迹 + 黑烟」同屏。
// 每个元素此前都单独验过（冬主题 theme.js#winter+frostVegetation · 雪 atmosphere.js+uSnow ·
// 长船登陆/近战/血迹 battle.js · 小屋着火黑烟 smoke.js），本条残差是「同屏组合未实现验收」。
// 本测不布景、不摆拍：真页面里走真实机制——UI 选冬季主题 + 开雪，battle.update 按真实波次/登陆/近战/
// 烧屋往前推，推到五类元素**同一时刻**全部成立才冻结验收：
//   ① 冬景：bnTheme.sky=#c4c7cb、场景背景换冬色、植被 emissive 真挂霜（userData.frostBase 计数）
//   ② 雪：atmosphere.snow.visible + uSnow=1（表面积雪混白）+ 3000 粒在位且 alpha>0
//   ③ 船群/士兵：≥2 条长船同时在场（真实 26 秒波次叠加），守军旗帜可见、维京人上岸
//   ④ 血：battle.blood.count>0 且 kills>0（真近战打出来的，不是注入）
//   ⑤ 黑烟：小屋 burn>4 失守 → smoke.sources>0 且 back/front 烟卡 count>0（真粒子在画）
//   ⑥ 像素：冻结帧（render(0)+paused）——雪开/关差分>阈值、关→开回位 0；
//      组合帧深红血像素计数、烟柱投影带亮度低于冬季天空。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const OUT = 'artifacts/coverage';
const report = { checks: [], state: {}, pixels: {}, frost: {}, errors: [] };
const check = (name, ok, detail) => { report.checks.push({ name, ok: !!ok, detail }); if (!ok) throw new Error(name + ' → ' + detail); };

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = report.errors;
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text()); });
  try {
    let booted = false;
    for (let attempt = 0; attempt < 2 && !booted; attempt++) {
      await p.goto('http://localhost:8769/index.html?scene=badnorth');
      booted = await p.waitForFunction(() => window.rea?.battle?.running && window.rea.battle.boats.length > 0, null, { timeout: 60000 }).then(() => true).catch(() => false);
    }
    assert.ok(booted, 'badnorth 场景起不来');

    /* ---------------- ①② 冬景 + 雪：走真实 UI 处理路径 ---------------- */
    const winter = await p.evaluate(() => {
      // 与面板 onchange 完全同一条路：select/复选框 dispatch change → applyBadNorthTheme / setDebug。
      const theme = document.querySelector('#environment-theme');
      theme.value = 'winter'; theme.dispatchEvent(new Event('change'));
      const snowBox = document.querySelector('[data-environment="snow"]');
      snowBox.checked = true; snowBox.dispatchEvent(new Event('change'));
      const v = rea.view;
      return {
        themeValue: theme.value,
        bnSky: v.bnTheme?.sky ?? null,
        bg: '#' + v.scene.background.getHexString(),
        uSnow: v.snowUniform.value,
        snowVisible: v.atmosphere.snow.visible,
        snowN: v.atmosphere.snowN,
      };
    });
    await p.waitForTimeout(1200);   // worldMesh.invalidate() 重建 + 植被刷新 + 雪播种
    report.state.winter = winter;
    check('冬季主题真应用（bnTheme.sky=#c4c7cb）', winter.bnSky === '#c4c7cb' && winter.themeValue === 'winter', JSON.stringify(winter));
    check('场景背景换成冬季天色', winter.bg === '#c4c7cb', winter.bg);
    check('雪粒子开 + 表面混白 uSnow=1', winter.snowVisible === true && winter.uSnow === 1 && winter.snowN === 3000, JSON.stringify(winter));

    // 植被挂霜：frostVegetation 只改带 emissive 的植被材质，改过的记 userData.frostBase。
    const frost = await p.evaluate(() => {
      let n = 0, frosted = 0, sample = null;
      rea.view.vegetation?.group?.traverse((o) => {
        for (const m of [o.material].flat()) {
          if (!m?.emissive) continue;
          n++;
          if (m.userData.frostBase !== undefined) { frosted++; if (!sample) sample = { before: '#' + m.userData.frostBase.toString(16), now: '#' + m.emissive.getHexString() }; }
        }
      });
      return { emissiveMaterials: n, frosted, sample };
    });
    report.frost = frost;
    check('冬景植被覆盖：带 emissive 的植被材质真挂霜', frost.emissiveMaterials > 0 && frost.frosted > 0 && frost.sample?.now === '#a7adb5', JSON.stringify(frost));

    const snowState = await p.evaluate(() => {
      const a = rea.view.atmosphere, P = a.snowPos, A = a.snowAlpha;
      let live = 0, bad = 0;
      for (let k = 0; k < a.snowN; k++) {
        if (!Number.isFinite(P[k * 3]) || !Number.isFinite(P[k * 3 + 1]) || !Number.isFinite(P[k * 3 + 2])) bad++;
        if (A[k] > 0.05) live++;
      }
      return { live, bad, n: a.snowN };
    });
    check('3000 雪粒在位、位置有限、有透明度', snowState.bad === 0 && snowState.live > snowState.n * 0.5, JSON.stringify(snowState));

    /* ---------------- ③④⑤ 快进真实战斗到「五类同屏」 ---------------- */
    const combo = await p.evaluate(() => {
      const b = rea.battle, v = rea.view, w = b.world;
      b.paused = false;
      const probe = () => ({
        t: +b.t.toFixed(1), wave: b.wave,
        boats: b.boats.length,
        boatsNearShore: b.boats.filter((x) => x.state !== 'out').length,
        vikAshore: b.units.filter((u) => u.team === 1 && !u.dead && !u.onBoat).length,
        vikOnBoat: b.units.filter((u) => u.team === 1 && !u.dead && !!u.onBoat).length,
        defAlive: b.units.filter((u) => u.team === 0 && !u.dead).length,
        flagsVisible: b.squads.filter((s) => s.flag.visible && s.flag.userData.cloth.visible).length,
        corpses: b.units.filter((u) => u.dead).length,
        blood: b.blood.count, kills: b.damageStats.kills,
        smokeSrc: v.smoke?.sources.length ?? 0,
        smokeCards: v.smoke ? Math.max(v.smoke.back.count, v.smoke.front.count) : 0,
        housesLost: b.houses.filter((h) => h.lost).length,
        fire: v.effects?.fire?.visible === true && (v.effects?.fireSources?.length ?? 0) > 0,
      });
      const met = (s) => s.boats >= 2 && s.vikAshore >= 4 && s.flagsVisible >= 1
        && s.blood > 0 && s.kills > 0 && s.smokeSrc > 0 && s.smokeCards > 20;
      let last = probe(), redirectedAt = null;
      // 守军小队把「移动」目标改到离所有屋门最远、且导航可达的格——与玩家点选小队→点地面
      // 是同一条机制（onPointer: sq.goal=picked.cell / sq.goalFloor=picked.floor），不是注入状态。
      // 默认布防站在门口 → defNear 永远成立 → 任何屋都烧不起来（实测 600s/24 波 0 失守）。
      // 原片是宣传摆拍构图，这里用真实指令把防线拉开，让维京人真占领门廊烧屋。
      const redirect = () => {
        const lead = b.squads.flatMap((s) => s.members).find((u) => !u.dead && !u.onBoat);
        const doors = b.houses.map((h) => h.door).filter(Boolean);
        if (!lead || !doors.length) return null;
        let target = null, bestD = -1;
        for (const c of w.cells) {
          if (w.top(c) < 2) continue;
          const d = Math.min(...doors.map((dr) => Math.hypot(dr.cx - c.cx, dr.cz - c.cz)));
          if (d > bestD && b.navigation.plan(lead, c, w.top(c))) { target = c; bestD = d; }
        }
        if (!target) return null;
        for (const sq of b.squads) if (sq.alive) { sq.goal = target; sq.goalFloor = w.top(target); }
        return { cell: target.id, doorDist: +bestD.toFixed(2) };
      };
      for (let i = 0; i < 12000 && !met(last); i++) {
        b.update(0.05);
        // 战斗快进时同步喂烟一点真实步长（RAF 被本 evaluate 阻塞）；不喂则点着也没粒子。
        v.smoke?.update(1 / 60, v.atmosphere.uWind.value, v.camera);
        last = probe();
        // 第一波真近战已见血 + 维京人已上岸 → 下移动令，给烧屋留足波次窗口
        if (redirectedAt === null && last.blood > 0 && last.vikAshore >= 4 && last.t > 20) redirectedAt = { t: last.t, ...redirect() } ?? { t: last.t, failed: true };
      }
      if (met(last)) b.paused = true;   // 五类同屏这一刻立刻冻住，后面的截图就是这一帧
      return { ...last, met: met(last), redirectedAt };
    });
    report.state.combo = combo;
    check('同一时刻五类齐：≥2 船在场', combo.boats >= 2, `${combo.boats} 船（t=${combo.t}s 第${combo.wave}波）`);
    check('士兵同屏：守军旗帜可见 + 维京人上岸', combo.flagsVisible >= 1 && combo.vikAshore >= 4, `旗 ${combo.flagsVisible} / 岸上维京 ${combo.vikAshore} / 守军 ${combo.defAlive}`);
    check('血迹：真近战留下血泊与击杀', combo.blood > 0 && combo.kills > 0, `blood.count=${combo.blood} kills=${combo.kills} 尸体=${combo.corpses}`);
    check('黑烟：小屋失守 → 烟源 + 烟卡真在画', combo.smokeSrc > 0 && combo.smokeCards > 20 && combo.housesLost > 0, `src=${combo.smokeSrc} cards=${combo.smokeCards} 失守=${combo.housesLost}`);
    check('火光同步（showFire + fireSources）', combo.fire === true, String(combo.fire));
    check('防线移动令真实下达（导航可达格）', combo.redirectedAt && !combo.redirectedAt.failed && combo.redirectedAt.doorDist > 1, JSON.stringify(combo.redirectedAt));

    /* ---------------- ⑥ 冻结帧像素验收 ---------------- */
    await p.evaluate(() => {
      const b = rea.battle, v = rea.view, w = b.world;
      document.getElementById('hud')?.style.setProperty('display', 'none');
      b.hud.style.display = 'none';
      document.getElementById('coverage-progress')?.style.setProperty('display', 'none');
      document.querySelectorAll('[data-progress-badge]').forEach((n) => { n.closest('div').style.display = 'none'; });
      // 机位：整岛全景但放宽到岸环海面也入画——船群/烟柱/雪岛同屏（冬季宣传片同款构图）
      let cx = 0, cz = 0, n = 0;
      for (const c of w.cells) { if (w.top(c) >= 1) { cx += c.cx; cz += c.cz; n++; } }
      cx /= n || 1; cz /= n || 1;
      const lockCam = () => { v.target.set(cx, 1.2, cz); v.distance = 16.5; v.pitch = 0.9; v.yaw = Math.PI * 0.2; v.updateCamera(); };
      lockCam();
      window.__pin = lockCam;
      b.paused = true;
      window.__camSave = { p: v.camera.position.clone(), q: v.camera.quaternion.clone() };
      v.updateCamera = () => { v.camera.position.copy(window.__camSave.p); v.camera.quaternion.copy(window.__camSave.q); v.camera.updateMatrixWorld(); };
      const orig = v.render.bind(v);
      window.__origRender = orig;
      v.render = () => { orig(0); };   // dt=0：水/雪/烟/旗全冻结，逐帧确定
    });
    const state = async () => p.evaluate(() => { window.__pin(); rea.view.render(0); });
    const snap = async (name) => { await state(); await p.waitForTimeout(200); await state(); return p.locator('canvas').screenshot({ path: path.join(OUT, name) }); };

    const comboShot = await snap('943230620242796544-combo-winter-battle.png');
    const comboShot2 = await snap('943230620242796544-combo-winter-battle-2.png');
    await p.evaluate(() => rea.view.setDebug('snow', false));
    const snowOff = await snap('943230620242796544-combo-snow-off.png');
    await p.evaluate(() => rea.view.setDebug('snow', true));
    const snowBack = await snap('943230620242796544-combo-snow-back.png');

    // 同帧像素统计：差分（luma>8）、深红血像素、烟柱投影带亮度
    const px = await p.evaluate(async ([A, A2, OFF, BACK]) => {
      const load = async (b64) => { const blob = await (await fetch('data:image/png;base64,' + b64)).blob(); return createImageBitmap(blob); };
      const imgs = await Promise.all([A, A2, OFF, BACK].map(load));
      const w = imgs[0].width, h = imgs[0].height;
      const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
      const grab = (img) => { g.clearRect(0, 0, w, h); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
      const [da, da2, doff, dback] = imgs.map(grab);
      const luma = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let noise = 0, snowDiff = 0, restored = 0, bloodPx = 0;
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(luma(da, i) - luma(da2, i)) > 8) noise++;
        if (Math.abs(luma(da, i) - luma(doff, i)) > 8) snowDiff++;
        if (Math.abs(luma(da, i) - luma(dback, i)) > 8) restored++;
        const r = da[i], gg = da[i + 1], bb = da[i + 2];
        if (r > 100 && r > gg * 1.7 && r > bb * 1.7) bloodPx++;
      }
      // 烟柱：把第一个烟源和源上方 2 个单位投到屏幕，取两点间竖带里比冬季天空（luma≈199）暗的像素。
      const T = await import('three');
      const v = rea.view, s = v.smoke.sources[0];
      const pr = (x, y, z) => { const p3 = new T.Vector3(x, y, z).project(v.camera); return p3.z > 1 ? null : [(p3.x * 0.5 + 0.5) * w, (0.5 - p3.y * 0.5) * h]; };
      const p0 = pr(s.x, s.y, s.z), p1 = pr(s.x, s.y + 2.0, s.z);
      let plumeDark = 0, plumeN = 0, plumeMed = 0;
      if (p0 && p1) {
        const yTop = Math.max(0, Math.min(p0[1], p1[1]) | 0), yBot = Math.min(h, Math.max(p0[1], p1[1]) | 0);
        const x0 = Math.max(0, (Math.min(p0[0], p1[0]) - w * 0.02) | 0), x1 = Math.min(w, (Math.max(p0[0], p1[0]) + w * 0.02) | 0);
        const lumas = [];
        for (let y = yTop; y < yBot; y++) for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4; plumeN++;
          const l = luma(da, i); lumas.push(l);
          if (l < 150) plumeDark++;
        }
        lumas.sort((a, b) => a - b);
        plumeMed = +(lumas[lumas.length >> 1] ?? 0).toFixed(1);
      }
      return { w, h, noise, snowDiff, restored, bloodPx, plume: { dark: plumeDark, n: plumeN, median: plumeMed, src: [s.x, s.y, s.z] } };
    }, [comboShot.toString('base64'), comboShot2.toString('base64'), snowOff.toString('base64'), snowBack.toString('base64')]);
    report.pixels = px;
    check('冻结帧同状态噪声 0（验收真冻结）', px.noise === 0, `${px.noise} px`);
    check('雪层开/关在画面上可分（粒子 + 表面混白）', px.snowDiff > 5000, `${px.snowDiff} px（${px.w}×${px.h}）`);
    check('雪 关→开 回位 0', px.restored === 0, `${px.restored} px`);
    check('组合帧有深红血像素（原片红色血迹同屏）', px.bloodPx > 20, `${px.bloodPx} px`);
    check('烟柱投影带比冬季天空暗（黑烟真在画面里）', px.plume.n > 0 && px.plume.dark > 10, JSON.stringify(px.plume));

    check('无 console error', errors.length === 0, errors.slice(0, 2).join(' | '));
    fs.writeFileSync(path.join(OUT, 'winter-battle-combo.json'), JSON.stringify(report, null, 1));
    console.log('\nPASS 943230620242796544 冬季宣传全景组合验收', report.checks.length, '项');
    console.log(JSON.stringify({ combo: report.state.combo, frost, pixels: px }));
    await browser.close();
  } catch (e) {
    console.error('FAIL ' + e.message);
    fs.writeFileSync(path.join(OUT, 'winter-battle-combo.json'), JSON.stringify({ ...report, error: e.message }, null, 1));
    await browser.close();
    process.exit(1);
  }
})();
