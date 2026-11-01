/**
 * outline.js — 描边 + 逆光亮边（两层"反向外壳"）。
 *
 * 依据：
 *   1751945034851570056 "Some nice new highlights when the island is backlit. Achieved by simply
 *     adding another inverted mesh outline layer that shows up when looking into the sun.
 *     And masked by shadows, of course."
 *   画面：第三个项目里所有轮廓都有一条细的深色墨线；镜头朝着太阳时，迎光一侧轮廓外再多一道暖亮边。
 *
 * 做法：同一份几何体画两次，只画背面（BackSide），顶点沿 aOutline（同一位置所有面法线的平均）
 * 在裁剪空间里外扩固定像素宽度 —— 远近一样粗。
 *   ink  墨线，深色，约 1.4 px
 *   rim  逆光亮边，更宽（约 3 px），画在墨线外侧；强度 = 镜头朝向与太阳方向的夹角
 *        × 该点法线背向太阳的程度（只在剪影上、迎光的那一侧出现）
 * "masked by shadows"：这里用法线朝下 / 朝里的程度近似（没有单独查阴影贴图）。
 */

import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec3 aOutline;
uniform vec2 uRes;
uniform float uWidth;
uniform vec3 uSun;        // 指向太阳的单位向量（世界空间）
uniform vec3 uCamDir;     // 相机朝向（世界空间）
varying float vRim;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * viewMatrix * wp;
  vec3 wn = normalize(mat3(modelMatrix) * aOutline);
  vec4 clipN = projectionMatrix * viewMatrix * vec4(wp.xyz + wn * 0.05, 1.0);
  vec2 dir = clipN.xy / clipN.w - clip.xy / clip.w;
  float l = length(dir);
  dir = l > 1e-6 ? dir / l : vec2(0.0);
  clip.xy += dir * uWidth * 2.0 / uRes * clip.w;
  clip.z += 0.00002 * clip.w;   // 往后推一点，避免和本体抢深度
  // 逆光：镜头看向太阳（camDir 与 sun 反向越多越亮） × 法线背离镜头且偏向太阳
  float into = clamp(dot(-uCamDir, -uSun) * 1.0, 0.0, 1.0);          // 1 = 正对太阳
  float facing = clamp(dot(wn, uSun) * 0.8 + 0.35, 0.0, 1.0);         // 迎光一侧
  float lit = clamp(wn.y * 0.6 + 0.6, 0.0, 1.0);                      // 朝下的面视为在阴影里
  vRim = into * facing * lit;
  gl_Position = clip;
}`;

const FRAG_INK = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor, uOpacity); }`;

const FRAG_RIM = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
varying float vRim;
void main() {
  float a = smoothstep(0.08, 0.6, vRim) * uStrength;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}`;

export class OutlineLayers {
  constructor(geometry) {
    const common = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uCamDir: { value: new THREE.Vector3(0, 0, -1) },
    };
    this.common = common;
    this.inkMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_INK, side: THREE.BackSide, transparent: true,
      uniforms: { ...common, uWidth: { value: 1.4 }, uColor: { value: new THREE.Color('#2a2622') }, uOpacity: { value: 0.85 } },
    });
    this.rimMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG_RIM, side: THREE.BackSide, transparent: true, depthWrite: false,
      uniforms: { ...common, uWidth: { value: 3.2 }, uColor: { value: new THREE.Color('#fff1c8') }, uStrength: { value: 1.0 } },
    });
    this.ink = new THREE.Mesh(geometry, this.inkMat);
    this.rim = new THREE.Mesh(geometry, this.rimMat);
    this.rim.renderOrder = -1;            // 先画亮边，墨线压在它里侧
    this.ink.frustumCulled = this.rim.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.rim, this.ink);
  }

  setGeometry(g) { this.ink.geometry = g; this.rim.geometry = g; }

  set inkVisible(on) { this.ink.visible = on; }
  set rimVisible(on) { this.rim.visible = on; }

  /** 每帧：分辨率、太阳方向、相机朝向。 */
  update(renderer, camera, sunDir) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.common.uRes.value.copy(size);
    // 1017355723171344385 "thicker outlines for all you 4k high ballers"：线宽按像素比 × 分辨率（以 1080 高为基准）放大，再乘可调的粗细
    const px = renderer.getPixelRatio() * Math.max(1, size.y / renderer.getPixelRatio() / 1080) * (this.thickness ?? 1);
    this.inkMat.uniforms.uWidth.value = 1.4 * px;
    this.rimMat.uniforms.uWidth.value = 3.2 * px;
    this.common.uSun.value.copy(sunDir).normalize();
    camera.getWorldDirection(this.common.uCamDir.value);
  }

  /** 时段：夜里墨线淡一点，亮边换成月光色。 */
  setTimeOfDay(mode) {
    this.inkMat.uniforms.uOpacity.value = mode === 'night' ? 0.55 : 0.85;
    this.rimMat.uniforms.uColor.value.set(mode === 'night' ? '#bcd0ff' : mode === 'dusk' ? '#ffd2a0' : '#fff1c8');
    this.rimMat.uniforms.uStrength.value = mode === 'night' ? 0.5 : 1.0;
  }
}
