/**
 * generic-scene.js — 通用场景编辑插件：任何在游戏里登记过根对象的场景（书店镇、湖沼、苔庭…）都能接入系统工坊。
 *
 * 参考 GenAIWorkPipeline 的做法：
 *   - 场景登记表（project.json → 这里的 id / label / root）：先登记，再接入
 *   - 原件不动：编辑只是叠加在原始变换上的增量，随时可整体撤销；存档只存增量
 *   - 「执行结束 ≠ 验收通过」：status() 给出接入检查，每项 passed 为 true / false / null（未验证）
 *
 * 物件 = 场景根对象下尺寸合适、含网格的子对象（自动登记，按子节点路径给稳定 ID）。
 * 增量以场景根的局部坐标表达（dx/dy/dz、绕场景「上」方向的 ry、等比缩放 s、隐藏），与物件管线（layout / 预览 / 写入）同一套接口。
 * 存档：localStorage `tm.scene-objects.edits.v1:<场景>`，游戏启动时自动回放。
 */
import * as T from 'three';

const clampEdit = (e) => ({ dx: +e.dx || 0, dy: +e.dy || 0, dz: +e.dz || 0, ry: +e.ry || 0, s: Math.max(0.3, Math.min(2.5, Number.isFinite(+e.s) && +e.s > 0 ? +e.s : 1)), hidden: !!e.hidden });
const isIdentity = (e) => !e.dx && !e.dy && !e.dz && !e.ry && e.s === 1 && !e.hidden;
const hasMesh = (o) => { let m = false; o.traverse((c) => { if (c.isMesh || c.isInstancedMesh) m = true; }); return m; };
const kindOf = (o) => (o.name || o.userData?.authoringKind || o.type || 'object').replace(/[\s_-]*\d+$/, '').replace(/[\s_-]+$/, '').slice(0, 40) || 'object';

export function createGenericScene({ id, label, root, camera, canvas, setCameraApply, storage = globalThis.localStorage, maxObjects = 400 }) {
  const KEY = 'tm.scene-objects.edits.v1:' + id;
  root.updateWorldMatrix(true, true);
  const rootInv = new T.Matrix4().copy(root.matrixWorld).invert();
  const rootBox = new T.Box3().setFromObject(root).applyMatrix4(rootInv);
  const rootDiag = Math.max(1e-3, rootBox.getSize(new T.Vector3()).length());
  const rows = new Map();   // id → { id, name, kind, object, base, center, r, box }
  // ---- 自动登记物件
  (function collect(node, path, depth) {
    node.children.forEach((child, i) => {
      if (rows.size >= maxObjects || child.isLight || child.isCamera || child.name === 'workshop-object-selection') return;
      if (!hasMesh(child)) return;
      const p = path ? path + '/' + i : String(i);
      child.updateWorldMatrix(true, true);
      const box = new T.Box3().setFromObject(child).applyMatrix4(rootInv);
      if (box.isEmpty()) return;
      const size = box.getSize(new T.Vector3()), diag = size.length();
      const tooBig = diag > rootDiag * 0.55 && depth < 3 && child.children.length > 1;
      if (tooBig) { collect(child, p, depth + 1); return; }
      if (diag < rootDiag * 0.004) return;
      const rid = id + ':' + p, c = box.getCenter(new T.Vector3());
      const named = !!(child.name || child.userData?.authoringLabel);
      // 旋转 / 缩放的支点：物件包围盒中心（父节点坐标）。很多网格的原点在场景原点，绕原点转会飞走
      const pivot = child.parent ? child.parent.worldToLocal(new T.Box3().setFromObject(child).getCenter(new T.Vector3())) : c.clone();
      rows.set(rid, { id: rid, name: child.name || child.userData?.authoringLabel || `${label} · 未命名网格 ${p}`, kind: named ? kindOf(child) : '未命名网格', named, object: child, box,
        center: c, r: Math.max(0.05, Math.max(size.x, size.z) / 2), pivot,
        base: { position: child.position.clone(), quaternion: child.quaternion.clone(), scale: child.scale.clone(), visible: child.visible } });
    });
  })(root, '', 0);

  // ---- 物件命名：没有名字的网格按「颜色 + 形状」自动命名；同款（几何相同）的归成一类，能批量编辑
  const NAMES_KEY = 'tm.scene-objects.names.v1:' + id;
  let userNames = {}; try { userNames = JSON.parse(storage?.getItem(NAMES_KEY) || '{}') || {}; } catch {}
  const COLOR_NAMES = [[0, '红'], [25, '橙'], [45, '黄'], [75, '黄绿'], [140, '绿'], [175, '青'], [215, '蓝'], [265, '紫'], [320, '玫红'], [360, '红']];
  const colorName = (c) => { if (!c) return ''; const hsl = {}; c.getHSL(hsl); if (hsl.l > 0.86) return '白'; if (hsl.l < 0.14) return '黑'; if (hsl.s < 0.16) return hsl.l > 0.55 ? '浅灰' : '深灰'; if (hsl.h * 360 > 15 && hsl.h * 360 < 45 && hsl.l < 0.42) return '棕'; const h = hsl.h * 360; return COLOR_NAMES.find(([x]) => h <= x + 12)?.[1] || '红'; };
  const shapeName = (sz) => { const w = Math.max(sz.x, sz.z), h = sz.y; if (h > w * 3) return '柱'; if (h > w * 1.4) return '塔'; if (h < w * 0.18) return '板'; if (w > Math.min(sz.x, sz.z) * 3.5) return '条'; return '块'; };
  const sigOf = (o) => { const g = []; let col = null; o.traverse((m) => { if (m.isMesh || m.isInstancedMesh) { g.push(m.geometry?.uuid?.slice(0, 8) + ':' + (m.geometry?.attributes?.position?.count || 0)); const mat = Array.isArray(m.material) ? m.material[0] : m.material; if (!col && mat?.color) col = mat.color; } }); return { sig: g.sort().join('|'), color: col }; };
  const sigGroups = new Map();
  for (const r of rows.values()) { const { sig, color } = sigOf(r.object); r.sig = sig; r.colorName = colorName(color); if (!sigGroups.has(sig)) sigGroups.set(sig, []); sigGroups.get(sig).push(r); }
  // 同款判定：几何顶点数相同 + 包围盒尺寸接近（不同实例常共享或复制同一几何）
  const sizeKey = (r) => { const z = r.box.getSize(new T.Vector3()); return [z.x, z.y, z.z].map((v) => v.toFixed(1)).join('x'); };
  const twins = new Map();
  for (const r of rows.values()) { const k = (r.sig.split('|').map((x) => x.split(':')[1]).join('|')) + '@' + sizeKey(r); if (!twins.has(k)) twins.set(k, []); twins.get(k).push(r); }
  const counters = {};
  for (const [, list] of twins) {
    const first = list[0], sz = first.box.getSize(new T.Vector3()), base = `${first.colorName}${shapeName(sz)}`;
    for (const r of list) {
      r.repeated = list.length > 1;
      if (!r.named) { counters[base] = (counters[base] || 0) + 1; r.autoName = `${base}${list.length > 1 ? '（同款）' : ''} ${counters[base]}`; r.kind = list.length > 1 ? `${base}·同款` : r.kind; }
      if (userNames[r.id]) { r.name = userNames[r.id]; r.userNamed = true; r.kind = r.name.replace(/[\s_-]*\d+$/, '') || r.name; } else if (!r.named) r.name = r.autoName;
    }
  }
  // 能批量编辑：有原名、作者改过名、或者是同款（重复出现的道具）；其余未命名的单件网格按结构件处理
  for (const r of rows.values()) r.batch = r.named || r.userNamed || r.repeated;
  // ---- 增量应用（场景根局部坐标 → 物件父节点局部坐标）
  const tmpQ = new T.Quaternion(), tmpV = new T.Vector3(), tmpS = new T.Vector3();
  const rootToParentDir = (v, parent) => {
    root.matrixWorld.decompose(tmpV, tmpQ, tmpS); v.multiply(tmpS).applyQuaternion(tmpQ);
    if (parent) { const pq = new T.Quaternion(), ps = new T.Vector3(), pp = new T.Vector3(); parent.matrixWorld.decompose(pp, pq, ps); v.applyQuaternion(pq.invert()).divide(ps); }
    return v;
  };
  function applyOne(rid, e) {
    const row = rows.get(rid); if (!row) return false;
    const o = row.object, b = row.base; o.parent?.updateWorldMatrix(true, false);
    const d = rootToParentDir(new T.Vector3(e.dx, e.dy, e.dz), o.parent);
    const axis = rootToParentDir(new T.Vector3(0, 1, 0), o.parent).normalize();
    const q = new T.Quaternion().setFromAxisAngle(axis, e.ry);
    // 绕包围盒中心转、缩：新位置 = 支点 + R·s·(原位置 − 支点) + 平移
    o.position.copy(b.position).sub(row.pivot).multiplyScalar(e.s).applyQuaternion(q).add(row.pivot).add(d);
    o.quaternion.copy(q).multiply(b.quaternion);
    o.scale.copy(b.scale).multiplyScalar(e.s);
    o.visible = b.visible && !e.hidden;
    o.updateMatrixWorld(true);
    return true;
  }
  let edits = {}; try { edits = JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { edits = {}; }
  let applied = 0, missing = 0;
  for (const [rid, e] of Object.entries(edits)) (applyOne(rid, clampEdit(e)) ? applied++ : missing++);
  const save = () => { try { storage?.setItem(KEY, JSON.stringify(edits)); return true; } catch { return false; } };
  const current = (rid) => clampEdit(edits[rid] || {});
  const undo = [], redo = [];
  function write(rid, next, record = true) {
    if (!rows.has(rid)) throw Error('这个物件不在场景登记表里');
    const e = clampEdit(next); if (record) { undo.push({ items: [{ id: rid, before: edits[rid] ? { ...edits[rid] } : null }] }); redo.length = 0; }
    if (isIdentity(e)) delete edits[rid]; else edits[rid] = e;
    applyOne(rid, e); save(); return get(rid);
  }
  const get = (rid) => ({ id: rid, edit: current(rid), edited: !!edits[rid], canUndo: undo.length > 0, canRedo: redo.length > 0, count: Object.keys(edits).length });
  function swap(entry, other) {
    other.push({ items: entry.items.map(({ id: rid }) => ({ id: rid, before: edits[rid] ? { ...edits[rid] } : null })) });
    for (const { id: rid, before } of entry.items) { const e = clampEdit(before || {}); if (isIdentity(e)) delete edits[rid]; else edits[rid] = e; applyOne(rid, e); }
    save(); return get(entry.items[0]?.id);
  }
  // ---- 候选预览（物件管线）
  let preview = null;
  const objectEditor = {
    get, get missing() { return missing; },
    edit(rid, op = {}) { const e = current(rid); if (op.reset) return write(rid, {}); return write(rid, { dx: e.dx + (op.dx || 0), dy: e.dy + (op.dy || 0), dz: e.dz + (op.dz || 0), ry: e.ry + (op.ry || 0), s: op.s ?? e.s, hidden: op.hidden ?? e.hidden }); },
    undo() { const u = undo.pop(); if (!u) throw Error('没有可撤销的物件改动'); return swap(u, redo); },
    redo() { const r = redo.pop(); if (!r) throw Error('没有可重做的物件改动'); return swap(r, undo); },
    drag() { throw Error('通用场景插件暂不支持拖动；用方向按钮移动'); },
    // 单件的未命名网格多是建筑的结构件（墙、屋顶分开的网格），批量能力默认不动它们（locked），单独编辑仍可以；同款道具和改过名的可以批量
    layout: () => [...rows.values()].map((r) => ({ id: r.id, kind: r.kind, name: r.name, x: r.center.x, z: r.center.z, y: r.center.y, r: r.r, edit: current(r.id), locked: !!edits[r.id] || !r.batch, structural: !r.batch })),
    previewEdits(next = {}) { objectEditor.revertPreview(); preview = { before: {}, next: {} }; for (const [rid, e] of Object.entries(next)) { if (!rows.has(rid)) continue; preview.before[rid] = current(rid); preview.next[rid] = clampEdit(e); applyOne(rid, preview.next[rid]); } return { previewing: Object.keys(preview.next).length }; },
    revertPreview() { if (!preview) return { reverted: 0 }; const ids = Object.keys(preview.before); for (const rid of ids) applyOne(rid, current(rid)); preview = null; return { reverted: ids.length }; },
    commitPreview() {
      if (!preview) throw Error('没有正在预览的物件候选');
      const items = Object.keys(preview.next).map((rid) => ({ id: rid, before: edits[rid] ? { ...edits[rid] } : null }));
      for (const [rid, e] of Object.entries(preview.next)) { if (isIdentity(e)) delete edits[rid]; else edits[rid] = e; }
      undo.push({ items }); redo.length = 0; preview = null; save(); return { ...get(items[0]?.id), committed: items.length };
    },
    compare(on) { if (!preview) return { comparing: false }; for (const rid of Object.keys(preview.next)) applyOne(rid, on ? preview.before[rid] : preview.next[rid]); return { comparing: !!on }; },
    snapshot: () => structuredClone(edits),
    restore(all = {}) { const ids = new Set([...Object.keys(edits), ...Object.keys(all)]); edits = {}; for (const rid of ids) { const e = clampEdit(all[rid] || {}); if (!isIdentity(e)) edits[rid] = e; applyOne(rid, e); } undo.length = redo.length = 0; save(); return { count: Object.keys(edits).length }; },
  };
  // ---- 风格：场景里的材质（按材质登记），颜色覆盖叠加在原色上；存档 tm.style.overrides.v1:<场景>，启动回放
  const STYLE_KEY = 'tm.style.overrides.v1:' + id;
  const mats = new Map();   // matId → { id, name, material, base:'#rrggbb', uses }
  root.traverse((m) => { if (!(m.isMesh || m.isInstancedMesh)) return; const list = Array.isArray(m.material) ? m.material : [m.material]; list.forEach((mat, slot) => { if (!mat?.color || mat.userData?.workshopMarker) return; const key = mat.uuid; if (!mats.has(key)) mats.set(key, { id: 'm' + mats.size, name: mat.name || '', material: mat, base: '#' + mat.color.getHexString(), uses: 0, meshes: [] }); const e = mats.get(key); e.uses++; e.meshes.push([m, slot]); }); });
  // 别的场景也在用的材质：改色前先给本场景复制一份，避免改到别处
  { let top = root; while (top.parent) top = top.parent; const outside = new Set(); top.traverse((m) => { if (!(m.isMesh || m.isInstancedMesh)) return; let p = m; while (p && p !== root) p = p.parent; if (p === root) return; for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) if (mat) outside.add(mat.uuid); }); for (const e of mats.values()) e.shared = outside.has(e.material.uuid); }
  const own = (e) => { if (!e.shared || e.cloned) return; const c = e.material.clone(); for (const [mesh, slot] of e.meshes) { if (Array.isArray(mesh.material)) { mesh.material = mesh.material.slice(); mesh.material[slot] = c; } else mesh.material = c; } e.material = c; e.cloned = true; };
  const matById = new Map([...mats.values()].map((m) => [m.id, m]));
  for (const m of matById.values()) if (!m.name) m.name = `${colorName(m.material.color)}色材质 ${m.id.slice(1)}`;
  let styleSaved = {}; try { styleSaved = JSON.parse(storage?.getItem(STYLE_KEY) || '{}') || {}; } catch {}
  let stylePreview = null;
  const paint = (all) => { for (const m of matById.values()) { const hex = all[m.id] || m.base; if (hex !== m.base) own(m); m.material.color.set(hex); } };
  paint(styleSaved);
  const styleApi = {
    state: () => ({ scene: id, materials: [...matById.values()].map((m) => ({ id: m.id, name: m.name, base: m.base, color: (stylePreview || styleSaved)[m.id] || m.base, uses: m.uses, shared: !!m.shared })), saved: { ...styleSaved }, previewing: !!stylePreview }),
    preview(over = {}) { const next = { ...styleSaved }; for (const [k, v] of Object.entries(over)) { if (!matById.has(k) || !/^#[0-9a-f]{6}$/i.test(v)) continue; if (v.toLowerCase() === matById.get(k).base) delete next[k]; else next[k] = v.toLowerCase(); } stylePreview = next; paint(next); return { previewing: Object.keys(over).length }; },
    compare(on) { if (!stylePreview) return { comparing: false }; paint(on ? styleSaved : stylePreview); return { comparing: !!on }; },
    save() { if (!stylePreview) throw Error('没有正在预览的风格改动'); styleSaved = stylePreview; stylePreview = null; try { storage?.setItem(STYLE_KEY, JSON.stringify(styleSaved)); } catch {} paint(styleSaved); return { saved: Object.keys(styleSaved).length }; },
    revert() { stylePreview = null; paint(styleSaved); return { reverted: true }; },
    reset() { stylePreview = null; styleSaved = {}; try { storage?.removeItem(STYLE_KEY); } catch {} paint(styleSaved); return { reset: true }; },
    snapshot: () => ({ ...styleSaved }),
    restore(all = {}) { stylePreview = null; styleSaved = { ...all }; try { storage?.setItem(STYLE_KEY, JSON.stringify(styleSaved)); } catch {} paint(styleSaved); return { count: Object.keys(styleSaved).length }; },
  };
  // ---- 草稿 / 定稿（参考 GenAIWorkPipeline：交付前人工确认；定稿 = 游戏启动时用的版本）
  const VERS_KEY = 'tm.scene.versions.v1';
  const readVers = () => { try { const v = JSON.parse(storage?.getItem(VERS_KEY) || 'null'); return v && Array.isArray(v.versions) ? v : { versions: [], finals: {} }; } catch { return { versions: [], finals: {} }; } };
  const writeVers = (v) => { try { storage?.setItem(VERS_KEY, JSON.stringify(v)); return true; } catch { return false; } };
  const drafts = {
    list: () => { const v = readVers(); return v.versions.filter((x) => x.scene === id).map((x) => ({ id: x.id, time: x.time, goal: x.goal, final: v.finals[id] === x.id, objects: Object.keys(x.objects || {}).length, style: Object.keys(x.style || {}).length, names: Object.keys(x.names || {}).length })).reverse(); },
    save(goal = '') { const v = readVers(); const row = { id: id + '-' + Date.now().toString(36), scene: id, time: Date.now(), goal: String(goal).slice(0, 120), objects: structuredClone(edits), style: { ...styleSaved }, names: { ...userNames } }; v.versions.push(row); const mine = v.versions.filter((x) => x.scene === id); if (mine.length > 30) v.versions.splice(v.versions.indexOf(mine[0]), 1); writeVers(v); return { id: row.id }; },
    restore(vid) { const row = readVers().versions.find((x) => x.id === vid && x.scene === id); if (!row) throw Error('找不到这个草稿'); objectEditor.restore(row.objects || {}); styleApi.restore(row.style || {}); userNames = { ...(row.names || {}) }; try { storage?.setItem(NAMES_KEY, JSON.stringify(userNames)); } catch {} return { restored: vid }; },
    finalize(vid) { const v = readVers(); if (!v.versions.some((x) => x.id === vid && x.scene === id)) throw Error('找不到这个草稿'); v.finals[id] = vid; writeVers(v); drafts.restore(vid); return { final: vid }; },
    remove(vid) { const v = readVers(); if (v.finals[id] === vid) throw Error('定稿版本不能删除'); v.versions = v.versions.filter((x) => !(x.id === vid && x.scene === id)); writeVers(v); return { removed: vid }; },
  };
  function rename(rid, name) { const r = rows.get(rid); if (!r) throw Error('该场景对象当前不可用'); const n = String(name || '').trim().slice(0, 40); if (n) { userNames[rid] = n; r.name = n; r.userNamed = true; r.batch = true; r.kind = n.replace(/[\s_-]*\d+$/, '') || n; } else { delete userNames[rid]; r.userNamed = false; r.name = r.named ? r.object.name : r.autoName; r.batch = r.named || r.repeated; } try { storage?.setItem(NAMES_KEY, JSON.stringify(userNames)); } catch {} return describe(r); }
  // ---- 定位、选中标记、实景点选
  let marker = null;
  const clearObjectFocus = () => { if (marker) { marker.removeFromParent(); marker.geometry.dispose(); marker.material.dispose(); marker = null; } };
  function focusObject(row) {
    clearObjectFocus();
    const o = row.object; o.updateWorldMatrix(true, true);
    const box = new T.Box3().setFromObject(o); if (box.isEmpty()) throw Error('该物件没有可定位的几何');
    const c = box.getCenter(new T.Vector3()), up = c.clone().normalize(), side = new T.Vector3(0, 1, 0).cross(up);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
    const d = Math.max(6, Math.min(120, box.getSize(new T.Vector3()).length() * 1.8));
    const apply = () => { camera.position.copy(c).addScaledVector(up, d * 0.55).addScaledVector(side, d * 0.85); camera.up.copy(up); camera.lookAt(c); camera.fov = 40; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); };
    setCameraApply(apply); apply();
    const local = new T.Box3().setFromObject(o).applyMatrix4(new T.Matrix4().copy(o.matrixWorld).invert());
    marker = new T.Box3Helper(local, 0x87e6cb); marker.name = 'workshop-object-selection'; marker.material.depthTest = false; marker.renderOrder = 1000; o.add(marker);
  }
  let picking = null;
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function onPick(e) {
    if (!picking || e.button !== 0) return;
    const rect = canvas.getBoundingClientRect(); ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(root, true);
    for (const h of hits) { let o = h.object; while (o && o !== root) { const row = [...rows.values()].find((r) => r.object === o); if (row) { e.preventDefault(); e.stopImmediatePropagation(); const cb = picking; picking = null; focusObject(row); cb?.(describe(row)); return; } o = o.parent; } }
    picking?.(null, '这里没有登记的物件；换个位置再点。');
  }
  canvas?.addEventListener('pointerdown', onPick, true);
  const describe = (r) => ({ id: r.id, name: r.name, kind: r.kind, kindName: r.kind, editable: true, scene: id, batch: !!r.batch, autoNamed: !r.named && !r.userNamed });
  return {
    id, label, kind: 'generic', objectEditor, style: styleApi, drafts, rename,
    list: () => [...rows.values()].map(describe),
    get: (rid) => { const r = rows.get(rid); if (!r) throw Error('该场景对象当前不可用'); return r; },
    describe, focusObject, clearObjectFocus,
    setObjectPicking: (on, cb) => { picking = on ? cb : null; },
    /** 接入检查（参考 GenAIWorkPipeline quality.assess：true 通过 / false 未通过 / null 未验证） */
    status: () => ({ scene: id, label, plugin: 'generic', checks: [
      { name: '场景根对象已登记', passed: true, detail: root.name || root.type },
      { name: '物件自动登记', passed: rows.size > 0, detail: `${rows.size} 个物件：原有名字 ${[...rows.values()].filter((r) => r.named).length}，自动命名 ${[...rows.values()].filter((r) => !r.named && !r.userNamed).length}，作者改名 ${[...rows.values()].filter((r) => r.userNamed).length}；可批量编辑 ${[...rows.values()].filter((r) => r.batch).length}（同款道具 / 有名字），单件未命名网格按结构件处理` },
      { name: '风格（材质）', passed: matById.size > 0, detail: `${matById.size} 种材质，已覆盖 ${Object.keys(styleSaved).length} 种` },
      { name: '草稿 / 定稿', passed: readVers().finals[id] ? true : null, detail: readVers().finals[id] ? '已有定稿' : `草稿 ${drafts.list().length} 份，尚未定稿` },
      { name: '存档回放', passed: missing ? false : true, detail: `回放 ${applied} 个改动${missing ? `，${missing} 个找不到对应物件` : ''}` },
      { name: '体素能力（石拱 / 灯塔等）', passed: null, detail: '不适用：这个场景不是 REA 体素世界；场景管线改为作用在材质色表上' },
    ] }),
  };
}
