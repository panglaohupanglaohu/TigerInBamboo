import * as THREE from 'three';

// 高山圣城一带的暮色调色（2026-11-08 主人要求「按目标图调整颜色」）。
// 目标图：artifacts/pipeline/citadel-target-20261024/highland-citadel-target-v1.png
//   蓝调暮色 —— 天顶淡蓝紫、地平线一条细桃色；灰蓝石灰岩；暖光只在窗和钟楼里点缀，不是大面积橙红。
// 只在暮色时段（约 0.64–0.90）、镜头靠近圣城 / 十二门徒时生效，按距离渐变；离开就回到昼夜系统原本的颜色。
// 每帧在昼夜系统写完之后再混色；灯的强度按「上一帧自己写的值」还原原值，不会越乘越暗。?citadelDusk=0 关闭。
// 天空着色器把 uniform 颜色按线性值直接输出（不做色彩空间转换），所以这里按「屏幕上要看到的颜色」直接写进去，
// 否则淡蓝紫会显示成深靛蓝、桃色会显示成橙红。颜色取自目标图：天顶 #7f88c8 → 中段 #a9a5d4 → 地平线桃 #f2b896。
const shown = (hex) => { const c = new THREE.Color(); c.setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, THREE.LinearSRGBColorSpace); return c; };
const SKY_TOP = shown(0x7f88c8), SKY_MID = shown(0xa9a5d4), SKY_BOT = shown(0xf2b896);
const GLOW_GOLD = shown(0xf6c7a4), GLOW_ROSE = shown(0xd9a3b8), GLOW_VIOLET = shown(0x8e93cc);
// 海：目标图近岸透青绿、往外很快变深蓝（海面着色器同样按显示色读 uniform）
const SEA_SHALLOW = shown(0x3f9eaa), SEA_DEEP = shown(0x24558f);
const CLOUD = shown(0xb3a8d2), CLOUD_LIT = new THREE.Color(0xe9c3cf);
const FOG = new THREE.Color(0x8a8fbf), AMB_COL = new THREE.Color(0xa9b2e0), SUN_COL = new THREE.Color(0xffc9a6);

export function createCitadelDuskGrade({ scene, skyMat, getCenters, radius = 161 }) {
  const off = new URLSearchParams(globalThis.location?.search || '').get('citadelDusk') === '0';
  const up = new THREE.Vector3();
  let weight = 0, lights = [], lightsAt = -1e9, cloudMats = [], cloudImp = [], cloudsAt = -1e9;
  const timeWeight = (t) => THREE.MathUtils.smoothstep(t, 0.62, 0.70) * (1 - THREE.MathUtils.smoothstep(t, 0.86, 0.93));
  const nearWeight = (pos) => {
    up.copy(pos).normalize(); let best = 1e9;
    for (const d of getCenters() || []) if (d) best = Math.min(best, up.angleTo(d) * radius);
    return 1 - THREE.MathUtils.smoothstep(best, 130, 250);
  };
  const scale = (l, f, col, mix) => {
    const ud = l.userData;
    const base = ud.citadelDuskWrote !== undefined && Math.abs(l.intensity - ud.citadelDuskWrote) < 1e-6 ? ud.citadelDuskBase : l.intensity;
    ud.citadelDuskBase = base; l.intensity = base * f; ud.citadelDuskWrote = l.intensity;
    if (col && mix > 0) {
      const cb = ud.citadelDuskColWrote && l.color.equals(ud.citadelDuskColWrote) ? ud.citadelDuskColBase : l.color.clone();
      ud.citadelDuskColBase = cb; l.color.copy(cb).lerp(col, mix); ud.citadelDuskColWrote = l.color.clone();
    }
  };
  // 天空霞光的颜色和强度是 sky 自己在 onBeforeRender 里写的，所以在它之后再改
  const sky = scene.getObjectByName('sky-background');
  if (sky && !off) {
    const prev = sky.onBeforeRender;
    sky.onBeforeRender = function (...a) {
      prev?.apply(this, a);
      if (weight <= 0 || !skyMat) return;
      const U = skyMat.uniforms;
      U.glowAmount.value *= 1 - 0.7 * weight;             // 太阳周围那一大圈光晕 / 橙红霞带收小，只留一条细桃色地平线
      U.glowGold.value.lerp(GLOW_GOLD, weight); U.glowRose.value.lerp(GLOW_ROSE, weight); U.glowViolet.value.lerp(GLOW_VIOLET, weight);
    };
  }
  // 颜色混合：记住别的系统写进来的原值（不管它是不是每帧重写），在原值上按权重混，权重为 0 时正好还原
  const tracked = new Map();
  const mixColor = (c, target, amt) => { let t = tracked.get(c); if (!t) tracked.set(c, t = { base: c.clone(), wrote: null });
    if (!t.wrote || !c.equals(t.wrote)) t.base.copy(c); c.copy(t.base).lerp(target, amt); t.wrote = (t.wrote || new THREE.Color()).copy(c); };
  // 海面颜色：记住海面系统写的原值（它只在换样式时写），在原值上按权重混；权重为 0 时还原
  const seaBase = { shallow: null, deep: null, light: null }, seaWrote = { shallow: null, deep: null, light: null };
  const seaGrade = (w) => {
    const SU = globalThis.__tmSeaStyle?.uniforms; if (!SU?.uTmShallow) return;
    for (const [k, key, target] of [['shallow', 'uTmShallow', SEA_SHALLOW], ['deep', 'uTmDeep', SEA_DEEP]]) {
      const c = SU[key].value; if (!seaWrote[k] || !c.equals(seaWrote[k])) seaBase[k] = c.clone();
      c.copy(seaBase[k]).lerp(target, 0.85 * w); seaWrote[k] = c.clone();
    }
    const L = SU.uTmLight; if (seaWrote.light === null || Math.abs(L.value - seaWrote.light) > 1e-6) seaBase.light = L.value;
    L.value = seaBase.light * (1 - 0.15 * w); seaWrote.light = L.value;
  };
  return {
    get weight() { return weight; },
    update(cameraPos, timeOfDay) {
      if (off) return 0;
      const t = ((timeOfDay ?? 0.5) % 1 + 1) % 1;
      const w = timeWeight(t) * nearWeight(cameraPos);
      weight = w;
      const now = performance.now();
      if (now - lightsAt > 10000) { lightsAt = now; lights = []; scene.traverse((o) => { if (o.isAmbientLight || o.isHemisphereLight || o.isDirectionalLight) lights.push(o); }); }
      seaGrade(w);
      // 云：受光的团云（citadel-orbit-cloud-*）底色混成淡粉紫；贴图云（*-cloud-impostors）用着色器里的暮色染色
      if (now - cloudsAt > 10000) { cloudsAt = now; cloudMats = []; cloudImp = [];
        scene.traverse((o) => { if (!o.isMesh) return; const n = o.name || '';
          if (/citadel-orbit-cloud|mountain-cloud-bank/.test(n) && o.material?.color) cloudMats.push(o.material);
          else if (/cloud-impostors/.test(n) && o.material?.uniforms?.uTmDuskAmt) cloudImp.push(o.material); }); }
      for (const m of cloudMats) mixColor(m.color, CLOUD_LIT, 0.65 * w);
      for (const m of cloudImp) m.uniforms.uTmDuskAmt.value = 0.75 * w;
      // 逆光亮边（描边外壳在镜头朝着太阳时迎光一侧变暖亮），太阳方向用天空霞光的同一个太阳
      const rim = globalThis.__tmOutlineRim;
      if (rim) { rim.uTmRimAmt.value = 0.85 * w; if (w > 0.001 && skyMat?.uniforms.glowSunDir) rim.uTmRimSun.value.copy(skyMat.uniforms.glowSunDir.value); }
      if (w <= 0.001) {
        for (const l of lights) { const ud = l.userData; if (ud.citadelDuskWrote === undefined) continue; scale(l, 1, null, 0);
          if (ud.citadelDuskColWrote) { if (l.color.equals(ud.citadelDuskColWrote)) l.color.copy(ud.citadelDuskColBase); delete ud.citadelDuskColWrote; } }
        for (const c of tracked.keys()) mixColor(c, c, 0);
        for (const m of cloudImp) m.uniforms.uTmDuskAmt.value = 0;
        return 0;
      }
      if (skyMat) {
        const U = skyMat.uniforms;
        mixColor(U.topColor.value, SKY_TOP, w); mixColor(U.midColor.value, SKY_MID, w); mixColor(U.botColor.value, SKY_BOT, w);
        // 天空里的「漫画式大云带」暮色时被染成大片桃色硬边光带；目标图只有零星软云 → 云带颜色贴近天色，只留淡淡的层次
        if (U.cloudColor) mixColor(U.cloudColor.value, CLOUD, 0.9 * w);
      }
      if (scene.background?.isColor) mixColor(scene.background, FOG, w);
      if (scene.fog) mixColor(scene.fog.color, FOG, w);
      for (const l of lights) {
        if (l.isDirectionalLight) scale(l, 1 - 0.25 * w, SUN_COL, 0.5 * w);
        else scale(l, 1 - 0.30 * w, l.isAmbientLight ? AMB_COL : null, 0.6 * w);
      }
      return w;
    },
  };
}
