/**
 * smoke-c01-native-browser.cjs — 第 71 轮 · 1015142746372366336 缺口 ①
 *
 * 原片（303 帧，sheet-00…03 全看）：烧屋黑烟是「6–7 个大瓣串成柱 → 顶端断开另起一团 → 贴地一层更宽更薄的弥散雾」。
 * 第 56 批先用 `src/life/smoke-c01.js` 外挂近似（包一层 smoke.update，每 3 片丢 1 片再放大 1.32、自己铺 240 张雾卡），
 * 第 63 轮把三条口径 native 进 `src/life/smoke.js`（setLobeStyle / setTopBreak / setCrown / setHaze），
 * 但 **battle-c01.js 一直还在挂外挂层** —— 这就是「battle-c01 切 native」这条缺口。
 *
 * 本测只看真实页面里的对象状态与真实绘制结果，不看 exit code：
 *   ① 打开 smokeShape 后，活的是 native 口径（lobeStyle='big' / topBreak / crownOn / hazeOn），且**没有** shape 外挂；
 *   ② 关掉后全部回到 fine / 关，说明开关可逆、不会残留外挂实例；
 *   ③ native 大瓣口径下，烟本体真的按 big 口径重排了发射（sources 的 em 被重置、片上数变少）；
 *   ④ 薄雾层真的铺出卡片（hazeStats.quads > 0），关掉后为 0；
 *   ⑤ 画布像素上，开与关的烟区像素分布不同（不是只改了个字段）。
 */
const { chromium } = require('playwright');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const out = { ok: true, checks: [] };
  const check = (name, cond, detail) => {
    out.checks.push({ name, pass: !!cond, detail });
    if (!cond) out.ok = false;
    console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
  };

  try {
    await page.goto('http://127.0.0.1:8769/index.html?scene=badnorth', { waitUntil: 'load' });
    await page.waitForFunction(() => window.rea?.battle?.running && window.rea?.view?.smoke, { timeout: 90000 });
    await page.evaluate(() => { rea.battle.paused = true; });
    // 夹具：battle 场景要等房子烧起来才有烟源，这里手动给一个岛心烟源（smoke.html 的 reset() 同款口径），
    // 否则测的是一个不发射的 Smoke —— 上一版就因此拿到 cards=0 / haze=0 的假 PASS。
    const seeded = await page.evaluate(async () => {
      const r = rea, w = r.world, sm = r.view.smoke;
      const c = w.cells.filter((x) => w.top(x) > 0)
        .reduce((a, b) => (Math.hypot(a.cx, a.cz) < Math.hypot(b.cx, b.cz) ? a : b));
      sm.clear(); sm.random = () => 0.5;
      sm.sources = [{ x: c.cx, y: w.top(c) * r.view.levelHeight + 0.2, z: c.cz }];
      return { x: +c.cx.toFixed(2), z: +c.cz.toFixed(2), y: +(w.top(c) * r.view.levelHeight + 0.2).toFixed(2) };
    });

    const before = await page.evaluate(() => {
      const sm = rea.view.smoke;
      for (let i = 0; i < 90; i++) sm.update(1 / 60, undefined, rea.view.camera);   // 先让柱身长出来
      return { lobeStyle: sm.lobeStyle, topBreak: sm.topBreak, crownOn: sm.crownOn, hazeOn: sm.hazeOn,
        hasShape: !!sm.shape, sources: sm.sources.length, cards: sm.back.count };
    });
    check('默认未启用', before.lobeStyle === 'fine' && !before.topBreak && !before.hasShape,
      `默认 lobeStyle=${before.lobeStyle} topBreak=${before.topBreak} shape=${before.hasShape}`);

    // ① 打开：走 native
    const on = await page.evaluate(async () => {
      const b = rea.battle, sm = rea.view.smoke, c01 = b.c01;
      c01.set('smokeShape', true);
      for (let i = 0; i < 60; i++) sm.update(1 / 60, undefined, rea.view.camera);
      return { flag: c01.on.smokeShape, lobeStyle: sm.lobeStyle, topBreak: sm.topBreak, crownOn: sm.crownOn,
        hazeOn: sm.hazeOn, hasShape: !!sm.shape, cards: sm.back.count,
        haze: sm.hazeStats && sm.hazeStats.quads, crown: sm.crownCount ?? null,
        styleScale: sm.style ? (sm.style.scale ?? sm.style.noiseScale ?? null) : null };
    });
    check('① 打开走 native 大瓣', on.lobeStyle === 'big' && on.flag, `lobeStyle=${on.lobeStyle}`);
    check('① 顶端断开 + 顶团 native', on.topBreak === true && on.crownOn === true, `topBreak=${on.topBreak} crownOn=${on.crownOn}`);
    check('① 薄雾层 native 铺卡', on.hazeOn === true && on.haze > 0, `hazeOn=${on.hazeOn} quads=${on.haze}`);
    check('① 不再挂 shape 外挂', on.hasShape === false, `shape=${on.hasShape}`);
    // ③ 同样 150 步模拟，fine / big 两种口径各长一次柱，比片上数：原片大瓣 = 片更少更大
    const rate = async (flag) => page.evaluate((f) => {
      const sm = rea.view.smoke, c01 = rea.battle.c01;
      c01.set('smokeShape', f);
      sm.clear(); sm.random = () => 0.5;
      for (let i = 0; i < 150; i++) sm.update(1 / 60, undefined, rea.view.camera);
      return { cards: sm.back.count, lobeStyle: sm.lobeStyle, haze: (sm.hazeStats && sm.hazeStats.quads) || 0 };
    }, flag);
    const rFine = await rate(false), rBig = await rate(true);
    check('③ big 口径片数更少', rBig.cards > 0 && rBig.cards < rFine.cards,
      `fine ${rFine.cards} 片 → big ${rBig.cards} 片`);
    // 回到「开」的状态拍照
    await page.evaluate(() => { rea.battle.c01.set('smokeShape', true); });

    // ⑤ 开/关画布像素分布不同
    const px = async () => page.evaluate(() => {
      const r = rea.view.renderer, gl = r.getContext();
      rea.view.render(0.016);
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const buf = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let dark = 0, tot = 0;
      for (let i = 0; i < buf.length; i += 4 * 7) { tot++; if (buf[i] + buf[i + 1] + buf[i + 2] < 240) dark++; }
      return { dark, tot, ratio: +(dark / tot).toFixed(4) };
    });
    const pxOn = await px();
    await page.screenshot({ path: 'artifacts/coverage/smoke-c01-native-on.png' });

    // ② 关掉：可逆
    const off = await page.evaluate(async () => {
      const sm = rea.view.smoke, c01 = rea.battle.c01;
      c01.set('smokeShape', false);
      for (let i = 0; i < 30; i++) sm.update(1 / 60, undefined, rea.view.camera);
      return { lobeStyle: sm.lobeStyle, topBreak: sm.topBreak, crownOn: sm.crownOn, hazeOn: sm.hazeOn,
        hasShape: !!sm.shape, haze: sm.hazeStats && sm.hazeStats.quads };
    });
    check('② 关掉回到 fine', off.lobeStyle === 'fine' && !off.topBreak && !off.crownOn && !off.hazeOn,
      `lobeStyle=${off.lobeStyle} topBreak=${off.topBreak} hazeOn=${off.hazeOn}`);
    check('② 关掉后无残留外挂', off.hasShape === false, `shape=${off.hasShape}`);
    const pxOff = await px();
    await page.screenshot({ path: 'artifacts/coverage/smoke-c01-native-off.png' });
    check('⑤ 开/关像素不同', Math.abs(pxOn.ratio - pxOff.ratio) > 0.0004,
      `dark ratio on=${pxOn.ratio} off=${pxOff.ratio}`);

    out.before = before; out.rate = { fine: rFine, big: rBig }; out.on = on; out.off = off; out.px = { on: pxOn, off: pxOff };
    if (errors.length) { out.ok = false; out.errors = errors; }
    fs.writeFileSync('artifacts/coverage/smoke-c01-native-browser.json', JSON.stringify(out, null, 2));
    console.log(out.ok ? 'ALL PASS' : 'SOME FAIL', JSON.stringify({ px: out.px }));
    process.exitCode = out.ok ? 0 : 1;
  } catch (e) {
    console.error('ERR', e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
