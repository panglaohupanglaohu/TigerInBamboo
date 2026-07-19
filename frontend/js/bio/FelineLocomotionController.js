// 状态机动画驱动器：严格的解剖学行走摆动控制
// 运行时只操纵骨骼旋转矩阵，不触碰几何体与着色器
// 状态：'IDLE'（呼吸/扫视）| 'WALK'（对角步态 / 兔科双跃）| 'ROAR'（昂首张嘴）
// 步态分支：DIGITIGRADE/UNGULIGRADE 对角交替；SALTATORIAL 双后肢同频蹬跃
import * as THREE from "three";

// 猫科对角步态相位：左后0 → 左前0.25 → 右后0.5 → 右前0.75
const LEGS = [
  { k1: "FL1", k2: "FL2", kF: "FLFoot", phase: 0.25, front: true },
  { k1: "FR1", k2: "FR2", kF: "FRFoot", phase: 0.75, front: true },
  { k1: "BL1", k2: "BL2", kF: "BLFoot", phase: 0.0, front: false },
  { k1: "BR1", k2: "BR2", kF: "BRFoot", phase: 0.5, front: false },
];
const SWING = 0.35; // 摆动期占比（支撑期 0.65，符合猫科行走占空比）

export class FelineLocomotionController {
  /**
   * @param {Map} boneMap - 装配器输出的 name → Bone 索引
   * @param {Object} ctx - { time, dt, state, gait, moving }
   *   time: 累计时钟(s)；dt: 帧间隔；state: 'IDLE'|'WALK'|'ROAR'
   *   gait: 步态周期相位 0..1（由移动速度积分）；moving: 移动混合因子 0..1
   */
  static update(boneMap, ctx) {
    if (!boneMap || boneMap.size === 0) return;
    const { time: t, dt, state, gait, moving = 1, anatomyType = "DIGITIGRADE" } = ctx;

    // —— 脊椎：行进时沿体长轻微 S 形波动，呼吸浮动 ——
    const wave = Math.sin(gait * Math.PI * 2);
    const sway = state === "WALK" ? moving : 0;
    boneMap.get("Pelvis").rotation.y = wave * 0.04 * sway;
    boneMap.get("Mid").rotation.y = Math.sin(gait * Math.PI * 2 - 0.6) * 0.05 * sway;
    boneMap.get("Chest").rotation.y = Math.sin(gait * Math.PI * 2 - 1.2) * 0.04 * sway;
    const root = boneMap.get("Root");
    root.position.y = root.userData.baseY + Math.sin(t * 1.7) * 0.008 + Math.abs(wave) * 0.02 * sway;

    // —— 四肢 ——
    if (state === "WALK") {
      if (anatomyType === "SALTATORIAL") this._hop(boneMap, gait, moving);
      else this._gait(boneMap, gait, moving);
    } else this._legsRelax(boneMap, dt);

    // —— 头颈 ——
    const Neck = boneMap.get("Neck"), Head = boneMap.get("Head"), Jaw = boneMap.get("Jaw");
    if (state === "ROAR") {
      // 咆哮：昂首 + 下颌大张
      Neck.rotation.x += (-0.22 - Neck.rotation.x) * Math.min(dt * 3, 1);
      Neck.rotation.y += (0 - Neck.rotation.y) * Math.min(dt * 3, 1);
      Head.rotation.x += (-0.15 - Head.rotation.x) * Math.min(dt * 3, 1);
      Jaw.rotation.x += (0.45 - Jaw.rotation.x) * Math.min(dt * 6, 1);
    } else if (state === "IDLE") {
      // 驻足：昂首远眺、缓慢扫视；下颌随呼吸微张
      Neck.rotation.y += (Math.sin(t * 0.9) * 0.4 - Neck.rotation.y) * Math.min(dt * 3, 1);
      Neck.rotation.x += (-0.18 - Neck.rotation.x) * Math.min(dt * 3, 1);
      Head.rotation.y += (Math.sin(t * 0.7) * 0.25 - Head.rotation.y) * Math.min(dt * 3, 1);
      Jaw.rotation.x += (0.03 + Math.sin(t * 1.7) * 0.015 - Jaw.rotation.x) * Math.min(dt * 6, 1);
    } else {
      // 巡游：平视、小幅扫视
      Neck.rotation.y += (Math.sin(t * 0.55) * 0.22 - Neck.rotation.y) * Math.min(dt * 2, 1);
      Neck.rotation.x += (0.03 - Neck.rotation.x) * Math.min(dt * 2, 1);
      Head.rotation.y += (Math.sin(t * 0.4) * 0.15 - Head.rotation.y) * Math.min(dt * 2, 1);
      Jaw.rotation.x += (0.03 + Math.sin(t * 1.7) * 0.015 - Jaw.rotation.x) * Math.min(dt * 6, 1);
    }

    // —— 尾：五节链甩鞭 —— 行进与步态耦合、驻足以时间摆动；
    // 根→梢相位延迟 0.45rad、振幅递增（甩鞭流体波浪），尾尖保持上翘
    const waveT = state === "WALK" ? gait * Math.PI * 2 : t * 1.4;
    const tailAmp = state === "WALK" ? moving : 0.55;
    for (let i = 1; i <= 5; i++) {
      const tb = boneMap.get(`Tail${i}`);
      if (!tb) break;
      tb.rotation.y = Math.sin(waveT - (i - 1) * 0.45) * (0.1 + i * 0.07) * tailAmp;
    }
    boneMap.get("Tail1").rotation.x = 0.06 + Math.cos(waveT * 2) * 0.05; // 尾根微起伏
    boneMap.get("Tail5").rotation.x = 0.22; // 尾尖自信上翘

    // —— 兔耳（仅 SALTATORIAL 装配）：静时微颤，跃时随蹬地冲量惯性后仰 ——
    const earL = boneMap.get("Ear_L"), earR = boneMap.get("Ear_R");
    if (earL && earR) {
      const lag = state === "WALK" ? Math.max(0, Math.sin(gait * Math.PI * 2)) * 0.35 * moving : 0;
      earL.rotation.x = -0.12 - lag + Math.sin(t * 2.3) * 0.04;
      earR.rotation.x = -0.12 - lag + Math.sin(t * 2.3 + 0.3) * 0.04;
    }
  }

  /** 跳跃行步态（兔形目）：双后肢同频蹬跃、前肢落地支撑、脊椎弓张如箭 */
  static _hop(boneMap, gait, moving) {
    const tick = gait * Math.PI * 2;          // 每个步态周期一次腾跃
    const push = Math.max(0, Math.sin(tick)); // 蹬地冲量 0→1→0
    // 脊椎：弓起 ↔ 舒展（弓箭式）
    boneMap.get("Mid").rotation.x = Math.sin(tick) * 0.16 * moving;
    boneMap.get("Chest").rotation.x = Math.sin(tick + 0.4) * 0.1 * moving;
    // 腾空抛物线叠加于根骨呼吸浮动之上
    boneMap.get("Root").position.y += push * 0.06 * moving;
    // 双后肢同频：蹬地伸直 ↔ 腾空深折（不再镜像交替）
    const hip = (-0.1 + push * 0.4) * moving;
    const knee = (0.85 - push * 0.7) * moving;
    for (const k of ["BL1", "BR1"]) boneMap.get(k).rotation.x = hip;
    for (const k of ["BL2", "BR2"]) boneMap.get(k).rotation.x = knee;
    for (const k of ["BLFoot", "BRFoot"]) boneMap.get(k).rotation.x = (0.3 - push * 0.5) * moving;
    // 前肢落地支撑，微微错开防呆板
    boneMap.get("FL1").rotation.x = Math.cos(tick) * 0.3 * moving;
    boneMap.get("FR1").rotation.x = Math.cos(tick + 0.25) * 0.3 * moving;
    boneMap.get("FL2").rotation.x = Math.max(0, -Math.sin(tick)) * 0.45 * moving;
    boneMap.get("FR2").rotation.x = Math.max(0, -Math.sin(tick + 0.25)) * 0.45 * moving;
  }

  /** 步态：趾行关节方向 —— 前肢肘只向后弯；后肢 Z 形（膝前凸、飞节后折） */
  static _gait(boneMap, gait, moving) {
    // 约定 rotation.x 为正 = 腿向后摆、为负 = 向前摆
    for (const L of LEGS) {
      const p = ((gait + L.phase) % 1 + 1) % 1;
      let hipX, fold;
      if (p < SWING) {
        // 摆动期：腿由后向前摆（hipX +→−），关节主动折叠防爪蹭地
        const s = p / SWING;
        hipX = THREE.MathUtils.lerp(0.42, -0.48, Math.pow(s, 0.75));
        fold = Math.sin(Math.PI * s); // 0→1→0，摆动中段折叠最深
      } else {
        // 支撑期：爪钉地，腿整体由前向后蹬（hipX −→+），关节舒展
        const s = (p - SWING) / (1 - SWING);
        hipX = THREE.MathUtils.lerp(-0.48, 0.42, s);
        fold = 0;
      }
      hipX *= moving; fold *= moving;
      const k1 = boneMap.get(L.k1), k2 = boneMap.get(L.k2), kF = boneMap.get(L.kF);
      if (L.front) {
        k1.rotation.x = hipX * 0.65;                  // 肩：前后摆
        k2.rotation.x = fold * 0.95;                  // 肘：仅向后折（绝不前凸）
        kF.rotation.x = fold * 0.4 - hipX * 0.25;     // 腕：抬爪向后收、落地放平
      } else {
        k1.rotation.x = hipX * 0.55;                  // 髋：前后摆
        k2.rotation.x = fold * 0.9;                   // 膝：屈曲 → 小腿后收、膝盖前凸
        kF.rotation.x = fold * 0.55;                  // 飞节（踝）：向后折
      }
    }
  }

  /** 非行走状态：四肢缓慢回正 */
  static _legsRelax(boneMap, dt) {
    const k = Math.min(dt * 4, 1);
    for (const L of LEGS) {
      for (const key of [L.k1, L.k2, L.kF]) {
        const b = boneMap.get(key);
        b.rotation.x += (0 - b.rotation.x) * k;
      }
    }
  }
}
