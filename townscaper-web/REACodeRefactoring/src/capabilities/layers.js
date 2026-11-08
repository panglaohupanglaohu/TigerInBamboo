/**
 * layers.js — 显示层能力的 three.js 实现（主线程）。
 * createLayer(name, host) → { refresh(world), update(dt), dispose() }
 * host：{ scene, world, index, levelHeight, uTime, uNight, chimneys() }
 */
import { Lighthouses } from '../build/lighthouse.js';
import { WaterVolume } from '../water/watervol.js';
import { Smoke } from '../life/smoke.js';

const FACTORIES = {
  lighthouse(host) {
    const l = new Lighthouses({ scene: host.scene, levelHeight: host.levelHeight, uTime: host.uTime, uNight: host.uNight });
    return { refresh: (w) => l.refresh(w), update: () => l.update(), dispose: () => { host.scene.remove(l.group); }, get count() { return l.list.length; } };
  },
  watervol(host) {
    const v = new WaterVolume({ scene: host.scene, uTime: host.uTime });
    v.visible = true;
    return { refresh: (w) => v.refresh(w, host.index), update() {}, dispose: () => { host.scene.remove(v.group); }, get count() { return v.group.children.length; } };
  },
  smoke(host) {
    const s = new Smoke({ scene: host.scene, uTime: host.uTime });
    return {
      refresh() { s.sources = (host.chimneys?.() || []).map((c) => ({ x: c.x, y: c.y + 0.05, z: c.z })); },
      update: (dt) => s.update(dt),
      dispose: () => { host.scene.remove(s.back, s.front); },
      get count() { return s.sources.length; },
    };
  },
};

export function createLayer(name, host) {
  const f = FACTORIES[name];
  if (!f) throw new Error('未知显示层：' + name);
  return f(host);
}
export const LAYER_NAMES = Object.keys(FACTORIES);
