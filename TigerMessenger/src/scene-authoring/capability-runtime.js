/**
 * capability-runtime.js — 游戏一侧的"能力执行接口"（经 pipeline-bridge 的固定命令调用）。
 *
 * 场景工坊（父页面）里的改造 Worker 在副本上生成候选编码，这里只负责：
 *   cap.state      当前场景编码 + 可编辑掩码（湖面范围、保护区之外）
 *   cap.preview    把候选编码载入实景预览（不写本机存档），挂上能力声明的显示层
 *   cap.show       在"候选 / 原始"之间切换对照
 *   cap.revert     放弃候选，回到进入预览前的样子
 *   cap.commit     你确认后才写入：当前工作区（可在原编辑器里撤销）
 *   cap.highlight  在实景中标出一组格子（匹配到的物件）并取景
 * 显示层的 three.js 代码来自 REACodeRefactoring/src/capabilities/layers.js（能力库原代码，不复制）。
 */
import * as T from 'three';

const REA = new URL('../townscaper-web/REACodeRefactoring/', location.href);

export function createCapabilityRuntime({ world, grid, stage, allowed, load, encode, rebuild, remember, persist, frame, pickAt }) {
  // 点选范围：下一次单击实景 → 命中的格子及其两圈邻格作为"选中物件"，回传给工坊
  let picking = false, down = null;
  const region = (id, rings = 2) => { const seen = new Set([id]); let front = [id]; for (let r = 0; r < rings; r++) { const next = []; for (const c of front) for (const n of grid.cells[c].edgeNeighbors) if (n >= 0 && !seen.has(n)) { seen.add(n); next.push(n); } front = next; } return [...seen]; };
  window.addEventListener('pointerdown', (e) => { if (!picking || e.button !== 0 || e.target?.tagName !== 'CANVAS') return; down = { x: e.clientX, y: e.clientY }; e.preventDefault(); e.stopImmediatePropagation(); }, true);
  window.addEventListener('pointerup', (e) => {
    if (!picking || e.button !== 0 || !down || e.target?.tagName !== 'CANVAS') return;
    const start = down; down = null; e.preventDefault(); e.stopImmediatePropagation();
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
    const hit = pickAt?.(e);
    if (!hit?.cell) { window.parent.postMessage({ type: 'tm.cap.picked', error: '没点到湖上的格子，请点建筑或地面' }, location.origin); return; }
    picking = false;
    const cells = region(hit.cell.id);
    drawHighlight(cells);
    window.parent.postMessage({ type: 'tm.cap.picked', cell: hit.cell.id, cells }, location.origin);
  }, true);
  let baseline = null, candidate = null, showing = 'live', layers = [], layerMod = null, highlight = null;
  const host = {
    scene: stage.scene, get world() { return world; }, index: stage.index, levelHeight: stage.levelHeight,
    uTime: stage.waterUniforms.uTime, uNight: stage.nightUniform, chimneys: () => stage.worldMesh.chimneys || [],
  };
  // 每帧更新显示层；几何重建后刷新（灯塔识别、岸线距离场、烟囱口都依赖体素）
  const update = stage.update.bind(stage);
  stage.update = (dt) => { update(dt); for (const l of layers) l.layer.update?.(dt); };
  const onGeometry = stage.onGeometry;
  stage.onGeometry = (g) => { onGeometry?.(g); setTimeout(() => { for (const l of layers) l.layer.refresh(world); }, 0); };

  const clearLayers = () => { for (const l of layers) l.layer.dispose(); layers = []; };
  async function setLayers(names) {
    clearLayers();
    if (!names?.length) return [];
    layerMod ||= await import(new URL('src/capabilities/layers.js', REA).href);
    for (const name of names) { const layer = layerMod.createLayer(name, host); layer.refresh(world); layers.push({ name, layer }); }
    return layers.map((l) => ({ name: l.name, count: l.layer.count }));
  }

  function mask() { return grid.cells.map((c) => (allowed(c) ? 1 : 0)); }
  function clearHighlight() { if (highlight) { stage.scene.remove(highlight); highlight.geometry.dispose(); highlight.material.dispose(); highlight = null; } }
  function drawHighlight(ids) {
    clearHighlight();
    const pos = [], L = stage.levelHeight;
    for (const id of ids) {
      const c = grid.cells[id]; if (!c) continue;
      let t = 0; const m = world.solid[id]; if (m) t = 32 - Math.clz32(m);
      const y = t * L + 0.03;
      for (let i = 0; i < c.n; i++) { const a = c.pts[i], b = c.pts[(i + 1) % c.n]; pos.push(a.x, y, a.z, b.x, y, b.z, a.x, 0.02, a.z, a.x, y, a.z); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    highlight = new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xffd36b, depthTest: false, transparent: true }));
    highlight.renderOrder = 1000; highlight.name = 'cap-highlight'; stage.scene.add(highlight);
  }

  const api = {
    'cap.state': () => ({ data: encode(), allowed: mask(), radius: grid.radius, cells: grid.cells.length, previewing: !!baseline }),
    'cap.preview': async ({ data, layers: names = [], focus = [] }) => {
      if (typeof data !== 'string' || !data) throw Error('候选编码无效');
      if (!baseline) baseline = encode();
      candidate = { data, layers: names };
      load(data); rebuild(); showing = 'candidate';
      const info = await setLayers(names);
      if (focus.length) { drawHighlight(focus); frame?.(focus); }
      return { showing, layers: info, geometryChanged: data !== baseline };
    },
    'cap.show': ({ which }) => {
      if (!baseline || !candidate) throw Error('当前没有候选');
      if (which === 'baseline') { load(baseline); rebuild(); clearLayers(); showing = 'baseline'; return { showing }; }
      load(candidate.data); rebuild(); showing = 'candidate';
      return setLayers(candidate.layers).then((info) => ({ showing, layers: info }));
    },
    'cap.revert': () => { clearLayers(); clearHighlight(); if (baseline) { load(baseline); rebuild(); } baseline = candidate = null; showing = 'live'; return { reverted: true }; },
    'cap.commit': async () => {
      if (!baseline || !candidate) throw Error('当前没有候选');
      if (showing !== 'candidate') { load(candidate.data); rebuild(); }
      // 原编辑器的撤销栈记下进入预览前的样子：写入后在编辑器里点「撤销」就能回去
      const now = world.snapshot(); load(baseline); remember(); world.restore(now); persist();
      const keep = candidate.layers; baseline = candidate = null; showing = 'live';
      clearHighlight();
      return { committed: true, layers: keep, data: encode() };
    },
    'cap.highlight': ({ cells = [], frame: doFrame = true }) => { if (!cells.length) { clearHighlight(); return { cleared: true }; } drawHighlight(cells); if (doFrame) frame?.(cells); return { cells: cells.length }; },
    'cap.pick': ({ enabled = true }) => { picking = !!enabled; down = null; return { picking }; },
    'cap.layers': async ({ layers: names = [] }) => ({ layers: await setLayers(names) }),
  };
  return { handle: (action, payload) => { const f = api[action]; if (!f) throw Error('未知能力命令'); return f(payload || {}); }, actions: Object.keys(api) };
}
