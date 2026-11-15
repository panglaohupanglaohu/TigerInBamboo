/**
 * view-c11-megagi.js — 第 56 批 C11：?c11=megagi 把 megatexture-gi.js（SDF(UV) → mega texture ↔ 六向光体积往返反弹）
 * 的结果作为主场景间接光。默认关、默认不加载。
 *
 * 接法：不改 view.js —— 打开时把实例上的 view.bakeGI 换成本模块的烘焙（写同一个 aGI 属性、同一个 uGI 混合），
 * 所以 View 原有的「World/太阳变了 → 防抖重烘」路径自动走新算法；关闭时还原原 bakeGI 与 giOn。
 */
import * as THREE from 'three';
import { bakeMegaTextureGI } from '../light/megatexture-gi.js';

export function install(view) {
  const st = { on: false, orig: null, prevGI: 0, last: null, opts: { bounces: 3 } };
  const albedoOf = (() => {
    const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; }, grass = [0.5, 0.6, 0.34], rock = [0.6, 0.58, 0.55], plaster = hex('#efe6d4');
    return (w) => (c, lv) => { if (w.isRock(c, lv)) return lv === w.top(c) ? grass : rock; const k = w.color[c.id]; return k >= 0 && w.palette?.colors?.[k] ? hex(w.palette.colors[k]) : plaster; };
  })();
  function writeAGI(r, zero = false) {
    const g = view.mesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, out = new Float32Array(pos.count * 3);
    if (!zero) for (let i = 0; i < pos.count; i++) {
      const n = [nor.getX(i), nor.getY(i), nor.getZ(i)], s = r.sampleIndirect(pos.getX(i), pos.getY(i), pos.getZ(i), n);
      out[i * 3] = s[0]; out[i * 3 + 1] = s[1]; out[i * 3 + 2] = s[2];
    }
    if (g.attributes.aGI?.array.length === out.length) { g.attributes.aGI.array.set(out); g.attributes.aGI.needsUpdate = true; } else g.setAttribute('aGI', new THREE.BufferAttribute(out, 3));
    return out;
  }
  function bake() {
    const w = view.town, sc = view.sun?.color ?? { r: 1, g: .95, b: .85 };
    const r = bakeMegaTextureGI(w, view.index, { L: view.levelHeight, sun: view.sunDir.toArray(), sunColor: [sc.r, sc.g, sc.b], albedoOf: albedoOf(w), bounces: st.opts.bounces, keepSnapshots: !!st.opts.keepSnapshots });
    if (!r) return null;
    st.last = r; view.megaGI = r; st.finalLV = r.lv.slice(); writeAGI(r);
    view.giStats = { megatexture: true, ...r.stats, bounceStats: r.bounceStats };
    return view.giStats;
  }
  return {
    get result() { return st.last; },
    options(o = {}) { Object.assign(st.opts, o); if (st.on) return bake(); return null; },
    rebake: () => bake(),
    set(on) {
      if (on === st.on) return;
      st.on = on;
      if (on) { st.orig = Object.prototype.hasOwnProperty.call(view, 'bakeGI') ? view.bakeGI : null; st.prevGI = view.giOn.value; view.bakeGI = bake; view.giOn.value = 1; bake(); }
      else { if (st.orig) view.bakeGI = st.orig; else delete view.bakeGI; view.giOn.value = st.prevGI; if (st.prevGI) view.bakeGI(); }
    },
    /**
     * 慢放反弹序列（1580846877855338497）：i 号快照 → 主场景。为看清反弹，播放期间关掉环境/半球光（否则阴影里本来就有天光），
     * reset 阶段太阳也关（全黑）；direct 阶段只有太阳（阴影纯黑）；volume/texture k 阶段 aGI = 第 k 轮光体积。endStages() 还原。
     */
    showStage(i) {
      const r = st.last; if (!r?.snapshots?.length) throw new Error('megagi: rebake with options({keepSnapshots:true}) first');
      const s = r.snapshots[i]; if (!s) throw new RangeError('stage');
      if (!st.lights) st.lights = { sun: view.sun.intensity, amb: view.ambient.intensity, hemi: view.hemi.intensity };
      view.ambient.intensity = 0; view.hemi.intensity = 0; view.sun.intensity = s.stage === 'reset' ? 0 : st.lights.sun;
      r.lv.set(s.lv); writeAGI(r, s.stage === 'reset' || s.stage === 'direct');
      return { stage: s.stage, bounce: s.bounce, index: i, of: r.snapshots.length };
    },
    endStages() {
      const r = st.last; if (st.lights) { view.sun.intensity = st.lights.sun; view.ambient.intensity = st.lights.amb; view.hemi.intensity = st.lights.hemi; st.lights = null; }
      if (r && st.finalLV) { r.lv.set(st.finalLV); writeAGI(r); }
    },
    stats() { return st.last ? { ...st.last.stats, bounceStats: st.last.bounceStats.map((b) => ({ bounce: b.bounce, relativeChange: +(b.relativeChange ?? 0).toFixed(5) })) } : {}; },
  };
}
