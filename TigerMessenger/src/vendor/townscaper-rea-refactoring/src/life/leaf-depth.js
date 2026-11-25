import * as THREE from 'three';
import { LEAF_SURFACE_GLSL, LEAF_NOISE_GLSL } from './leaf-surface.js';

/**
 * leaf-depth.js — 与叶状彩色材质「同源」的阴影深度材质（customDepthMaterial）。
 *
 * 依据：1205420678859632640 "alpha is view angle modulated by leaf texture mapped
 * to a sphere"。树冠网格开了 castShadow 后，默认 MeshDepthMaterial 不认片元里的
 * discard：影子是整团实心轮廓（叶隙不透光），而且风摆只在彩色着色器里、影子不
 * 跟着动。这里给树冠配一份和 swayMaterial 同公式的深度材质：
 *
 *   · 顶点：同样的 uTime 风摆位移（wp0 取实例原点、aTip² 权重）→ 影子随树一起摆。
 *   · 片元：同样的 leafPattern（共享 32² 图集）× leafCoverage，但「视角」换成
 *     阴影相机的视点——正交阴影相机下 cameraPosition − 片元世界坐标 ≈ 光方向，
 *     即「从太阳看过去的视角 alpha」。uLeafAtlasOn=0 时退回与彩色材质同式的
 *     旧噪声阈值（rim > 0.52 + 0.4·leaf）。
 *   · 彩色通道靠 alphaToCoverage 出软边；深度图没有 MSAA，leafCoverage < .5 硬
 *     裁掉（.5 恰好落在 leafCoverage 的 edge=0 轮廓线上，与彩色轮廓同一判据）。
 *
 * 近似边界：法线取世界空间 object normal（彩色通道用的是视图空间微扰法线），
 * 不做逐实例颜色/透明排序；灌木 / 草丛照旧不投影（vegetation.js 的既有取舍）。
 */

/**
 * @param {object} o
 * @param {{value:number}} o.uTime   与 swayMaterial 同一个 uniform 对象（风摆同步）
 * @param {{value:number}} o.uLeafy  叶状轮廓总开关（0 → 实心影子，与彩色实心模式一致）
 * @param {object} o.surface         makeLeafSurface() 结果（uniform/on 均绑定同一对象）
 * @param {THREE.Vector3} o.center   与 swayMaterial 同一个 uLeafCenter（树冠几何中心）
 * @param {number} o.amount          风摆幅度（与彩色材质一致；0 = 不摆）
 * @param {number} o.leafScale       旧噪声的空间频率（与彩色材质 leafScale 一致）
 */
export function makeLeafDepthMaterial({ uTime, uLeafy, surface, center, amount, leafScale }) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uLeafy = uLeafy;
    shader.uniforms.uLeafAtlas = surface?.uniform ?? { value: null };
    shader.uniforms.uLeafAtlasOn = surface?.on ?? { value: 0 };
    shader.uniforms.uLeafCenter = { value: center };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform vec3 uLeafCenter;
        attribute float aTip;
        varying vec3 vLeafSphere;
        varying vec3 vLeafP;
        varying vec3 vLeafN;
        varying vec3 vLeafW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLeafSphere = position - uLeafCenter;
        vLeafP = position * ${leafScale.toFixed(1)};
        // 风摆与 swayMaterial 同式（实例原点做相位、aTip² 权重）：影子跟着树摆
        vec3 wp0 = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sway = sin(uTime * 1.3 + wp0.x * 1.7 + wp0.z * 1.3) * 0.6 + sin(uTime * 2.1 + wp0.z * 2.3) * 0.4;
        transformed.x += sway * ${amount.toFixed(4)} * aTip * aTip;
        transformed.z += sway * ${(amount * 0.6).toFixed(4)} * aTip * aTip;
        vLeafN = mat3(modelMatrix) * mat3(instanceMatrix) * normal;
        vLeafW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLeafy;
        varying vec3 vLeafP;
        varying vec3 vLeafN;
        varying vec3 vLeafW;
        ${LEAF_NOISE_GLSL}
        ${LEAF_SURFACE_GLSL}`)   // vLeafSphere 由 LEAF_SURFACE_GLSL 声明，不能重复
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (uLeafy > 0.5) {
          // 阴影通道的「视角」= 阴影相机视点。正交光下所有光线平行，用相机 backward
          // 轴（viewMatrix 第三行，与 impostor.js 的 toCam 同口径）而不是逐片元方向。
          vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
          vec3 viewDir = isOrthographic ? back : normalize(cameraPosition - vLeafW);
          float facing = abs(dot(normalize(vLeafN), viewDir));
          if (uLeafAtlasOn > .5) {
            // 与彩色材质同一轮廓判据：leafCoverage 的 edge=0 → 覆盖 .5 处硬裁
            if (leafCoverage(facing, leafPattern(vLeafSphere)) < .5) discard;
          } else {
            float leaf = lnoise(vLeafP) * 0.65 + lnoise(vLeafP * 2.3) * 0.35;
            float rim = 1.0 - facing;
            if (rim > 0.52 + 0.4 * leaf) discard;   // 彩色材质旧噪声阈值同式
          }
        }`);
  };
  // 与 swayMaterial 同一族参数 → 同样的程序缓存键口径（避免不同摆幅/频率共用一份程序）
  m.customProgramCacheKey = () => `leaf-depth-${amount}-${leafScale}-${!!surface}`;
  return m;
}
