// flying-town-c06-browser.cjs — 1313837640366596096（第 127 轮补运行验收）
// "You can now build flying towns (if you find any of the perfect loops I've scattered across the grid)"
// 片子：315 帧转台，展示「环内的镇子整片悬空」这个结果状态；岛底一圈亮黄船壳（板缝+舷窗）＋红舷缘，
//       外沿等距挂黄色短舱 + 4 片白桨叶，岛下挂带斜撑的腿，腿脚一圈涟漪。
// 本测在**主场景**（index.html?flying=1）上量，不读日志：全部从 world 体素 / InstancedMesh / 像素里取数。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const out = 'artifacts/coverage';
const base = 'http://127.0.0.1:8769';

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  try {
    await p.goto(base + '/index.html?flying=1');
    await p.waitForFunction(() => window.rea?.flying?.ok, { timeout: 90000 });
    await p.addStyleTag({ content: 'body *{visibility:hidden!important} #view,#view *{visibility:visible!important}' });

    // ── 1. 结构断言：腿 / 斜撑 / 短舱 / 桨叶 / 舷窗 / 船壳带 全在几何里
    const S = await p.evaluate(() => {
      const f = window.rea.flying;
      return {
        cells: f.cells, moved: f.moved, lifted: f.lifted, legs: f.legs, y0: f.y0, depth: f.depth, perimeter: f.perimeter,
        parts: f.parts, props: f.propPositions.length, propPositions: f.propPositions, lift: f.lift, loops: f.loops,
      };
    });
    assert.ok(S.cells > 20 && S.loops >= 1, `环内格数/环数不合理：${S.cells}/${S.loops}`);
    assert.equal(S.lifted.columns, S.cells, '每格整列都要统计到');
    assert.ok(S.lifted.blocks > 0, '环内应真有建筑体素被抬（建筑随岛抬升）');
    assert.ok(S.lifted.rocks > 0, '地形岩石也要一起抬');
    assert.equal(S.moved, S.lifted.blocks + S.lifted.rocks, 'moved 应等于建筑 + 岩石体素');
    assert.ok(S.parts.braces === S.parts.legs * 2, `每腿两条斜撑：${S.parts.braces} vs ${S.parts.legs}`);
    assert.ok(S.parts.blades === S.parts.props * 4, `每短舱 4 片桨叶：${S.parts.blades} vs ${S.parts.props}`);
    assert.ok(S.parts.portholes > 2, `舷窗太少：${S.parts.portholes}`);
    assert.ok(S.parts.bandTris > 0 && S.parts.rimTris > 0, '船壳鼓边带/舷缘都要有三角');
    assert.ok(Math.abs(S.parts.bandH - Math.min(0.42, S.depth * 0.45)) < 1e-3, '鼓边带高应随船壳厚缩放');
    assert.equal(S.parts.cradleBars, S.parts.cradleBays * 3, '每榀摇篮三根杆');

    // ── 2. 整列抬升的数据面：环内最低实心层 == lift+1，且建筑体素都在 6 层以上
    const lift = await p.evaluate(() => {
      const f = window.rea.flying, w = window.rea.world, ids = new Set(f.cellIds);
      let minLevel = 99, builtHigh = 0, builtTotal = 0, leftLow = 0;
      for (const id of ids) {
        const c = w.grid.cells[id];
        for (let l = 1; l <= 20; l++) if (w.isSolid(c, l)) { if (l < minLevel) minLevel = l; if (l <= 3) leftLow++; }
        for (let l = 1; l <= 20; l++) if (w.isSolid(c, l) && !w.isRock(c, l)) { builtTotal++; if (l >= 6) builtHigh++; }
      }
      let outsideGround = 0;
      for (const c of w.grid.cells) if (!ids.has(c.id) && w.isSolid(c, 1)) outsideGround++;
      return { minLevel, builtTotal, builtHigh, leftLow, outsideGround, lift: f.lift };
    });
    assert.equal(lift.leftLow, 0, '环内 1–3 层应全部腾空');
    assert.equal(lift.minLevel, lift.lift + 1, `环内最低实心层应是第 ${lift.lift + 1} 层：${lift.minLevel}`);
    assert.equal(lift.builtTotal, S.lifted.blocks, '建筑体素数应与 liftColumns 台账一致');
    assert.ok(lift.builtHigh > 0, `建筑应在抬升后的层上：>=6 层 ${lift.builtHigh}`);
    assert.ok(lift.outsideGround > 50, `环外仍应有一大片贴地地形（第 1 层实心 ${lift.outsideGround} 格），说明只抬了环内`);

    // ── 3. 桨位等弧长（原片外沿等距挂件）
    const angs = S.propPositions.map((q) => Math.atan2(q.nx, q.nz));
    assert.ok(S.props >= 4, `桨位太少：${S.props}`);

    // ── 4. 像素 A/B：船壳近景，桨叶开 / 关，同状态两帧做噪声底
    await p.evaluate(() => {
      const f = window.rea.flying, v = window.rea.view, pp = f.propPositions[2];
      v.target.set(pp.x + pp.nx * 1.2, pp.y + 0.35, pp.z + pp.nz * 1.2);
      v.pitch = 0.06; v.distance = 9.0; v.yaw = Math.atan2(pp.nx, pp.nz) + 1.6;
      v.updateCamera();
      const orig = v.render.bind(v); v.render = () => orig(0);   // 冻住时间轴（水/烟/相机阻尼）
      v.render(0);
    });
    await p.waitForTimeout(400);
    const on = await p.screenshot();
    const on2 = await p.screenshot();
    fs.writeFileSync(path.join(out, 'flying-town-r127-hull.png'), on);
    await p.evaluate(() => window.rea.flying.setParts({ props: false }));
    await p.waitForTimeout(250);
    const off = await p.screenshot();
    fs.writeFileSync(path.join(out, 'flying-town-r127-props-off.png'), off);
    await p.evaluate(() => window.rea.flying.setParts({ props: true }));
    await p.waitForTimeout(250);

    const px = await p.evaluate(async ([a, b, c]) => {
      const load = (s) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + s; });
      const [ia, ib, ic] = await Promise.all([load(a), load(b), load(c)]);
      const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      const grab = (im) => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0); return ctx.getImageData(0, 0, cv.width, cv.height).data; };
      const da = grab(ia), db = grab(ib), dc = grab(ic);
      const isBlade = (d, i) => d[i] > 190 && d[i + 1] > 185 && d[i + 2] > 170 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 40;
      const isYellow = (d, i) => d[i] > 170 && d[i + 1] > 140 && d[i + 2] < 130 && d[i] - d[i + 2] > 60;
      let bladeOn = 0, bladeOff = 0, yellowOn = 0, yellowOff = 0, noise = 0, changed = 0;
      for (let y = 0; y < ia.height; y++) for (let x = 0; x < ia.width; x++) {
        const i = (y * ia.width + x) * 4;
        if (isBlade(da, i)) bladeOn++;
        if (isBlade(dc, i)) bladeOff++;
        if (isYellow(da, i)) yellowOn++;
        if (isYellow(dc, i)) yellowOff++;
        if (Math.abs(db[i] - da[i]) + Math.abs(db[i + 1] - da[i + 1]) + Math.abs(db[i + 2] - da[i + 2]) > 24) noise++;
        if (Math.abs(dc[i] - da[i]) + Math.abs(dc[i + 1] - da[i + 1]) + Math.abs(dc[i + 2] - da[i + 2]) > 24) changed++;
      }
      return { bladeOn, bladeOff, yellowOn, yellowOff, noise, changed };
    }, [on.toString('base64'), on2.toString('base64'), off.toString('base64')]);
    assert.ok(px.noise < 2000, `同状态两帧噪声 ${px.noise}px 过大（时间轴没冻住）`);
    assert.ok(px.bladeOff < px.bladeOn * 0.75, `关掉桨叶后白像素应明显变少：${px.bladeOn} → ${px.bladeOff}`);
    assert.ok(px.yellowOn > px.yellowOff, `短舱是黄的：关桨后黄像素应变少 ${px.yellowOn} → ${px.yellowOff}`);
    assert.ok(px.changed > 3000, `桨叶/短舱应真的画在画面上：差分 ${px.changed}px`);

    // ── 5. 全景截图（同一冻结时间轴，只换机位）
    await p.evaluate(() => {
      const f = window.rea.flying, v = window.rea.view;
      v.target.set(0, f.y0 - 0.6, 0); v.pitch = 0.14; v.distance = 30; v.yaw = 0.9; v.updateCamera(); v.render(0);
    });
    await p.waitForTimeout(300);
    await p.locator('#view').screenshot({ path: path.join(out, 'flying-town-r127-wide.png') });

    assert.deepEqual(errors, [], '页面不应有 console/page 错误');
    const report = { ...S, lift, pixel: px, propAngleSpanDeg: +(((Math.max(...angs) - Math.min(...angs)) * 180) / Math.PI).toFixed(1) };
    fs.writeFileSync(path.join(out, 'flying-town-r127.json'), JSON.stringify(report, null, 2));
    console.log('PASS flying-town-c06-browser', JSON.stringify({
      cells: S.cells, moved: S.moved, blocks: S.lifted.blocks, legs: S.parts.legs, braces: S.parts.braces,
      props: S.parts.props, blades: S.parts.blades, portholes: S.parts.portholes, bandTris: S.parts.bandTris,
      minLevel: lift.minLevel, bladeOn: px.bladeOn, bladeOff: px.bladeOff, noise: px.noise, changed: px.changed,
    }));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
