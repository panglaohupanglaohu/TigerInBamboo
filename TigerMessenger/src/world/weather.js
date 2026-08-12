// =====================================================================
//  天气系统：雨（雨丝 + 粗闪电 + 雷鸣） / 雪 / 雨停彩虹
//  - 雨天每 5–15 分钟随机停一次，停雨时天空大光圈呈彩虹色
//  - 闪电为多分枝宽带网格（粗细随机 2–6 倍），近地收成单支
// =====================================================================
import * as THREE from "three";
import { sfxThunder } from "../audio/sfx.js";

const RAIN_COUNT = 550;
const SNOW_COUNT = 380;
const AREA = 16; // 以玩家为中心的粒子半径
const TOP = 11; // 生成高度（玩家上方）

/** 雨段时长（秒）：5–15 分钟 */
const RAIN_SPAN_MIN = 5 * 60;
const RAIN_SPAN_MAX = 15 * 60;
/** 停雨（彩虹）时长（秒）：约 1.5–4 分钟 */
const CLEAR_SPAN_MIN = 90;
const CLEAR_SPAN_MAX = 240;
/** 下雨时电闪雷鸣间隔（秒）：约 4 分钟一次，带随机抖动 */
const BOLT_INTERVAL_MIN = 3.5 * 60;
const BOLT_INTERVAL_MAX = 4.5 * 60;

function nextBoltDelay() {
  return BOLT_INTERVAL_MIN + Math.random() * (BOLT_INTERVAL_MAX - BOLT_INTERVAL_MIN);
}

/** 闪电基准半宽（世界单位）；实际半宽 = 基准 × (2..6) × 角色系数 */
const BOLT_BASE_HALF_W = 0.038;

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _tmp = new THREE.Vector3();

function makeFlakeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(16, 16, 9, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

/** 彩虹环带贴图（沿 u 一周七色） */
function makeRainbowRingTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 16;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  const stops = [
    [0, "#ff3b3b"],
    [0.16, "#ff9a1f"],
    [0.32, "#ffe14a"],
    [0.48, "#4adf6a"],
    [0.64, "#3aa0ff"],
    [0.8, "#6b4dff"],
    [0.92, "#d14dff"],
    [1, "#ff3b3b"],
  ];
  for (const [t, col] of stops) g.addColorStop(t, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 16);
  // 径向柔边
  const vg = ctx.createLinearGradient(0, 0, 0, 16);
  vg.addColorStop(0, "rgba(255,255,255,0)");
  vg.addColorStop(0.35, "rgba(255,255,255,0.55)");
  vg.addColorStop(0.65, "rgba(255,255,255,0.55)");
  vg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, 256, 16);
  ctx.globalCompositeOperation = "source-over";
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** 风向量（世界 XZ，度 → 单位向量 × 风速） */
function windVec(dirDeg, speed, out) {
  const r = THREE.MathUtils.degToRad(dirDeg);
  return out.set(Math.cos(r) * speed, 0, Math.sin(r) * speed);
}

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

/**
 * 创建天气系统。
 * @param {import("three").Scene} scene
 * @param {number} R 行星半径（预留）
 * @param {{ skyRing?: import("three").Mesh|null }} [opts]
 * @returns {{ update, setMode, strikeNow, isRaining, isRainPaused }}
 */
export function createWeatherSystem(scene, R, opts = {}) {
  const skyRing = opts.skyRing || null;
  let rainbowTex = null;
  /** @type {{ color: THREE.Color, opacity: number, map: THREE.Texture|null }|null} */
  let skyRingBase = null;
  if (skyRing?.material) {
    const m = skyRing.material;
    skyRingBase = {
      color: m.color?.clone?.() || new THREE.Color(0xa3e4d7),
      opacity: m.opacity ?? 0.4,
      map: m.map || null,
    };
    skyRing.userData.skyRingBase = skyRingBase;
  }

  // ---------- 雨丝（LineSegments，沿速度方向的短线） ----------
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 6);
  const rainVel = new Float32Array(RAIN_COUNT * 3);
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0x9db8d8, transparent: true, opacity: 0.55 })
  );
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  // ---------- 雪花（Points，圆形软片） ----------
  const snowGeo = new THREE.BufferGeometry();
  const snowPos = new Float32Array(SNOW_COUNT * 3);
  const snowSeed = new Float32Array(SNOW_COUNT * 2); // 摇摆相位/幅度
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(
    snowGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.16,
      map: makeFlakeTexture(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  snow.visible = false;
  snow.frustumCulled = false;
  scene.add(snow);

  // ---------- 闪电（宽带网格：每段四边形，粗细随机 2–6 倍） ----------
  const MAX_BOLT_SEGS = 120;
  const flash = new THREE.PointLight(0xcfe0ff, 0, 260, 1.6);
  scene.add(flash);

  const boltPosArr = new Float32Array(MAX_BOLT_SEGS * 4 * 3);
  const boltIdxArr = new Uint16Array(MAX_BOLT_SEGS * 6);
  // 预填索引：每段 4 顶点 → 2 三角
  for (let s = 0; s < MAX_BOLT_SEGS; s++) {
    const b = s * 4;
    const o = s * 6;
    boltIdxArr[o] = b;
    boltIdxArr[o + 1] = b + 1;
    boltIdxArr[o + 2] = b + 2;
    boltIdxArr[o + 3] = b + 1;
    boltIdxArr[o + 4] = b + 3;
    boltIdxArr[o + 5] = b + 2;
  }
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute("position", new THREE.BufferAttribute(boltPosArr, 3));
  boltGeo.setIndex(new THREE.BufferAttribute(boltIdxArr, 1));
  boltGeo.setDrawRange(0, 0);
  const bolt = new THREE.Mesh(
    boltGeo,
    new THREE.MeshBasicMaterial({
      color: 0xeaf4ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  bolt.visible = false;
  bolt.frustumCulled = false;
  bolt.renderOrder = 5;
  scene.add(bolt);

  // 外层微晕（更宽、更淡）
  const boltGlowPos = new Float32Array(MAX_BOLT_SEGS * 4 * 3);
  const boltGlowGeo = new THREE.BufferGeometry();
  boltGlowGeo.setAttribute("position", new THREE.BufferAttribute(boltGlowPos, 3));
  boltGlowGeo.setIndex(new THREE.BufferAttribute(boltIdxArr, 1));
  boltGlowGeo.setDrawRange(0, 0);
  const boltGlow = new THREE.Mesh(
    boltGlowGeo,
    new THREE.MeshBasicMaterial({
      color: 0xb8d8ff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  boltGlow.visible = false;
  boltGlow.frustumCulled = false;
  boltGlow.renderOrder = 4;
  scene.add(boltGlow);

  let mode = 0; // 0 晴 / 1 雨 / 2 雪
  /** 雨天子状态：raining | clear（停雨彩虹） */
  let rainPhase = "raining";
  let rainPhaseT = 0;
  let rainPhaseDur = randRange(RAIN_SPAN_MIN, RAIN_SPAN_MAX);
  let nextBoltAt = nextBoltDelay();
  let boltAnim = 0;
  let boltAnimDur = 0.32;
  let time = 0;
  const lastCenter = new THREE.Vector3();
  let boltSegCount = 0;

  function respawnRainDrop(i, center) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * AREA;
    rainPos[i * 6] = center.x + Math.cos(a) * d;
    rainPos[i * 6 + 1] = center.y + TOP * (0.4 + Math.random() * 0.6);
    rainPos[i * 6 + 2] = center.z + Math.sin(a) * d;
  }
  function respawnSnowFlake(i, center) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * AREA;
    snowPos[i * 3] = center.x + Math.cos(a) * d;
    snowPos[i * 3 + 1] = center.y + TOP * (0.3 + Math.random() * 0.7);
    snowPos[i * 3 + 2] = center.z + Math.sin(a) * d;
    snowSeed[i * 2] = Math.random() * Math.PI * 2;
    snowSeed[i * 2 + 1] = 0.4 + Math.random() * 0.6;
  }

  function setSkyRingRainbow(on) {
    if (!skyRing?.material || !skyRingBase) return;
    const m = skyRing.material;
    if (on) {
      if (!rainbowTex) rainbowTex = makeRainbowRingTexture();
      m.map = rainbowTex;
      m.color.set(0xffffff);
      m.opacity = 0.82;
      m.transparent = true;
      m.depthWrite = false;
      m.side = THREE.DoubleSide;
      m.needsUpdate = true;
    } else {
      m.map = skyRingBase.map;
      m.color.copy(skyRingBase.color);
      m.opacity = skyRingBase.opacity;
      m.needsUpdate = true;
    }
  }

  function beginRaining(center) {
    rainPhase = "raining";
    rainPhaseT = 0;
    rainPhaseDur = randRange(RAIN_SPAN_MIN, RAIN_SPAN_MAX);
    rain.visible = true;
    for (let i = 0; i < RAIN_COUNT; i++) respawnRainDrop(i, center);
    setSkyRingRainbow(false);
    // 入雨后先等约一整段间隔再响，避免刚下雨就连闪
    nextBoltAt = nextBoltDelay();
  }

  function beginRainClear() {
    rainPhase = "clear";
    rainPhaseT = 0;
    rainPhaseDur = randRange(CLEAR_SPAN_MIN, CLEAR_SPAN_MAX);
    rain.visible = false;
    bolt.visible = false;
    boltGlow.visible = false;
    flash.intensity = 0;
    boltAnim = 0;
    setSkyRingRainbow(true);
  }

  /**
   * 写入一段闪电四边形（及更宽的光晕）。
   * halfW：半宽（世界单位）
   */
  function pushBoltSeg(ax, ay, az, bx, by, bz, halfW) {
    if (boltSegCount >= MAX_BOLT_SEGS) return false;
    _dir.set(bx - ax, by - ay, bz - az);
    const len = _dir.length();
    if (len < 1e-5) return true;
    _dir.multiplyScalar(1 / len);
    // 与方向不正交时取 (0,1,0) 或 (1,0,0) 叉乘得横向
    if (Math.abs(_dir.y) < 0.92) {
      _tmp.set(0, 1, 0);
    } else {
      _tmp.set(1, 0, 0);
    }
    _perp.crossVectors(_dir, _tmp).normalize();
    // 轻微扭动横向，避免整条共面发扁
    _perp.x += (Math.random() - 0.5) * 0.15;
    _perp.z += (Math.random() - 0.5) * 0.15;
    _perp.normalize().multiplyScalar(halfW);

    const s = boltSegCount;
    const o = s * 12; // 4 verts * 3
    // a+p, a-p, b+p, b-p
    boltPosArr[o] = ax + _perp.x;
    boltPosArr[o + 1] = ay + _perp.y;
    boltPosArr[o + 2] = az + _perp.z;
    boltPosArr[o + 3] = ax - _perp.x;
    boltPosArr[o + 4] = ay - _perp.y;
    boltPosArr[o + 5] = az - _perp.z;
    boltPosArr[o + 6] = bx + _perp.x;
    boltPosArr[o + 7] = by + _perp.y;
    boltPosArr[o + 8] = bz + _perp.z;
    boltPosArr[o + 9] = bx - _perp.x;
    boltPosArr[o + 10] = by - _perp.y;
    boltPosArr[o + 11] = bz - _perp.z;

    // 光晕约 2.2 倍宽
    const gScale = 2.2;
    boltGlowPos[o] = ax + _perp.x * gScale;
    boltGlowPos[o + 1] = ay + _perp.y * gScale;
    boltGlowPos[o + 2] = az + _perp.z * gScale;
    boltGlowPos[o + 3] = ax - _perp.x * gScale;
    boltGlowPos[o + 4] = ay - _perp.y * gScale;
    boltGlowPos[o + 5] = az - _perp.z * gScale;
    boltGlowPos[o + 6] = bx + _perp.x * gScale;
    boltGlowPos[o + 7] = by + _perp.y * gScale;
    boltGlowPos[o + 8] = bz + _perp.z * gScale;
    boltGlowPos[o + 9] = bx - _perp.x * gScale;
    boltGlowPos[o + 10] = by - _perp.y * gScale;
    boltGlowPos[o + 11] = bz - _perp.z * gScale;

    boltSegCount += 1;
    return true;
  }

  /**
   * 递归生成闪电枝：
   * - 主杆：全程到达 groundY，近地抖动收紧成单支
   * - 侧枝：只在中上段分出，长度短且不到地
   * - 每段粗细随机 2–6 倍基准
   */
  function growBoltBranch(sx, sy, sz, groundY, steps, isMain, depth) {
    let x = sx;
    let y = sy;
    let z = sz;
    let driftX = (Math.random() - 0.5) * (isMain ? 0.55 : 1.1);
    let driftZ = (Math.random() - 0.5) * (isMain ? 0.55 : 1.1);
    const yTop = sy;
    const ySpan = Math.max(0.5, yTop - groundY);
    // 整枝共享一个基础倍数区间，段内再微抖
    const branchMult = 2 + Math.random() * 4;

    for (let i = 0; i < steps; i++) {
      const heightFrac = (y - groundY) / ySpan;
      const nearGround = isMain && heightFrac < 0.22;
      const midAir = heightFrac > 0.28 && heightFrac < 0.92;

      let jitter;
      if (!isMain) {
        jitter = 0.55 + Math.random() * 0.9;
      } else if (nearGround) {
        jitter = 0.12 + Math.random() * 0.18;
      } else if (heightFrac > 0.75) {
        jitter = 0.7 + Math.random() * 1.1;
      } else {
        jitter = 1.1 + Math.random() * 1.6;
      }

      const stepDown = isMain
        ? ySpan / steps
        : (ySpan * (0.18 + Math.random() * 0.22)) / steps;
      if (Math.random() < (isMain ? 0.22 : 0.35)) {
        driftX += (Math.random() - 0.5) * (nearGround ? 0.25 : 1.4);
        driftZ += (Math.random() - 0.5) * (nearGround ? 0.25 : 1.4);
      }
      driftX *= nearGround ? 0.55 : 0.88;
      driftZ *= nearGround ? 0.55 : 0.88;

      let nx = x + driftX * stepDown * 0.9 + (Math.random() - 0.5) * jitter;
      let nz = z + driftZ * stepDown * 0.9 + (Math.random() - 0.5) * jitter;
      let ny = y - stepDown;

      if (isMain && i === steps - 1) {
        ny = groundY;
        nx = x + (Math.random() - 0.5) * 0.2;
        nz = z + (Math.random() - 0.5) * 0.2;
      } else if (!isMain && ny < groundY + ySpan * 0.2) {
        break;
      }

      // 粗细：2–6 倍基准；近地收尖；侧枝更细
      const role = isMain ? 1 : depth <= 1 ? 0.55 : 0.38;
      const taper = nearGround ? 0.45 + heightFrac * 0.4 : 0.85 + Math.random() * 0.35;
      const segMult = branchMult * (0.75 + Math.random() * 0.5); // 段间随机
      const halfW = BOLT_BASE_HALF_W * Math.min(6, Math.max(2, segMult)) * role * taper;

      if (!pushBoltSeg(x, y, z, nx, ny, nz, halfW)) return;
      x = nx;
      y = ny;
      z = nz;

      if (midAir && !nearGround && depth < 2 && boltSegCount < MAX_BOLT_SEGS - 4) {
        const branchP = isMain ? 0.38 : 0.18;
        if (Math.random() < branchP) {
          const bSteps = isMain
            ? 3 + ((Math.random() * 5) | 0)
            : 2 + ((Math.random() * 3) | 0);
          const bGround = y - ySpan * (0.12 + Math.random() * 0.28);
          growBoltBranch(x, y, z, Math.max(bGround, groundY + ySpan * 0.25), bSteps, false, depth + 1);
        }
        if (isMain && Math.random() < 0.12) {
          const bSteps = 2 + ((Math.random() * 4) | 0);
          const bGround = y - ySpan * (0.1 + Math.random() * 0.2);
          growBoltBranch(x, y, z, Math.max(bGround, groundY + ySpan * 0.3), bSteps, false, depth + 1);
        }
      }
    }
  }

  function strikeBolt(center) {
    // 停雨阶段不打雷
    if (mode === 1 && rainPhase === "clear") return;

    boltSegCount = 0;
    const gx = center.x + (Math.random() - 0.5) * 18;
    const gz = center.z + (Math.random() - 0.5) * 18;
    const groundY = center.y - 0.2 + (Math.random() - 0.5) * 1.2;
    const topY = center.y + 14 + Math.random() * 5;
    const sx = gx + (Math.random() - 0.5) * 6;
    const sz = gz + (Math.random() - 0.5) * 6;

    const mainSteps = 14 + ((Math.random() * 8) | 0);
    growBoltBranch(sx, topY, sz, groundY, mainSteps, true, 0);

    const cloudForks = 1 + ((Math.random() * 2) | 0);
    for (let f = 0; f < cloudForks; f++) {
      const fy = topY - 1.5 - Math.random() * 4;
      const fx = sx + (Math.random() - 0.5) * 2;
      const fz = sz + (Math.random() - 0.5) * 2;
      growBoltBranch(
        fx,
        fy,
        fz,
        fy - 2 - Math.random() * 4,
        3 + ((Math.random() * 3) | 0),
        false,
        1
      );
    }

    boltGeo.attributes.position.needsUpdate = true;
    boltGlowGeo.attributes.position.needsUpdate = true;
    const drawVerts = boltSegCount * 6; // 索引数量
    boltGeo.setDrawRange(0, drawVerts);
    boltGlowGeo.setDrawRange(0, drawVerts);
    bolt.visible = boltSegCount > 0;
    boltGlow.visible = boltSegCount > 0;

    const flashX = (sx + gx) * 0.5;
    const flashZ = (sz + gz) * 0.5;
    flash.position.set(flashX, center.y + 10, flashZ);
    boltAnimDur = 0.28 + Math.random() * 0.12;
    boltAnim = boltAnimDur;

    const dist = Math.hypot(flashX - center.x, flashZ - center.z);
    sfxThunder({ distance: dist });
  }

  /**
   * 每帧更新。
   * @param {number} dt
   * @param {THREE.Vector3} center 玩家位置
   * @param {{ speed: number, dirDeg: number }} wind
   * @param {number} nextMode 0 晴 / 1 雨 / 2 雪
   */
  function update(dt, center, wind, nextMode) {
    time += dt;
    lastCenter.copy(center);

    if (nextMode !== mode) {
      const prev = mode;
      mode = nextMode;
      snow.visible = mode === 2;
      if (mode === 2) {
        for (let i = 0; i < SNOW_COUNT; i++) respawnSnowFlake(i, center);
        rain.visible = false;
        setSkyRingRainbow(false);
        rainPhase = "raining";
      } else if (mode === 1) {
        beginRaining(center);
      } else {
        // 晴
        rain.visible = false;
        snow.visible = false;
        setSkyRingRainbow(false);
        rainPhase = "raining";
        bolt.visible = false;
        boltGlow.visible = false;
        flash.intensity = 0;
        boltAnim = 0;
      }
      if (prev === 1 && mode !== 1) {
        setSkyRingRainbow(false);
      }
    }

    windVec(wind.dirDeg, wind.speed, _w);

    // ---------- 雨天：5–15 分钟停一次，停时彩虹 ----------
    if (mode === 1) {
      rainPhaseT += dt;
      if (rainPhaseT >= rainPhaseDur) {
        if (rainPhase === "raining") {
          beginRainClear();
        } else {
          beginRaining(center);
        }
      }
    }

    const rainingNow = mode === 1 && rainPhase === "raining";

    // ---------- 雨 ----------
    if (rainingNow) {
      if (!rain.visible) {
        rain.visible = true;
        for (let i = 0; i < RAIN_COUNT; i++) respawnRainDrop(i, center);
      }
      const fallY = 11 + wind.speed * 0.8;
      for (let i = 0; i < RAIN_COUNT; i++) {
        rainVel[i * 3] = _w.x * 1.6;
        rainVel[i * 3 + 1] = -fallY;
        rainVel[i * 3 + 2] = _w.z * 1.6;
        rainPos[i * 6] += rainVel[i * 3] * dt;
        rainPos[i * 6 + 1] += rainVel[i * 3 + 1] * dt;
        rainPos[i * 6 + 2] += rainVel[i * 3 + 2] * dt;
        if (rainPos[i * 6 + 1] < center.y - 2.5) respawnRainDrop(i, center);
        _v.set(rainVel[i * 3], rainVel[i * 3 + 1], rainVel[i * 3 + 2]).normalize().multiplyScalar(0.4);
        rainPos[i * 6 + 3] = rainPos[i * 6] - _v.x;
        rainPos[i * 6 + 4] = rainPos[i * 6 + 1] - _v.y;
        rainPos[i * 6 + 5] = rainPos[i * 6 + 2] - _v.z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    } else if (mode === 1 && rainPhase === "clear") {
      rain.visible = false;
    }

    // ---------- 雪 ----------
    if (snow.visible) {
      for (let i = 0; i < SNOW_COUNT; i++) {
        const sway = Math.sin(time * 1.7 + snowSeed[i * 2]) * snowSeed[i * 2 + 1];
        snowPos[i * 3] += (_w.x * 0.9 + sway * 0.3) * dt;
        snowPos[i * 3 + 1] += -(1.1 + wind.speed * 0.25) * dt;
        snowPos[i * 3 + 2] += (_w.z * 0.9 + Math.cos(time * 1.3 + snowSeed[i * 2]) * 0.3) * dt;
        if (snowPos[i * 3 + 1] < center.y - 2.5) respawnSnowFlake(i, center);
      }
      snowGeo.attributes.position.needsUpdate = true;
    }

    // ---------- 闪电（仅正在下雨时 · 约每 4 分钟一次） ----------
    if (rainingNow) {
      nextBoltAt -= dt;
      if (nextBoltAt <= 0) {
        strikeBolt(center);
        nextBoltAt = nextBoltDelay();
      }
    }
    if (boltAnim > 0) {
      boltAnim -= dt;
      const k = Math.max(0, boltAnim / boltAnimDur);
      flash.intensity = k > 0.5 ? 10 * k : 6.5 * k;
      if (bolt.material) bolt.material.opacity = 0.55 + 0.45 * k;
      if (boltGlow.material) boltGlow.material.opacity = 0.12 + 0.28 * k;
      if (boltAnim <= 0) {
        flash.intensity = 0;
        bolt.visible = false;
        boltGlow.visible = false;
      }
    }
  }

  return {
    update,
    strikeNow: () => strikeBolt(lastCenter),
    isRaining: () => mode === 1 && rainPhase === "raining",
    isRainPaused: () => mode === 1 && rainPhase === "clear",
    /** 测试用：立刻进入停雨彩虹 */
    forceRainClear: () => {
      if (mode === 1) beginRainClear();
    },
  };
}
