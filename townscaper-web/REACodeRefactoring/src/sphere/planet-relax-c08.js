// r56 C08 · 1769641473895432220「relax pass: module-containing cells try to achieve their desired
// shape and size. Note the cells on the top left contracting.」
// 片中是迭代松弛的过程本身：格子从纯径向（越高越大 = 蘑菇化）逐步收缩到期望大小。
// 这里不另写求解器：每一帧就是共享 cornerPositions 跑 k 次真实弹簧迭代的结果（k=0 = 纯径向），
// 末帧可接 r55 的 'shape' 整片相似收缩。另给出格子顶环线框（按面积比着色）供对照片中线框段。
import { cornerPositions, moduleSizeReport, mushroomRatio, planetMesh } from './planet.js';

export const RELAX_STEPS = [0, 1, 2, 3, 4, 6, 8, 11, 15, 20, 27, 34, 40];

/** 逐迭代快照：返回 [{iters, at, ratio, report}]；finalSolver='shape' 时再追加一帧整片收缩结果 */
export function relaxFrames(planet, { steps = RELAX_STEPS, moduleCells = null, finalSolver = null } = {}) {
  if (!Array.isArray(steps) || !steps.length || steps.some((k, i) => !Number.isInteger(k) || k < 0 || k > 1000 || (i && k <= steps[i - 1])))
    throw new RangeError('steps must be strictly increasing non-negative integers');
  const frames = steps.map((iters) => {
    const at = iters === 0 ? cornerPositions(planet, { relax: false }) : cornerPositions(planet, { relax: true, iters, moduleCells, solver: 'spring' });
    return { iters, solver: iters === 0 ? 'radial' : 'spring', at, ratio: mushroomRatio(planet, at), report: moduleSizeReport(planet, at, { moduleCells }) };
  });
  if (finalSolver === 'shape') {
    const at = cornerPositions(planet, { relax: true, moduleCells, solver: 'shape' });
    frames.push({ iters: steps[steps.length - 1], solver: 'shape', at, ratio: mushroomRatio(planet, at), report: moduleSizeReport(planet, at, { moduleCells }) });
  }
  return frames;
}

/** 每个陆地格在其顶层的轮廓线段；颜色：面积比 >1.25 红（仍蘑菇化）、>1.08 黄、否则青（已到期望大小） */
export function cellOutlineSegments(planet, at, { lift = 0.004 } = {}) {
  const pos = [], col = [], area = (r) => { let s = 0; for (let i = 1; i + 1 < r.length; i++) { const a = sub(r[i], r[0]), b = sub(r[i + 1], r[0]); s += Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) / 2; } return s; };
  let red = 0, yellow = 0, cyan = 0;
  for (const c of planet.cells) {
    const h = planet.H[c.id]; if (h < 2) continue;
    const top = c.ring.map((k) => at(k, h)), base = c.ring.map((k) => at(k, 0)), q = area(top) / area(base);
    const rgb = q > 1.25 ? [1, .35, .3] : q > 1.08 ? [1, .85, .35] : [.45, .95, 1];
    if (q > 1.25) red++; else if (q > 1.08) yellow++; else cyan++;
    for (let i = 0; i < top.length; i++) {
      const a = top[i], b = top[(i + 1) % top.length];
      for (const p of [a, b]) { const l = Math.hypot(...p); pos.push(...p.map((x) => x * (1 + lift / l))); col.push(...rgb); }
    }
  }
  return { position: pos, color: col, counts: { red, yellow, cyan } };
}

/** planet.html?relaxanim=1 的挂件：真实 View 里逐帧替换陆地几何 + 顶环线框；?relaxT=0..1 定格 */
export function installRelaxAnim({ THREE, demo, Q }) {
  const frames = relaxFrames(demo.planet, { finalSolver: Q.get('solver') === 'shape' ? 'shape' : null });
  const outline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .95, depthTest: true }));
  const label = document.createElement('div');
  label.style.cssText = 'position:fixed;right:16px;top:16px;background:rgba(255,255,255,.92);color:#1d2f36;border-radius:10px;padding:8px 12px;font:12.5px/1.5 system-ui,sans-serif;max-width:340px';
  document.body.appendChild(label);
  let idx = -1, t = Q.has('relaxT') ? Math.max(0, Math.min(1, Number(Q.get('relaxT')) || 0)) : 0, playing = !Q.has('relaxT');
  const setFrame = (i) => {
    i = Math.max(0, Math.min(frames.length - 1, i)); if (i === idx) return; idx = i;
    const f = frames[i], m = planetMesh(demo.planet, f.at), land = demo.land;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(m.position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(m.normal, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(m.color, 3));
    if (land) { land.geometry.dispose(); land.geometry = g; }
    const o = cellOutlineSegments(demo.planet, f.at);
    outline.geometry.dispose(); outline.geometry = new THREE.BufferGeometry();
    outline.geometry.setAttribute('position', new THREE.Float32BufferAttribute(o.position, 3));
    outline.geometry.setAttribute('color', new THREE.Float32BufferAttribute(o.color, 3));
    api.current = { i, iters: f.iters, solver: f.solver, ratio: f.ratio, minArea: f.report.minAreaRatio, maxArea: f.report.maxAreaRatio, counts: o.counts };
    label.innerHTML = `<b>防蘑菇化松弛过程</b>（1769641473895432220）<br>帧 ${i + 1}/${frames.length} · ${f.solver === 'radial' ? '纯径向（未松弛）' : f.solver === 'shape' ? '整片相似收缩（r55 末帧）' : `弹簧迭代 ${f.iters} 次`}<br>` +
      `高台面积比 <b>${f.ratio.toFixed(2)}</b> · 顶环：<span style="color:#c33">红 ${o.counts.red}</span> / <span style="color:#a80">黄 ${o.counts.yellow}</span> / <span style="color:#178">青 ${o.counts.cyan}</span>（红=仍蘑菇化，青=已到期望大小）`;
  };
  const api = { frames, setFrame, get playing() { return playing; }, set playing(v) { playing = !!v; }, current: null };
  window.planetRelaxAnim = api;
  setFrame(Math.round(t * (frames.length - 1)));
  let last = performance.now();
  const tick = () => {
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
    if (playing) { t += dt / 5; if (t > 1.25) t = 0; setFrame(Math.round(Math.min(1, t) * (frames.length - 1))); }
    if (outline.parent !== demo.world) demo.world.add(outline);   // show() clears the group on every UI event
    requestAnimationFrame(tick);
  };
  tick();
  return api;
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
