/**
 * squad-hud-browser.cjs — 队旗血量槽 + 击杀飘字 + 脚下线网，两页一起验收
 *   · squad-hud.html      839067977781768193：槽按血量比例缩、受击闪红、飘字合并/淡出
 *   · squad-footprint.html 883447205176238083：轮廓角数/辐条/三角面/角标随占位变
 * 只看画布上真画出来的像素，不看 exit code。
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const b = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  let ok = 0;
  const check = (name, cond, detail) => {
    if (!cond) throw new Error(`FAIL ${name}: ${detail}`);
    ok++;
    console.log(`  PASS ${name} — ${detail}`);
  };
  const shot = async (p, sel, out) => {
    const el = await p.$(sel);
    await el.screenshot({ path: out });
    return out;
  };
  // 统计画布上某一族颜色的像素数（容差 12，ignore 干净背景）
  const count = (p, sel, target) =>
    p.evaluate(([sel, target]) => {
      const c = document.querySelector(sel), ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - target[0]) <= 12 && Math.abs(d[i + 1] - target[1]) <= 12 && Math.abs(d[i + 2] - target[2]) <= 12) n++;
      }
      return n;
    }, [sel, target]);

  try {
    const p = await b.newPage({ viewport: { width: 1000, height: 820 } });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    // ── 一、旗条与飘字 ──────────────────────────────────────────────
    await p.goto('http://127.0.0.1:8769/squad-hud.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__hudReady === true, null, { polling: 50 });
    await p.waitForTimeout(200);

    const s1 = await p.evaluate(() => ({
      full: window.__hud.full, hurt: window.__hud.hurt,
    }));
    check('满员条铺满', s1.full.fill.w === s1.full.width && s1.full.empty.w === 0, `fill ${s1.full.fill.w}/${s1.full.width}`);
    check('残队条缩短留空槽', s1.hurt.fill.w < s1.hurt.width && s1.hurt.empty.w > 0, `1/3 血 fill ${s1.hurt.fill.w} empty ${s1.hurt.empty.w}`);

    const greenFull = await count(p, '#full', [104, 206, 124]);
    const greenHurt = await count(p, '#hurt', [104, 206, 124]);
    check('满员绿条像素明显多于残队', greenFull > greenHurt * 1.8, `green ${greenFull} vs ${greenHurt}`);
    const slotHurt = await count(p, '#hurt', [22, 32, 42]);
    check('残队画面上真的留出深色槽底', slotHurt > 200, `slot px ${slotHurt}`);

    // 受击闪红：窗口 0.16s 内红色像素应冒出来，之后消失
    await p.click('#hit');
    const redNow = await count(p, '#hurt', [238, 74, 66]);
    check('受击当帧左端闪红', redNow > 40, `flash px ${redNow}`);
    await p.waitForTimeout(320);
    const redLater = await count(p, '#hurt', [238, 74, 66]);
    check('闪红窗口过后不再红', redLater < redNow / 4, `flash px ${redNow} → ${redLater}`);

    // 飘字：连点两次 → 合并成一条 "+20"，再过 1.2s 清空
    await p.evaluate(() => { document.getElementById('hp').value = '2'; document.getElementById('hp').dispatchEvent(new Event('input')); });
    await p.click('#kill'); await p.click('#kill');
    const popAfter = await p.evaluate(() => ({ n: window.__hud.popups, kills: window.__hud.kills }));
    check('连杀合并为一条飘字', popAfter.n === 1 && popAfter.kills === 2, `popups ${popAfter.n} / kills ${popAfter.kills}`);
    const whitePop = await p.evaluate(() => {
      const c = document.querySelector('#hurt'), ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) n++;
      return n;
    });
    check('飘字真的画在画布上', whitePop > 30, `pure white px ${whitePop}`);
    await p.waitForTimeout(1400);
    const popGone = await p.evaluate(() => window.__hud.popups);
    check('飘字 1.05s 后自行消失', popGone === 0, `popups ${popGone}`);

    await p.evaluate(() => { document.getElementById('hp').value = '1'; document.getElementById('hp').dispatchEvent(new Event('input')); });
    await p.click('#kill');
    await p.waitForTimeout(120);
    const file1 = await shot(p, '.row', 'artifacts/coverage/squad-hud.png');

    // ── 二、脚下线网 ────────────────────────────────────────────────
    await p.goto('http://127.0.0.1:8769/squad-footprint.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.__fpReady === true, null, { polling: 50 });
    const fp12 = await p.evaluate(() => window.__fp);
    check('整块 12 人：轮廓 4 角 4 三角面', fp12.ring === 4 && fp12.tris === 4 && fp12.spokes === 4, JSON.stringify(fp12));
    // 3 列 × 4 行，格心间距 1 → 轮廓 2 格 × 3 格，面积 6、周长 10
    check('12 人占位轮廓 = 2×3 格（面积 6、周长 10）', Math.abs(fp12.area - 6) < 1e-6 && Math.abs(fp12.perimeter - 10) < 1e-6, `area ${fp12.area} perimeter ${fp12.perimeter}`);

    const fp4 = await p.evaluate(() => {
      const n = document.getElementById('n'); n.value = '4'; n.dispatchEvent(new Event('input'));
      return window.__fp;
    });
    check('4 人（3+1）：轮廓塌成三角，面积 1 格', fp4.ring === 3 && fp4.tris === 3 && Math.abs(fp4.area - 1) < 1e-6, JSON.stringify(fp4));

    const fpScatter = await p.evaluate(() => {
      const n = document.getElementById('n'); n.value = '9'; n.dispatchEvent(new Event('input'));
      const sp = document.getElementById('spread'); sp.value = '0.55'; sp.dispatchEvent(new Event('input'));
      return window.__fp;
    });
    check('散开后轮廓角变多、面积变大', fpScatter.ring >= 4 && fpScatter.area > 1.2, JSON.stringify(fpScatter));

    const netPx = await count(p, '#net', [234, 253, 255]);
    check('近白青色线网像素在画布上', netPx > 400, `net px ${netPx}`);
    const file2 = await shot(p, '.row', 'artifacts/coverage/squad-footprint.png');

    // 回到默认再看一眼
    await p.evaluate(() => {
      const n = document.getElementById('n'); n.value = '12'; n.dispatchEvent(new Event('input'));
      const sp = document.getElementById('spread'); sp.value = '0'; sp.dispatchEvent(new Event('input'));
    });
    const file3 = await shot(p, '.row', 'artifacts/coverage/squad-footprint-12.png');

    check('无页面报错', errors.length === 0, errors.join(' | ') || '0 error');
    for (const f of [file1, file2, file3]) console.log('  截图 ' + f + ' ' + fs.statSync(f).size + 'B');
    console.log(`PASS squad-hud-browser：${ok} 项断言全过`);
  } finally {
    await b.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
