// =====================================================================
//  圣城各台地鸟群：每台 20 只，随机栖于各房屋屋顶
//  · 白天：双螺旋漩涡起舞
//  · 夜晚：栖息屋顶；纸士兵经过时惊飞，离开后立刻落下
// =====================================================================
import * as THREE from "three";
import { BirdVortexManager } from "./birdVortex.js";
import { citadelTerraceMetrics } from "./odysseyCitadel.js";
import { P } from "../core/params.js";

const BIRDS_PER_TERRACE = 20;
/** 与 citadelInfiltration / dayNight 一致：入夜 0.82 → 黎明 0.22 */
const NIGHT_OPEN = 0.82;
const NIGHT_CLOSE = 0.22;
/** 士兵靠近台地中心多少距离算「经过」 */
const TERRACE_THREAT_R = 14;

const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _soldierPool = Array.from({ length: 24 }, () => new THREE.Vector3());
const _threats = [];

function isNight(phase) {
  const p = ((Number(phase) || 0) + 1) % 1;
  return p >= NIGHT_OPEN || p < NIGHT_CLOSE;
}

/**
 * 收集某台地房屋屋顶栖息点（世界坐标）。
 * 优先人字坡/尖顶/穹顶，其次城垛与围栏，保证多屋随机可落。
 * @param {THREE.Object3D} castle
 * @param {number} terraceIndex
 * @param {THREE.Vector3} up 台地法向
 */
export function collectTerraceRoofPerches(castle, terraceIndex, up) {
  const pts = [];
  if (!castle) return pts;
  // 权重：真屋顶优先（多采样），城垛/围栏次之
  const roofName = /town-roof|town-spire|town-dome|town-fence|town-crenel/;
  castle.updateMatrixWorld(true);
  castle.traverse((o) => {
    if (!o.isMesh || !roofName.test(o.name || "")) return;
    let p = o;
    let tIdx = null;
    while (p) {
      if (Number.isFinite(p.userData?.terraceIndex)) {
        tIdx = p.userData.terraceIndex | 0;
        break;
      }
      const m = /^town-terrace-(\d+)/.exec(p.name || "");
      if (m) {
        tIdx = Number(m[1]) | 0;
        break;
      }
      p = p.parent;
    }
    if (tIdx !== terraceIndex) return;
    o.getWorldPosition(_tmp);
    const base = _tmp.clone().addScaledVector(up, 0.22);
    const isPrimary =
      o.name === "town-roof" || o.name === "town-spire" || o.name === "town-dome";
    // 每块屋顶撒 2–4 个点，便于 20 只鸟分散到不同屋面
    const samples = isPrimary ? 3 : 1;
    for (let s = 0; s < samples; s++) {
      const j = Math.random() * Math.PI * 2;
      const r = isPrimary ? 0.15 + Math.random() * 0.7 : Math.random() * 0.25;
      pts.push(
        base
          .clone()
          .addScaledVector(_right, Math.cos(j) * r)
          .addScaledVector(_fwd, Math.sin(j) * r)
      );
    }
  });
  return pts;
}

/**
 * 从夜间潜入系统取纸士兵世界坐标（复用池，勿长期持有）。
 * @param {{ root?: THREE.Object3D }|null} infiltration
 * @returns {THREE.Vector3[]}
 */
export function collectInfiltrationThreats(infiltration) {
  _threats.length = 0;
  const soldiers = infiltration?.root?.userData?.soldiers;
  if (!infiltration?.root?.visible || !Array.isArray(soldiers)) return _threats;
  let i = 0;
  for (const s of soldiers) {
    if (!s?.visible) continue;
    if (i >= _soldierPool.length) _soldierPool.push(new THREE.Vector3());
    s.getWorldPosition(_soldierPool[i]);
    _threats.push(_soldierPool[i]);
    i++;
  }
  return _threats;
}

const _rel = new THREE.Vector3();

/**
 * 士兵是否经过本台地：高度落在台面带内，且水平距离在威胁半径内。
 * （避免一根中轴士兵把五层台地鸟群同时惊飞）
 */
function anyThreatNear(threats, origin, radius, up, bandH = 5.5) {
  if (!threats?.length) return false;
  const r2 = radius * radius;
  for (let i = 0; i < threats.length; i++) {
    const s = threats[i];
    _rel.set(s.x - origin.x, s.y - origin.y, s.z - origin.z);
    const h = _rel.dot(up);
    if (Math.abs(h) > bandH) continue;
    _rel.addScaledVector(up, -h);
    if (_rel.lengthSq() <= r2) return true;
  }
  return false;
}

/**
 * 在五级台地各布 20 只鸟，随机栖于各房屋屋顶；昼夜切换漩涡/栖顶/惊飞。
 * @param {THREE.Scene} scene
 * @param {THREE.Object3D} odysseyCitadel
 * @param {object} [opts]
 * @param {object} [opts.contour]
 * @param {() => object|null} [opts.getTram]
 * @param {() => object|null} [opts.getInfiltration]
 */
export function createCitadelTerraceBirds(scene, odysseyCitadel, opts = {}) {
  const metrics = citadelTerraceMetrics(opts.contour ?? odysseyCitadel?.userData?.contourSpec);
  const flocks = [];

  _up.set(0, 1, 0).applyQuaternion(odysseyCitadel.quaternion).normalize();
  _right.set(1, 0, 0).applyQuaternion(odysseyCitadel.quaternion).normalize();
  _fwd.set(0, 0, 1).applyQuaternion(odysseyCitadel.quaternion).normalize();

  for (let ti = 0; ti < metrics.length; ti++) {
    const m = metrics[ti];
    _origin.set(0, m.top + 0.35, 0);
    odysseyCitadel.localToWorld(_origin);

    const vortex = new BirdVortexManager(scene, {
      count: BIRDS_PER_TERRACE,
      origin: _origin.clone(),
      up: _up.clone(),
      right: _right.clone(),
      forward: _fwd.clone(),
      spiralOnly: true,
      yFloor: 1.2 + ti * 0.15,
      yCeil: Math.max(8, 4 + m.radius * 0.55),
      rMin: Math.max(2.2, m.radius * 0.22),
      rMax: Math.max(5.5, m.radius * 0.85),
      name: `bird-vortex-citadel-terrace-${ti + 1}`,
      getTram: opts.getTram || null,
    });
    vortex.setGateFrame({
      origin: _origin,
      up: _up,
      right: _right,
      forward: _fwd,
      respawn: true,
    });

    // 屋顶栖息点；不足则在台面圆环补点
    let perches = collectTerraceRoofPerches(odysseyCitadel, ti, _up);
    if (perches.length < 8) {
      const ringN = 24;
      const ringR = Math.max(3, m.radius * 0.55);
      for (let k = 0; k < ringN; k++) {
        const a = (k / ringN) * Math.PI * 2;
        _tmp
          .copy(_origin)
          .addScaledVector(_right, Math.cos(a) * ringR)
          .addScaledVector(_fwd, Math.sin(a) * ringR)
          .addScaledVector(_up, -0.15);
        perches.push(_tmp.clone());
      }
    }
    vortex.setRoostPoints(perches);
    vortex.setBehavior("vortex");

    vortex.root.userData.anchor = {
      kind: `citadel-terrace-${ti + 1}`,
      terraceIndex: ti,
      radius: m.radius,
      topY: m.top,
    };

    flocks.push({
      terraceIndex: ti,
      vortex,
      origin: _origin.clone(),
      threatR: Math.max(TERRACE_THREAT_R, m.radius * 1.15),
      night: false,
    });
  }

  function update(dt, t, ctx = {}) {
    const phase = ctx.phase ?? P.timeOfDay ?? 0.5;
    const night = isNight(phase);
    const d = Math.min(0.05, Math.max(0, Number(dt) || 0));

    let threats = ctx.threats;
    if (!threats) {
      const inf =
        typeof opts.getInfiltration === "function"
          ? opts.getInfiltration()
          : ctx.infiltration || null;
      threats = collectInfiltrationThreats(inf);
    }

    const tram =
      ctx.tram !== undefined
        ? ctx.tram
        : typeof opts.getTram === "function"
          ? opts.getTram()
          : null;
    const viewer = ctx.viewer ?? null;

    for (const flock of flocks) {
      const wasNight = flock.night;
      flock.night = night;

      if (!night) {
        // 白天：漩涡起舞
        flock.vortex.setBehavior("vortex");
      } else {
        // 入夜 / 士兵离开：立刻栖顶；士兵经过：惊飞
        if (!wasNight) {
          flock.vortex.setBehavior("roost");
        }
        const threat = anyThreatNear(threats, flock.origin, flock.threatR, _up);
        if (threat) {
          flock.vortex.setBehavior("flush");
        } else {
          // 士兵一离开马上落下（不再等待 flushTimer）
          flock.vortex.setBehavior("roost");
        }
      }

      flock.vortex.update(d, t, { tram, viewer });
    }
  }

  function dispose() {
    for (const f of flocks) f.vortex.dispose();
    flocks.length = 0;
  }

  return {
    flocks,
    update,
    dispose,
    getThreats: () => _threats,
    /** 兼容旧单旋涡 API：返回台地 1 的 vortex */
    get primary() {
      return flocks[0]?.vortex || null;
    },
  };
}
