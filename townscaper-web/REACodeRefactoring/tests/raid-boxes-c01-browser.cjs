/* 第 242 轮 · 974325184525201409「Behold, our beautiful viking raid planner」运行验收
 *
 * 片内形制（frame-0250 原尺寸）：岛周一圈**短泊位盒**，每个泊位再牵出一条**贯到远处的长车道盒**，
 * 按泊位分色（同一泊位的车道同色），整片是「候选泊位 × 车道角」的扫掠可视化，没有船体、没有时间参数化扫掠。
 *
 * 本测守三件事：
 *   ① 扫掠规模：raidLanes === raidBerths × LANE_ANGLES.length，且 ok + rejected === raidLanes；
 *   ② 真画出来了：几何顶点数 == (船×2 + 车道×2) 个盒，颜色 ≥ 6 种（按泊位分色），关档后 raid 层不可见；
 *   ③ 判定口径没走样：可用泊位两两不相交（与 planLanding 同一套 berthBox SAT）。
 * 双网格各跑一遍，截图给人看（像素差另用 python 比）。
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_BASE = 'http://localhost:8769/index.html?scene=badnorth';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const reports = [];
  try {
    for (const kind of ['quad', 'mixed']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.on('pageerror', (e) => errors.push(`${kind}: ${e.message}`));
      await page.goto(`${URL_BASE}&grid=${kind}&c01=raidBoxes`);
      await page.waitForFunction(() => window.rea?.battle?.running, null, { timeout: 120000 });

      const r = await page.evaluate(async () => {
        const b = window.rea.battle, c01 = b.c01;
        const { LANE_ANGLES, berthBox } = await import('/src/badnorth/landing-plan.js');
        const { obbOverlap } = await import('/src/core/obb.js');
        // 推一波船出来（片里盒子是给「候选泊位 + 已发船」画的），再跑几帧让 afterDraw 的 0.5s 定时器重建一次
        b.paused = false;
        for (let k = 0; k < 600 && b.boats.length < 2; k++) { b.nextWave = -1; b.update(1 / 60); }
        for (let k = 0; k < 40; k++) b.update(1 / 60);
        b.paused = true;
        const attr = c01.raid.geometry.getAttribute('position');
        const col = c01.raid.geometry.getAttribute('color');
        const palette = new Set();
        for (let i = 0; i < col.count; i++) {
          palette.add([col.getX(i), col.getY(i), col.getZ(i)].map((v) => v.toFixed(3)).join(','));
        }
        // 可用泊位两两不相交（与 planLanding 同口径）
        let pairs = 0, overlap = 0;
        for (let i = 0; i < b.boats.length; i++) {
          for (let j = i + 1; j < b.boats.length; j++) {
            pairs++;
            if (obbOverlap(berthBox(b.boats[i].stop, b.boats[i].dir), berthBox(b.boats[j].stop, b.boats[j].dir))) overlap++;
          }
        }
        const s = c01.stats;
        // 同一 JS 任务内按需渲染 + toDataURL（r240 坑 85：截图交给 rAF 会被主循环覆盖，噪声也来自主循环）
        const v = window.rea.view, rd = v.renderer;
        const snap = () => { v.render(0); return rd.domElement.toDataURL('image/png'); };
        const on = snap(), on2 = snap();
        c01.set('raidBoxes', false);
        for (let k = 0; k < 4; k++) b.update(1 / 60);
        const offShot = snap();
        return {
          boats: s.raidBoats, berths: s.raidBerths, lanes: s.raidLanes, laneBoxes: s.raidLaneBoxes,
          ok: s.raidOk, rejected: s.raidRejected,
          angleCount: LANE_ANGLES.length, verts: attr.count, paletteSize: palette.size,
          expectVerts: (s.raidBoats * 2 + s.raidLanes + s.raidLaneBoxes) * 24,   // 船(泊位+走廊) + 每个候选车道一只泊位盒 + 首选车道一只长盒
          pairs, overlap, visible: true, offVisible: c01.raid ? c01.raid.visible : null,
          on, on2, offShot,
        };
      });

      // 落盘三张（开档 / 同状态 / 关档），像素账另用 python 比
      const write = (name, url) => fs.writeFileSync(`artifacts/coverage/raid-boxes-${kind}${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
      write('', r.on); write('-same', r.on2); write('-off', r.offShot);
      const off = { visible: r.offVisible };

      assert.equal(r.angleCount, 3, '车道角档 3 档（LANE_ANGLES）');
      assert.equal(r.lanes, r.berths * r.angleCount, `每泊位三档车道角：${r.berths} × ${r.angleCount} != ${r.lanes}`);
      assert.equal(r.ok + r.rejected, r.lanes, `判定覆盖全部车道盒：${r.ok}+${r.rejected} != ${r.lanes}`);
      assert.ok(r.berths >= 8, `岛周候选泊位成圈（${r.berths}）`);
      assert.ok(r.ok > 0 && r.rejected > 0, `可用/被拒都要有样本：ok=${r.ok} rejected=${r.rejected}`);
      assert.ok(r.laneBoxes > 0 && r.laneBoxes <= r.berths, `长车道盒只给可用的首选车道（${r.laneBoxes} ≤ 泊位 ${r.berths}）`);
      assert.equal(r.verts, r.expectVerts, `几何顶点数 = 盒数×24：${r.verts} vs ${r.expectVerts}`);
      assert.ok(r.paletteSize >= 6, `按泊位分色，颜色 ≥ 6 种（实测 ${r.paletteSize}）`);
      assert.equal(r.overlap, 0, `可用泊位两两不相交（${r.pairs} 对）`);
      assert.equal(r.visible, true, '开档时 raid 层可见');
      assert.equal(off.visible, false, '关档后 raid 层不可见');

      const { on: _on, on2: _on2, offShot: _off, ...dry } = r;
      reports.push({ kind, ...dry, offVisible: off.visible });
      await page.close();
    }
    assert.deepEqual(errors, [], `页面无 error：${errors.join(' | ')}`);
    fs.writeFileSync('artifacts/coverage/raid-boxes-c01-browser.json', JSON.stringify({ reports, errors }, null, 2));
    console.log(JSON.stringify(reports, null, 1));
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL: ' + e.message); process.exit(1); });
