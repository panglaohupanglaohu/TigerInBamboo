// head-blood-browser.cjs — 999185422403055616 "the splatter on the face follows the actual motion of the head"
// 片子：血斑是皮肤空间（跟着头/身体转）的贴图；白模版里能直接看到脸和头盔上一片血点，头一动血点跟着动。
// 验收：头（mHead）与身体（mBody）共用同一份 aSoak 与同一套物体空间噪声着色器；
//       把同一个单位的 soak 从 0 拉到 1，头部窗口里的暗红像素从 0 涨起来，身体窗口也同样有（不回归）。
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');

const RED = (r, g, b) => r > 60 && r > g * 1.55 && r > b * 1.45;

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await p.waitForFunction(() => window.rea?.battle?.running, { timeout: 90000 });

    // 结构：头也挂了 aSoak，高度门限是自己的局部 y 区间
    const wiring = await p.evaluate(() => {
      const b = window.rea.battle;
      return {
        headSoak: !!b.mHead.geometry.attributes.aSoak,
        bodySoak: !!b.mBody.geometry.attributes.aSoak,
        sharedAttr: b.mHead.geometry.attributes.aSoak === b.mBody.geometry.attributes.aSoak,
        headShader: typeof b.mHead.material.onBeforeCompile === 'function',
        headGate: b.mHead.userData.soak && { y0: b.mHead.userData.soak.uSoakY0.value, ys: b.mHead.userData.soak.uSoakYS.value },
        bodyGate: b.mBody.userData.soak && { y0: b.mBody.userData.soak.uSoakY0.value, ys: b.mBody.userData.soak.uSoakYS.value },
      };
    });
    assert.ok(wiring.headSoak, '头几何体应带 aSoak 属性');
    assert.ok(wiring.bodySoak && wiring.sharedAttr, '头与身体应共用同一份 aSoak 实例属性');
    assert.ok(wiring.headShader, '头材质应装血迹着色器');
    assert.ok(wiring.headGate.y0 > 0.1 && wiring.headGate.y0 + wiring.headGate.ys > 0.17, '头的高度门限应覆盖 0.11–0.18');

    // 单个单位贴脸拍，soak 0 → 1 各渲一帧读回像素
    const measure = await p.evaluate(async (REDSRC) => {
      const red = eval('(' + REDSRC + ')');
      const r = window.rea, v = r.view, b = r.battle, w = b.world, L = b.L;
      b.paused = false; b.scale = 1; b.wave = 2; b.t = 4; b.nextWave = 999;
      b.update(0);
      const u = b.units.find((x) => x.team === 0 && !x.dead) || b.units[0];
      u.x = 0; u.z = 0; u.y = w.top(b.view.index.cellAt(0, 0)) * L || L;
      u.navFloor = Math.round(u.y / L); u.hp = u.hpMax || u.hp; u.dead = false; u.fall = null;
      b.units = [u];
      v.target.set(u.x, u.y + 0.09, u.z); v.distance = 1.05; v.pitch = 0.18; v.yaw = 0.7;
      v.updateCamera();
      const gl = v.renderer.getContext();
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const buf = new Uint8Array(W * H * 4);
      const box = (cv, wpt) => {
        const q = v.camera.position.clone().set(wpt.x, wpt.y, wpt.z).project(v.camera);
        return { x: Math.round((q.x * 0.5 + 0.5) * W), y: Math.round((q.y * 0.5 + 0.5) * H) };
      };
      const headPt = box(v, { x: u.x, y: u.y + 0.145, z: u.z });
      const bodyPt = box(v, { x: u.x, y: u.y + 0.05, z: u.z });
      const count = (cx, cy, half) => {
        let n = 0, tot = 0;
        for (let y = cy - half; y <= cy + half; y++) for (let x = cx - half; x <= cx + half; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = (y * W + x) * 4; tot++;
          if (red(buf[i], buf[i + 1], buf[i + 2])) n++;
        }
        return { n, tot };
      };
      const shot = (soak) => {
        u.soak = soak; b.update(0);
        v.renderer.render(v.scene, v.camera);
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        return { head: count(headPt.x, headPt.y, 9), body: count(bodyPt.x, bodyPt.y, 7) };
      };
      const dry = shot(0);
      const soaked = shot(1);
      return { headPt, bodyPt, dry, soaked, W, H, hp: u.hp, soakAttr: Array.from(b.aSoak.array).slice(0, 4) };
    }, RED.toString());

    await p.screenshot({ path: 'artifacts/coverage/head-blood.png' });

    console.log(JSON.stringify({ wiring, measure }, null, 2));
    assert.ok(measure.headPt && measure.headPt.y > 0, '头部窗口应落在画布内');
    assert.ok(measure.soaked.head.n > measure.dry.head.n + 20,
      'soak=1 时头部暗红像素应明显增加：干 ' + measure.dry.head.n + ' → 满 ' + measure.soaked.head.n);
    assert.ok(measure.soaked.body.n > measure.dry.body.n + 20,
      '身体的血不应回归：干 ' + measure.dry.body.n + ' → 满 ' + measure.soaked.body.n);
    assert.equal(measure.dry.head.n < measure.soaked.head.n * 0.5, true, '干的时候头上几乎不该有血');
    assert.deepEqual(errors, []);
    fs.writeFileSync('artifacts/coverage/head-blood-browser.json', JSON.stringify({ wiring, measure, errors }, null, 2));
    console.log('PASS head blood: 头 ' + measure.dry.head.n + '→' + measure.soaked.head.n + ' px，身体 ' +
      measure.dry.body.n + '→' + measure.soaked.body.n + ' px（soak 由 aSoak 实例属性驱动）');
  } finally { await browser.close(); }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
