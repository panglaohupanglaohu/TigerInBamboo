/**
 * merge-bench-c06.js — 第 56 批 C06：1401145625572425728「小网格靠引擎动态合批不够快 → 自己写 mesh merger」的本地对照。
 * 同一份 World 主体几何：① 切成很多小网格（每个 trisPerMesh 个三角，模拟「每块模块一个小 mesh」）逐个提交；
 * ② WorldMesh 已拼好的单一几何一次提交。同相机、同材质，测 renderer.info 提交次数 + gl.finish 后的帧时间。
 * 只测主体（不含水/植被/阴影）；SwiftShader/CPU 上的倍数不等于 Switch，结论只说「合并减少提交、本机更快」。
 */
import * as THREE from 'three';

export function splitGeometry(geometry, trisPerMesh = 64) {
  if (!Number.isInteger(trisPerMesh) || trisPerMesh < 1) throw new RangeError('trisPerMesh');
  const src = geometry.index ? geometry.toNonIndexed() : geometry;
  const names = Object.keys(src.attributes), n = src.getAttribute('position').count, out = [];
  for (let start = 0; start < n; start += trisPerMesh * 3) {
    const end = Math.min(n, start + trisPerMesh * 3), g = new THREE.BufferGeometry();
    for (const name of names) { const a = src.getAttribute(name); g.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, end * a.itemSize), a.itemSize, a.normalized)); }
    out.push(g);
  }
  return out;
}

// tiny=true：视口缩到 8×8 像素，填充代价近乎为 0 → 只剩每次提交的 CPU/驱动开销（Switch 上的瓶颈就是这一项）。
export function benchMerge(view, { frames = 40, trisPerMesh = 64, tiny = false } = {}) {
  const renderer = view.renderer, gl = renderer.getContext(), px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px), geometry = view.worldMesh.geometry, material = view.material;
  const merged = new THREE.Scene(), split = new THREE.Scene(), parts = splitGeometry(geometry, trisPerMesh);
  const m = new THREE.Mesh(geometry, material); m.frustumCulled = false; merged.add(m);
  for (const g of parts) { const p = new THREE.Mesh(g, material); p.frustumCulled = false; split.add(p); }
  const autoReset = renderer.info.autoReset, target = renderer.getRenderTarget(), shadow = renderer.shadowMap.enabled;
  const run = (scene) => {
    renderer.render(scene, view.camera); sync();   // 预热（编译、上传）
    renderer.info.reset(); const t0 = performance.now();
    for (let i = 0; i < frames; i++) { renderer.render(scene, view.camera); sync(); }   // 每帧读回 1 像素强制 GPU 做完
    return { ms: (performance.now() - t0) / frames, calls: renderer.info.render.calls / frames, triangles: renderer.info.render.triangles / frames };
  };
  const vp = new THREE.Vector4(); renderer.getViewport(vp);
  try {
    renderer.setRenderTarget(null); if (tiny) renderer.setViewport(0, 0, 8, 8); renderer.shadowMap.enabled = false; renderer.info.autoReset = false;
    const a = run(split), b = run(merged), a2 = run(split), b2 = run(merged);   // 交替两轮，取较小值减抖动
    const S = { ms: Math.min(a.ms, a2.ms), calls: a.calls, triangles: a.triangles, meshes: parts.length }, M = { ms: Math.min(b.ms, b2.ms), calls: b.calls, triangles: b.triangles, meshes: 1 };
    return { split: S, merged: M, speedup: S.ms / M.ms, callRatio: S.calls / M.calls, sameTriangles: Math.round(S.triangles) === Math.round(M.triangles), scope: 'World 主体（地形+建筑），不含水/植被/阴影' + (tiny ? '；8×8 视口只测提交开销' : '') };
  } finally {
    renderer.setViewport(vp); renderer.info.autoReset = autoReset; renderer.shadowMap.enabled = shadow; renderer.setRenderTarget(target); renderer.info.reset();
    for (const g of parts) g.dispose();
    view.render(0);
  }
}
