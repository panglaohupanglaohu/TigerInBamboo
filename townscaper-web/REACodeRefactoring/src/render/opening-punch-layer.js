/**
 * opening-punch-layer.js — 主场景门窗的模板挖洞层（第 56 批 C05·C）。
 *
 * 片子 1205422438437273601（2019-12-13 "For doors and windows, I use som stencil buffer shenanigans to punch
 * holes in the zbuffer"）：门窗处的墙在 z-buffer 里被挖掉，后面的洞（有厚度的侧壁 + 室内）真的透出来，随镜头有视差。
 * 原型 src/render/opening-punch.js 是独立零厚度平面；这里把同一机制接到 WorldMesh 实际建筑上：
 *
 *   pass A  mask   （renderOrder 100）：每个门窗玻璃 / 门板矩形，略在墙面外（0.014，夹在玻璃 0.012 与窗棂 0.016 之间），
 *                   depthTest 开、colorWrite / depthWrite 关，stencil Always→Replace(1)。只有“看得见的”洞口像素被标记，
 *                   被前排房子挡住的部分深度测试失败，不会误挖前排房子。
 *   pass B  reset  （101）：同一组矩形，顶点着色器把 z 推到远平面，depthFunc Always + depthWrite，stencil Equal 1
 *                   → 只在被标记的像素把 z-buffer 重置为“无穷远”（= punch holes in the zbuffer）。
 *   pass C  recess （102）：每个洞口一个开口朝外的盒子（后墙 + 两侧壁 + 窗台 + 窗楣，深 depth），stencil Equal 1，
 *                   正常深度测试 → 洞里看到有厚度的侧壁与室内；窗棂（0.016）在 mask 前面，被保留下来，悬在洞口前。
 *
 * 只在主相机、且当前目标带 stencil 的那次渲染里可见（倒影相机 / 无 stencil 的 RT 自动隐藏）；
 * 主相机渲进不带 stencil 的 RT（描边 colorTarget 等）时，下一帧把那个 RT 升级成 depth+stencil 再用。
 * 开关：index.html?punch=1（app.js 一行挂钩）或演示页 openings-r56.html 勾选；默认不加载。
 */
import * as THREE from 'three';

const MASK_OFFSET = 0.014;

/** 纯函数：门窗记录 → mask 三角形（世界坐标）与凹洞盒子（三角形 + 每顶点颜色）。供测试与图层共用。 */
export function punchGeometry(openings, { depth = 0.06, maskOffset = MASK_OFFSET, colors = {} } = {}) {
  const mask = [], recess = [], rcol = [], boxes = [];
  const C = { back: colors.back ?? [0.025, 0.04, 0.065], door: colors.door ?? [0.05, 0.03, 0.02], jamb: colors.jamb ?? [0.62, 0.57, 0.5], sill: colors.sill ?? [0.5, 0.48, 0.46] };
  const push = (arr, ...pts) => { for (const p of pts) arr.push(p[0], p[1], p[2]); };
  for (const o of openings) {
    const len = Math.hypot(o.bx - o.ax, o.bz - o.az) || 1, hw = o.width / 2 / len;
    const P = (t, y, off) => [o.ax + (o.bx - o.ax) * t + o.nx * off, y, o.az + (o.bz - o.az) * t + o.nz * off];
    const t1 = o.t - hw, t2 = o.t + hw, y0 = o.y0, y1 = o.y1;
    // mask：两三角
    const m = [P(t1, y0, maskOffset), P(t2, y0, maskOffset), P(t2, y1, maskOffset), P(t1, y1, maskOffset)];
    push(mask, m[0], m[1], m[2], m[0], m[2], m[3]);
    // recess：开口在墙面（off 0），盒底在 −depth
    const f = [P(t1, y0, 0), P(t2, y0, 0), P(t2, y1, 0), P(t1, y1, 0)], b = [P(t1, y0, -depth), P(t2, y0, -depth), P(t2, y1, -depth), P(t1, y1, -depth)];
    const quad = (q, col, shade) => { push(recess, q[0], q[1], q[2], q[0], q[2], q[3]); for (let k = 0; k < 6; k++) rcol.push(col[0] * shade, col[1] * shade, col[2] * shade); };
    quad([b[0], b[1], b[2], b[3]], o.door ? C.door : C.back, 1);          // 后墙（室内 / 门洞深处）
    quad([f[0], b[0], b[3], f[3]], C.jamb, 0.9);                           // 左侧壁
    quad([b[1], f[1], f[2], b[2]], C.jamb, 0.8);                           // 右侧壁
    quad([f[0], f[1], b[1], b[0]], C.sill, 1.05);                          // 窗台 / 门槛
    quad([b[3], b[2], f[2], f[3]], C.jamb, 0.6);                           // 窗楣（朝下）
    boxes.push({ cell: o.cell, edge: o.edge, door: !!o.door, width: o.width, height: y1 - y0, depth, area: o.width * (y1 - y0) });
  }
  return { mask: new Float32Array(mask), recess: new Float32Array(recess), recessColor: new Float32Array(rcol), boxes };
}

export function punchMaterials() {
  const mask = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp });
  const reset = new THREE.ShaderMaterial({
    vertexShader: 'void main(){ vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); p.z = p.w * 0.999999; gl_Position = p; }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.0); }',
    colorWrite: false, depthWrite: true, depthTest: true, depthFunc: THREE.AlwaysDepth, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.KeepStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp });
  const recess = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.KeepStencilOp, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp });
  return { mask, reset, recess };
}

export function attachOpeningPunch(view, { depth = 0.06 } = {}) {
  const mats = punchMaterials();
  const group = new THREE.Group(); group.name = 'opening-punch-r56';
  const mk = (mat, order) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.renderOrder = order; m.frustumCulled = false; m.userData.overlayOnly = true; group.add(m); return m; };
  const mask = mk(mats.mask, 100), reset = mk(mats.reset, 101), recess = mk(mats.recess, 102);
  view.scene.add(group);
  const state = { enabled: true, build: null, boxes: [], frames: 0, stencilFrames: 0, upgraded: 0, skipped: 0 };
  const rebuild = (build) => {
    const g = punchGeometry(build?.openings ?? [], { depth });
    mask.geometry.dispose(); reset.geometry.dispose(); recess.geometry.dispose();
    mask.geometry = new THREE.BufferGeometry(); mask.geometry.setAttribute('position', new THREE.BufferAttribute(g.mask, 3));
    reset.geometry = mask.geometry.clone();
    recess.geometry = new THREE.BufferGeometry(); recess.geometry.setAttribute('position', new THREE.BufferAttribute(g.recess, 3)); recess.geometry.setAttribute('color', new THREE.BufferAttribute(g.recessColor, 3));
    state.boxes = g.boxes; state.build = build;
  };
  // 主相机渲进不带 stencil 的 RT：本帧先隐藏，等这一帧的 JS 任务结束（微任务）再把 RT 升级为 depth+stencil 并释放，
  // 下一次 setRenderTarget 时 three 按新格式重建（depthTexture 改 DepthStencilFormat / UnsignedInt248Type）。
  const pending = new Set();
  const upgrade = () => {
    for (const t of pending) {
      t.stencilBuffer = true;
      if (t.depthTexture) { t.depthTexture.format = THREE.DepthStencilFormat; t.depthTexture.type = THREE.UnsignedInt248Type; }
      t.dispose(); state.upgraded++;
    }
    pending.clear();
  };
  const prevBefore = view.scene.onBeforeRender;
  view.scene.onBeforeRender = function (renderer, scene, camera, rt) {
    prevBefore?.apply(this, arguments);
    const build = view.worldMesh?.build ?? null;
    if (build !== state.build) rebuild(build);
    const main = camera === view.camera, hasStencil = rt ? !!rt.stencilBuffer : renderer.getContext().getContextAttributes()?.stencil !== false;
    if (main && rt && !rt.stencilBuffer && rt.depthBuffer && state.enabled && !pending.has(rt)) { if (!pending.size) queueMicrotask(upgrade); pending.add(rt); }
    group.visible = state.enabled && main && hasStencil;
    if (group.visible) { state.frames++; if (rt) state.stencilFrames++; } else if (main) state.skipped++;
  };
  return {
    state, group,
    set enabled(on) { state.enabled = !!on; group.visible = false; },
    get enabled() { return state.enabled; },
    stats: () => ({ openings: state.boxes.length, doors: state.boxes.filter((b) => b.door).length, depth, frames: state.frames, upgraded: state.upgraded, skipped: state.skipped }),
    dispose() { view.scene.remove(group); view.scene.onBeforeRender = prevBefore; for (const m of [mask, reset, recess]) m.geometry.dispose(); for (const m of Object.values(mats)) m.dispose(); },
  };
}
