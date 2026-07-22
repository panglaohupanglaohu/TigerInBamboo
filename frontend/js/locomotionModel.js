// 生物运动计算：以解剖类型 + 体型尺寸为键，给出有生物力学依据的步态参数
// 方法：腿长 → 倒摆(pendulum)自然频率 f=(1/2π)√(g/L)；步频≈腿摆自然频率；
//       Froude 数 Fr=v²/(g·L) 标定步态区（行走/小跑/奔驰）；颈摆相位由颈长派生。
// 全部纯前端、确定性计算，供状态机每帧 tick 消费，不重建网格。

import { ANATOMY_PRIOR } from "./bio/anatomyEstimator.js";

const G = 9.81;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 腿倒摆自然频率 (Hz) */
function pendulumFreq(legLen) {
  return (1 / (2 * Math.PI)) * Math.sqrt(G / Math.max(legLen, 0.02));
}

/**
 * 计算步态参数
 * @param {string} anatomyType
 * @param {{width:number,height:number,length:number}} dimensions
 * @param {{neckLen:number,legLen:number,tailLen:number}} [proportions]
 */
export function computeGait(anatomyType, dimensions, proportions = {}) {
  const prior = ANATOMY_PRIOR[anatomyType] || ANATOMY_PRIOR.DIGITIGRADE;
  const legLen = Math.max(0.02, dimensions.height * (proportions.legLen ?? prior.leg));
  const neckLen = dimensions.height * (proportions.neckLen ?? prior.neck);
  const tailLen = dimensions.height * (proportions.tailLen ?? prior.tail);

  const fLeg = pendulumFreq(legLen);
  // 偏好步速 ~ 0.3·√(gL)（慢走/觅食溜达），并据类型微调
  const speedFactor = { SALTATORIAL: 0.5, AVES: 0.35, DIGITIGRADE: 0.3, UNGULIGRADE: 0.45 }[anatomyType] ?? 0.33;
  const prefSpeed = speedFactor * Math.sqrt(G * legLen);
  const froude = (prefSpeed * prefSpeed) / (G * legLen);

  let freq, swing, spine, tail, neckPhase, locomotion, note;
  switch (anatomyType) {
    case "SALTATORIAL": // 跳跃：高频大摆
      freq = clamp(fLeg * 2.4, 1.6, 3.2);
      swing = 1.6; spine = 0.6; tail = 1.2;
      neckPhase = 1.0; locomotion = "hop";
      note = "后肢弹跳，落地缓冲靠长耳与绒尾配平"; break;
    case "AVES": // 禽：地行小跑 + 颈随步点头
      freq = clamp(fLeg * 1.3, 0.8, 2.0);
      swing = 1.1; spine = 0.5; tail = clamp(tailLen / dimensions.height * 1.4, 0.3, 1.2);
      neckPhase = clamp(neckLen / Math.max(legLen, 0.05) * 1.6, 1.0, 3.0); // 颈摆相位超前腿摆
      locomotion = "walk";
      note = "颈惯性大，步伐与点头相位差形成招牌「探头顿挫」"; break;
    case "UNGULIGRADE": // 蹄行：大步幅、低摆、稳健
      freq = clamp(fLeg * 1.1, 0.7, 1.6);
      swing = 0.9; spine = 0.7; tail = clamp(tailLen / dimensions.height * 1.6, 0.3, 1.3);
      neckPhase = 1.0; locomotion = "trot";
      note = "修长四肢、Froude 偏高，过渡到小跑/奔驰"; break;
    default: // DIGITIGRADE 趾行（猫科式潜行）
      freq = clamp(fLeg * 1.0, 0.7, 1.5);
      swing = 1.0; spine = 0.9; tail = clamp(tailLen / dimensions.height * 1.2, 0.4, 1.4);
      neckPhase = 1.0; locomotion = "stalk";
      note = "低重心四拍潜行，肩胛参与步长，尾为平衡配重"; break;
  }
  return {
    freq: +freq.toFixed(2), swing: +swing.toFixed(2), spine: +spine.toFixed(2),
    tail: +tail.toFixed(2), neckPhase: +neckPhase.toFixed(2),
    locomotion, note, froude: +froude.toFixed(2), prefSpeed: +prefSpeed.toFixed(2),
  };
}

/** 将计算步态写入 record.gait（带边界保护） */
export function applyGait(record, gait) {
  record.gait.freq = clamp(gait.freq, 0.4, 4);
  record.gait.swing = clamp(gait.swing, 0.3, 2);
  record.gait.spine = clamp(gait.spine, 0.2, 1.5);
  record.gait.tail = clamp(gait.tail, 0.2, 1.5);
  return record;
}
