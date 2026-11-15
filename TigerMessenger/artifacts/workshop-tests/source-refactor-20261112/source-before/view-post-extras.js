/**
 * view-post-extras.js — 第 55 批（G2：渲染循环 / 网格法线 / 大气植被组）。
 *
 * View 只在构造末尾调一次 installPostExtras(this)（view.js 里一行 import + 一处调用），其余逻辑都在这里。
 * 所有开关**默认关**；打开方式：URL `?fx=outline,smear,...`（逗号分隔）或 `view.postExtras.set(name, on)`。
 *
 *   outline        engine/outline.js → world/outline-pass.js 屏幕空间描边（法线 + 线性深度）接进渲染循环
 *   smear          src/smear.js 解析切向拖影：v = ω × (p − c)·dt，单帧沿切向 6 次三角权重采样（不是历史叠加）；
 *                  与 View 原有的 motionblur 历史叠加可并存（两者各自开关）
 *   clouddeck      src/clouddeck.js 三层深度云体（高耸积云带）+ 同一 deck 的云影投到地形
 *   penumbra3d     src/penumbra.js 体素半影接到地形 / 悬挑接收面（水面层一起开）
 *   softnormals    src/flowdemo.js + src/voxelflow.js：World 体素占用法线写回 View 主网格（保硬边 minDot）
 *   windflag       src/wind.js：旗子着色器读 Atmosphere 风场纹理（方向 + 强度），不再只看全局 uWind
 *   wallcards      src/shrubcard.js：墙根灌木换折卡
 *   levelflora     src/levelflora.js：每级台地两物种 + 六种物种几何
 *   dualflora      src/dual.js：地被落到顶点对偶格 + 崖壁竖面挂丛
 *   impostorpitch  engine/impostor.js：多俯仰行 impostor + 球面卡片 + 原云材质
 * 调试：`?spin=1.5` 让相机每秒绕 1.5 rad（拖影验收用）。
 *
 * 接法：包一层 renderer.render —— 只有 (view.scene, view.camera) 且目标为屏幕的那一次调用会被接管，
 * 其他渲染（阴影图、impostor 烘焙、反射等）原样通过。
 */
import * as THREE from 'three';
import { ScreenOutlinePass } from './outline-pass.js';
import { CloudDeckLayer } from './cloud-deck-layer.js';
import { PenumbraTerrain } from './penumbra-terrain.js';
import { FloraSpecies } from '../life/flora-species.js';
import { ImpostorBaker, ImpostorField, blobCloudGeometry } from '../life/impostor.js';
import { windFieldGLSL, meshCollider } from '../core/wind-flow.js';

export const POST_EXTRAS = Object.freeze(['outline', 'smear', 'clouddeck', 'penumbra3d', 'softnormals', 'windflag', 'wallcards', 'levelflora', 'dualflora', 'impostorpitch']);

/** 屏幕中心可变的切向拖影（REACode smear.js 的 GLSL 版；core/camera-motion.js ORBIT_SMEAR_GLSL 固定在画面中心）。 */
export const ORBIT_SMEAR_CENTER_GLSL = /* glsl */ `
vec4 orbitSmearAt(sampler2D tex, vec2 uv, vec2 res, vec2 c, float omegaDt, float maxPx) {
  vec2 p = uv * res; vec2 v = vec2(-(p.y - c.y), p.x - c.x) * omegaDt; float l = length(v); if (l > maxPx) v *= maxPx / l;
  vec4 acc = vec4(0.); float ws = 0.;
  for (int k = 0; k < 6; k++) { float t = float(k) / 5., w = 1. - abs(t - .5) * 1.5; acc += texture2D(tex, (p + v * (t - .5)) / res) * w; ws += w; }
  return acc / ws;
}`;

/** 轨道相机的屏幕旋转量（一个快门内的弧度）：绕世界竖轴的角速度 ω = dyaw/dt，投到视线方向的分量 ω·sin(俯角)，
 * 乘快门 1/60 s（REACode smear.js smearLengthPx 的默认 dt）。用固定快门而不是实际帧间隔：帧率低时拖影长度不跟着变长。 */
export function screenOmegaDt(yaw, lastYaw, pitch, dt, shutter = 1 / 60) {
  if (![yaw, lastYaw, pitch, dt].every(Number.isFinite) || dt <= 0) return 0;
  const d = Math.atan2(Math.sin(yaw - lastYaw), Math.cos(yaw - lastYaw));
  return d / dt * Math.sin(pitch) * shutter;
}

export function parseFx(search) {
  const p = new URLSearchParams(search || '');
  const on = new Set((p.get('fx') || '').split(',').map((s) => s.trim()).filter((s) => POST_EXTRAS.includes(s)));
  const spin = Number(p.get('spin'));
  return { on, spin: Number.isFinite(spin) ? spin : 0 };
}

export function installPostExtras(view, { search = globalThis.location?.search ?? '' } = {}) {
  if (view.postExtras) return view.postExtras;
  const r = view.renderer, raw = r.render.bind(r);
  const state = Object.fromEntries(POST_EXTRAS.map((k) => [k, false]));
  const stats = {};
  let busy = false, last = null, lastYaw = view.yaw, spin = 0;
  let outline = null, smearRT = null, smearScene = null, smearCam = null, smearMat = null;
  let deck = null, pen = null, flora = null, pitch = null;
  const size = new THREE.Vector2();

  /* ---- 风场纹理 → 旗子（src/wind.js） ---- */
  const windU = { uWindField: { value: null }, uWindGrid: { value: new THREE.Vector4(0, 0, 1, view.levelHeight) }, uWindDims: { value: new THREE.Vector3(2, 2, 2) }, uWindTexOn: { value: 0 } };
  const flagMat = view.decor?.flagMat;
  if (flagMat) {
    const prev = flagMat.onBeforeCompile, prevKey = flagMat.customProgramCacheKey;
    flagMat.onBeforeCompile = (sh, rr) => {
      prev?.call(flagMat, sh, rr);
      Object.assign(sh.uniforms, windU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + windFieldGLSL + '\nuniform float uWindTexOn;')
        .replace('#include <project_vertex>', `
          if (uWindTexOn > .5) {
            // 926903893866541057 "wind vectors ... used by all kinds of systems, including shaders"：
            // 在旗杆顶与旗尾各采一次风场纹理，旗面转到当地风向、按风速决定飘直/下垂与抖动
            vec3 pole = (instanceMatrix * vec4(0., .19, 0., 1.)).xyz;
            vec3 w0 = sampleWind(pole);
            mat3 R = mat3(instanceMatrix);
            vec3 wl = transpose(R) * w0;
            float sp = length(wl.xz);
            float ang = atan(-wl.z, wl.x);
            vec3 tipW = transpose(R) * sampleWind(pole + w0 * .13 / max(.05, length(w0)));
            float bendA = atan(-tipW.z, tipW.x) - ang;
            float u2 = clamp(transformed.x / .13, 0., 1.);
            float a2 = ang + bendA * u2 * .6;
            float c2 = cos(a2), s2 = sin(a2);
            float gust = clamp(sp / 1.2, .15, 1.4);
            vec3 t2 = transformed;
            t2.y -= (1. - min(1., gust)) * .045 * u2 * u2;               // 风弱：下垂
            t2.z += sin(u2 * 9. - uTime * 9. * gust) * .01 * u2 * gust;   // 风强：抖得快
            transformed = vec3(t2.x * c2 + t2.z * s2, t2.y, -t2.x * s2 + t2.z * c2);
          }
          #include <project_vertex>`);
    };
    flagMat.customProgramCacheKey = () => (prevKey ? prevKey.call(flagMat) : '') + '|windtex';
    flagMat.needsUpdate = true;
  }
  const syncWind = () => {
    if (!state.windflag) { windU.uWindTexOn.value = 0; return; }
    try {
      const t = view.atmosphere.windTexture();
      windU.uWindField.value = t.texture; windU.uWindGrid.value.copy(t.uniforms.uWindGrid.value); windU.uWindDims.value.copy(t.uniforms.uWindDims.value);
      windU.uWindTexOn.value = 1;
    } catch { windU.uWindTexOn.value = 0; }   // Atmosphere 还没建好：下一帧再试
  };

  /* ---- 软法线写回（flowdemo / voxelflow） ---- */
  let softGeo = null, collider = null;
  const syncSoft = () => {
    const g = view.mesh.geometry;
    if (!state.softnormals) {
      if (softGeo && softGeo.userData.hardNormals) { softGeo.getAttribute('normal').array.set(softGeo.userData.hardNormals); softGeo.getAttribute('normal').needsUpdate = true; delete softGeo.userData.hardNormals; }
      softGeo = null; return;
    }
    if (g === softGeo || !view.atmosphere.probes) return;
    if (softGeo && softGeo !== g && softGeo.userData.hardNormals) delete softGeo.userData.hardNormals;
    const n = g.getAttribute('normal');
    if (!n) return;
    g.userData.hardNormals = Float32Array.from(n.array);
    stats.softnormals = view.atmosphere.bakeSoftNormals(g, { blend: .55, offset: .12, minDot: .5 });
    softGeo = g;
    // src/voxelflow.js 的"变形网格碰撞"：对 View 实际显示的三角形（形变后）做竖直射线，喂给 groundAt()
    collider = g.index ? null : meshCollider(g.getAttribute('position').array, { bucket: 1 });
  };
  // Atmosphere 重建（World 改了之后）→ 探针变了，强制重烘
  const atm = view.atmosphere, atmRebuild = atm.rebuild.bind(atm);
  atm.rebuild = (...a) => { const out = atmRebuild(...a); if (softGeo) { const g = softGeo; if (g.userData.hardNormals) { g.getAttribute('normal').array.set(g.userData.hardNormals); delete g.userData.hardNormals; } softGeo = null; } return out; };

  /* ---- 植被：物种几何 / 对偶落点 / 折卡 / 多俯仰 impostor ---- */
  const veg = view.vegetation, vegRefresh = veg.refresh.bind(veg);
  let vegArgs = null;
  veg.refresh = (...a) => {
    vegArgs = a;
    const out = vegRefresh(...a);
    if (flora && (state.levelflora || state.dualflora)) stats.flora = flora.rebuild(a[0], a[1]);
    if (pitch) syncPitch();
    return out;
  };
  const revegetate = () => { if (vegArgs) veg.refresh(...vegArgs); else veg.refresh(view.town, view.worldMesh.shape, view.worldMesh.garden); view.requestShadowUpdate?.(); };

  function buildPitch() {
    const baker = new ImpostorBaker(r, 2048);
    const fields = veg.crowns.map((cr) => {
      const f = new ImpostorField(baker.rt.texture, baker.bake(cr.m.geometry, 128, { pitches: [.12, .42, .85] }), veg.max.crowns, { uLight: veg.uLight, sphere: true });
      f.mesh.visible = false; veg.group.add(f.mesh); return f;
    });
    const cloudBaked = baker.bake(blobCloudGeometry(3), 256, { vertexColors: true });
    return { baker, fields, cloudBaked, prevCloud: null };
  }
  function syncPitch() {
    const src = veg.impostorFields || [];
    pitch.fields.forEach((f, i) => {
      const s = src[i]; if (!s) return;
      f.mesh.instanceMatrix.array.set(s.mesh.instanceMatrix.array); f.color.array.set(s.color.array); f.yaw.array.set(s.yaw.array);
      f.commit(s.mesh.count);
    });
  }
  function applyPitch(on) {
    if (on && !pitch) { pitch = buildPitch(); syncPitch(); }
    if (!pitch) return;
    const trees = veg.layers?.trees ?? true;
    if (on) { pitch.wasImpostor = veg.impostorOn; veg.impostor = true; }
    else if (pitch.wasImpostor !== undefined) veg.impostor = pitch.wasImpostor;
    for (const f of veg.impostorFields || []) f.mesh.visible = !on && veg.impostorOn && trees;
    for (const f of pitch.fields) f.mesh.visible = on && trees;
    // 云：换成原版云材质烘出来的图（树和云仍共用一张图集——同一个 baker）
    const cf = veg.cloudField;
    if (cf) {
      const u = cf.material.uniforms;
      if (on) { pitch.prevCloud ??= { tex: u.uTex.value, frames: u.uFrames.value.map((v) => v.clone()), size: u.uSize.value, center: u.uCenter.value.clone() };
        u.uTex.value = pitch.baker.rt.texture; pitch.cloudBaked.frames.forEach((x, k) => u.uFrames.value[k >> 2].setComponent(k & 3, x)); u.uSize.value = pitch.cloudBaked.size; u.uCenter.value.copy(pitch.cloudBaked.center); }
      else if (pitch.prevCloud) { u.uTex.value = pitch.prevCloud.tex; pitch.prevCloud.frames.forEach((v, k) => u.uFrames.value[k].copy(v)); u.uSize.value = pitch.prevCloud.size; u.uCenter.value.copy(pitch.prevCloud.center); pitch.prevCloud = null; }
    }
  }

  /* ---- 拖影 ---- */
  function ensureSmear() {
    r.getDrawingBufferSize(size);
    if (smearRT && smearRT.width === size.x && smearRT.height === size.y) return;
    smearRT?.dispose();
    smearRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    if (!smearMat) {
      smearMat = new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false,
        uniforms: { tColor: { value: null }, uRes: { value: new THREE.Vector2() }, uCenter: { value: new THREE.Vector2() }, uOmegaDt: { value: 0 }, uMaxPx: { value: 24 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
        fragmentShader: 'uniform sampler2D tColor; uniform vec2 uRes; uniform vec2 uCenter; uniform float uOmegaDt; uniform float uMaxPx; varying vec2 vUv;\n' + ORBIT_SMEAR_CENTER_GLSL +
          '\nvoid main(){ gl_FragColor = orbitSmearAt(tColor, vUv, uRes, uCenter, uOmegaDt, uMaxPx);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      });
      smearScene = new THREE.Scene(); smearScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), smearMat)); smearCam = new THREE.Camera();
    }
    smearMat.uniforms.tColor.value = smearRT.texture;
    smearMat.uniforms.uRes.value.set(size.x, size.y);
  }

  function ensureOutline() {
    if (!outline) outline = new ScreenOutlinePass(r, { thickness: 1 });
    r.getDrawingBufferSize(size);
    const u = outline.uniforms.uResolution.value;
    if (u.x !== size.x || u.y !== size.y) { const dpr = r.getPixelRatio() || 1; outline.setSize(size.x / dpr, size.y / dpr); }
  }

  function preFrame() {
    const now = performance.now(), dt = last === null ? 1 / 60 : Math.min(.1, (now - last) / 1000); last = now;
    if (spin) { view.yaw += spin * dt; view.updateCamera(); }
    if (state.penumbra3d) pen.refresh();
    if (state.clouddeck) deck.update();
    syncWind(); syncSoft();
    const omegaDt = screenOmegaDt(view.yaw, lastYaw, view.pitch, dt); lastYaw = view.yaw;
    return { dt, omegaDt };
  }

  function draw(scene, camera, { omegaDt }) {
    if (!state.outline && !state.smear) return raw(scene, camera);
    if (state.smear) {
      ensureSmear();
      const prev = r.getRenderTarget();
      r.setRenderTarget(smearRT); r.clear();
      if (state.outline) { ensureOutline(); outline.render(scene, camera); } else raw(scene, camera);
      r.setRenderTarget(prev);
      // 中心 = 相机目标点投到屏幕（轨道旋转绕它转）
      const c = view.target.clone().project(camera), u = smearMat.uniforms;
      u.uCenter.value.set((c.x * .5 + .5) * size.x, (c.y * .5 + .5) * size.y);
      u.uOmegaDt.value = omegaDt; u.uMaxPx.value = 24 * (r.getPixelRatio() || 1);
      raw(smearScene, smearCam);
      stats.smear = { omegaDt: +omegaDt.toFixed(5), outerPx: +(Math.abs(omegaDt) * Math.min(size.x, size.y) / 2).toFixed(2), center: [Math.round(u.uCenter.value.x), Math.round(u.uCenter.value.y)] };
      return;
    }
    ensureOutline(); outline.render(scene, camera);
  }

  r.render = (scene, camera) => {
    if (busy || scene !== view.scene || camera !== view.camera || r.getRenderTarget() !== null) return raw(scene, camera);
    busy = true;
    try { const f = preFrame(); draw(scene, camera, f); }
    finally { busy = false; }
  };

  function set(name, on) {
    if (!POST_EXTRAS.includes(name)) throw new RangeError('unknown post extra ' + name);
    on = !!on;
    if (state[name] === on) return on;
    state[name] = on;
    switch (name) {
      case 'outline': if (on) ensureOutline(); break;
      case 'smear': if (on) ensureSmear(); break;
      case 'clouddeck': deck ??= new CloudDeckLayer(view); deck.setEnabled(on); if (!on) view.cloudShadow.update(); break;
      case 'penumbra3d': pen ??= new PenumbraTerrain(view); pen.setEnabled(on); stats.penumbra3d = pen.stats; break;
      case 'softnormals': syncSoft(); break;
      case 'windflag': flagMat && (flagMat.needsUpdate = true); syncWind(); break;
      case 'wallcards': veg.wallShrubCards = on; revegetate(); break;
      case 'levelflora': case 'dualflora':
        flora ??= new FloraSpecies(view);
        flora.setModes({ levelFlora: state.levelflora, dual: state.dualflora });
        revegetate(); break;
      case 'impostorpitch': applyPitch(on); break;
    }
    return on;
  }

  const api = {
    set, get state() { return { ...state }; },
    get spin() { return spin; }, set spin(v) { spin = Number.isFinite(v) ? v : 0; },
    stats() {
      return { ...stats, clouddeck: deck?.stats, penumbra3d: pen?.stats, flora: flora?.stats,
        impostorpitch: pitch ? { fields: pitch.fields.length, pitches: [.12, .42, .85], instances: pitch.fields.map((f) => f.mesh.count) } : undefined,
        windflag: { on: windU.uWindTexOn.value, dims: windU.uWindDims.value.toArray(), flags: view.decor?.flags?.count } };
    },
    /** 软法线开着时：View 主网格（形变后）上 (x,z) 处、maxY 以下最高的表面；关时 null。 */
    groundAt(x, z, maxY = Infinity) { return state.softnormals && collider ? collider.heightAt(x, z, maxY) : null; },
    get outlinePass() { return outline; }, get cloudDeck() { return deck; }, get penumbra() { return pen; }, get flora() { return flora; },
  };
  view.postExtras = api;
  if (globalThis.window) globalThis.window.__postExtras = api;
  const fx = parseFx(search);
  spin = fx.spin;
  // 植被/大气要等第一次 rebuild 之后才有数据；开关先记下，首帧后应用
  if (fx.on.size) {
    const pending = [...fx.on];
    const apply = () => { for (const k of pending) { try { set(k, true); } catch (e) { console.warn('post extra', k, e.message); } } };
    if (globalThis.setTimeout) setTimeout(apply, 900); else apply();
  }
  return api;
}
