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
 *                      controls and possibly some drag-to-paint mode"   光标处拉出一条白色细线（第 147 轮按原片改成实线），沿拓扑直线穿过格子，绕回起点即闭环。
 *
 * 全部走主场景的真实命令：setTool / undo / redo / pushUndo / encodeWorld / decodeWorld / view.setDebug('grid')；
 * 直线用共享 core/grid.js traceStraightReport。手柄：方向键 / 手柄十字键让光标沿拓扑直线一格格走，A 键（或 Enter）建造。
 */
import * as THREE from 'three';
import { mountIconToolbar } from './icon-toolbar.js';
import { DEFAULT_ICONS, iconSvg } from './icon-ink.js';
import { playfulJitter } from '../core/playful-layout.js';
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
#gameui-c06 .gtool .ic{color:var(--ink,#2a2a3a);transform:rotate(var(--tilt,0deg));transition:transform .12s}
#gameui-c06 .gtool .act{background:#8d8d93;border-color:#6d6d73;color:#fff}
#gameui-c06 .gtool .act:disabled{background:#a3a3a8;border-color:#88888e;cursor:default}
#gameui-c06 .gtool .ic svg,#gameui-c06 .gtool .act svg{width:26px;height:26px}
#gameui-c06 .gtool .ic.on{transform:rotate(-4deg) scale(1.08);color:#fff}
#gameui-c06 .gtool .ic.on::after{content:'';position:absolute;left:46px;top:12px;border:7px solid transparent;border-left:0;border-right:10px solid #fff;filter:drop-shadow(0 1px 1px #0006)}
#gameui-c06 .gtool .sep{height:6px}
#gameui-c06{--gmw:167px;--u:1}
#gameui-c06 .gmenu{position:fixed;right:0;top:0;width:var(--gmw);z-index:40;display:flex;flex-direction:column;gap:0;padding:calc(var(--u)*8px) calc(var(--u)*11px) calc(var(--u)*10px) calc(var(--u)*5px);background:rgba(240,225,182,.97);border-left:calc(var(--u)*2px) solid #2f2d2b;border-bottom:calc(var(--u)*2px) solid #2f2d2b;border-bottom-left-radius:calc(var(--u)*10px)}
#gameui-c06 .gmenu.hidden{display:none}
#gameui-c06 .gmenu button{--hh:36;box-sizing:border-box;height:calc(var(--u)*var(--hh)*1px);border-radius:calc(var(--u)*7px);border:calc(var(--u)*2px) solid #333;font-family:'Courier New',monospace;font-weight:600;font-size:calc(var(--u)*13px);line-height:1;letter-spacing:.5px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:0 calc(var(--u)*10px);color:#222}
#gameui-c06 .gmenu button[data-g="primary"]{--hh:60;background:#c6f0b5;border-color:#2f5233;color:#1d3b22}
#gameui-c06 .gmenu button[data-g="warn"]{background:#f1b5af;border-color:#7a2f2a;color:#3d1a17}
#gameui-c06 .gmenu button[data-g="soft"]{background:#f1dfc0;border-color:#5c4a2a;color:#3a2f16;font-size:calc(var(--u)*11px)}
#gameui-c06 .gmenu button[data-g="blue"]{--hh:45;background:#b4c9e1;border-color:#2c3f5a;color:#16283d}
#gameui-c06 .gmenu button>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#gameui-c06 .gmenu .pair{display:flex;gap:calc(var(--u)*4px)}#gameui-c06 .gmenu .pair button{flex:1;--hh:65}
#gameui-c06 .gcount{display:flex;gap:calc(var(--u)*4px);margin-top:calc(var(--u)*3px)}
#gameui-c06 .gcount span{flex:1;text-align:center;font-family:'Courier New',monospace;font-weight:700;font-size:calc(var(--u)*11px);line-height:1.6;color:#4a4438}
#gameui-c06 .gmenu button .knobs{display:flex;gap:calc(var(--u)*7px)}
#gameui-c06 .gmenu button .knob{width:calc(var(--u)*17px);height:calc(var(--u)*17px);border-radius:50%;border:calc(var(--u)*2px) solid #2c3f5a;background:#e8eef6;display:inline-block}
#gameui-c06 .gmenu button .knob.on{background:#4d6f9c}
#gameui-c06 .gclose{position:fixed;right:calc(var(--u)*8px);top:calc(var(--u)*5px);width:calc(var(--u)*60px);height:calc(var(--u)*62px);border-radius:calc(var(--u)*12px);border:none;background:#3a3a3c;color:#fff;font-family:system-ui;font-weight:700;font-size:calc(var(--u)*26px);line-height:1;cursor:pointer;z-index:41;transition:right .12s}
#gameui-c06.menu-open .gclose{right:calc(var(--gmw) + var(--u)*10px)}
#gameui-c06 .gsave{position:fixed;left:64px;top:8px;right:70px;z-index:40;font:10px/1.25 monospace;color:#fffc;text-shadow:0 1px 1px #0008;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
#gameui-c06 .gtoast{position:fixed;right:230px;top:70px;background:#222d;color:#fff;padding:5px 9px;border-radius:6px;font:12px system-ui;z-index:41;display:none}`;
  root.append(css); document.body.append(root);
  let disposeFn = null;   // 退出按钮要用（返回对象在文件末尾才构造）
  const hidden = [], restores = [];
  const hide = (id) => { const el = document.getElementById(id); if (el) { hidden.push([el, el.style.display]); el.style.display = 'none'; } };
  const toastEl = document.createElement('div'); toastEl.className = 'gtoast'; root.append(toastEl);
  const toast = (m) => { toastEl.textContent = m; toastEl.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (toastEl.style.display = 'none'), 1600); };
  const state = { tool: 'build', saveText: '', saveUpdates: 0, menuOpen: false, line: null, cursor: null, lastVersion: -1, commands: [] };
  const log = (c) => { state.commands.push(c); if (state.commands.length > 50) state.commands.shift(); };

  /* ---- 1201179450668441600 图标工具条 ---- */
  let bar = null, actButtons = null;
  if (toolbar) {
    hide('tools');
    const host = document.createElement('div'); host.className = 'gtool'; root.append(host);
    // 片中四个工具格各自一种底色（玫瑰/青/橄榄/棕），未选中时图形是同色系的浅色，选中变纯白 —— 见 r133 证据
    const items = [
      { key: 'build', label: '建造', paths: ICONS.build, color: '#b3708a', ink: '#f2cfda', tilt: -2.6 },
      { key: 'erase', label: '拆除', paths: ICONS.erase, color: '#5f8f92', ink: '#bfe0e2', tilt: 1.8 },
      { key: 'paint', label: '刷色', paths: ICONS.paint, color: '#8b8b4c', ink: '#e2e2b4', tilt: -1.4 },
    ];
    if (topoline) items.push({ key: 'line', label: '拓扑直线连刷', paths: ICONS.line, color: '#8d6242', ink: '#e8cbb4', tilt: 2.4 });
    const tb = document.createElement('div'); tb.style.display = 'contents'; host.append(tb);
    bar = mountIconToolbar(tb, items, { value: 'build', onChange: (k) => { state.tool = k; setTool(k === 'line' ? 'build' : k); log('tool:' + k); } });
    for (const b of tb.querySelectorAll('.ic')) {
      const it = items.find((x) => x.key === b.dataset.key);
      b.style.setProperty('--ink', it.ink); b.style.setProperty('--tilt', it.tilt + 'deg');
      b.dataset.tile = it.color;
    }
    const sep = document.createElement('div'); sep.className = 'sep'; host.append(sep);
    // 片中下方三项（撤销/重做/叉）是灰底白描边；撤销·重做不可用时整格灰掉（= 真实栈为空），叉 = 退出图标 UI
    const act = (label, paths, fn) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'act'; b.setAttribute('aria-label', label); b.dataset.act = label;
      b.innerHTML = iconSvg(paths, { scale: 1.25, width: 2.1, size: 26, color: 'currentColor' });
      b.onclick = () => { fn(); refreshActs(); };
      host.append(b); return b;
    };
    const undoB = act('撤销', DEFAULT_ICONS.undo, () => { undo(); log('undo'); });
    const redoB = act('重做', DEFAULT_ICONS.redo, () => { redo(); log('redo'); });
    const exitB = act('退出', DEFAULT_ICONS.close, () => { state.exited = true; log('exit'); if (disposeFn) disposeFn(); });
    actButtons = { undo: undoB, redo: redoB, exit: exitB };
    state.actButtons = actButtons;
  }
  /** 撤销/重做的可用态 = 主场景真实栈的深度（app.js 传进来的 undoDepth/redoDepth，默认回落到 HUD 按钮的 disabled）。 */
  const refreshActs = () => {
    if (!actButtons) return;
    const d = api.undoDepth?.(), r = api.redoDepth?.();
    const dUndo = typeof d === 'number' ? d === 0 : document.getElementById('undo')?.disabled !== false;
    const dRedo = typeof r === 'number' ? r === 0 : document.getElementById('redo')?.disabled !== false;
    actButtons.undo.disabled = dUndo; actButtons.redo.disabled = dRedo;
    state.actState = { undo: dUndo, redo: dRedo, depth: d, redoDepth: r };
    state.updateCounts?.();
  };

  /* ---- 1242824460325052417 倾斜按钮菜单 ---- */
  let menuEl = null;
  if (menu) {
    hide('topright');
    const env = document.getElementById('environment-panel'); if (env?.open) { env.open = false; restores.push(() => { env.open = true; }); }
    // 片内几何（512×512 帧实测，见 artifacts/coverage/1242824460325052417-review-r199.md）：
    // 面板贴右缘、宽 167（视口 32.6%）；行宽 152（左留 4 / 右留 11）；主行动高 60、次级 36、Undo/Redo 双联 74×65、Grid 45。
    const scale = () => { const u = Math.max(.9, Math.min(1.6, (innerWidth * .326) / 167)); root.style.setProperty('--u', String(u)); root.style.setProperty('--gmw', (167 * u).toFixed(1) + 'px'); return u; };
    scale(); addEventListener('resize', scale);
    const close = document.createElement('button'); close.className = 'gclose'; close.textContent = '≡'; close.setAttribute('aria-label', '菜单'); root.append(close);
    menuEl = document.createElement('div'); menuEl.className = 'gmenu hidden'; root.append(menuEl);
    const spec = [
      ['new', 'New', 0, 0, () => { pushUndo(world.snapshot()); world.reset(); view.changed(); scheduleHash(); toast('新建'); }],
      ['open', 'Open', 0, 0, () => { const s = prompt('粘贴存档字符串'); if (s) load(s); }],
      ['quit', 'Quit', 1, 2, () => setMenu(false)],
      ['save', 'Save to Clipboard', 2, 5, async () => { const s = encodeWorld(world, getScene()); state.clipboard = s; try { await navigator.clipboard.writeText(s); } catch { /* 无权限时退到内存剪贴板 */ } toast(`已复制 ${s.length} 字符`); }],
      ['load', 'Load from Clipboard', 2, 5, async () => { let s = state.clipboard; try { s = (await navigator.clipboard.readText()) || s; } catch { /* 同上 */ } if (s) load(s); else toast('剪贴板为空'); }],
      ['undo', 'Undo', 3, 15, () => undo()], ['redo', 'Redo', 3, 15, () => redo()],
      ['grid', 'Grid', 4, 10, () => { state.grid = !state.grid; view.setDebug('grid', state.grid); syncGrid(); }],
    ];
    const GROUP = { 0: 'primary', 1: 'warn', 2: 'soft', 3: 'warn', 4: 'blue' };
    const H = { 0: 60, 1: 36, 2: 36, 3: 65, 4: 45 };
    const GLYPH = { new: '⌂', open: '⌂⌂⌂', quit: '✕', save: '⇪', load: '⇩', undo: '↶', redo: '↷' };
    const buttons = {};
    const make = ([key, label, g, mt, fn]) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.key = key; b.dataset.g = GROUP[g];
      const gap = key === 'save' || key === 'load' ? 4 : 10;
      const j = playfulJitter(key, { seed: 31, width: 151, height: H[g], gap, maxRot: 2.3, maxDx: 3, maxDy: 1.5 });
      b.style.transform = `translate(${j.dx}px,${j.dy}px) rotate(${j.rot}deg)`;
      b.style.marginTop = `calc(var(--u)*${mt}px)`;
      b.innerHTML = key === 'grid'
        ? `<span>${label}</span><span class="knobs" aria-hidden="true"><i class="knob" data-knob="grid"></i><i class="knob" data-knob="regular"></i></span>`
        : `<span>${label}</span><span aria-hidden="true">${GLYPH[key]}</span>`;
      b.onclick = async (e) => {
        const knob = e.target.closest?.('.knob');
        if (knob && knob.dataset.knob === 'regular') { e.stopPropagation(); state.gridRegular = !state.gridRegular; view.setDebug('gridregular', state.gridRegular); syncGrid(); log('menu:gridregular'); return; }
        await fn(); log('menu:' + key);
      };
      buttons[key] = { el: b, rot: j.rot };
      return b;
    };
    const syncGrid = () => {
      const g = buttons.grid?.el.querySelector('[data-knob="grid"]'), r = buttons.grid?.el.querySelector('[data-knob="regular"]');
      g?.classList.toggle('on', !!state.grid); r?.classList.toggle('on', !!state.gridRegular);
    };
    for (const s of spec) {
      if (s[0] === 'undo') {
        const p = document.createElement('div'); p.className = 'pair'; p.style.marginTop = `calc(var(--u)*15px)`;
        const ub = make(s), rb = make(spec.find((x) => x[0] === 'redo')); ub.style.marginTop = '0'; rb.style.marginTop = '0';
        p.append(ub, rb); menuEl.append(p);
        // 片内 Undo/Redo 下方两枚数字 = 真实栈深度（本仓 undoDepth/redoDepth）
        const cnt = document.createElement('div'); cnt.className = 'gcount';
        cnt.innerHTML = '<span data-count="undo">0</span><span data-count="redo">0</span>'; menuEl.append(cnt); state.countEl = cnt;
        state.updateCounts = () => {
          const d = api.undoDepth?.(), r = api.redoDepth?.();
          cnt.querySelector('[data-count="undo"]').textContent = typeof d === 'number' ? String(d) : '0';
          cnt.querySelector('[data-count="redo"]').textContent = typeof r === 'number' ? String(r) : '0';
        };
        state.updateCounts();
      } else if (s[0] !== 'redo') menuEl.append(make(s));
    }
    state.menuButtons = buttons;
    state.menuSpec = spec.map(([key, label, g, mt]) => ({ key, label, group: GROUP[g], height: H[g], marginTop: mt }));
    const setMenu = (on) => { state.menuOpen = on; menuEl.classList.toggle('hidden', !on); root.classList.toggle('menu-open', on); close.textContent = on ? '✕' : '≡'; if (on) syncGrid(); };
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
  let lineObj = null, trailObj = null, cursorObj = null, canvas = view.renderer?.domElement || document.getElementById('view');
  const lineY = (c) => Math.max(0, world.top(c)) * view.levelHeight + .04;
  const toPoints = (res) => res.points.map(([x, z]) => { const c = view.index?.cellAt?.(x, z) ?? res.cells[0]; return new THREE.Vector3(x, lineY(c), z); });
  const drawLine = (res) => {
    // 第 147 轮：原片这条线是**实线**（frame-0300 4× 最近邻裁切：连续 1px 白线，无 dash 间隔）→ 由虚线改实线；
    // 名字/标记留给验收用（tests/topoline-pad-drag-browser.cjs 按 name 取对象，不靠材质类型猜）。
    if (!lineObj) { lineObj = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: .95 })); lineObj.name = 'topoline-line'; lineObj.userData.topoline = true; lineObj.renderOrder = 20; lineObj.frustumCulled = false; view.scene.add(lineObj); }
    if (!res) { lineObj.visible = false; return; }
    lineObj.geometry.dispose(); lineObj.geometry = new THREE.BufferGeometry().setFromPoints(toPoints(res)); lineObj.visible = true;
  };
  /** 第 147 轮：原片里**同时留着好几条线**（frame-0650 一屏 4–5 条直线 + 小闭环，互相交叉/共格），
   *  本仓原先只画「当前光标这一条」→ 补一条历史轨迹层（最近 MAX_TRACES 条，压暗一档、画在当前线下面）。 */
  const MAX_TRACES = 5;
  const drawTrails = () => {
    const list = state.traces || [];
    if (!list.length) { if (trailObj) trailObj.visible = false; return; }
    if (!trailObj) { trailObj = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: .5 })); trailObj.name = 'topoline-trails'; trailObj.renderOrder = 19; trailObj.frustumCulled = false; view.scene.add(trailObj); }
    const seg = [];
    for (const pts of list) for (let i = 0; i + 1 < pts.length; i++) seg.push(pts[i], pts[i + 1]);
    trailObj.geometry.dispose(); trailObj.geometry = new THREE.BufferGeometry().setFromPoints(seg); trailObj.visible = seg.length > 0;
  };
  const drawCursor = (c) => {
    if (!cursorObj) { cursorObj = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffe066, depthTest: false })); cursorObj.renderOrder = 21; view.scene.add(cursorObj); }
    cursorObj.geometry.dispose(); cursorObj.geometry = new THREE.BufferGeometry().setFromPoints(c.pts.map((p) => new THREE.Vector3(p.x, lineY(c) + .01, p.z)));
  };
  const setLine = (cell, edge) => {
    const res = straightLineThrough(grid, cell, edge);
    const key = cell.id + ':' + edge;
    if (key !== state.lineKey) {
      // 换了「格 + 出口边」：把上一条当前线压进历史轨迹（原片一屏留好几条）
      if (state.activePts) { state.traces = state.traces || []; state.traces.unshift(state.activePts); state.traces.length = Math.min(state.traces.length, MAX_TRACES); drawTrails(); }
      state.lineKey = key;
    }
    state.activePts = toPoints(res);
    state.line = { cell: cell.id, edge, cells: res.cells.map((c) => c.id), closed: res.closed, reason: res.reason, points: res.points.length };
    drawLine(res); return res;
  };
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
    refreshActs();
    if (topoline && navigator.getGamepads) for (const pad of navigator.getGamepads()) {
      if (!pad) continue;
      const btn = (i) => !!pad.buttons[i]?.pressed;
      for (const [i, k] of [[12, 'up'], [13, 'down'], [14, 'left'], [15, 'right']]) { if (btn(i) && !padPrev[i]) stepCursor(k); padPrev[i] = btn(i); }
      if (btn(0) && !padPrev[0]) paintLine(); padPrev[0] = btn(0);
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
  const handle = {
    state, bar, actButtons, refreshActs, stepCursor, setLine: (id, e) => setLine(grid.cells[id], e), paintLine, load, refreshSave,
    clearTraces: () => { state.traces = []; state.activePts = null; state.lineKey = null; drawTrails(); state.line = null; drawLine(null); },
    click: (key) => state.menuButtons?.[key]?.el.click(), selectTool: (k) => { bar?.setValue(k); state.tool = k; setTool(k === 'line' ? 'build' : k); refreshActs(); },
    dispose() { cancelAnimationFrame(raf); ac.abort(); bar?.dispose(); root.remove(); for (const [el, d] of hidden) el.style.display = d; for (const f of restores) f(); for (const o of [lineObj, trailObj, cursorObj]) if (o) { view.scene.remove(o); o.geometry.dispose(); o.material.dispose(); } },
  };
  disposeFn = handle.dispose;
  return handle;
}
