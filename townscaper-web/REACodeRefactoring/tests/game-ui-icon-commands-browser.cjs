// 1201179450668441600 "Icons!" 运行时验收（r133）：图标工具条在**主场景**里发的是真命令，不是本地假工具。
// 片中可量的四件事 → 本测四项：
//   ① 形态：4 个工具格各自一种底色（玫瑰/青/橄榄，本仓 3 个工具 + 可选直线）、每格轻微倾斜、
//      选中格 = 图形变纯白 + 右侧白三角（◀，10px），未选中 = 同色系浅色图形 + 无三角；
//   ② 下方三项（撤销/重做/退出）是灰底白描边；**撤销/重做的可用态 = 主场景真实撤销栈深度**（片中灰 = 不可用）；
//   ③ 命令：真指针点地 → 建一块 → 撤销栈 1 → 撤销可用；点撤销 → 体素回到基线（真 undo）；点重做 → 回来（真 redo）；
//   ④ 退出：点叉 → #gameui-c06 摘掉、被隐藏的 #tools 恢复显示（= 退出的是这套图标 UI，不是清空城镇）。
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const out = path.join(__dirname, '..', 'artifacts', 'coverage');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const errors = [];
  const fail = (m) => { throw new Error(m); };
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto('http://localhost:8769/index.html?scene=town&grid=quad&seed=3&gameui=1');
    await page.waitForFunction(() => window.rea?.gameUI?.actButtons?.undo, null, { timeout: 90000, polling: 200 });
    await page.waitForTimeout(700);

    /* ---- ① 工具条形态 ---- */
    const ui = await page.evaluate(() => {
      const root = document.getElementById('gameui-c06');
      const cs = (el, p) => getComputedStyle(el, p);
      const rot = (t) => { const m = /matrix\(([^)]+)\)/.exec(t); if (!m) return 0; const [a, b] = m[1].split(',').map(Number); return Math.round((Math.atan2(b, a) * 180 / Math.PI) * 100) / 100; };
      const ics = [...root.querySelectorAll('.gtool .ic')], acts = [...root.querySelectorAll('.gtool .act')];
      return {
        tools: ics.map((b) => ({
          key: b.dataset.key, on: b.classList.contains('on'), bg: cs(b).backgroundColor, ink: cs(b).color,
          tilt: rot(cs(b).transform), paths: b.querySelectorAll('svg path').length,
          dLen: (b.querySelector('svg path')?.getAttribute('d') || '').length,
          inkWidth: +(b.dataset.inkWidth || 0), tri: cs(b, '::after').borderRightWidth,
        })),
        acts: acts.map((b) => ({ label: b.dataset.act, disabled: b.disabled, bg: cs(b).backgroundColor, ink: cs(b).color, paths: b.querySelectorAll('svg path').length })),
        actState: window.rea.gameUI.state.actState,
        toolsDisplay: cs(document.getElementById('tools')).display,
        barRole: [...root.querySelectorAll('.gtool [role=toolbar]')].length,
      };
    });
    if (ui.tools.length !== 3) fail('toolbar should have 3 tool tiles, got ' + ui.tools.length);
    if (ui.tools.some((t) => !t.paths || t.dLen < 10)) fail('every tool tile must carry an inline SVG stroke path');
    if (new Set(ui.tools.map((t) => t.bg)).size !== 3) fail('tiles must each have their own background colour');
    if (ui.tools.some((t) => Math.abs(t.tilt) < 0.5 || Math.abs(t.tilt) > 6)) fail('every tile must be slightly tilted (0.5–6°), got ' + JSON.stringify(ui.tools.map((t) => t.tilt)));
    const widths = ui.tools.map((t) => t.inkWidth);
    if (widths.some((w) => !(w > 0))) fail('ink widths must be resolved per icon, got ' + JSON.stringify(widths));
    const on = ui.tools.filter((t) => t.on);
    if (on.length !== 1) fail('exactly one tile selected, got ' + on.length);
    if (on[0].ink !== 'rgb(255, 255, 255)') fail('selected glyph must be pure white, got ' + on[0].ink);
    if (on[0].tri !== '10px') fail('selected tile must show the white triangle, got border-right ' + on[0].tri);
    const off = ui.tools.filter((t) => !t.on);
    if (off.some((t) => t.ink === 'rgb(255, 255, 255)')) fail('unselected glyphs must stay tinted, not white');
    if (off.some((t) => t.tri !== '0px')) fail('unselected tiles must not show the triangle');

    /* ---- ② 三项灰底白描边 + 可用态来自真实栈 ---- */
    if (ui.acts.length !== 3) fail('3 action tiles expected, got ' + ui.acts.length);
    const labels = ui.acts.map((a) => a.label).join('/');
    if (labels !== '撤销/重做/退出') fail('action tiles must be 撤销/重做/退出, got ' + labels);
    if (ui.acts.some((a) => a.ink !== 'rgb(255, 255, 255)')) fail('action glyphs must be white-on-grey');
    if (ui.acts.some((a) => a.paths < 1)) fail('action tiles must use icon-ink stroke paths');
    if (!ui.acts[0].disabled || !ui.acts[1].disabled) fail('undo/redo must start disabled (empty stacks), got ' + JSON.stringify(ui.acts.map((a) => a.disabled)));
    if (ui.toolsDisplay !== 'none') fail('#tools must be hidden while the icon bar is mounted, got ' + ui.toolsDisplay);

    /* ---- ③ 真命令：点地建造 → 撤销 → 重做 ---- */
    const base = await page.evaluate(() => {
      const w = window.rea.world; let n = 0;
      for (const m of w.solid) { let v = m; while (v) { n += v & 1; v >>= 1; } }
      return n;
    });
    const hit = await page.evaluate(() => {
      const { view } = window.rea, c = document.getElementById('view'), r = c.getBoundingClientRect();
      for (let y = r.top + r.height * 0.30; y < r.top + r.height * 0.80; y += 6) {
        for (let x = r.left + r.width * 0.28; x < r.left + r.width * 0.78; x += 6) {
          const h = view.pick(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
          if (h?.cell && h.level) return { x: Math.round(x), y: Math.round(y), id: h.cell.id, level: h.level };
        }
      }
      return null;
    });
    if (!hit) fail('no pickable cell found in viewport');
    // 真指针一笔：move → down →（保持一下，确保 setPointerCapture 已生效）→ up，up 才 pushUndo
    await page.mouse.move(hit.x, hit.y);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const afterBuild = await page.evaluate(() => {
      const w = window.rea.world; let n = 0;
      for (const m of w.solid) { let v = m; while (v) { n += v & 1; v >>= 1; } }
      return { n, act: window.rea.gameUI.state.actState, cmds: window.rea.gameUI.state.commands.slice(-4) };
    });
    if (afterBuild.n !== base + 1) fail('one click should add exactly one voxel: ' + base + ' -> ' + afterBuild.n);
    await page.waitForTimeout(350);
    const st1 = await page.evaluate(() => ({ act: window.rea.gameUI.state.actState, disabled: window.rea.gameUI.actButtons.undo.disabled }));
    if (st1.act.depth !== 1 || st1.disabled) fail('after a build the undo tile must enable (depth 1), got ' + JSON.stringify(st1));

    await page.evaluate(() => window.rea.gameUI.actButtons.undo.click());
    await page.waitForTimeout(250);
    const afterUndo = await page.evaluate(() => {
      const w = window.rea.world; let n = 0;
      for (const m of w.solid) { let v = m; while (v) { n += v & 1; v >>= 1; } }
      return { n, act: window.rea.gameUI.state.actState, undoDisabled: window.rea.gameUI.actButtons.undo.disabled, redoDisabled: window.rea.gameUI.actButtons.redo.disabled };
    });
    if (afterUndo.n !== base) fail('undo must revert the voxel: expected ' + base + ', got ' + afterUndo.n);
    if (!afterUndo.undoDisabled || afterUndo.redoDisabled) fail('after undo: undo must grey out (depth 0) and redo must light up, got ' + JSON.stringify(afterUndo));

    await page.evaluate(() => window.rea.gameUI.actButtons.redo.click());
    await page.waitForTimeout(250);
    const afterRedo = await page.evaluate(() => {
      const w = window.rea.world; let n = 0;
      for (const m of w.solid) { let v = m; while (v) { n += v & 1; v >>= 1; } }
      return { n, act: window.rea.gameUI.state.actState };
    });
    if (afterRedo.n !== base + 1) fail('redo must restore the voxel, got ' + afterRedo.n);

    // 工具切换走的是真 setTool：选中态与 state.tool 同步
    // 真点一次图标格：mountIconToolbar 的 onChange 只在"选择真的变了"时发，所以这里不能先 setValue
    await page.click('#gameui-c06 .gtool .ic[data-key="erase"]');
    const tool = await page.evaluate(() => ({ on: document.querySelector('#gameui-c06 .gtool .ic.on')?.dataset.key, t: window.rea.gameUI.state.tool, cmds: window.rea.gameUI.state.commands.slice(-3) }));
    if (tool.on !== 'erase' || tool.t !== 'erase') fail('tool switch must land on erase, got ' + JSON.stringify(tool));

    // 截图：工具条 + 右侧菜单（菜单用 ≡ 打开）
    await page.evaluate(() => document.querySelector('#gameui-c06 .gclose')?.click());
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, 'game-ui-icon-r133-page.png') });
    const barShot = await page.locator('#gameui-c06 .gtool').screenshot({ path: path.join(out, 'game-ui-icon-r133-bar.png') });
    if (!barShot || barShot.length < 1000) fail('toolbar screenshot looks empty');

    /* ---- ④ 退出 = 摘掉图标 UI 并恢复默认 HUD ---- */
    await page.evaluate(() => window.rea.gameUI.actButtons.exit.click());
    await page.waitForTimeout(250);
    const exited = await page.evaluate(() => ({
      root: !!document.getElementById('gameui-c06'),
      tools: getComputedStyle(document.getElementById('tools')).display,
      exited: window.rea.gameUI.state.exited,
      cmds: window.rea.gameUI.state.commands.slice(-2),
    }));
    if (exited.root) fail('#gameui-c06 must be removed on exit');
    if (exited.tools === 'none') fail('#tools must come back after exit, got ' + exited.tools);
    if (!exited.exited) fail('exit must be recorded in state.exited');

    if (errors.length) fail('console/page errors: ' + JSON.stringify(errors.slice(0, 4)));
    console.log('PASS game-ui-icon-commands', JSON.stringify({
      tools: ui.tools.map((t) => ({ k: t.key, tilt: t.tilt, w: t.inkWidth, on: t.on })),
      acts: ui.acts.map((a) => ({ l: a.label, d: a.disabled })),
      voxels: [base, afterBuild.n, afterUndo.n, afterRedo.n],
      depth: [st1.act.depth, afterUndo.act.depth, afterRedo.act.depth],
      tool: tool.on, exitRestored: exited.tools,
    }));
  } catch (e) {
    console.log('FAIL game-ui-icon-commands ' + e.message);
    if (errors.length) console.log('errors: ' + JSON.stringify(errors.slice(0, 5)));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
