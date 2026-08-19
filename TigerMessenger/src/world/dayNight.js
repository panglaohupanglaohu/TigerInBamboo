// =====================================================================
//  昼夜循环：天空/雾/日光/环境光/云色 随时刻联动
//  重点表现朝霞（t≈0.28）与暮云（t≈0.75）的暖色过渡
// =====================================================================
import * as THREE from "three";
import { P } from "../core/params.js";

// 关键帧：[t, 天顶, 天中(背景/雾), 天底(地平线), 日光色, 日光强度, 环境强度, 云色]
const KEYS = [
  [0.0, 0x1a2440, 0x16202e, 0x0e1420, 0x9db8e8, 0.25, 0.25, 0x8a96b8], // 午夜
  [0.2, 0x3a4266, 0x2a3450, 0x1c2438, 0xa8b8e0, 0.4, 0.4, 0xb0a8c0], // 黎明前
  [0.28, 0xf0a878, 0xf2b57e, 0xffd9a8, 0xffb27a, 1.1, 0.65, 0xffc9a3], // 朝霞 ★
  [0.38, 0x9adfcf, 0x8ad8cc, 0xbfe8dc, 0xfff0d8, 1.5, 0.85, 0xffffff],
  [0.5, 0x6ac7c2, 0x7fcfc8, 0xa8e1d4, 0xfff6e0, 1.6, 0.9, 0xffffff], // 正午（现色）
  [0.62, 0x8ec8c0, 0x92d0c2, 0xc0dcd0, 0xffe8c8, 1.3, 0.8, 0xfff2e0],
  [0.75, 0xd9788a, 0xe8956b, 0xffb890, 0xff9a5c, 1.0, 0.6, 0xffc3a0], // 暮云 ★
  [0.85, 0x3a4266, 0x24304a, 0x182238, 0xa8b0d8, 0.45, 0.4, 0xa8a8c0], // 入夜
  [1.0, 0x1a2440, 0x16202e, 0x0e1420, 0x9db8e8, 0.25, 0.25, 0x8a96b8], // 回午夜
];

const DAY_LENGTH = 90; // 一昼夜（秒），乘以 daySpeed 加速

const _cA = new THREE.Color();
const _cB = new THREE.Color();

// 采样：返回该时刻各项参数
function sample(t) {
  t = ((t % 1) + 1) % 1;
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      const mix = (ia, ib) => _cA.setHex(ia).lerp(_cB.setHex(ib), k).clone();
      return {
        skyTop: mix(a[1], b[1]),
        skyMid: mix(a[2], b[2]),
        skyBot: mix(a[3], b[3]),
        sunColor: mix(a[4], b[4]),
        sunI: a[5] + (b[5] - a[5]) * k,
        ambientI: a[6] + (b[6] - a[6]) * k,
        cloud: mix(a[7], b[7]),
      };
    }
  }
  return sample(0);
}

/**
 * 创建昼夜循环。
 * @param {object} refs { scene, skyMat, sun, ambient, hemi, clouds, fill }
 */
export function createDayNight({ scene, skyMat, sun, ambient, hemi, clouds, fill }) {
  let phase = P.timeOfDay ?? 0.5;
  let lastWritten = phase;
  let current = null; // 最近一帧采样（供莫比斯结界二次调色）

  // 收集云材质（染色用）
  const cloudMats = new Set();
  for (const c of clouds || []) {
    c.traverse((o) => {
      if (o.isMesh && o.material && o.material.color) cloudMats.add(o.material);
    });
  }

  /**
   * 每帧推进。P.daySpeed 控制昼夜速度；P.timeOfDay 可被面板手动拖动。
   */
  function update(dt) {
    // 面板拖动优先：检测用户手改时刻
    if (Math.abs(P.timeOfDay - lastWritten) > 0.003) {
      phase = P.timeOfDay;
    }
    phase = (phase + (P.daySpeed * dt) / DAY_LENGTH) % 1;
    lastWritten = phase;
    P.timeOfDay = phase; // 面板同步显示当前时刻

    const s = sample(phase);
    current = s;
    if (skyMat) {
      skyMat.uniforms.topColor.value.copy(s.skyTop);
      skyMat.uniforms.midColor.value.copy(s.skyMid);
      skyMat.uniforms.botColor.value.copy(s.skyBot);
      // 云带颜色必须同步：否则深夜天顶已黑、白天的薄荷云纹还横在天上发亮
      if (skyMat.uniforms.cloudColor) skyMat.uniforms.cloudColor.value.copy(s.cloud);
    }
    if (scene.background && scene.background.isColor) scene.background.copy(s.skyMid);
    if (scene.fog) scene.fog.color.copy(s.skyMid);
    if (sun) {
      sun.color.copy(s.sunColor);
      sun.intensity = s.sunI;
    }
    if (ambient) ambient.intensity = s.ambientI;
    if (hemi) hemi.intensity = s.ambientI * 0.5;
    if (fill) fill.intensity = 0.28 * Math.min(1, s.ambientI / 0.9); // 薄荷补光随夜衰减
    for (const m of cloudMats) m.color.copy(s.cloud);
  }

  return { update, getPhase: () => phase, getCurrent: () => current };
}
