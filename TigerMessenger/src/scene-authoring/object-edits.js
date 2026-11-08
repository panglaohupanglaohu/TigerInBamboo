/**
 * object-edits.js — 场景物件编辑（游戏侧）：移动 / 拖动 / 旋转 / 缩放 / 隐藏 / 复位，撤销重做，本机保存。
 *
 * 植物在 morrisBotany 里被合批成少数几个大网格。编辑一棵树 = 只改它在合批网格里的那段顶点：
 *   第一次编辑时记下这段顶点的原始位置 / 法线和物件原始矩阵 B；
 *   之后每次改动算出新矩阵 N，把这段顶点写成 N·B⁻¹·原始（法线用其法线矩阵），物件 Group 本身也同步到 N，
 *   所以选中框、定位、再次点选都跟着走。几何的顶点数、顺序、其他物件一律不动。
 * 改动按物件稳定 ID 存成"相对原样的增量"，刷新后重放；草稿 / 定稿通过 capture 一并保存。
 */
import * as T from 'three';
import { getObjectRanges, listEditableObjectIds } from './scene-objects.js';

const clampEdit = (e) => ({ dx: +e.dx || 0, dy: +e.dy || 0, dz: +e.dz || 0, ry: +e.ry || 0, s: Math.max(0.3, Math.min(2.5, Number.isFinite(+e.s) && +e.s > 0 ? +e.s : 1)), hidden: !!e.hidden });
const isIdentity = (e) => !e.dx && !e.dy && !e.dz && !e.ry && e.s === 1 && !e.hidden;

export function createObjectEditor({ sceneId, storage = localStorage, getRow, camera, onChange = () => {} }) {
  const KEY = 'tm.scene-objects.edits.v1:' + sceneId;
  let edits = {};
  try { edits = JSON.parse(storage.getItem(KEY) || '{}'); } catch { edits = {}; }
  const base = new Map(), undo = [], redo = [];

  function prepare(id) {
    if (base.has(id)) return base.get(id);
    const row = getRow(id), ranges = getObjectRanges(id);
    if (!row || !ranges.length) throw Error('这个物件不是可编辑的合批植物');
    const object = row.object; object.updateMatrix();
    const b = { object, B: object.matrix.clone(), p0: object.position.clone(), r0: object.rotation.y, s0: object.scale.clone(),
      ranges: ranges.map(({ mesh, start, end }) => ({ mesh, start, end,
        pos: mesh.geometry.attributes.position.array.slice(start * 3, end * 3),
        nor: mesh.geometry.attributes.normal?.array.slice(start * 3, end * 3) })) };
    base.set(id, b); return b;
  }
  const touched = new Set();
  function applyOne(id, e) {
    const b = prepare(id), o = b.object;
    o.position.set(b.p0.x + e.dx, b.p0.y + e.dy, b.p0.z + e.dz);
    o.rotation.y = b.r0 + e.ry; o.scale.copy(b.s0).multiplyScalar(e.s); o.updateMatrix();
    const M = o.matrix.clone().multiply(b.B.clone().invert()), N = new T.Matrix3().getNormalMatrix(M), v = new T.Vector3();
    for (const r of b.ranges) {
      const P = r.mesh.geometry.attributes.position, Nn = r.mesh.geometry.attributes.normal;
      for (let i = 0; i < r.end - r.start; i++) {
        if (e.hidden) v.copy(o.position); else v.fromArray(r.pos, i * 3).applyMatrix4(M);   // 隐藏 = 顶点收成一点（三角形退化，不画）
        P.array[(r.start + i) * 3] = v.x; P.array[(r.start + i) * 3 + 1] = v.y; P.array[(r.start + i) * 3 + 2] = v.z;
        if (Nn && r.nor) { v.fromArray(r.nor, i * 3).applyMatrix3(N).normalize(); Nn.array[(r.start + i) * 3] = v.x; Nn.array[(r.start + i) * 3 + 1] = v.y; Nn.array[(r.start + i) * 3 + 2] = v.z; }
      }
      P.needsUpdate = true; if (Nn) Nn.needsUpdate = true;
      touched.add(r.mesh);
    }
    o.visible = !e.hidden;
  }
  function flush() { for (const m of touched) { m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox(); } touched.clear(); }
  function save() { try { storage.setItem(KEY, JSON.stringify(edits)); return true; } catch { return false; } }
  const current = (id) => clampEdit(edits[id] || {});
  function state(id) { const saved = save(); onChange(id); return { id, edit: current(id), edited: !!edits[id], canUndo: undo.length > 0, canRedo: redo.length > 0, saved, count: Object.keys(edits).length }; }
  function write(id, next, { record = true } = {}) {
    next = clampEdit(next);
    if (record) { undo.push({ id, before: edits[id] ? { ...edits[id] } : null }); if (undo.length > 100) undo.shift(); redo.length = 0; }
    if (isIdentity(next)) delete edits[id]; else edits[id] = next;
    applyOne(id, next); flush();
    return state(id);
  }
  // 启动时重放已保存的改动；物件不存在了（场景改版）就跳过，保留记录不删
  let missing = [];
  const replay = () => { const left = []; for (const id of missing) { try { applyOne(id, clampEdit(edits[id])); } catch { left.push(id); } } flush(); missing = left; };
  missing = Object.keys(edits); replay();
  // 植物可能晚于编辑器登记：每秒重试，最多 60 次
  for (let k = 1; k <= 60 && missing.length; k++) setTimeout(() => missing.length && replay(), k * 1000);

  // 拖动：选中物件后在实景中按住拖，沿物件所在高度的水平面移动
  let dragId = null, drag = null;
  const plane = new T.Plane(), ray = new T.Raycaster(), hitPoint = new T.Vector3();
  const ndc = (e) => { const r = e.target.getBoundingClientRect(); return new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); };
  const groundHit = (e) => { ray.setFromCamera(ndc(e), camera()); return ray.ray.intersectPlane(plane, hitPoint) ? hitPoint.clone() : null; };
  window.addEventListener('pointerdown', (e) => {
    if (!dragId || e.button !== 0 || e.target?.tagName !== 'CANVAS') return;
    const o = prepare(dragId).object; o.updateWorldMatrix(true, false);
    const wp = o.getWorldPosition(new T.Vector3()); plane.set(new T.Vector3(0, 1, 0), -wp.y);
    const p = groundHit(e); if (!p) return;
    drag = { start: o.parent.worldToLocal(p.clone()), edit: current(dragId), before: edits[dragId] ? { ...edits[dragId] } : null };
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.target?.tagName !== 'CANVAS') return;
    const p = groundHit(e); if (!p) return;
    const o = prepare(dragId).object, l = o.parent.worldToLocal(p.clone());
    const next = { ...drag.edit, dx: drag.edit.dx + l.x - drag.start.x, dz: drag.edit.dz + l.z - drag.start.z };
    edits[dragId] = clampEdit(next); applyOne(dragId, edits[dragId]); flush();
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  window.addEventListener('pointerup', (e) => {
    if (!drag) return;
    undo.push({ id: dragId, before: drag.before }); redo.length = 0; drag = null;
    window.parent.postMessage({ type: 'tm.scene-object.edited', state: state(dragId) }, location.origin);
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);

  // 撤销记录可以是一组（物件工坊一次候选改了多个物件 = 一步撤销）
  function swap(entry, other) {
    const items = entry.items || [entry];
    other.push({ items: items.map(({ id }) => ({ id, before: edits[id] ? { ...edits[id] } : null })) });
    for (const { id, before } of items) { const e = clampEdit(before || {}); if (isIdentity(e)) delete edits[id]; else edits[id] = e; try { applyOne(id, e); } catch {} }
    flush(); return state(items[0]?.id);
  }

  // 物件工坊（super agent）：布局读取、候选预览、写入（一组撤销）、放弃
  let preview = null;
  function layout() {
    const rows = [];
    for (const id of listEditableObjectIds()) {
      const row = getRow(id); if (!row) continue;
      let b; try { b = prepare(id); } catch { continue; }
      const sc = b.object.parent ? b.object.parent.getWorldScale(new T.Vector3()).x || 1 : 1;
      const bx = row.bounds ? (row.bounds.max[0] - row.bounds.min[0]) : 1, bz = row.bounds ? (row.bounds.max[2] - row.bounds.min[2]) : 1;
      rows.push({ id, kind: row.kind || 'object', name: row.name || id, x: b.p0.x, z: b.p0.z, y: b.p0.y, r: Math.max(0.02, Math.max(bx, bz) / 2 / sc), edit: current(id), locked: !!edits[id] });
    }
    return rows;
  }
  function previewEdits(next = {}) {
    revertPreview();
    preview = { before: {}, next: {} };
    for (const [id, e] of Object.entries(next)) { if (!getRow(id)) continue; preview.before[id] = current(id); preview.next[id] = clampEdit(e); applyOne(id, preview.next[id]); }
    flush(); return { previewing: Object.keys(preview.next).length };
  }
  function revertPreview() {
    if (!preview) return { reverted: 0 };
    const ids = Object.keys(preview.before); for (const id of ids) applyOne(id, current(id)); flush(); preview = null; return { reverted: ids.length };
  }
  function commitPreview() {
    if (!preview) throw Error('没有正在预览的物件候选');
    const items = Object.keys(preview.next).map((id) => ({ id, before: edits[id] ? { ...edits[id] } : null }));
    for (const [id, e] of Object.entries(preview.next)) { if (isIdentity(e)) delete edits[id]; else edits[id] = e; }
    undo.push({ items }); if (undo.length > 100) undo.shift(); redo.length = 0; preview = null;
    const st = state(items[0]?.id); return { ...st, committed: items.length };
  }
  function compare(on) { if (!preview) return { comparing: false }; for (const id of Object.keys(preview.next)) applyOne(id, on ? preview.before[id] : preview.next[id]); flush(); return { comparing: !!on }; }

  return {
    layout, previewEdits, revertPreview, commitPreview, compare,
    get missing() { return missing; },
    get: (id) => ({ id, edit: current(id), edited: !!edits[id], canUndo: undo.length > 0, canRedo: redo.length > 0, count: Object.keys(edits).length }),
    edit(id, op = {}) {
      const e = current(id);
      if (op.reset) return write(id, {});
      return write(id, { dx: e.dx + (op.dx || 0), dy: e.dy + (op.dy || 0), dz: e.dz + (op.dz || 0), ry: e.ry + (op.ry || 0), s: op.s ?? e.s, hidden: op.hidden ?? e.hidden });
    },
    undo() { const u = undo.pop(); if (!u) throw Error('没有可撤销的物件改动'); return swap(u, redo); },
    redo() { const r = redo.pop(); if (!r) throw Error('没有可重做的物件改动'); return swap(r, undo); },
    drag(id, on) { if (on) prepare(id); dragId = on ? id : null; drag = null; return { dragging: !!dragId }; },
    /** 草稿 / 定稿：导出与整体恢复 */
    snapshot: () => structuredClone(edits),
    restore(all = {}) {
      const ids = new Set([...Object.keys(edits), ...Object.keys(all)]);
      edits = {};
      for (const id of ids) { const e = clampEdit(all[id] || {}); if (!isIdentity(e)) edits[id] = e; try { applyOne(id, e); } catch {} }
      flush(); undo.length = redo.length = 0; save(); onChange(null); return { count: Object.keys(edits).length };
    },
  };
}
