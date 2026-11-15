/**
 * build-reel-c09.js — 第 56 批 C09-D：主场景（共享 World / WorldMesh）上的「线框构建 → 着色 → 转镜 → 换岛」。
 *
 *   1579478470098243584  格笼线框一点点长出来 → 着色（笼线还叠着）→ 转镜 → 笼线退掉        mode 'cage'
 *   1579474420749725696  第一座岛线框逐笔搭出 → 着色 → 转镜 → 重置 → 第二座岛同样一遍       mode 'two'
 *   1447483550257799171  彩色岛 ↔ 黑底白线逐笔累积成岛轮廓，每轮换一座新岛（44s showreel）   mode 'reel'
 *
 * 线不是手画的：来自 terrainmesh 记录的真实墙四边形/顶面外边（world.terrainSurface）或 shape.at 的格笼；
 * 排期用 stroke-reveal-c09（共享 stroke-reveal 的错峰 + 弧长裁剪）。换岛 = scenes.buildScene 用新种子重跑地形管线。
 * 只往 view.scene 里加一个 Group，退出时还原所有可见性/背景/开关；不改 view.js / worldmesh.js。
 */
import * as THREE from 'three';
import { buildScene } from './scenes.js';
import { createStrokeReveal3D } from '../core/stroke-reveal-c09.js';
import { surfaceSegments, cageSegments, terrainStrokes } from '../terrain/terrain-strokes-c09.js';

export const REEL_PRESETS = {
  // 片子 0–70 线框（~5.7s）→ 71 着色、笼线叠着 → ~215 起笼线消失，期间转镜
  cage: { lines: 'cage', bg: '#36585c', line: '#e6f2ef', wire: 5.5, hold: 0.4, color: 8, overlay: 6, orbit: 0.22, seeds: [7], scene: 'terrain', soft: false },
  // 片子 0–78 线框 → 79 着色 → 160 转镜 → 218 重置第二座岛 → 300 着色 → 402 转到俯视
  two: { lines: 'mesh', bg: '#36585c', line: '#e6f2ef', wire: 4.5, hold: 0.3, color: 7, overlay: 0, orbit: 0.3, seeds: [11, 23], scene: 'fusion', soft: true, pitchTo: 0.95 },
  // 黑底白线；彩色岛环绕 → 切黑 → 白线累积 → 另一座彩色岛
  reel: { lines: 'feature', bg: '#2b2b2b', line: '#f2f2f2', wire: 3.2, hold: 0.25, color: 5.5, overlay: 0, orbit: 0.35, seeds: [5, 9, 17, 31], scene: 'terrain', soft: false, colorFirst: true },
};

/** 整个 WorldMesh（地形 + 房子）的特征边：二面角 > angle 的边，等于「模型线框」。 */
export function meshEdgeSegments(geometry, angle = 35) {
  const eg = new THREE.EdgesGeometry(geometry, angle);
  const a = eg.attributes.position.array, segs = [];
  for (let i = 0; i + 5 < a.length; i += 6) segs.push([[a[i], a[i + 1], a[i + 2]], [a[i + 3], a[i + 4], a[i + 5]]]);
  eg.dispose();
  return segs;
}

export function attachBuildReel(view, world, preset = 'reel', over = {}) {
  const P = { ...(REEL_PRESETS[preset] ?? REEL_PRESETS.reel), ...over };
  const L = view.levelHeight;
  const group = new THREE.Group();
  group.name = 'build-reel-c09';
  const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(P.line), transparent: true, opacity: 0.95, depthTest: false });
  const geo = new THREE.BufferGeometry();
  const lines = new THREE.LineSegments(geo, mat);
  lines.renderOrder = 999;
  lines.frustumCulled = false;
  group.add(lines);
  view.scene.add(group);

  const saved = { bg: view.scene.background?.clone?.() ?? null, vis: new Map(), yaw: view.yaw, pitch: view.pitch };
  for (const o of view.scene.children) if (o !== group) saved.vis.set(o, o.visible);

  // 每轮的阶段：colorFirst（reel）= 先彩色岛再线稿；否则线框 → 着色
  const phases = P.colorFirst
    ? [['color', P.color], ['wire', P.wire], ['hold', P.hold]]
    : [['wire', P.wire], ['hold', P.hold], ['color', P.color]];
  const roundLen = phases.reduce((s, p) => s + p[1], 0);
  let round = -1, reveal = null, strokes = [], buf = null, segCount = 0, seed = P.seeds[0], lastPhase = null;

  function regenerate(r) {
    seed = P.seeds[r % P.seeds.length];
    buildScene(world, P.scene, seed);
    world.terrainCollide = true;
    world.softTops = !!P.soft;
    view.changed();
    view.worldMesh.invalidate();
    view.render(0);                                   // 同步重建网格 → terrainSurface
    const surf = world.terrainSurface;
    if (!surf || surf.version !== world.version) throw new Error('terrainSurface not rebuilt');
    view.frameTown?.();
    let segs;
    if (P.lines === 'cage') segs = cageSegments(world, view.worldMesh.shape, { L });
    else if (P.lines === 'mesh') segs = meshEdgeSegments(view.worldMesh.geometry, P.edgeAngle ?? 35);
    else segs = surfaceSegments(surf);
    strokes = terrainStrokes(segs, { maxPoints: P.lines === 'cage' ? 10 : 18 });
    reveal = createStrokeReveal3D({ strokes, duration: P.wire, stagger: 0.7, order: 'random', seed, ease: 'smooth' });
    segCount = strokes.reduce((s, k) => s + k.length - 1, 0);
    buf = new Float32Array(segCount * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
    round = r;
  }

  function fill(t) {
    let n = 0;
    for (const s of reveal.sampleAt(t)) {
      const p = s.points;
      for (let i = 1; i < p.length && n < segCount; i++, n++) {
        buf.set(p[i - 1], n * 6); buf.set(p[i], n * 6 + 3);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.setDrawRange(0, n * 2);
    return n;
  }

  function showWorld(on) {
    for (const [o, v] of saved.vis) o.visible = on ? v : false;
    if (view.scene.background) view.scene.background.set(on ? (saved.bg ?? P.bg) : P.bg);
  }

  let time = 0, info = {};
  function seek(t) {
    time = Math.max(0, t);
    const r = Math.floor(time / roundLen);
    if (r !== round) regenerate(r);
    let lt = time - r * roundLen, phase = phases[phases.length - 1][0], local = 0, dur = 1;
    for (const [name, d] of phases) { if (lt < d) { phase = name; local = lt; dur = d; break; } lt -= d; }
    let drawn = 0;
    if (phase === 'wire') { showWorld(false); lines.visible = true; mat.opacity = 0.95; drawn = fill(local); }
    else if (phase === 'hold') { showWorld(false); lines.visible = true; mat.opacity = 0.95; drawn = fill(P.wire); }
    else {
      showWorld(true);
      // 着色后笼线还叠一会（cage），然后淡出
      const fade = P.overlay > 0 ? Math.max(0, 1 - Math.max(0, local - P.overlay * 0.7) / (P.overlay * 0.3)) : 0;
      lines.visible = fade > 0.01; mat.opacity = 0.55 * fade;
      if (lines.visible) drawn = fill(P.wire);
      if (P.orbit) { view.yaw = saved.yaw + local * P.orbit; if (P.pitchTo) view.pitch = saved.pitch + (P.pitchTo - saved.pitch) * Math.min(1, local / dur) * (r % 2 ? 1 : 0); view.updateCamera(); }
    }
    if (phase !== lastPhase && phase !== 'color') { view.yaw = saved.yaw; view.pitch = saved.pitch; view.updateCamera(); }
    lastPhase = phase;
    const st = phase === 'color' ? null : reveal.statsAt(phase === 'wire' ? local : P.wire);
    info = { time, round, seed, phase, local, strokes: strokes.length, segments: segCount, drawnSegments: drawn, ratio: st ? st.ratio : 1, started: st?.started ?? strokes.length, worldVisible: phase === 'color', overlay: lines.visible && phase === 'color' };
    return info;
  }

  let raf = 0, playing = false, last = 0;
  function loop(ts) {
    if (!playing) return;
    const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
    last = ts;
    seek(time + dt);
    raf = requestAnimationFrame(loop);
  }
  function play() { playing = true; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  function pause() { playing = false; cancelAnimationFrame(raf); }
  function dispose() {
    pause(); view.scene.remove(group); geo.dispose(); mat.dispose(); showWorld(true);
    view.yaw = saved.yaw; view.pitch = saved.pitch; view.updateCamera();
  }
  /** 第 r 轮某阶段某进度的时刻（截图定格用）。 */
  function timeOf(r, phase, norm = 1) {
    let t = r * roundLen;
    for (const [name, d] of phases) { if (name === phase) return t + d * Math.max(0, Math.min(0.999, norm)); t += d; }
    throw new RangeError('unknown phase ' + phase);
  }
  seek(0);
  return { preset: P, phases, roundLen, seek, play, pause, dispose, timeOf, get info() { return info; }, get strokes() { return strokes; }, group };
}
