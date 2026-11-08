import {CLOUD_DRIFT_GLSL} from '../core/cloud-motion.js';
/**
 * impostor.js — 八方位 impostor（树林）+ 共用 impostor 的云。
 *
 * 依据：
 *   1849427564034498642 "octagonal impostors for these trees … a lot more stable when rotating the camera
 *     than all other billboard solutions I've tried"
 *     画面：球面上大片树林，每棵都是一团圆冠，转镜头时轮廓不跳。
 *   1852334860137849222 "A fluffy cloud shader. It is using the same impostors as the trees"
 *     画面：白色蓬松的云团成带状飘过岛屿上空，底部略灰。
 *   1593215065423245313 运行时从网格烘出精灵、放进动态图集 → 用 core/atlas.js 分配图集里的格子。
 *
 * 本地近似：八张水平视图不是由“octagonal”一词唯一确定的原算法。
 * 尚未复现原球面树卡几何/完整俯仰采样与原云材质。
 * 做法：
 *   烘焙：每种网格从水平方向 8 个方位（每 45°，仰角固定）各拍一张，放进图集里分配到的格子；
 *         白色材质 + 固定光照 → 图里存的是"明暗"，实例颜色在着色器里再乘上去（一套图给所有颜色的树用）。
 *   绘制：每棵树一个竖直的四边形（只绕 Y 轴朝向镜头）；按"镜头相对这棵树朝向的方位角"
 *         找相邻两个方位的图，按角度插值混合 —— 这就是比普通广告牌转镜头时稳定的原因。
 *   云：同一个烘焙器烘一团白色的"云团块"，实例放大很多、半透明边缘、沿风向慢慢飘。
 */

import * as THREE from 'three';
import { Atlas } from '../core/atlas.js';

const VIEWS = 8;
const CELL = 128;
const ELEV = 0.42;   // 烘焙仰角（弧度）：接近游戏镜头的俯角

export class ImpostorBaker {
  #allocations = new WeakMap();
  constructor(renderer, size = 1024) {
    this.renderer = renderer;
    this.atlas = new Atlas(size, size);
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
    // Mipmaps reduce minification flicker; finite padding cannot isolate every mip level.
    this.rt.texture.generateMipmaps = true;
    this.rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.size = size;
    this.cleared = false;
    this.clearScene = new THREE.Scene();
    this.clearCamera = new THREE.Camera();
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-0.6, 1.4, 0.8);
    this.scene.add(sun);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  }

  /**
   * 烘一种网格的 8 个方位，返回 { frames: [u0,v0,du,dv]×8, size: 世界尺寸, base: 底部偏移 }。
   */
  // 1593215065423245313: "add and remove sprite allotments at runtime".
  // Reserve the complete 8-view set before rendering; no partial slot leaks.
  bake(geometry, CELL = 128) {
    if(!Number.isSafeInteger(CELL)||CELL<=0)throw new RangeError('positive integer bake size required');
    geometry.computeBoundingBox();
    const bb=geometry.boundingBox,c=bb.getCenter(new THREE.Vector3()),ext=bb.getSize(new THREE.Vector3());
    const half=Math.max(ext.x,ext.y,ext.z)*.62;
    if(!Number.isFinite(half)||half<=0)throw new RangeError('nonempty finite geometry required');
    const slots=[];
    try {for(let k=0;k<VIEWS;k++){const slot=this.atlas.allocate(CELL+16,CELL+16);if(!slot)throw new Error('impostor 图集满了');slots.push(slot);}}
    catch(error){for(const slot of slots)this.atlas.free(slot);throw error;}
    const mesh=new THREE.Mesh(geometry,this.mat),cam=new THREE.OrthographicCamera(-half,half,half,-half,.01,half*8),frames=[];
    this.scene.add(mesh);
    try {
      this.#withTarget(()=>{
        const r=this.renderer;
        if(!this.cleared){this.rt.scissorTest=false;r.setRenderTarget(this.rt);r.setClearColor(0,0);r.clear(true,true,true);this.cleared=true;}
        for(let k=0;k<VIEWS;k++) {
          const slot=slots[k],x=slot.x+8,y=slot.y+8,a=k/VIEWS*Math.PI*2;
          cam.position.set(c.x+Math.sin(a)*Math.cos(ELEV)*half*4,c.y+Math.sin(ELEV)*half*4,c.z+Math.cos(a)*Math.cos(ELEV)*half*4);cam.lookAt(c);
          // Clear the whole allotment, including reused padding. Then draw inside.
          this.rt.viewport.set(slot.x,slot.y,slot.w,slot.h);this.rt.scissor.copy(this.rt.viewport);this.rt.scissorTest=true;
          r.setRenderTarget(this.rt);r.setClearColor(0,0);r.clear(true,true,true);
          this.rt.viewport.set(x,y,CELL,CELL);this.rt.scissor.copy(this.rt.viewport);r.setRenderTarget(this.rt);r.render(this.scene,cam);
          frames.push(x/this.size,y/this.size,CELL/this.size,CELL/this.size);
        }
      });
    } catch(error) {
      for(const slot of slots)this.atlas.free(slot);
      // Clean partially drawn regions, preserving every other live sprite.
      try{this.#clearSlots(slots)}catch{};
      throw error;
    } finally {this.scene.remove(mesh);}
    const baked={frames,size:half*2,center:c.clone()};this.#allocations.set(baked,slots);return baked;
  }
  #withTarget(fn) {
    const r=this.renderer,target=r.getRenderTarget(),face=r.getActiveCubeFace(),mip=r.getActiveMipmapLevel(),color=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha();
    const viewport=this.rt.viewport.clone(),scissor=this.rt.scissor.clone(),test=this.rt.scissorTest;
    try{return fn()}finally{this.rt.viewport.copy(viewport);this.rt.scissor.copy(scissor);this.rt.scissorTest=test;r.setRenderTarget(target,face,mip);r.setClearColor(color,alpha);}
  }
  #clearSlots(slots) {
    this.#withTarget(()=>{for(const slot of slots){this.rt.viewport.set(slot.x,slot.y,slot.w,slot.h);this.rt.scissor.copy(this.rt.viewport);this.rt.scissorTest=true;this.renderer.setRenderTarget(this.rt);this.renderer.setClearColor(0,0);this.renderer.clear(true,true,true);}
      // A render finalizes the RT mip chain after clears as well as draws.
      this.renderer.render(this.clearScene,this.clearCamera);});
  }
  /** Detach consumers before releasing: their UVs become available for reuse. */
  release(baked) {
    const slots=baked&&this.#allocations.get(baked);if(!slots)return false;
    this.#clearSlots(slots); // If GPU clearing fails, keep ownership for a retry.
    for(const slot of slots)this.atlas.free(slot);this.#allocations.delete(baked);return true;
  }

}

/**
 * 一组同种网格的 impostor 实例（树冠 / 云）。
 * 实例矩阵：平移 = 网格原点所在位置，Y 旋转 = 朝向，缩放 = 大小。
 */
export class ImpostorField {
  constructor(texture, baked, max, { cloud = false, horizon = false, uTime = { value: 0 }, uLight = { value: 1 } } = {}) {
    const g = new THREE.PlaneGeometry(1, 1);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.yaw = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    g.setAttribute('aColor', this.color);
    g.setAttribute('aYaw', this.yaw);
    this.depth = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1);
    g.setAttribute('aCloudDepth', this.depth);
    const fr = [];
    for (let i = 0; i < VIEWS; i++) fr.push(new THREE.Vector4(...baked.frames.slice(i * 4, i * 4 + 4)));
    this.material = new THREE.ShaderMaterial({
      transparent: cloud,
      depthWrite: !cloud,
      side: THREE.DoubleSide,
      uniforms: {
        uTex: { value: texture }, uFrames: { value: fr }, uSize: { value: baked.size },
        uCenter: { value: baked.center }, uTime, uLight,
        uOrbit: { value: new THREE.Vector3(0, 0, .002) },
        uDepthMotion: { value: 0 },
      },
      defines: { CLOUD: cloud ? 1 : 0, HORIZON: horizon ? 1 : 0, VIEWS },
      vertexShader: /* glsl */ `
        ${CLOUD_DRIFT_GLSL}
        attribute vec3 aColor;
        attribute float aYaw;
        attribute float aCloudDepth;
        uniform float uDepthMotion;
        uniform float uSize;
        uniform vec3 uCenter;
        uniform float uTime;
        uniform vec3 uOrbit;
        uniform vec4 uFrames[VIEWS];
        varying vec4 vF0;
        varying vec4 vF1;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vK;
        varying float vT;
        void main() {
          // 1849427564034498642: stability while rotating. Transform the
          // off-centre bake anchor with the actual instance and parent matrix.
          // Contract: positive uniform scale and Y rotations (cylindrical cards).
          mat4 im = modelMatrix * instanceMatrix;
          float s = length(im[0].xyz);
          vec3 center = (im * vec4(uCenter, 1.0)).xyz;
          #if CLOUD
          #if HORIZON
            // 1243228419162341379 "Some moody clouds": local continuous
            // ring drift, not an inferred original weather solver. No hard wrap
            // across the island; preserve distance from the World bounds centre.
            float depth = mix(1.0, max(1.0, aCloudDepth), uDepthMotion);
            float angle = uTime * uOrbit.z / depth;
            vec2 turn = normalize(vec2(cos(angle), sin(angle)));
            vec2 d = center.xz - uOrbit.xy;
            center.xz = uOrbit.xy + vec2(turn.x*d.x-turn.y*d.y,
                                         turn.y*d.x+turn.x*d.y);
          #else
            center.x += cloudDrift(uTime,aYaw);   // 沿风向慢慢飘，飘出去从另一边回来
          #endif
          #endif
          // Orthographic rays are parallel; camera position must not make
          // copies of one object select different views across the screen.
          vec3 back = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
          vec3 toCam = isOrthographic ? back : cameraPosition - center;
          vec2 hd = toCam.xz;
          if (length(hd) < 1e-6) hd = back.xz;
          if (length(hd) < 1e-6) hd = vec2(0.0, 1.0);
          vec3 hdir = vec3(hd.x, 0.0, hd.y) / length(hd);
          vec3 right = vec3(hdir.z, 0.0, -hdir.x);
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 p = center + (right * position.x + up * position.y) * uSize * s;
          // 镜头相对这棵树的方位角 → 第几张图（相邻两张按 t 混合）
          float parentYaw = atan(modelMatrix[2].x, modelMatrix[2].z);
          float az = atan(hdir.x, hdir.z) - aYaw - parentYaw;
          float f = mod(mod(az / 6.28318530718 * float(VIEWS), float(VIEWS)) + float(VIEWS), float(VIEWS));
          vK = floor(f);
          vT = f - vK;
          // 在顶点着色器里选好两张图（整块四边形都一样），片元里就能无条件采样
          // —— 在条件分支里采样会让 mip 级别的导数失效，云会一片片地闪（之前的"雪花点"就是这个）
          int k0 = int(vK), k1 = int(mod(vK + 1.0, float(VIEWS)));
          vF0 = uFrames[0]; vF1 = uFrames[0];
          for (int i = 0; i < VIEWS; i++) { if (i == k0) vF0 = uFrames[i]; if (i == k1) vF1 = uFrames[i]; }
          vUv = position.xy + 0.5;
          vCol = aColor;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
          #if CLOUD && HORIZON
            // Background clouds must stay behind opaque islands even when a
            // large billboard from the near side of the ring crosses the view.
            gl_Position.z = gl_Position.w * .9999;
          #endif
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uLight;
        varying vec4 vF0;
        varying vec4 vF1;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vK;
        varying float vT;
        void main() {
          vec4 a = texture2D(uTex, vF0.xy + vUv * vF0.zw);
          vec4 b = texture2D(uTex, vF1.xy + vUv * vF1.zw);
          vec4 c = mix(a, b, vT);
          #if CLOUD
            float alpha = smoothstep(0.05, 0.55, c.a) * 0.9;
            if (alpha < 0.02) discard;
            float lum = clamp(c.r / max(c.a, 0.05), 0.0, 1.0);    // 去掉"和透明黑混合"带来的暗边
            vec3 col = mix(vec3(0.8, 0.84, 0.9), vec3(1.0), lum) * vCol * uLight;   // vCol：阴云偏灰
            gl_FragColor = vec4(col, alpha);
          #else
            if (c.a < 0.5) discard;
            // 轮廓：alpha 边缘一圈墨色（和网格版团块的墨线一致）
            float ink = 1.0 - smoothstep(0.5, 0.75, c.a);
            vec3 col = c.rgb * vCol * uLight;
            col = mix(col, vec3(0.12, 0.13, 0.1), ink * 0.9);
            gl_FragColor = vec4(col, 1.0);
          #endif
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(g, this.material, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    if (cloud) this.mesh.renderOrder = 9;
  }

  set(i, matrix, color, yaw, depth = 1) {
    if(!Number.isFinite(depth)||depth<1)throw new RangeError('cloud depth must be finite and >=1');
    this.depth.setX(i, depth);
    this.mesh.setMatrixAt(i, matrix);
    if (color) this.color.setXYZ(i, color.r, color.g, color.b);
    this.yaw.setX(i, yaw);
  }

  commit(n) {
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.color.needsUpdate = true;
    this.yaw.needsUpdate = true;
    this.depth.needsUpdate = true;
  }
}

/** 云团块：许多球融成的扁平一团（烘一次，所有云共用）。 */
export function cloudGeometry() {
  const parts = [];
  const puffs = [[0, 0.5, 0, 0.55], [0.6, 0.42, 0.1, 0.42], [-0.62, 0.4, -0.05, 0.44], [0.25, 0.75, -0.1, 0.4], [-0.3, 0.72, 0.12, 0.38], [0.95, 0.32, -0.12, 0.3], [-0.95, 0.3, 0.1, 0.3]];
  for (const [x, y, z, r] of puffs) {
    const s = new THREE.IcosahedronGeometry(r, 2).toNonIndexed();
    s.scale(1, 0.8, 1);
    s.translate(x, y, z);
    parts.push(s);
  }
  const total = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++, o++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      pos.set([x, y, z], o * 3);
      const l = Math.hypot(x, (y - 0.5) * 1.6, z) || 1;
      nor.set([x / l, ((y - 0.5) * 1.6) / l + 0.25, z / l], o * 3);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
