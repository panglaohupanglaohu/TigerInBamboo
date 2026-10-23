// =====================================================================
//  湖沼虎 V3 外皮：Blender 整体蒙皮模型（骨骼 + 条纹投影着色 + 墨线外壳）
//  - 只换外观：旧 V1 关节（身体/头/四足/尾）继续由步态、地面求解、行为驱动，
//    新骨骼每帧跟随旧关节（脚掌用 IK 贴到旧脚掌的运动上）。
//  - 尾巴情绪（放松摆 / 烦躁抽 / 预备颤动）、停下时张望、耳朵抖动。
//  - ?tiger=classic 保留旧外观。
// =====================================================================
import * as THREE from 'three';
import { TIGER_CORAL_PALETTE as PAL } from './tigerCoralGait.js';

const BASE = new URL('../../../assets/models/tiger-v3/', import.meta.url);
export const TIGER_V3_URL = new URL('tiger-v3.glb', BASE).href;
export const TIGER_V3_K = 1.36; // build scale (ref units -> tiger local)
const MAPS = { side: { z0: -4.4, z1: 3.4, yh: 2.8 }, face: { fw: 0.62, y0: 1.62, y1: 2.78 } };
const OUTLINE_W = 0.028;
// Old V1 rig rest frames (tiger-local), measured from the shipped rig.
const OLD = {
  body: new THREE.Matrix4().makeTranslation(0, 2.4, 0),
  head: new THREE.Matrix4().compose(new THREE.Vector3(0, 3.3, 2.45), new THREE.Quaternion(), new THREE.Vector3(1.1, 1.02, 1.04)),
  legs: [[-0.87, 2.1, 1.53], [0.87, 2.1, 1.53], [-0.85, 2.1, -1.78], [0.85, 2.1, -1.78]],
  sole: new THREE.Vector3(0, -2.075, 0.18),
};
const LEG_IDS = ['n52', 'n59', 'n66', 'n73'], PAW_IDS = ['n55', 'n62', 'n69', 'n76'];
// old leg index -> new side suffix
const LEG_SIDE = ['R', 'L', 'R', 'L'];

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();

function coatMaterial(sideMap, faceMap, isOutline = false) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, side: isOutline ? THREE.BackSide : THREE.FrontSide });
  if (isOutline) m.color.set(PAL.stripe);
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      uSide: { value: sideMap }, uFace: { value: faceMap }, uK: { value: TIGER_V3_K }, uOutline: { value: OUTLINE_W },
      uCoat: { value: new THREE.Color(PAL.coat) }, uInk: { value: new THREE.Color(PAL.stripe) }, uIvory: { value: new THREE.Color(PAL.ivory) }, uAmber: { value: new THREE.Color('#E0B04A') },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutline;varying vec3 vRestP;varying vec3 vRestN;varying vec3 vViewN;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        vRestP=position;vRestN=normal;
        #ifdef USE_SKINNING
        vViewN=normalize(normalMatrix*objectNormal);
        #else
        vViewN=normalize(normalMatrix*normal);
        #endif
        ${isOutline ? `
        #ifdef USE_SKINNING
        transformed+=normalize(objectNormal)*uOutline;
        #else
        transformed+=normalize(normal)*uOutline;
        #endif` : ''}`);
    if (isOutline) return;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uSide;uniform sampler2D uFace;uniform float uK;uniform vec3 uCoat;uniform vec3 uInk;uniform vec3 uIvory;uniform vec3 uAmber;
        varying vec3 vRestP;varying vec3 vRestN;varying vec3 vViewN;`)
      .replace('#include <map_fragment>', `
        vec3 p=vRestP/uK;vec3 n=normalize(vRestN);
        float sv=clamp(p.y/${MAPS.side.yh.toFixed(3)},0.,1.)*.5+(p.x>0.?.5:0.);
        vec2 suv=vec2((p.z-(${MAPS.side.z0.toFixed(3)}))/${(MAPS.side.z1 - MAPS.side.z0).toFixed(3)},sv);
        vec4 s=texture2D(uSide,suv);
        vec2 fuv=vec2((p.x+${MAPS.face.fw.toFixed(3)})/${(2 * MAPS.face.fw).toFixed(3)},(p.y-${MAPS.face.y0.toFixed(3)})/${(MAPS.face.y1 - MAPS.face.y0).toFixed(3)});
        vec4 f=texture2D(uFace,clamp(fuv,0.,1.));
        float w=smoothstep(2.18,2.42,p.z)*smoothstep(.05,.45,n.z)*step(abs(p.x),${MAPS.face.fw.toFixed(3)});
        float ink=mix(s.r,f.r,w),ivo=mix(s.g,f.g,w);
        // inside of the legs is ivory but keeps its stripes; belly and chin undersides are ivory
        float leg=(1.-smoothstep(1.15,1.35,p.y))*step(.16,abs(p.x))*max(step(.75,p.z),step(p.z,-.75));
        ivo=max(ivo,leg*smoothstep(-.05,-.45,n.x*sign(p.x)));
        ivo=max(ivo,smoothstep(-.3,-.7,n.y)*step(p.z,2.9)*step(-2.2,p.z));
        // white chest between the forelegs; back of the forelegs white up to the elbow
        ivo=max(ivo,smoothstep(.3,.6,n.z)*(1.-smoothstep(.22,.34,abs(p.x)))*step(1.05,p.y)*step(p.y,2.05)*step(1.3,p.z)*step(p.z,2.3));
        ivo=max(ivo,smoothstep(-.25,-.6,n.z)*step(.9,p.z)*step(p.z,2.0)*(1.-smoothstep(1.0,1.2,p.y)));
        vec3 col=mix(uCoat,uIvory,smoothstep(.45,.55,ivo));
        col=mix(col,uAmber,smoothstep(.45,.55,f.b*w));
        col=mix(col,uInk,smoothstep(.42,.58,ink));
        float l=dot(normalize(vViewN),normalize(vec3(-.35,.75,.55)));
        col*=.88+.12*smoothstep(-.2,.2,l);
        diffuseColor.rgb=col;`);
  };
  m.customProgramCacheKey = () => 'tiger-v3-coat-' + (isOutline ? 'line' : 'fill');
  return m;
}

function partMaterial(kind) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  const col = { eye: PAL.eye, pupil: PAL.stripe, nose: PAL.nose }[kind];
  if (col) { m.color.set(col); return m; }
  // ear: front cup ivory with an orange rim and ink edge; back ink with a white spot
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uCoat: { value: new THREE.Color(PAL.coat) }, uInk: { value: new THREE.Color(PAL.stripe) }, uIvory: { value: new THREE.Color(PAL.ivory) }, uK: { value: TIGER_V3_K } });
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRestP;varying vec3 vRestN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRestP=position;vRestN=normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCoat;uniform vec3 uInk;uniform vec3 uIvory;uniform float uK;varying vec3 vRestP;varying vec3 vRestN;')
      .replace('#include <map_fragment>', `
        vec3 p=vRestP/uK;vec2 c=vec2(sign(p.x)*.27,2.51);float d=length((p.xy-c)/vec2(.13,.13));
        vec3 col;
        if(vRestN.z>0.){col=d<.62?uIvory:(d<.86?uCoat:uInk);}
        else{float spot=length((p.xy-c-vec2(0.,.01))/vec2(.055,.05));col=spot<1.?uIvory:uInk;}
        diffuseColor.rgb=col;`);
  };
  m.customProgramCacheKey = () => 'tiger-v3-ear';
  return m;
}


/** White tapered whiskers (ivory core + ink shell), rooted on the skin surface, carried by the head bone. */
function buildWhiskers(skinGeo, headBone, headRest) {
  const K = TIGER_V3_K, pos = skinGeo.attributes.position;
  const surfaceZ = (x, y) => { let best = -Infinity; for (let i = 0; i < pos.count; i++) { const px = pos.getX(i) / K, py = pos.getY(i) / K; if (Math.abs(px - x) < .03 && Math.abs(py - y) < .03) best = Math.max(best, pos.getZ(i) / K); } return best; };
  const group = new THREE.Group(); group.name = 'tiger-v3-whiskers';
  const core = new THREE.MeshBasicMaterial({ color: '#F7F2E6', fog: false });
  const ink = new THREE.MeshBasicMaterial({ color: PAL.ink, fog: false, side: THREE.BackSide });
  const toBone = headRest.clone().invert();
  const specs = [];
  // three rows on each whisker pad: long, sweeping out and back, drooping slightly
  for (const sd of [1, -1]) {
    [[.10, 1.995, .62, .10], [.14, 1.995, .70, .02], [.18, 1.99, .66, -.06], [.11, 1.963, .58, -.10], [.16, 1.96, .64, -.16], [.20, 1.955, .52, -.22], [.13, 1.93, .46, -.26]]
      .forEach(([x, y, len, rise]) => specs.push({ sd, x, y, len, rise, r: .0075 }));
    // a few short brow whiskers above the eye
    [[.12, 2.37, .26, .35], [.17, 2.385, .30, .25]].forEach(([x, y, len, rise]) => specs.push({ sd, x, y, len, rise, r: .005 }));
  }
  for (const w of specs) {
    const z0 = surfaceZ(w.x, w.y); if (!Number.isFinite(z0)) continue;
    const a = new THREE.Vector3(w.sd * w.x, w.y, z0 - .01);
    const out = new THREE.Vector3(w.sd * .9, w.rise * .45, .12).normalize();
    const pts = [a, a.clone().addScaledVector(out, w.len * .4).add(new THREE.Vector3(0, .015, 0)),
      a.clone().addScaledVector(out, w.len * .75).add(new THREE.Vector3(0, -.01, -.06)),
      a.clone().addScaledVector(out, w.len).add(new THREE.Vector3(0, -.05, -.16))].map(p => p.multiplyScalar(K));
    const curve = new THREE.CatmullRomCurve3(pts);
    for (const [mat, extra] of [[core, 0], [ink, .0045]]) {
      const g = new THREE.TubeGeometry(curve, 14, 1, 5, false), p = g.attributes.position;
      for (let i = 0; i <= 14; i++) {
        const u = i / 14, c = curve.getPointAt(u), rad = ((w.r * K) * (1 - .85 * u) + extra * K);
        for (let j = 0; j <= 5; j++) { const k = i * 6 + j; _v.fromBufferAttribute(p, k).sub(c).normalize().multiplyScalar(rad).add(c); p.setXYZ(k, _v.x, _v.y, _v.z); }
      }
      g.applyMatrix4(toBone); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; if (mat === ink) m.userData.isOutline = true; group.add(m);
    }
  }
  headBone.add(group);
  return group;
}

function bone(root, name) { return root.getObjectByName(name) || root.getObjectByName(name.replace(/\./g, '')); }

/** Set a bone's transform from a desired tiger-local matrix. */
function setBoneTigerLocal(bone, tigerInv, desired) {
  bone.parent.updateWorldMatrix(true, false);
  _m.copy(tigerInv).multiply(bone.parent.matrixWorld).invert().multiply(desired);
  _m.decompose(bone.position, bone.quaternion, _v2);
  bone.updateMatrixWorld(true);
}
function tigerLocal(obj, tigerInv, out = new THREE.Matrix4()) { obj.updateWorldMatrix(true, false); return out.copy(tigerInv).multiply(obj.matrixWorld); }

/** Rotate bone (tiger-local rest matrix R) so its +Y axis points from `from` toward `to`; returns matrix. */
function aimMatrix(rest, from, to, out = new THREE.Matrix4()) {
  const restDir = new THREE.Vector3(0, 1, 0).transformDirection(rest);
  const dir = _v.copy(to).sub(from).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(restDir, dir);
  const rq = new THREE.Quaternion().setFromRotationMatrix(rest);
  return out.compose(from, q.multiply(rq), new THREE.Vector3(1, 1, 1));
}

function solveTwoBone(S, T, L1, L2, pole, outJoint) {
  const d0 = _v.copy(T).sub(S); let d = d0.length();
  const u = d0.clone().normalize();
  d = Math.min(Math.max(d, Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-4);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const v = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
  return outJoint.copy(S).addScaledVector(u, a).addScaledVector(v, h);
}

export function upgradeTigerToV3(tiger, opts = {}) {
  if (!tiger.userData.tigerV3Pending) tiger.userData.tigerV3Pending = buildTigerV3(tiger, opts);
  return tiger.userData.tigerV3Pending;
}
async function buildTigerV3(tiger, { url = TIGER_V3_URL, loader = null } = {}) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const texLoader = new THREE.TextureLoader();
  const [gltf, sideMap, faceMap] = await Promise.all([
    (loader || new GLTFLoader()).loadAsync(url),
    texLoader.loadAsync(new URL('tiger-v3-side.png', BASE).href),
    texLoader.loadAsync(new URL('tiger-v3-face.png', BASE).href),
  ]);
  for (const t of [sideMap, faceMap]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; }
  const root = gltf.scene; root.name = 'tiger-v3-skin';
  const coat = coatMaterial(sideMap, faceMap), line = coatMaterial(sideMap, faceMap, true);
  const outlines = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const kind = (o.material?.name || '').replace('tiger_', '');
    if (kind === 'coat') {
      o.material = coat;
      const shell = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, line) : new THREE.Mesh(o.geometry, line);
      if (o.isSkinnedMesh) shell.bind(o.skeleton, o.bindMatrix);
      shell.frustumCulled = false; shell.name = 'tiger-v3-ink-outline'; shell.userData.isOutline = true;
      outlines.push([o, shell]);
    } else o.material = partMaterial(kind === 'ink' ? 'pupil' : kind);
  });
  for (const [o, shell] of outlines) o.parent.add(shell);
  tiger.add(root);

  // ---- old rig handles ----
  const nodes = new Map(); tiger.traverse(n => { if (n.userData.blenderSourceNode) nodes.set(n.userData.blenderSourceNode, n); });
  const oldBody = nodes.get('n1'), oldHead = nodes.get('n8');
  const oldLegs = LEG_IDS.map(id => nodes.get(id)), oldPaws = PAW_IDS.map(id => nodes.get(id));
  const oldRest = OLD.legs.map(p => new THREE.Vector3(...p).add(OLD.sole));
  const hidden = [];
  tiger.traverse(o => { if ((o.isMesh || o.isLine || o.isPoints) && !isUnder(o, root)) hidden.push(o); });
  const hideOld = on => { for (const o of hidden) o.visible = !on; };
  hideOld(true);

  // ---- new rig ----
  const B = n => bone(root, n);
  const names = ['root', 'pelvis', 'spine', 'chest', 'neck0', 'neck1', 'head', 'jaw', 'ear.L', 'ear.R',
    ...['L', 'R'].flatMap(s => ['scap', 'hum', 'rad', 'mc', 'fpaw', 'hip', 'fem', 'tib', 'mt', 'hpaw'].map(b => `${b}.${s}`)),
    ...Array.from({ length: 8 }, (_, i) => `tail${i}`)];
  const bones = {}; for (const n of names) bones[n] = B(n);
  root.updateMatrixWorld(true); tiger.updateWorldMatrix(true, false);
  const tigerInv0 = tiger.matrixWorld.clone().invert();
  const rest = {}; for (const n of names) rest[n] = tigerLocal(bones[n], tigerInv0);
  const restLocal = {}; for (const n of names) restLocal[n] = bones[n].quaternion.clone();
  const P = m => new THREE.Vector3().setFromMatrixPosition(m);
  const legs = ['L', 'R'].flatMap(s => [
    { s, fore: true, a: `hum.${s}`, b: `rad.${s}`, c: `mc.${s}`, paw: `fpaw.${s}` },
    { s, fore: false, a: `fem.${s}`, b: `tib.${s}`, c: `mt.${s}`, paw: `hpaw.${s}` },
  ]);
  for (const L of legs) {
    L.L1 = P(rest[L.a]).distanceTo(P(rest[L.b])); L.L2 = P(rest[L.b]).distanceTo(P(rest[L.c]));
    L.pawRest = P(rest[L.paw]); L.cRest = P(rest[L.c]);
    L.old = LEG_SIDE.findIndex((s, i) => s === L.s && (i < 2) === L.fore);
  }
  // body geometry for terrain pitch / roll: paw spans and the pivot between shoulders and hips
  const gait = (() => {
    const fz = legs.filter(L => L.fore).map(L => L.pawRest.z), hz = legs.filter(L => !L.fore).map(L => L.pawRest.z), xs = legs.map(L => L.pawRest.x);
    const sh = legs.map(L => P(rest[L.a])), pivot = sh.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / sh.length);
    return { foreZ: fz.reduce((a, v) => a + v, 0) / fz.length, hindZ: hz.reduce((a, v) => a + v, 0) / hz.length, width: Math.max(...xs) - Math.min(...xs), pivot };
  })();

  let skinMesh = null; root.traverse(o => { if (o.isSkinnedMesh && o.material === coat) skinMesh = o; });
  const whiskers = skinMesh ? buildWhiskers(skinMesh.geometry, bones.head, rest.head) : null;
  const tailRestQ = Array.from({ length: 8 }, (_, i) => restLocal[`tail${i}`]);
  const oldTailRoot = tiger.userData.tailRoot, oldTail = tiger.userData.tailSegs || [];
  // Hanging tail: bends per bone about the local X axis (sagittal plane).
  const TAIL_HANG = [-0.28, -0.22, -0.14, -0.06, 0.04, 0.12, 0.2, 0.24];

  const state = { mood: 'relaxed', moodT: 0, look: 0, lookTarget: 0, lookT: 0, earT: [0, 0], earFlick: [0, 0], still: 0 };
  const api = { root, whiskers, bones, rest, state, hideOld, sideMap, faceMap, setMood: m => { state.mood = m; state.moodT = 0; } };
  tiger.userData.tigerV3 = api;

  const drive = (dt, t) => {
    tiger.updateWorldMatrix(true, false);
    const inv = tiger.matrixWorld.clone().invert();
    // body: rigid delta of the old body group
    const body = tigerLocal(oldBody, inv), bodyD = body.clone().multiply(OLD.body.clone().invert());
    // ---- moods (from behaviour state) ----
    const ud = tiger.userData, walking = !!ud._walking && !ud._drinking;
    state.still = walking ? 0 : state.still + dt;
    const mood = ud._greeting ? 'ready' : ud._companion ? 'relaxed' : (ud._mode === 'drink' || ud._drinking) ? 'calm' : walking ? 'relaxed' : (state.still > 6 ? 'irritated' : 'relaxed');
    if (mood !== state.mood) { state.mood = mood; state.moodT = 0; }
    state.moodT += dt;
    // spine: small breathing / lateral flex with stride
    // ---- leg targets first. On uneven ground (stairs, a step edge) the body follows the paws like a real cat:
    //      pitch (front lower going down a stair), roll (toward the lower side), then lower the body for what is left.
    //      Legs are then clamped to their real length, so one side can never stretch. ----
    const swing = ud.targetGait?.swing || [0, 0, 0, 0];
    const yawQ = new THREE.Quaternion().setFromRotationMatrix(bodyD);
    const plans = legs.map(L => {
      const i = L.old, oldPaw = oldLegs[i].localToWorld(_v2.copy(OLD.sole)).applyMatrix4(inv);
      const target = L.pawRest.clone().add(oldPaw.sub(oldRest[i]));
      const sw = THREE.MathUtils.clamp(swing[i] || 0, 0, 1);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (L.fore ? 1.0 : 0.55) * sw);
      const cOff = L.cRest.clone().sub(L.pawRest).applyQuaternion(tilt).applyQuaternion(yawQ);
      return { L, target, sw, cOff, dy: target.y - L.pawRest.y };
    });
    // stance paws carry the ground height; a swinging paw is lifted on purpose and should not tilt the body
    const groundY = (f) => { let s = 0, w = 0; for (const p of plans) if (f(p.L)) { const k = 1 - 0.85 * p.sw; s += p.dy * k; w += k; } return w ? s / w : 0; };
    const foreY = groundY(L => L.fore), hindY = groundY(L => !L.fore), posY = groundY(L => L.pawRest.x > 0), negY = groundY(L => L.pawRest.x < 0);
    const bodyLen = Math.max(0.5, gait.foreZ - gait.hindZ), bodyWid = Math.max(0.3, gait.width);
    const pitchWant = THREE.MathUtils.clamp(Math.atan2(hindY - foreY, bodyLen), -0.42, 0.42);
    const rollWant = THREE.MathUtils.clamp(Math.atan2(posY - negY, bodyWid) * 0.6, -0.22, 0.22);
    const ease = Math.min(1, (dt || 1) * 8);
    state.pitch = (state.pitch ?? 0) + (pitchWant - (state.pitch ?? 0)) * ease;
    state.roll = (state.roll ?? 0) + (rollWant - (state.roll ?? 0)) * ease;
    const pivot = gait.pivot.clone().applyMatrix4(bodyD);
    const tiltM = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z)
      .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(state.pitch, 0, state.roll, 'XZY')))
      .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    // also sink the whole body by the average ground drop under it (both sides of a step), before checking reach
    const avgDrop = Math.max(0, -Math.min(0, (foreY + hindY) / 2)) * 0.5;
    const over = Math.max(0, ...plans.map(p => {
      const S0 = P(rest[p.L.a]).applyMatrix4(bodyD).applyMatrix4(tiltM); S0.y -= avgDrop;
      return S0.distanceTo(p.target.clone().add(p.cOff)) - 0.97 * (p.L.L1 + p.L.L2);
    }));
    const want = THREE.MathUtils.clamp(avgDrop + over * 0.8, 0, 0.6 * TIGER_V3_K);
    state.drop = (state.drop ?? 0) + (want - (state.drop ?? 0)) * Math.min(1, (dt || 1) * 10);
    const adj = new THREE.Matrix4().makeTranslation(0, -state.drop, 0).multiply(tiltM);
    const bodyA = adj.clone().multiply(bodyD);
    setBoneTigerLocal(bones.root, inv, bodyA.clone().multiply(rest.root));
    const phase = ud.targetGait?.phase ?? 0;
    const flex = walking ? 0.05 * Math.sin(phase * Math.PI * 2) : 0;
    bones.spine.quaternion.copy(restLocal.spine).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), flex));
    bones.chest.quaternion.copy(restLocal.chest).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -flex * 0.6));
    bones.root.updateMatrixWorld(true);
    // ---- head & neck follow old head (+ idle look-around) ----
    const headNow = tigerLocal(oldHead, inv), headD = headNow.clone().multiply(OLD.head.clone().invert());
    // strip the old head's scale out of the delta
    const hp = new THREE.Vector3(), hq = new THREE.Quaternion(), hs = new THREE.Vector3(); headD.decompose(hp, hq, hs);
    if (!walking && state.still > 1.5 && !ud._drinking) {
      state.lookT -= dt; if (state.lookT <= 0) { state.lookTarget = (Math.random() * 2 - 1) * 0.55; state.lookT = 2 + Math.random() * 3; }
    } else state.lookTarget = 0;
    state.look += (state.lookTarget - state.look) * Math.min(1, dt * 2.2);
    const look = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.look);
    const headRestPos = P(rest.head);
    const headM = adj.clone().multiply(new THREE.Matrix4().compose(headRestPos.clone().applyQuaternion(hq).add(hp), hq.clone().multiply(look).multiply(new THREE.Quaternion().setFromRotationMatrix(rest.head)), new THREE.Vector3(1, 1, 1)));
    const headPos = P(headM);
    const n0 = P(tigerLocal(bones.neck0, inv));
    const mid = n0.clone().lerp(headPos, 0.5); mid.y += 0.06 * TIGER_V3_K;
    setBoneTigerLocal(bones.neck0, inv, aimMatrix(bodyA.clone().multiply(rest.neck0), n0, mid));
    setBoneTigerLocal(bones.neck1, inv, aimMatrix(bodyA.clone().multiply(rest.neck1), P(tigerLocal(bones.neck1, inv)), headPos));
    setBoneTigerLocal(bones.head, inv, headM);
    // jaw: drinking laps
    const jawA = ud.drinkDetail?.active ? Math.max(0, ud.drinkDetail.jawAngle || 0) * 1.4 : 0;
    bones.jaw.quaternion.copy(restLocal.jaw).multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), jawA)); bones.jaw.updateMatrixWorld(true);
    // ears: occasional flicks, flattened back a little when irritated
    for (const [i, s] of [[0, 'L'], [1, 'R']]) {
      state.earT[i] -= dt; if (state.earT[i] <= 0) { state.earFlick[i] = 1; state.earT[i] = 2.5 + Math.random() * 5; }
      state.earFlick[i] = Math.max(0, state.earFlick[i] - dt * 5);
      const back = state.mood === 'irritated' ? 0.35 : state.mood === 'ready' ? -0.15 : 0;
      const e = bones[`ear.${s}`]; e.quaternion.copy(restLocal[`ear.${s}`]).multiply(_q.setFromEuler(new THREE.Euler(back + 0.5 * Math.sin(state.earFlick[i] * Math.PI * 3) * state.earFlick[i], 0, 0)));
      e.updateMatrixWorld(true);
    }
    // ---- legs: IK onto the old paws' motion, never longer than the real leg ----
    for (const { L, target, sw, cOff } of plans) {
      const S = P(tigerLocal(bones[L.a], inv));
      let cPos = target.clone().add(cOff);
      const reach = 0.985 * (L.L1 + L.L2), dist = cPos.distanceTo(S);
      if (dist > reach) { const pull = cPos.clone().sub(S).multiplyScalar(reach / dist).add(S).sub(cPos); cPos.add(pull); target.add(pull); }
      const pole = new THREE.Vector3(0, 0, L.fore ? -1 : 1).applyQuaternion(yawQ);
      const E = solveTwoBone(S, cPos, L.L1, L.L2, pole, new THREE.Vector3());
      setBoneTigerLocal(bones[L.a], inv, aimMatrix(bodyA.clone().multiply(rest[L.a]), S, E));
      setBoneTigerLocal(bones[L.b], inv, aimMatrix(bodyA.clone().multiply(rest[L.b]), E, cPos));
      setBoneTigerLocal(bones[L.c], inv, aimMatrix(bodyA.clone().multiply(rest[L.c]), cPos, target));
      const curl = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (L.fore ? 0.9 : 0.6) * sw);
      setBoneTigerLocal(bones[L.paw], inv, new THREE.Matrix4().compose(target, yawQ.clone().multiply(curl).multiply(new THREE.Quaternion().setFromRotationMatrix(rest[L.paw])), new THREE.Vector3(1, 1, 1)));
    }
    // ---- tail: hang + old tail motion + mood ----
    const m = state.mood, mt = state.moodT;
    for (let i = 0; i < 8; i++) {
      const u = i / 7, b = bones[`tail${i}`];
      let bend = TAIL_HANG[i], sway = 0, lift = 0;
      const old = oldTail[i];
      if (old) { sway += (old.rotation.z - (old.userData.baseRot?.z || 0)) + (old.rotation.y - (old.userData.baseRot?.y || 0)); }
      if (i === 0 && oldTailRoot) sway += oldTailRoot.rotation.z * 0.5;
      if (m === 'relaxed') sway += 0.10 * Math.sin(t * 1.6 - u * 2.2) * (0.3 + u);
      else if (m === 'calm') sway += 0.05 * Math.sin(t * 1.1 - u * 2) * u;
      else if (m === 'irritated') { // horizontal whip left-right
        lift = i < 4 ? 0.22 : 0; sway += 0.32 * Math.sin(t * 6.5 - u * 3.2) * (0.25 + u);
      } else if (m === 'ready') { // horizontal, only the end twitching
        lift = i < 4 ? 0.24 : 0.05; sway += (u > 0.7 ? 0.25 * Math.sin(t * 18) * (u - 0.7) / 0.3 : 0);
      }
      b.quaternion.copy(tailRestQ[i]).multiply(_q.setFromEuler(new THREE.Euler(bend + lift, 0, sway)));
    }
    bones.tail0.updateMatrixWorld(true);
  };
  const prev = tiger.userData.update;
  tiger.userData.update = function (dt, t, runtime) {
    prev?.call(this, dt, t, runtime);
    hideOld(true);
    drive(dt || 0, t || 0);
  };
  api.drive = drive;
  api.detach = () => { tiger.userData.update = prev; };
  drive(0, 0);
  return api;
}
function isUnder(o, root) { for (let p = o; p; p = p.parent) if (p === root) return true; return false; }
export function revertTigerV3(tiger) {
  const api = tiger.userData.tigerV3; if (!api) return;
  api.root.removeFromParent(); api.hideOld(false); api.detach(); delete tiger.userData.tigerV3; delete tiger.userData.tigerV3Pending;
}
