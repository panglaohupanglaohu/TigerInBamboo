/**
 * game-ui-c06.js — 第 56 批 C06：主场景的「游戏 UI」层（?gameui=1 打开，默认关）。
 *
 * 1201179450668441600 "Icons!"            左侧竖排图标工具条，白色小三角指着当前工具，反复切换。
 * 1242824460325052417 "Finally making some proper UI. Turns out you can make a boring list of buttons playful by
 *                      just tilting them slightly."   右侧 New/Open/Quit/Save to Clipboard/Load from Clipboard/Undo·Redo/Grid，
 *                      每个按钮轻微倾斜，颜色分组（绿/红/黄/粉/蓝）。
 * 1198957499027795969 "That bit of text up top is the save data for the current construction … Keeping the save data in a
 *                      string will make constructions easily shareable"   左上角一行小字随建造实时变化。
 * 1384958097542819845 "trace topologically straight lines across the Townscaper grid … use it for a thing in the gamepad
 *                      controls and possibly some drag-to-paint mode"   光标处拉出一条白色虚线，沿拓扑直线穿过格子，绕回起点即闭环。
 *
 * 全部走主场景的真实命令：setTool / undo / redo / pushUndo / encodeWorld / decodeWorld / view.setDebug('grid')；
 * 直线用共享 core/grid.js traceStraightReport。手柄：方向键 / 手柄十字键让光标沿拓扑直线一格格走，A 键（或 Enter）建造。
 */
import * as THREE from 'three';
import { mountIconToolbar } from './icon-toolbar.js';
import { playfulJitter, colorFor } from '../core/playful-layout.js';
import { traceStraightReport } from '../core/grid.js';
import { MAX_LEVEL } from '../core/world.js';

// 描边折线（icon-ink 的 [-1,1] 坐标，y 向上）：建造 = 菱形块，拆除 = 橡皮，刷色 = 刷子，直线 = 折线穿格
const ICONS = {
  build: [[[0, .8], [.7, 0], [0, -.8], [-.7, 0], [0, .8]], [[0, .4], [0, -.4]]],
  erase: [[[-.7, -.7], [.7, -.7]], [[-.5, -.3], [.25, .65], [.65, .25], [-.1, -.7], [-.5, -.3]]],
  paint: [[[-.7, -.7], [-.3, -.3]], [[-.3, -.3], [-.05, .05], [.65, -.65], [.4, -.9]], [[-.05, .05], [.5, .6], [.75, .35], [.2, -.2]]],
  line: [[[-.8, -.7], [-.3, -.1], [.2, -.3], [.8, .6]], [[-.8, -.7], [-.7, -.7]], [[.8, .6], [.7, .6]]],
};

/** 光标格 + 方向 → 拓扑直线两侧拼起来（向前 exit = e，向后 exit = e+2）。返回折线点与格集合。 */
export function straightLineThrough(grid, cell, edge, { max = 120 } = {}) {
  const n = cell.n, fwd = traceStraightReport(grid, cell, edge, max);
  if (fwd.closed) return { cells: [cell, ...fwd.cells.filter((c) => c !== cell)], points: [[cell.cx, cell.cz], ...fwd.segments.flatMap((s) => [s.a, s.b])], closed: true, reason: 'loop' };
  const back = n === 4 ? traceStraightReport(grid, cell, (edge + 2) % 4, max) : { cells: [], segments: [], reason: 'nonquad' };
  const mid = (e) => { const a = cell.pts[e], b = cell.pts[(e + 1) % n]; return [(a.x + b.x) / 2, (a.z + b.z) / 2]; };
  const bpts = back.segments.slice().reverse().flatMap((s) => [s.b, s.a]);
  const points = [...bpts, ...(n === 4 ? [mid((edge + 2) % 4)] : []), [cell.cx, cell.cz], mid(edge), ...fwd.segments.flatMap((s) => [s.a, s.b])];
  return { cells: [...back.cells.slice().reverse(), cell, ...fwd.cells], points, closed: false, reason: fwd.reason + '/' + back.reason };
}

/** 一格里哪条边最朝向 dir（世界 xz 向量）。 */
export function edgeToward(cell, dir) {
  let best = 0, bv = -Infinity;
  for (let e = 0; e < cell.n; e++) { const a = cell.pts[e], b = cell.pts[(e + 1) % cell.n], mx = (a.x + b.x) / 2 - cell.cx, mz = (a.z + b.z) / 2 - cell.cz, v = (mx * dir[0] + mz * dir[1]) / (Math.hypot(mx, mz) || 1); if (v > bv) { bv = v; best = e; } }
  return best;
}

export function mountGameUI(api, { savestring = true, toolbar = true, menu = true, topoline = false } = {}) {
  const { world, grid, view, setTool, undo, redo, pushUndo, encodeWorld, decodeWorld, getScene, scheduleHash } = api;
  const root = document.createElement('div'); root.id = 'gameui-c06';
  const css = document.createElement('style');
  css.textContent = `#gameui-c06 .gtool{position:fixed;left:104px;top:140px;display:flex;flex-direction:column;gap:7px;z-index:40}
#gameui-c06 .gtool .ic,#gameui-c06 .gtool .act{width:38px;height:38px;border-radius:9px;border:2px solid #2a2a3a;background:#f3efe6;display:grid;place-items:center;cursor:pointer;position:relative;padding:0}
#gameui-c06 .gtool .ic svg,#gameui-c06 .gtool .act svg{width:24px;height:24px}
#gameui-c06 .gtool .ic.on{transform:rotate(-4deg) scale(1.08);background:#f7b9c9}
#gameui-c06 .gtool .ic.on::after{content:'';position:absolute;left:46px;top:12px;border:7px solid transparent;border-left:0;border-right:10px solid #fff;filter:drop-shadow(0 1px 1px #0006)}
#gameui-c06 .gtool .sep{height:6px}
#gameui-c06 .gmenu{position:fixed;right:16px;top:64px;width:200px;z-index:40;display:flex;flex-direction:column;gap:8px}
#gameui-c06 .gmenu.hidden{display:none}
#gameui-c06 .gmenu button{height:34px;border-radius:7px;border:2px solid #333;font:600 13px/1 'Courier New',monospace;letter-spacing:.5px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:0 10px;color:#222}
#gameui-c06 .gmenu .pair{display:flex;gap:8px}#gameui-c06 .gmenu .pair button{flex:1}
#gameui-c06 .gclose{position:fixed;right:16px;top:16px;width:38px;height:38px;border-radius:8px;border:none;background:#2a2a2a;color:#fff;font:700 20px/1 system-ui;cursor:pointer;z-index:41}
#gameui-c06 .gsave{position:fixed;left:64px;top:8px;right:70px;z-index:40;font:10px/1.25 monospace;color:#fffc;text-shadow:0 1px 1px #0008;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
#gameui-c06 .gtoast{position:fixed;right:230px;top:70px;background:#222d;color:#fff;padding:5px 9px;border-radius:6px;font:12px system-ui;z-index:41;display:none}`;
  root.append(css); document.body.append(root);
  const hidden = [], restores = [];
  const hide = (id) => { const el = document.getElementById(id); if (el) { hidden.push([el, el.style.display]); el.style.display = 'none'; } };
  const toastEl = document.createElement('div'); toastEl.className = 'gtoast'; root.append(toastEl);
  const toast = (m) => { toastEl.textContent = m; toastEl.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.style.display = 'none'), 1600); };
  const state = { tool: 'build', saveText: '', saveUpdates: 0, menuOpen: false, line: null, cursor: null, lastVersion: -1, commands: [] };
  const log = (c) => { state.commands.push(c); if (state.commands.length > 50) state.commands.shift(); };

  /* ---- 1201179450668441600 图标工具条 ---- */
  let bar = null;
  if (toolbar) {
    hide('tools');
    const host = document.createElement('div'); host.className = 'gtool'; root.append(host);
    const items = [{ key: 'build', label: '建造', paths: ICONS.build }, { key: 'erase', label: '拆除', paths: ICONS.erase }, { key: 'paint', label: '刷色', paths: ICONS.paint }];
    if (topoline) items.push({ key: 'line', label: '拓扑直线连刷', paths: ICONS.line });
    const tb = document.createElement('div'); tb.style.display = 'contents'; host.append(tb);
    bar = mountIconToolbar(tb, items, { value: 'build', onChange: (k) => { state.tool = k; setTool(k === 'line' ? 'build' : k); log('tool:' + k); } });
    const sep = document.createElement('div'); sep.className = 'sep'; host.append(sep);
    const act = (label, glyph, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'act'; b.setAttribute('aria-label', label); b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#2a2a3a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${glyph}"/></svg>`; b.onclick = fn; host.append(b); return b; };
    act('撤销', 'M9 7 4 12l5 5M4 12h10a6 6 0 0 1 0 12', () => { undo(); log('undo'); });
    act('重做', 'M15 7l5 5-5 5M20 12H10a6 6 0 0 0 0 12', () => { redo(); log('redo'); });
    act('清空', 'M6 6l12 12M18 6 6 18', () => { pushUndo(world.snapshot()); world.reset(); view.changed(); scheduleHash(); log('clear'); });
  }

  /* ---- 1242824460325052417 倾斜按钮菜单 ---- */
  let menuEl = null;
  if (menu) {
    hide('topright');
    const env = document.getElementById('environment-panel'); if (env?.open) { env.open = false; restores.push(() => { env.open = true; }); }
    const close = document.createElement('button'); close.className = 'gclose'; close.textContent = '≡'; close.setAttribute('aria-label', '菜单'); root.append(close);
    menuEl = document.createElement('div'); menuEl.className = 'gmenu hidden'; root.append(menuEl);
    const spec = [
      ['new', 'New', 0, () => { pushUndo(world.snapshot()); world.reset(); view.changed(); scheduleHash(); toast('新建'); }],
      ['open', 'Open', 0, () => { const s = prompt('粘贴存档字符串'); if (s) load(s); }],
      ['quit', 'Quit', 1, () => setMenu(false)],
      ['save', 'Save to Clipboard', 2, async () => { const s = encodeWorld(world, getScene()); state.clipboard = s; try { await navigator.clipboard.writeText(s); } catch { /* 无权限时退到内存剪贴板 */ } toast(`已复制 ${s.length} 字符`); }],
      ['load', 'Load from Clipboard', 2, async () => { let s = state.clipboard; try { s = (await navigator.clipboard.readText()) || s; } catch { /* 同上 */ } if (s) load(s); else toast('剪贴板为空'); }],
      ['undo', 'Undo', 3, () => undo()], ['redo', 'Redo', 3, () => redo()],
      ['grid', 'Grid', 4, () => { state.grid = !state.grid; view.setDebug('grid', state.grid); }],
    ];
    const groups = 5, buttons = {};
    const make = ([key, label, g, fn]) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.key = key;
      const c = colorFor([2, 0, 1, 4, 3][g] ?? g, groups);
      const j = playfulJitter(key, { seed: 31, width: key === 'undo' || key === 'redo' ? 92 : 200, height: 34, gap: 8, maxRot: 3, maxDx: 3, maxDy: 1 });
      b.style.background = c.fill; b.style.borderColor = c.edge; b.style.transform = `translate(${j.dx}px,${j.dy}px) rotate(${j.rot}deg)`;
      b.innerHTML = `<span>${label}</span><span aria-hidden="true">${{ new: '□', open: '⌂', quit: '✕', save: '⇪', load: '⇩', undo: '↶', redo: '↷', grid: '▦' }[key]}</span>`;
      b.onclick = async () => { await fn(); log('menu:' + key); };
      buttons[key] = { el: b, rot: j.rot };
      return b;
    };
    for (const s of spec) {
      if (s[0] === 'undo') { const p = document.createElement('div'); p.className = 'pair'; p.append(make(s), make(spec.find((x) => x[0] === 'redo'))); menuEl.append(p); }
      else if (s[0] !== 'redo') menuEl.append(make(s));
    }
    state.menuButtons = buttons;
    const setMenu = (on) => { state.menuOpen = on; menuEl.classList.toggle('hidden', !on); close.textContent = on ? '✕' : '≡'; };
    close.onclick = () => setMenu(!state.menuOpen);
    state.setMenu = setMenu;
  }
  function load(s) {
    const snap = world.snapshot();
    try { decodeWorld(s.trim().replace(/^.*#/, ''), world); pushUndo(snap); view.changed(); scheduleHash(); toast('已载入'); log('load'); }
    catch (e) { world.restore(snap); view.changed(); toast('存档无效：' + e.message); log('load-fail'); }
  }

  /* ---- 1198957499027795969 左上角实时存档串 ---- */
  let saveEl = null;
  if (savestring) { saveEl = document.createElement('div'); saveEl.className = 'gsave'; root.append(saveEl); }
  const refreshSave = () => {
    if (!saveEl || world.version === state.lastVersion) return;
    state.lastVersion = world.version;
    try { state.saveText = encodeWorld(world, getScene()); state.saveUpdates++; saveEl.textContent = `${getScene()} ${state.saveText.length}ch · ${state.saveText}`; } catch (e) { saveEl.textContent = '（当前场景不能存档：' + e.message + '）'; }
  };

  /* ---- 1384958097542819845 拓扑直线 + 手柄光标 + 连刷 ---- */
  let lineObj = null, cursorObj = null, canvas = view.renderer?.domElement || document.getElementById('view');
  const lineY = (c) => Math.max(0, world.top(c)) * view.levelHeight + .04;
  const drawLine = (res) => {
    if (!lineObj) { lineObj = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: .12, gapSize: .09, depthTest: false, transparent: true })); lineObj.renderOrder = 20; lineObj.frustumCulled = false; view.scene.add(lineObj); }
    if (!res) { lineObj.visible = false; return; }
    const byCell = new Map(); for (const c of res.cells) byCell.set(c.id, c);
    const P = res.points.map(([x, z]) => { const c = view.index?.cellAt?.(x, z) ?? res.cells[0]; return new THREE.Vector3(x, lineY(c), z); });
    lineObj.geometry.dispose(); lineObj.geometry = new THREE.BufferGeometry().setFromPoints(P); lineObj.computeLineDistances(); lineObj.visible = true;
  };
  const drawCursor = (c) => {
    if (!cursorObj) { cursorObj = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffe066, depthTest: false })); cursorObj.renderOrder = 21; view.scene.add(cursorObj); }
    cursorObj.geometry.dispose(); cursorObj.geometry = new THREE.BufferGeometry().setFromPoints(c.pts.map((p) => new THREE.Vector3(p.x, lineY(c) + .01, p.z)));
  };
  const setLine = (cell, edge) => { const res = straightLineThrough(grid, cell, edge); state.line = { cell: cell.id, edge, cells: res.cells.map((c) => c.id), closed: res.closed, reason: res.reason, points: res.points.length }; drawLine(res); return res; };
  const paintLine = () => {
    if (!state.line) return 0;
    const snap = world.snapshot(); let n = 0;
    for (const id of state.line.cells) { const c = grid.cells[id], t = world.top(c); const target = Math.min(MAX_LEVEL, t + 1); if (target >= 1 && !world.isSolid(c, target)) { world.setSolid(c, target, true); n++; } }
    if (n) { pushUndo(snap); view.changed(); scheduleHash(); }
    log('paintline:' + n); return n;
  };
  const stepCursor = (dirKey) => {
    // 手柄：光标格沿拓扑直线前进/后退；左右换方向（转到相邻边）
    if (!state.cursor) { const c = grid.cells.reduce((b, x) => Math.hypot(x.cx, x.cz) < Math.hypot(b.cx, b.cz) ? x : b); state.cursor = { cell: c.id, edge: 0 }; }
    let c = grid.cells[state.cursor.cell], e = state.cursor.edge;
    if (dirKey === 'left' || dirKey === 'right') e = (e + (dirKey === 'right' ? 1 : c.n - 1)) % c.n;
    else {
      const out = dirKey === 'up' ? e : (e + 2) % c.n, nid = c.edgeNeighbors[out];
      if (nid >= 0) { const twin = c.edgeTwins[out], nc = grid.cells[nid]; e = dirKey === 'up' ? (twin + 2) % nc.n : twin; c = nc; }
    }
    state.cursor = { cell: c.id, edge: e }; drawCursor(c); setLine(c, e); log('pad:' + dirKey);
    return state.cursor;
  };
  const ac = new AbortController();
  if (topoline) {
    let prev = null, dragging = false;
    const ndc = (ev) => { const r = canvas.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1]; };
    canvas.addEventListener('pointermove', (ev) => {
      const hit = view.pick(...ndc(ev)); if (!hit?.cell) return;
      const c = hit.cell;
      if (prev && prev.id !== c.id) { const e = edgeToward(c, [c.cx - prev.cx, c.cz - prev.cz]); setLine(c, e); drawCursor(c); state.cursor = { cell: c.id, edge: e }; if (dragging && state.tool === 'line') paintLine(); }
      prev = c;
    }, { signal: ac.signal });
    canvas.addEventListener('pointerdown', (ev) => { if (ev.button === 0 && state.tool === 'line') { dragging = true; ev.stopImmediatePropagation(); paintLine(); } }, { signal: ac.signal, capture: true });
    addEventListener('pointerup', () => { dragging = false; }, { signal: ac.signal });
    addEventListener('keydown', (ev) => {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (map[ev.key]) { ev.preventDefault(); stepCursor(map[ev.key]); }
      else if (ev.key === 'Enter' && state.cursor) paintLine();
    }, { signal: ac.signal });
  }
  // 手柄轮询（navigator.getGamepads）：十字键 = 方向，A = 连刷当前直线
  const padPrev = {};
  let raf = 0;
  const tick = () => {
    refreshSave();
    if (topoline && navigator.getGamepads) for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      const btn = (i) => !!pad.buttons[i]?.pressed;
      for (const [i, k] of [[12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']]) { if (btn(i) && !padPrev[i]) stepCursor(k); padPrev[i] = btn(i); }
      if (btn(0) && !padPrev[0]) paintLine(); padPrev[0] = btn(0);
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
  return {
    state, bar, stepCursor, setLine: (id, e) => setLine(grid.cells[id], e), paintLine, load, refreshSave,
    click: (key) => state.menuButtons?.[key]?.el.click(), selectTool: (k) => { bar.setValue(k); state.tool = k; setTool(k === 'line' ? 'build' : k); },
    dispose() { cancelAnimationFrame(raf); ac.abort(); bar?.dispose(); root.remove(); for (const [el, d] of hidden) el.style.display = d; for (const f of restores) f(); for (const o of [lineObj, cursorObj]) if (o) { view.scene.remove(o); o.geometry.dispose(); o.material.dispose(); } },
  };
}
