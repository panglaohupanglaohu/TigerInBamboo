/**
 * weatherStyle.js — 系统工坊「球系统管线 · 天气」的实景执行端。
 * 天气本体是游戏已有的 world/weather.js（雨丝 + 闪电 + 雷鸣 / 雪 / 停雨彩虹，读 P.weather / P.windSpeed / P.windDir），
 * 这里只负责：把管线给的天气样式写进这些参数、加天气雾、让雨雪跟着工坊镜头下（游玩时仍跟着玩家），以及预览 / 对照 / 定稿 / 恢复。
 *
 * 学习来源：
 *   943230624369868800  雪片受风场影响、绕着岛流动            → 雪 + 风向风速
 *   959530111187013632  （109 帧硬切）紫色雨景                 → 雨
 *   926903893866541057  风向量场，所有系统（含着色器）共用      → 一个风（P.windSpeed / P.windDir）同时驱动云、雨丝斜度、雪漂
 *   926834721392340992 / 931196707236392960  风系统让旗帜飘动、体素空间里的风模拟
 *   906207980802252801  "For background effects, subtlety is key" 淡雾，REACodeRefactoring src/core/fog-envelope.js → 雾默认淡、渐入渐出
 *   943230624369868800  （同上）开雪时主材质朝上的面混白 = 台地 / 屋顶积雪（REACodeRefactoring view.js uSnow）→ 莫西斯湖建筑积雪
 */
import * as THREE from 'three';
import { P } from '../../core/params.js';

export const WEATHER_FINAL_KEY = 'tm.weather.style.final.v1';
export const DEFAULT_WEATHER = Object.freeze({ kind: 0, wind: { speed: 0.8, dir: 45 }, fog: { on: false, density: 0.35, color: '#c9d3d6' }, clouds: { on: false, gloom: 0, shadow: 0 }, snow: { on: false, amount: 0 } });
const clone = (o) => JSON.parse(JSON.stringify(o));
export function mergeWeather(base, patch) {
  const out = clone(base || DEFAULT_WEATHER);
  for (const [k, v] of Object.entries(patch || {})) out[k] = v && typeof v === 'object' ? { ...(out[k] || {}), ...v } : v;
  return out;
}
const KIND = ['晴', '雨（带闪电）', '雪'];

export function installWeatherStyle({ scene, camera, storage = globalThis.localStorage }) {
  const orig = { weather: P.weather | 0, windSpeed: P.windSpeed, windDir: P.windDir, daySpeed: P.daySpeed };
  let applied = null, comparing = false, fogMix = 0, fogTarget = 0;
  const fogColor = new THREE.Color(DEFAULT_WEATHER.fog.color);
  const readFinal = () => { try { return JSON.parse(storage.getItem(WEATHER_FINAL_KEY) || 'null'); } catch { return null; } };
  const embedded = (() => { try { return window.top !== window; } catch { return true; } })();

  // 雨雪默认围着玩家下；在系统工坊里实景看的是工坊镜头，所以改为跟着镜头前方（游玩时不变）
  const center = new THREE.Vector3(), fwd = new THREE.Vector3();
  globalThis.__tmWeatherCenter = () => {
    if (!embedded || !applied) return null;
    camera.getWorldDirection(fwd);
    // 落在镜头看向的地面上：视线与星球表面（半径约 161）求交，再抬高 4 米；求不到就放在镜头前 14 米
    const c = camera.position, b = c.dot(fwd), cc = c.lengthSq() - 161 * 161, disc = b * b - cc;
    if (disc > 0) { const t = -b - Math.sqrt(disc); if (t > 0) { center.copy(c).addScaledVector(fwd, t); return center.addScaledVector(center.clone().normalize(), 4); } }
    return center.copy(camera.position).addScaledVector(fwd, 14);
  };

  // 天气雾：游戏里大部分建筑 / 地形用自定义着色器、不吃 scene.fog（只有云和部分树会变），所以雾自己画：
  // 镜头前方几层半透明幕（18 → 150 米），开深度测试 —— 越远的东西隔着越多层，越雾；近处清楚。不改任何材质。
  // （fog-envelope：浓度渐入渐出不突变）
  const LAYERS = [0.3, 0.5, 0.7, 0.9, 1.15, 1.5, 2.1];   // 按「镜头到所看地面的距离」的比例摆：主体前有几层轻雾，身后更浓
  const veil = new THREE.Group(); veil.name = 'tm-weather-fog-veil'; veil.visible = false; veil.matrixAutoUpdate = false;
  const veilMat = new THREE.MeshBasicMaterial({ color: fogColor, transparent: true, opacity: 0, depthWrite: false, depthTest: true, fog: false, toneMapped: false });
  const quad = new THREE.PlaneGeometry(1, 1);
  for (const d of LAYERS) { const m = new THREE.Mesh(quad, veilMat); m.userData.off = d; m.renderOrder = 9990; m.frustumCulled = false; m.raycast = () => {}; veil.add(m); }
  scene.add(veil);
  const prevBefore = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) {
    prevBefore?.apply(this, a);
    fogMix += (fogTarget - fogMix) * 0.08;
    const on = fogMix > 0.004; veil.visible = on; if (!on) return;
    const cam = a[2] || camera; cam.updateMatrixWorld?.();
    veil.matrix.copy(cam.matrixWorld); veil.matrixWorld.copy(cam.matrixWorld);
    const fov = THREE.MathUtils.degToRad(cam.fov || 50), aspect = cam.aspect || 1.6;
    cam.getWorldDirection(fwd); const cp = cam.getWorldPosition(center.clone()), b = cp.dot(fwd), disc = b * b - (cp.lengthSq() - 161 * 161);
    const focus = disc > 0 && -b - Math.sqrt(disc) > 0 ? -b - Math.sqrt(disc) : 40;
    for (const m of veil.children) { m.userData.d = Math.max(4, focus * m.userData.off); m.position.z = -m.userData.d; const h = 2 * m.userData.d * Math.tan(fov / 2) * 1.15; m.scale.set(h * aspect * 1.15, h, 1); m.updateMatrix(); m.matrixWorld.multiplyMatrices(veil.matrixWorld, m.matrix); }
    // 总雾量：浓度 1 时最远处约 85%；平分到每一层
    const total = Math.min(0.92, fogMix * 0.85);
    veilMat.opacity = 1 - Math.pow(1 - total, 1 / LAYERS.length);
    veilMat.color.copy(fogColor);
  };
  veil.updateMatrixWorld = () => {};

  // ── 云：游戏已有的 impostor 云（render/clouds/cloudImpostorSystem.js，1852334860137849222「云和树共用 impostor」）──
  //   阴云（1243228419162341379 moody clouds）：把云材质的 uWeather 抬到 gloom（灰蓝、压暗），云系统每帧设完之后再改。
  //   云影（REACodeRefactoring src/light/cloud-shadow.js 的做法：沿太阳方向把云投到表面）：这里投到海面上一层薄壳，
  //   用离镜头最近的 64 朵云，按云自己的路径公式算当前位置；软圆盘近似，不是云图集轮廓。陆地高于海面的地方被地面挡住。
  const MAXC = 64; let clouds = { on: false, gloom: 0, shadow: 0 }, shadowMix = 0, cloudMesh = null;
  const puffs = Array.from({ length: MAXC }, () => new THREE.Vector4());
  const shellU = { uPuffs: { value: puffs }, uCount: { value: 0 }, uSun: { value: new THREE.Vector3(0.3, 0.9, 0.2) }, uStrength: { value: 0 } };
  const shell = new THREE.Mesh(new THREE.SphereGeometry(161.0, 256, 128), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, uniforms: shellU,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform vec4 uPuffs[${MAXC}]; uniform int uCount; uniform vec3 uSun; uniform float uStrength; varying vec3 vW;
      void main(){ if(uStrength<=0.0) discard; float cover=0.0;
        for(int i=0;i<${MAXC};i++){ if(i>=uCount) break; vec4 c=uPuffs[i]; vec3 d=c.xyz-vW; float t=dot(d,uSun); if(t<=0.0) continue;
          float r=length(d-uSun*t); cover=max(cover, 1.0-smoothstep(c.w*0.35, c.w*0.75, r)); }
        if(cover<0.01) discard; gl_FragColor=vec4(0.05,0.09,0.12, cover*uStrength); }`,
  }));
  shell.name = 'tm-weather-cloud-shadows'; shell.renderOrder = 2; shell.frustumCulled = false; shell.raycast = () => {}; shell.visible = false; scene.add(shell);
  const pathAt = (g, i, ph) => { const seg = Math.min(4, Math.floor(ph * 5)), f = ph * 5 - seg, a = g.getAttribute('aPath' + seg), b = g.getAttribute('aPath' + (seg + 1));
    return [a.getX(i) + (b.getX(i) - a.getX(i)) * f, a.getY(i) + (b.getY(i) - a.getY(i)) * f, a.getZ(i) + (b.getZ(i) - a.getZ(i)) * f]; };
  const sunDir = () => { let best = null; scene.traverse((o) => { if (o.isDirectionalLight && o.visible && (!best || o.intensity > best.intensity)) best = o; }); return best ? best.position.clone().sub(best.target?.position || new THREE.Vector3()).normalize() : null; };
  let sunCache = null, sunAt = 0;
  function updateClouds(cam) {
    cloudMesh ||= scene.getObjectByName('planet-v8-cloud-impostors');
    const m = cloudMesh?.material; if (!m?.uniforms) return;
    if (clouds.on && clouds.gloom > 0 && m.uniforms.uWeather) m.uniforms.uWeather.value = Math.max(m.uniforms.uWeather.value, clouds.gloom * 2);
    shadowMix += ((clouds.on ? clouds.shadow : 0) - shadowMix) * 0.08;
    shell.visible = shadowMix > 0.01; shellU.uStrength.value = shadowMix * 0.55; if (!shell.visible) return;
    if (!sunCache || performance.now() - sunAt > 1000) { sunCache = sunDir() || sunCache; sunAt = performance.now(); }
    if (sunCache) shellU.uSun.value.copy(sunCache);
    const g = cloudMesh.geometry, n = g.instanceCount ?? 0, time = m.uniforms.uTime?.value || 0;
    const sp = g.getAttribute('aSpeed'), off = g.getAttribute('aTimeOffset'), sc = g.getAttribute('aScale'), hero = g.getAttribute('aHero');
    if (!sp || !g.getAttribute('aPath0')) return;
    cloudMesh.updateWorldMatrix(true, false); const mw = cloudMesh.matrixWorld, v = new THREE.Vector3(), cp = cam.getWorldPosition(new THREE.Vector3());
    const cand = [];
    for (let i = 0; i < n; i++) { if (hero && hero.getX(i) >= 2) continue;   // 树冠（共用 impostor）不投云影
      const ph = ((time * sp.getX(i) + off.getX(i)) % 1 + 1) % 1, p = pathAt(g, i, ph); v.set(p[0], p[1], p[2]).applyMatrix4(mw);
      cand.push([v.distanceToSquared(cp), v.x, v.y, v.z, Math.max(4, sc.getX(i))]); }
    cand.sort((a, b) => a[0] - b[0]); const k = Math.min(MAXC, cand.length);
    for (let i = 0; i < k; i++) puffs[i].set(cand[i][1], cand[i][2], cand[i][3], cand[i][4]);
    shellU.uCount.value = k;
  }
  const prevBefore2 = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) { prevBefore2?.apply(this, a); try { updateClouds(a[2] || camera); } catch {} };


  // ── 积雪（雪后的建筑）：莫西斯湖上的城镇有自己的材质，里面本来就带 uSnow（view.js 的屋顶积雪），这里把它从 0/1 开关
  //   改成按量渐变（雪越多，越斜的屋面也盖上，边缘带噪声）；湖面倒影跟着变白。下雪时城镇小场景里的雪片也一起下。
  let snow = { on: false, amount: 0 }, snowMix = globalThis.__tmMorrisStage?.snowBase ?? 0, snowOwned = false;
  const prevBefore3 = scene.onBeforeRender;
  scene.onBeforeRender = function (...a) { prevBefore3?.apply(this, a);
    const stage = globalThis.__tmMorrisStage; if (!stage?.snowUniform) return;
    const base = stage.snowBase ?? 0;   // 莫西斯湖常开积雪（stage.snowBase）是底；天气只能在它上面加，不会把它清掉
    const target = snow.on ? Math.max(base, snow.amount) : base;
    const falling = snow.on && (P.weather | 0) === 2;
    if (!snowOwned && target <= base && !falling) return;   // 没碰过积雪就不接管（学习面板的「雪」开关照旧可用）
    if (!snowOwned) snowMix = stage.snowUniform.value;   // 从当前积雪开始渐变，不先清零
    snowMix += (target - snowMix) * 0.05; if (Math.abs(target - snowMix) < 0.002) snowMix = target;
    stage.snowUniform.value = snowMix; snowOwned = snowMix > base + 0.002 || target > base || falling;
    if (stage.atmosphere && stage.__tmSnowFall !== falling) { stage.atmosphere.showSnow = falling || !!stage.winter; stage.__tmSnowFall = falling; }
    if (!snowOwned && stage.atmosphere) { stage.atmosphere.showSnow = !!stage.debugState?.snow || !!stage.winter; stage.__tmSnowFall = undefined; stage.snowUniform.value = stage.debugState?.snow && !stage.winter ? Math.max(1, base) : base; }
  };

  function set(st) {
    P.weather = st.kind | 0; P.windSpeed = st.wind.speed; P.windDir = st.wind.dir;
    fogColor.set(st.fog.color || DEFAULT_WEATHER.fog.color); fogTarget = st.fog.on ? st.fog.density : 0;
    clouds = { ...DEFAULT_WEATHER.clouds, ...(st.clouds || {}) };
    snow = { ...DEFAULT_WEATHER.snow, ...(st.snow || {}) };
    // 时刻与太阳（光照与时间 · 学习 1313840428685447170「阳光 + 控制它的小部件」）：定时刻、定昼夜速度（0 = 停在这个时刻）
    globalThis.__tmLightStyle?.apply(st.light || {});   // 光照与时间的其余旋钮（world/lightStyle/lightStyle.js）
    if (st.time?.on) { P.timeOfDay = Math.max(0, Math.min(1, st.time.at)); P.daySpeed = Math.max(0, st.time.speed); } else P.daySpeed = orig.daySpeed;
  }
  function restoreOrig() { globalThis.__tmLightStyle?.apply({}); P.weather = orig.weather; P.windSpeed = orig.windSpeed; P.windDir = orig.windDir; P.daySpeed = orig.daySpeed; fogTarget = 0; clouds = { ...DEFAULT_WEATHER.clouds }; snow = { ...DEFAULT_WEATHER.snow }; }
  const describe = (st) => ({ kind: KIND[st.kind | 0], wind: `${st.wind.speed} · ${Math.round(st.wind.dir)}°`, fog: st.fog.on ? `淡雾 ${st.fog.density}` : '无', clouds: st.clouds?.on ? `阴云 ${st.clouds.gloom} · 云影 ${st.clouds.shadow}` : '原样', snow: st.snow?.on ? `积雪 ${st.snow.amount}` : '无', time: st.time?.on ? `时刻 ${st.time.at}${st.time.speed ? ` · 昼夜速度 ${st.time.speed}` : ' · 停住'}` : '照常流转' });
  const api = {
    defaults: () => clone(DEFAULT_WEATHER),
    preview(style) {
      const st = mergeWeather(DEFAULT_WEATHER, style); applied = st; comparing = false; set(st);
      return { style: st, applied: describe(st), params: { weather: P.weather, windSpeed: P.windSpeed, windDir: P.windDir }, followCamera: embedded };
    },
    compare(on) { comparing = !!on; if (on) restoreOrig(); else if (applied) set(applied); return { comparing }; },
    revert() { const f = readFinal(); applied = f ? mergeWeather(DEFAULT_WEATHER, f) : null; if (applied) set(applied); else restoreOrig(); return { restored: f ? 'final' : 'original' }; },
    commit(style) { const st = mergeWeather(DEFAULT_WEATHER, style || applied); storage.setItem(WEATHER_FINAL_KEY, JSON.stringify(st)); return { saved: true, style: st }; },
    reset() { storage.removeItem(WEATHER_FINAL_KEY); applied = null; restoreOrig(); return { reset: true }; },
    state() { return { light: globalThis.__tmLightStyle?.state?.() ?? null, snowCover: +snowMix.toFixed(3), snowTarget: snow.on ? snow.amount : 0, morrisStage: !!globalThis.__tmMorrisStage?.snowUniform, cloudShadows: shellU.uCount.value, cloudMesh: !!cloudMesh, applied: applied && describe(applied), final: readFinal(), params: { weather: P.weather, windSpeed: P.windSpeed, windDir: P.windDir, timeOfDay: +(+P.timeOfDay).toFixed(3), daySpeed: P.daySpeed }, fog: +fogMix.toFixed(3), comparing }; },
  };
  globalThis.__tmWeatherStyle = api;
  const final = readFinal(); if (final) { applied = mergeWeather(DEFAULT_WEATHER, final); set(applied); }
  return api;
}
