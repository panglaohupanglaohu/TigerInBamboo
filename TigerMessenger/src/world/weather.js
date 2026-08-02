// =====================================================================
//  天气系统：雨（雨丝 + 闪电） / 雪（慢飘 + 湍流）
//  雨落与雪飘均受风速/风向影响（斜落、漂移）；闪电仅雨天出现
// =====================================================================
import * as THREE from "three";

const RAIN_COUNT = 550;
const SNOW_COUNT = 380;
const AREA = 16; // 以玩家为中心的粒子半径
const TOP = 11; // 生成高度（玩家上方）

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _up = new THREE.Vector3();

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

/** 风向量（世界 XZ，度 → 单位向量 × 风速） */
function windVec(dirDeg, speed, out) {
  const r = THREE.MathUtils.degToRad(dirDeg);
  return out.set(Math.cos(r) * speed, 0, Math.sin(r) * speed);
}

/**
 * 创建天气系统。
 * @returns {{ update, setMode }}
 */
export function createWeatherSystem(scene, R) {
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

  // ---------- 闪电（高亮点光源脉冲 + 多分枝折线雷） ----------
  // LineSegments：主杆 + 侧枝；近地只留单支落地
  const MAX_BOLT_SEGS = 120; // 线段上限（每段 2 顶点）
  const flash = new THREE.PointLight(0xcfe0ff, 0, 260, 1.6);
  scene.add(flash);
  const boltPosArr = new Float32Array(MAX_BOLT_SEGS * 6);
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute("position", new THREE.BufferAttribute(boltPosArr, 3));
  boltGeo.setDrawRange(0, 0);
  const bolt = new THREE.LineSegments(
    boltGeo,
    new THREE.LineBasicMaterial({
      color: 0xeaf4ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
  );
  bolt.visible = false;
  bolt.frustumCulled = false;
  scene.add(bolt);

  let mode = 0; // 0 晴 / 1 雨 / 2 雪
  let nextBoltAt = 3;
  let boltAnim = 0; // >0 表示闪电脉冲进行中
  let boltAnimDur = 0.32;
  let time = 0;
  const lastCenter = new THREE.Vector3(); // 供 strikeNow 测试/手动触发
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

  function pushBoltSeg(ax, ay, az, bx, by, bz) {
    if (boltSegCount >= MAX_BOLT_SEGS) return false;
    const o = boltSegCount * 6;
    boltPosArr[o] = ax;
    boltPosArr[o + 1] = ay;
    boltPosArr[o + 2] = az;
    boltPosArr[o + 3] = bx;
    boltPosArr[o + 4] = by;
    boltPosArr[o + 5] = bz;
    boltSegCount += 1;
    return true;
  }

  /**
   * 递归生成闪电枝：
   * - 主杆：全程到达 groundY，近地抖动收紧成单支
   * - 侧枝：只在中上段分出，长度短且不到地
   * @param {boolean} isMain
   * @param {number} depth 分叉深度（侧枝 depth 更大则不再分）
   */
  function growBoltBranch(sx, sy, sz, groundY, steps, isMain, depth) {
    let x = sx;
    let y = sy;
    let z = sz;
    // 主杆整体漂移方向（略倾斜，非竖直）
    let driftX = (Math.random() - 0.5) * (isMain ? 0.55 : 1.1);
    let driftZ = (Math.random() - 0.5) * (isMain ? 0.55 : 1.1);
    const yTop = sy;
    const ySpan = Math.max(0.5, yTop - groundY);

    for (let i = 0; i < steps; i++) {
      const heightFrac = (y - groundY) / ySpan; // 1 云端 → 0 地面
      // 近地（主杆最后约 22%）：几乎只沿主路径，禁止再分叉
      const nearGround = isMain && heightFrac < 0.22;
      const midAir = heightFrac > 0.28 && heightFrac < 0.92;

      // 主杆中段大幅锯齿；近地收成细尖；侧枝更碎、更短
      let jitter;
      if (!isMain) {
        jitter = 0.55 + Math.random() * 0.9;
      } else if (nearGround) {
        jitter = 0.12 + Math.random() * 0.18; // 单支落地
      } else if (heightFrac > 0.75) {
        jitter = 0.7 + Math.random() * 1.1; // 云端开叉感
      } else {
        jitter = 1.1 + Math.random() * 1.6; // 中段最狂
      }

      const stepDown = isMain
        ? ySpan / steps
        : (ySpan * (0.18 + Math.random() * 0.22)) / steps;
      // 偶尔急拐（侧向跳变），避免整条近似直线
      if (Math.random() < (isMain ? 0.22 : 0.35)) {
        driftX += (Math.random() - 0.5) * (nearGround ? 0.25 : 1.4);
        driftZ += (Math.random() - 0.5) * (nearGround ? 0.25 : 1.4);
      }
      // 阻尼漂移，防止飞出太远
      driftX *= nearGround ? 0.55 : 0.88;
      driftZ *= nearGround ? 0.55 : 0.88;

      let nx = x + driftX * stepDown * 0.9 + (Math.random() - 0.5) * jitter;
      let nz = z + driftZ * stepDown * 0.9 + (Math.random() - 0.5) * jitter;
      let ny = y - stepDown;

      if (isMain && i === steps - 1) {
        // 主杆最后一点精确贴地（单点着地）
        ny = groundY;
        // 收束：最后一步横向偏移很小
        nx = x + (Math.random() - 0.5) * 0.2;
        nz = z + (Math.random() - 0.5) * 0.2;
      } else if (!isMain && ny < groundY + ySpan * 0.2) {
        // 侧枝不到地：提前终止
        break;
      }

      if (!pushBoltSeg(x, y, z, nx, ny, nz)) return;
      x = nx;
      y = ny;
      z = nz;

      // 分叉：仅中高空；主杆可多分，侧枝最多再分一层
      if (midAir && !nearGround && depth < 2 && boltSegCount < MAX_BOLT_SEGS - 4) {
        const branchP = isMain ? 0.38 : 0.18;
        if (Math.random() < branchP) {
          const bSteps = isMain
            ? 3 + ((Math.random() * 5) | 0)
            : 2 + ((Math.random() * 3) | 0);
          // 侧枝目标高度：停在半空
          const bGround = y - ySpan * (0.12 + Math.random() * 0.28);
          growBoltBranch(x, y, z, Math.max(bGround, groundY + ySpan * 0.25), bSteps, false, depth + 1);
        }
        // 主杆偶发双侧对称感（连续两叉）
        if (isMain && Math.random() < 0.12) {
          const bSteps = 2 + ((Math.random() * 4) | 0);
          const bGround = y - ySpan * (0.1 + Math.random() * 0.2);
          growBoltBranch(x, y, z, Math.max(bGround, groundY + ySpan * 0.3), bSteps, false, depth + 1);
        }
      }
    }
  }

  function strikeBolt(center) {
    boltSegCount = 0;
    // 云端起点 + 落地点（玩家附近，可偏一段距离）
    const gx = center.x + (Math.random() - 0.5) * 18;
    const gz = center.z + (Math.random() - 0.5) * 18;
    const groundY = center.y - 0.2 + (Math.random() - 0.5) * 1.2;
    const topY = center.y + 14 + Math.random() * 5;
    // 云端入口也带水平偏移，避免竖直一条
    const sx = gx + (Math.random() - 0.5) * 6;
    const sz = gz + (Math.random() - 0.5) * 6;

    const mainSteps = 14 + ((Math.random() * 8) | 0); // 14–21 段主杆
    growBoltBranch(sx, topY, sz, groundY, mainSteps, true, 0);

    // 云端再补 1–2 条短叉，增强“树状”剪影
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
    boltGeo.setDrawRange(0, boltSegCount * 2);
    bolt.visible = boltSegCount > 0;
    // 闪光中心取中上段
    flash.position.set((sx + gx) * 0.5, center.y + 10, (sz + gz) * 0.5);
    boltAnimDur = 0.28 + Math.random() * 0.12;
    boltAnim = boltAnimDur;
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
      mode = nextMode;
      rain.visible = mode === 1;
      snow.visible = mode === 2;
      if (mode === 1) for (let i = 0; i < RAIN_COUNT; i++) respawnRainDrop(i, center);
      if (mode === 2) for (let i = 0; i < SNOW_COUNT; i++) respawnSnowFlake(i, center);
    }
    windVec(wind.dirDeg, wind.speed, _w);

    // ---------- 雨 ----------
    if (rain.visible) {
      const fallY = 11 + wind.speed * 0.8;
      for (let i = 0; i < RAIN_COUNT; i++) {
        rainVel[i * 3] = _w.x * 1.6;
        rainVel[i * 3 + 1] = -fallY;
        rainVel[i * 3 + 2] = _w.z * 1.6;
        rainPos[i * 6] += rainVel[i * 3] * dt;
        rainPos[i * 6 + 1] += rainVel[i * 3 + 1] * dt;
        rainPos[i * 6 + 2] += rainVel[i * 3 + 2] * dt;
        if (rainPos[i * 6 + 1] < center.y - 2.5) respawnRainDrop(i, center);
        // 雨丝末端 = 起点 - 速度单位向量 × 0.4（斜落方向）
        _v.set(rainVel[i * 3], rainVel[i * 3 + 1], rainVel[i * 3 + 2]).normalize().multiplyScalar(0.4);
        rainPos[i * 6 + 3] = rainPos[i * 6] - _v.x;
        rainPos[i * 6 + 4] = rainPos[i * 6 + 1] - _v.y;
        rainPos[i * 6 + 5] = rainPos[i * 6 + 2] - _v.z;
      }
      rainGeo.attributes.position.needsUpdate = true;
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

    // ---------- 闪电（仅雨天） ----------
    if (mode === 1) {
      nextBoltAt -= dt;
      if (nextBoltAt <= 0) {
        strikeBolt(center);
        nextBoltAt = 4 + Math.random() * 5;
      }
    }
    if (boltAnim > 0) {
      boltAnim -= dt;
      // 双脉冲：强-弱-强-灭
      const k = Math.max(0, boltAnim / boltAnimDur);
      flash.intensity = k > 0.5 ? 10 * k : 6.5 * k;
      // 线体随脉冲略闪
      if (bolt.material) bolt.material.opacity = 0.55 + 0.45 * k;
      if (boltAnim <= 0) {
        flash.intensity = 0;
        bolt.visible = false;
      }
    }
  }

  return { update, strikeNow: () => strikeBolt(lastCenter) };
}
