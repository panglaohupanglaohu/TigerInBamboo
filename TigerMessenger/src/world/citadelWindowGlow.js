// 高山圣城可见建筑的暖窗（2026-11-09，目标图 citadel-target-20261024：蓝调暮色里满城暖窗，钟楼和窗是暖色点缀）。
// 现状：可见的新设计（citadel-target-*）窗玻璃用 target-old-city-glass / target-new-stairs-glass，完全不发光，入夜也不亮；
//   原有的「夜窗」系统（updateCitadelNightWindows）管的是已隐藏的旧布局建筑格，管不到这些窗。
// 做法：只把名字是窗玻璃 / 窗格 / 深色嵌板的网格换成该材质的「发光副本」（门扇、地基等共用同一材质的不动）；
//   暖光强度 = max(入夜程度, 圣城暮色权重 × 0.85)；按网格固定分配约七成窗亮、三成微亮，不是整城一个亮度。?citadelWindows=0 关闭。
import * as THREE from 'three';
import { nightWeightAt } from '../render/lighting/highlandLightVolumes.js';

const GLASS = /^(target-old-city-glass|target-new-stairs-glass)$/;
const PANE = /windows?-glass|window-pane|panes|dark-inset/i;
const WARM = new THREE.Color(0xffb35a);

export function installCitadelWindowGlow({ getCastle }) {
  if (new URLSearchParams(globalThis.location?.search || '').get('citadelWindows') === '0') return { update() {}, count: 0 };
  const clones = new Map();   // 原材质 → { lit, dim }
  let count = 0, at = -1e9;
  const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967295; };
  const scan = () => {
    const castle = getCastle(); if (!castle) return;
    castle.traverse((o) => {
      if (!o.isMesh || o.userData.tmWindowGlow || !PANE.test(o.name || '') || !visible(o)) return;
      const m = o.material; if (Array.isArray(m) || !m?.isMeshStandardMaterial || !GLASS.test(m.name || '')) return;
      let c = clones.get(m);
      if (!c) {
        const mk = (name) => { const x = m.clone(); x.name = m.name + name; x.emissive = WARM.clone(); x.emissiveIntensity = 0; return x; };
        c = { lit: mk('·暖窗'), dim: mk('·微亮') }; clones.set(m, c);
      }
      o.material = hash((o.name || '') + o.id) < 0.7 ? c.lit : c.dim;
      o.userData.tmWindowGlow = true; count++;
    });
  };
  return {
    get count() { return count; },
    update(timeOfDay, duskWeight = 0) {
      const now = performance.now(); if (now - at > 8000) { at = now; scan(); }
      const glow = Math.min(1, Math.max(nightWeightAt(timeOfDay), duskWeight * 0.85));
      for (const c of clones.values()) { c.lit.emissiveIntensity = 1.25 * glow; c.dim.emissiveIntensity = 0.22 * glow; }
    },
  };
}
