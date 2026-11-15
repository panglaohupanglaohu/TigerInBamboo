/**
 * view-c11.js — 第 56 批 C11（第三项目 光照 / 贴图）接进 View 的开关分发。全部默认关、默认不加载。
 * View 构造末尾一行：`?c11=` 出现时 import 本文件并 installC11(view)。打开：URL `?c11=a,b` 或 `await view.c11.set(name, on)`。
 *
 * 每个开关一个独立文件（避免多人改同一文件），文件导出 install(view) → { set(on), update?(dt,t), stats? }：
 *   grassline   view-c11-grassline.js   1590674061092212738 草卡顶点着色器在站立处 + 背景射线处两次采样反差纹理，差值定描边强度
 *   shrubband   view-c11-shrubband.js   1707490932017279035 纯贴图灌木带：带宽随崖高缩放 + 高崖壁每层台阶线挂一条灌木带
 *   megagi      view-c11-megagi.js      1580835075629133825 / 1580845127207387137 / 1580846877855338497 SDF(UV)→mega texture→六向体积往返反弹
 *   normalline  view-c11-normalline.js  1482011744843223042 程序化笔触法线图里的反差 → 像素细线（描边线源）
 *   mountaintex view-c11-mountaintex.js 1786014232594485497 岩壁 = 顶点烘焙明度 × 下坡条痕（白条/沟槽）+ 脊线墨，运行时不采法线
 */
export const C11_MODULES = Object.freeze({
  grassline: () => import('./view-c11-grassline.js'),
  shrubband: () => import('./view-c11-shrubband.js'),
  mountaintex: () => import('./view-c11-mountaintex.js'),
  megagi: () => import('./view-c11-megagi.js'),
  normalline: () => import('./view-c11-normalline.js'),
});
export const C11_KEYS = Object.freeze(Object.keys(C11_MODULES));
export function parseC11(search) {
  const p = new URLSearchParams(search || '');
  return (p.get('c11') || '').split(',').map((s) => s.trim()).filter((s) => C11_KEYS.includes(s));
}

export async function installC11(view, keys = parseC11(globalThis.location?.search)) {
  if (view.c11) { for (const k of keys) await view.c11.set(k, true); return view.c11; }
  const mods = {}, on = {};
  const api = {
    mods, on, view,
    async load(name) {
      if (!C11_MODULES[name]) throw new RangeError('c11: unknown ' + name);
      if (!mods[name]) mods[name] = (await C11_MODULES[name]()).install(view);
      return mods[name];
    },
    async set(name, value) { const m = await api.load(name); on[name] = !!value; await m.set(!!value); return m; },
    update(dt, t) { for (const [k, m] of Object.entries(mods)) if (on[k] && m.update) m.update(dt, t); },
    stats() { return Object.fromEntries(Object.entries(mods).map(([k, m]) => [k, { on: !!on[k], ...(typeof m.stats === 'function' ? m.stats() : m.stats ?? {}) }])); },
  };
  view.c11 = api;
  if (globalThis.window) globalThis.window.__c11 = api;
  // 每帧更新：挂在 renderer.render 前（不改 view.render），只在有模块开着时做事
  const r = view.renderer, orig = r.render.bind(r); let last = performance.now();
  r.render = (scene, camera) => {
    if (scene === view.scene) { const now = performance.now(); api.update(Math.min(0.1, (now - last) / 1000), now / 1000); last = now; }
    return orig(scene, camera);
  };
  for (const k of keys) await api.set(k, true);
  return api;
}
