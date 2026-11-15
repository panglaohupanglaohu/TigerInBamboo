// gore-toggle-browser.cjs — 999191760944418817 "the option of disabling gore"
// 片子（111 帧 / 15.5fps）：同一场战斗，0–26 帧整座白崖与草地被血铺满，27–56 帧血迹全部消失、人还在站着，
// 57–89 帧血又回来，90–110 帧再次清空 —— 两次「开关血腥」的前后对照，红像素 26040 → 827 → 25955 → 803。
// 验收：view.setDebug('gore', false) 之后 ① 血迹实例网格不可见（渲染像素里的红消失）
//       ② 尸体实例不再进 mBody/mHead/mShield 的实例数（不是只把血藏起来）
//       ③ 活着的人还在（不能整场清空）。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const RED = (r, g, b) => r > 70 && r > g * 1.5 && r > b * 1.4;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await p.waitForFunction(() => window.rea?.battle?.running, { timeout: 90000 });

    // 把仗打起来，攒够血迹与尸体，再把镜头固定在一处（同一帧同一机位对照）
    const armed = await p.evaluate(() => {
      const b = window.rea.battle, v = window.rea.view;
      b.paused = false;
      // 让波次自己来，一直推到血攒够（最多 90 秒模拟时间）
      for (let i = 0; i < 1800 && b.blood.count < 60; i++) b.update(0.05);
      const dead = b.units.filter((u) => u.dead).length;
      // 机位：对准所有血迹的中心，按血迹扩散定距离（不然拉太近只拍到一块草皮）
      const arr = b.blood.instanceMatrix.array, n = b.blood.count;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { const k = i * 16; cx += arr[k + 12]; cy += arr[k + 13]; cz += arr[k + 14]; }
      cx /= n; cy /= n; cz /= n;
      let spread = 1;
      for (let i = 0; i < n; i++) { const k = i * 16; spread = Math.max(spread, Math.hypot(arr[k + 12] - cx, arr[k + 14] - cz)); }
      v.target.set(cx, cy + 0.4, cz);
      v.distance = Math.min(26, 5 + spread * 2.4); v.pitch = 0.95; v.yaw = 0.9;
      v.updateCamera();
      b.paused = true;      // 冻结战况，两张截图之间不许再死人（页面自己的 rAF 也在跑 update）
      return { blood: b.blood.count, dead, alive: b.units.filter((u) => !u.dead).length, target: [cx, cy, cz], spread: +spread.toFixed(2), distance: +v.distance.toFixed(2) };
    });
    assert.ok(armed.blood > 20, `应有血迹实例，实际 ${armed.blood}`);
    assert.ok(armed.dead > 0, `应有阵亡单位，实际 ${armed.dead}`);

    const shot = async (on, file) => {
      const stats = await p.evaluate((onState) => {
        const b = window.rea.battle, v = window.rea.view;
        v.setDebug('gore', onState);
        b.update(0);                       // 走一遍 #draw
        return {
          bloodVisible: b.blood.visible,
          bodies: b.mBody.count,
          heads: b.mHead.count,
          goreOff: !!v.goreOff,
          dead: b.units.filter((u) => u.dead).length,
          bloodCount: b.blood.count,
        };
      }, on);
      await p.waitForTimeout(250);
      // 只截画布，别把右侧能力面板截进来干扰像素统计
      const el = await p.$('#scene, canvas');
      await (el || p).screenshot({ path: file });
      return stats;
    };
    const on = await shot(true, '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACodeRefactoring/artifacts/coverage/gore-on.png');
    const off = await shot(false, '/Users/panglaohu/Downloads/TigerInBamboo/townscaper-web/REACodeRefactoring/artifacts/coverage/gore-off.png');

    assert.equal(on.bloodVisible, true, 'gore 开：血迹可见');
    assert.equal(on.goreOff, false, 'gore 开：goreOff 应为 false');
    assert.equal(off.bloodVisible, false, 'gore 关：血迹隐藏');
    assert.equal(off.goreOff, true, 'gore 关：goreOff 应为 true');
    assert.ok(off.bodies < on.bodies, `gore 关：尸体实例应减少（${on.bodies} → ${off.bodies}）`);
    assert.ok(off.bodies > 0, 'gore 关：活着的单位仍要画（不能整场清空）');
    const droppedBodies = on.bodies - off.bodies;
    assert.equal(on.dead, off.dead, '两张截图之间不应再死人');
    assert.equal(droppedBodies, off.dead, `减少的实例数应等于阵亡数（${on.bodies} - ${off.bodies} vs dead ${off.dead}）`);

    const out = { armed, on, off, droppedBodies, errors };
    fs.writeFileSync('/tmp/gore-report.json', JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out));
    assert.deepEqual(errors, [], '页面不应有 JS 报错');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
