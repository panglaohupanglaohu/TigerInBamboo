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
 * 第 55 批：bake({pitches}) 多俯仰行 + ImpostorField({sphere}) 球面卡片（视角 alpha × 球面叶隙）+ blobCloudGeometry 原云材质；
 * 默认仍是单仰角柱面卡（View 默认画面不变），由 view-post-extras.js 的 impostorpitch 开关切换。
 * 做法：
 *   烘焙：每种网格从水平方向 8 个方位（每 45°，仰角固定）各拍一张，放进图集里分配到的格子；
 *         白色材质 + 固定光照 → 图里存的是"明暗"，实例颜色在着色器里再乘上去（一套图给所有颜色的树用）。
 *   绘制：每棵树一个竖直的四边形（只绕 Y 轴朝向镜头）；按"镜头相对这棵树朝向的方位角"
 *         找相邻两个方位的图，按角度插值混合 —— 这就是比普通广告牌转镜头时稳定的原因。
 *   云：同一个烘焙器烘一团白色的"云团块"，实例放大很多、半透明边缘、沿风向慢慢飘。
 */

import * as THREE from 'three';
import { Atlas } from '../core/atlas.js';
import { foldedCard } from '../core/anchored-billboard.js';

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
  bake(geometry, CELL = 128, { pitches = [ELEV], vertexColors = false } = {}) {
    if(!Number.isSafeInteger(CELL)||CELL<=0)throw new RangeError('positive integer bake size required');
    // 第 55 批：多俯仰视图（REACode engine/impostor.js 只有一个仰角 0.32；1849427564034498642 的
    // 球面树林从高俯角看时单行八方位会"躺平"）。pitches = 仰角列表（弧度，升序），帧按 [俯仰行][方位] 排。
    if(!Array.isArray(pitches)||!pitches.length||pitches.length>4||!pitches.every((p,i)=>Number.isFinite(p)&&p>-.2&&p<1.5&&(i===0||p>pitches[i-1])))throw new RangeError('pitches must be 1-4 ascending elevations');
    const P=pitches.length;
    geometry.computeBoundingBox();
    const bb=geometry.boundingBox,c=bb.getCenter(new THREE.Vector3()),ext=bb.getSize(new THREE.Vector3());
    const half=Math.max(ext.x,ext.y,ext.z)*.62;
    if(!Number.isFinite(half)||half<=0)throw new RangeError('nonempty finite geometry required');
    const slots=[];
    try {for(let k=0;k<VIEWS*P;k++){const slot=this.atlas.allocate(CELL+16,CELL+16);if(!slot)throw new Error('impostor 图集满了');slots.push(slot);}}
    catch(error){for(const slot of slots)this.atlas.free(slot);throw error;}
    if(vertexColors&&!this.matVC)this.matVC=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true});
    const mesh=new THREE.Mesh(geometry,vertexColors?this.matVC:this.mat),cam=new THREE.OrthographicCamera(-half,half,half,-half,.01,half*8),frames=[];
    this.scene.add(mesh);
    try {
      this.#withTarget(()=>{
        const r=this.renderer;
        if(!this.cleared){this.rt.scissorTest=false;r.setRenderTarget(this.rt);r.setClearColor(0,0);r.clear(true,true,true);this.cleared=true;}
        for(let k=0;k<VIEWS*P;k++) {
          const slot=slots[k],x=slot.x+8,y=slot.y+8,a=(k%VIEWS)/VIEWS*Math.PI*2,el=pitches[Math.floor(k/VIEWS)];
          cam.position.set(c.x+Math.sin(a)*Math.cos(el)*half*4,c.y+Math.sin(el)*half*4,c.z+Math.cos(a)*Math.cos(el)*half*4);cam.lookAt(c);
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
    const baked={frames,size:half*2,center:c.clone(),pitches:pitches.slice()};this.#allocations.set(baked,slots);return baked;
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
  constructor(texture, baked, max, { cloud = false, horizon = false, uTime = { value: 0 }, uLight = { value: 1 }, sphere = false } = {}) {
    const P = baked.pitches?.length || 1;
    // REACode engine/impostor.js `bend`: a centre vertex pushed toward the camera (shared with
    // shrubcard / 1191990107785572352). position.z marks it; trees bend 0.06, clouds stay flat.
    const card = foldedCard({ width: 1, height: 1, depth: 1 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(card.positions, 3));
    g.setIndex(card.index);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.yaw = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    g.setAttribute('aColor', this.color);
    g.setAttribute('aYaw', this.yaw);
    this.depth = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1);
    g.setAttribute('aCloudDepth', this.depth);
    const fr = [];
    for (let i = 0; i < VIEWS * P; i++) fr.push(new THREE.Vector4(...baked.frames.slice(i * 4, i * 4 + 4)));
    const pitchU = [...(baked.pitches || [ELEV])]; while (pitchU.length < 4) pitchU.push(pitchU[pitchU.length - 1] + 1);
    this.material = new THREE.ShaderMaterial({
      transparent: cloud,
      depthWrite: !cloud,
      side: THREE.DoubleSide,
      uniforms: {
        uTex: { value: texture }, uFrames: { value: fr }, uSize: { value: baked.size },
        uCenter: { value: baked.center }, uTime, uLight,
        uOrbit: { value: new THREE.Vector3(0, 0, .002) },
        uDepthMotion: { value: 0 },
        uBend: { value: cloud ? 0 : .06 },
        uPitch: { value: new THREE.Vector4(...pitchU) },
      },
      defines: { CLOUD: cloud ? 1 : 0, HORIZON: horizon ? 1 : 0, VIEWS, PITCHES: P, NFRAMES: VIEWS * P, SPHERE: sphere ? 1 : 0 },
      vertexShader: /* glsl */ `
        ${CLOUD_DRIFT_GLSL}
        attribute vec3 aColor;
        attribute float aYaw;
        attribute float aCloudDepth;
        uniform float uDepthMotion;
        uniform float uBend;
        uniform float uSize;
        uniform vec3 uCenter;
        uniform float uTime;
        uniform vec3 uOrbit;
        uniform vec4 uFrames[NFRAMES];
        uniform vec4 uPitch;
        varying vec4 vF0;
        varying vec4 vF1;
        varying vec4 vF2;
        varying vec4 vF3;
        varying float vTp;
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
          #if SPHERE
            // 球面卡片：卡片整张朝向镜头（不只绕 Y），从高处往下看时不再是一张竖板
            vec3 vdir = normalize(length(toCam) > 1e-6 ? toCam : back);
            up = normalize(cross(vdir, right));
            vec3 p = center + (right * position.x + up * position.y + vdir * position.z * uBend) * uSize * s;
          #else
            vec3 p = center + (right * position.x + up * position.y + hdir * position.z * uBend) * uSize * s;
          #endif
          // 镜头相对这棵树的方位角 → 第几张图（相邻两张按 t 混合）
          float parentYaw = atan(modelMatrix[2].x, modelMatrix[2].z);
          float az = atan(hdir.x, hdir.z) - aYaw - parentYaw;
          float f = mod(mod(az / 6.28318530718 * float(VIEWS), float(VIEWS)) + float(VIEWS), float(VIEWS));
          vK = floor(f);
          vT = f - vK;
          // 在顶点着色器里选好两张图（整块四边形都一样），片元里就能无条件采样
          // —— 在条件分支里采样会让 mip 级别的导数失效，云会一片片地闪（之前的"雪花点"就是这个）
          int k0 = int(vK), k1 = int(mod(vK + 1.0, float(VIEWS)));
          // 多俯仰：镜头仰角落在哪两行之间（行内同样两张方位图），四张双线性混合
          float el = atan(toCam.y, max(1e-5, length(toCam.xz)));
          int row = 0; vTp = 0.0;
          #if PITCHES > 1
            for (int r = 0; r < PITCHES - 1; r++) { if (el >= uPitch[r]) row = r; }
            vTp = clamp((el - uPitch[row]) / max(1e-4, uPitch[row + 1] - uPitch[row]), 0.0, 1.0);
          #endif
          int r0 = row * VIEWS, r1 = min(row + 1, PITCHES - 1) * VIEWS;
          vF0 = uFrames[0]; vF1 = uFrames[0]; vF2 = uFrames[0]; vF3 = uFrames[0];
          for (int i = 0; i < NFRAMES; i++) {
            if (i == r0 + k0) vF0 = uFrames[i]; if (i == r0 + k1) vF1 = uFrames[i];
            if (i == r1 + k0) vF2 = uFrames[i]; if (i == r1 + k1) vF3 = uFrames[i];
          }
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
        varying vec4 vF2;
        varying vec4 vF3;
        varying float vTp;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vK;
        varying float vT;
        float leafHash(vec2 p) { return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec4 a = texture2D(uTex, vF0.xy + vUv * vF0.zw);
          vec4 b = texture2D(uTex, vF1.xy + vUv * vF1.zw);
          vec4 c = mix(a, b, vT);
          #if PITCHES > 1
            vec4 a2 = texture2D(uTex, vF2.xy + vUv * vF2.zw);
            vec4 b2 = texture2D(uTex, vF3.xy + vUv * vF3.zw);
            c = mix(c, mix(a2, b2, vT), vTp);
          #endif
          #if SPHERE && !CLOUD
            // 1205420678859632640 "alpha is view angle modulated by leaf texture mapped to a sphere"（REACode engine/impostor.js）：
            // 卡片当成球的正面，z = 视线夹角余弦；同一球坐标（经度, 半径）采样叶隙噪声 → 方角削圆、边上出叶隙
            vec2 cp = vUv - .5; float rr = length(cp) * 2.; float zz = sqrt(max(0., 1. - rr * rr));
            float lon = atan(cp.y, cp.x) / 6.2831853 + .5;
            float leaf = mix(leafHash(vec2(lon * 18., rr * 6.)), leafHash(vec2(lon * 18. + 7., rr * 6. + 3.)), .5);
            c.a *= mix(1., smoothstep(.02, .42, zz), .6) * mix(1., smoothstep(.12, .5, leaf + (1. - rr) * .55), .85);
          #endif
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

/**
 * 第 55 批：REACode engine/impostor.js 的原云材质 —— makeBlobCloud（5 个压扁二十面体一字排开）+ bakeLitColors
 * （固定世界光 (0.45,0.82,0.35) 的 Lambert × 底部压暗 0.22 × 顶部提亮 0.16，暖白 #f2f0ea），光照烘进顶点色，
 * 所以云在镜头转动时亮度不跳。尺寸归一到与 cloudGeometry() 同量级（宽 ~2.4）。烘焙时用 bake(..., {vertexColors:true})。
 */
export function blobCloudGeometry(seed = 1, { size = 1.1, tint = '#f2f0ea' } = {}) {
  let s = seed * 7919 + 104729;
  const rnd = () => ((s = (s * 7919 + 104729) % 233280) / 233280);
  const L = new THREE.Vector3(0.45, 0.82, 0.35).normalize(), base = new THREE.Color(tint), height = size * .7;
  const pos = [], nor = [], col = [];
  for (let i = 0; i < 5; i++) {
    const r = size * (0.30 + rnd() * 0.16);
    const g = new THREE.IcosahedronGeometry(r, 1).toNonIndexed();
    g.scale(1.25, 0.72, 1.15);
    g.translate((i / 4 - 0.5) * size * 1.15, (rnd() - 0.5) * size * 0.16 + size * .4, (rnd() - 0.5) * size * 0.35);
    g.computeVertexNormals();
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let k = 0; k < p.count; k++) {
      const lam = Math.max(0, n.getX(k) * L.x + n.getY(k) * L.y + n.getZ(k) * L.z), y = Math.min(1, Math.max(0, p.getY(k) / Math.max(height, 1e-3)));
      const sh = (0.52 + 0.48 * lam) * (1 - 0.22 * (1 - y)) * (1 + 0.16 * y);
      pos.push(p.getX(k), p.getY(k), p.getZ(k)); nor.push(n.getX(k), n.getY(k), n.getZ(k)); col.push(base.r * sh, base.g * sh, base.b * sh);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
