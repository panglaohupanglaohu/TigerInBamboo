import {CLOUD_DRIFT_GLSL,CLOUD_WIND_BOB_GLSL} from '../core/cloud-motion.js';
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
 *   图集：整组预留 8 方位 × 俯仰行的格子；满板时按 REACode SpriteAtlas.insert 语义自动翻倍、
 *         所有存活槽整批重排（core/atlas.js repack），GPU 侧原位放大 render target 并逐槽搬运像素，
 *         存活烘焙的 frames 就地改写、注册的 ImpostorField 同步 uFrames；扩容失败回滚到扩容前状态。
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
  #allocations = new WeakMap();   // baked -> entry {baked, slots, cell}
  #entries = new Set();         // 槽位仍在图集里的全部烘焙（未 release 的都算存活）
  #fields = new Set();          // track() 注册的消费方，扩容后 syncFrames()
  constructor(renderer, size = 1024, { maxSize = 8192 } = {}) {
    this.renderer = renderer;
    this.atlas = new Atlas(size, size);
    if (!Number.isSafeInteger(maxSize) || maxSize < size) throw new RangeError('maxSize must be an integer >= size');
    this.maxSize = maxSize;
    this.growths = 0;
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
    // Mipmaps reduce minification flicker; finite padding cannot isolate every mip level.
    this.rt.texture.generateMipmaps = true;
    this.rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.size = size;
    this.cleared = false;
    // 扩容像素搬运用的整屏 quad 场景（userData 标记给测试/诊断识别）
    this.blitScene = new THREE.Scene();
    this.blitScene.userData.atlasBlit = true;
    this.blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
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
    // 自动扩容/重排（REACode SpriteAtlas.insert 语义：满了就翻倍重插）：整组预留失败 →
    // #grow() 翻倍重排+搬运像素后整组重试，直到 maxSize；扩不动仍抛"图集满了"。
    if(CELL+16>this.maxSize)throw new Error('impostor 图集满了');   // 永远放不下的尺寸不触发无谓扩容
    let slots=this.#reserve(VIEWS*P,CELL+16);
    while(!slots){this.#grow();slots=this.#reserve(VIEWS*P,CELL+16);}
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
    const baked={frames,size:half*2,center:c.clone(),pitches:pitches.slice()};
    const entry={baked,slots,cell:CELL};this.#allocations.set(baked,entry);this.#entries.add(entry);return baked;
  }
  /** 整组预留 count 个 extent² 槽；中途失败全数归还，返回 null。 */
  #reserve(count,extent) {
    const slots=[];
    for(let k=0;k<count;k++){const slot=this.atlas.allocate(extent,extent);if(!slot){for(const s of slots)this.atlas.free(s);return null;}slots.push(slot);}
    return slots;
  }
  /**
   * 扩容：REACode SpriteAtlas「满了就放大一倍、所有 allotment 重插」（atlas.repack 同语义、确定性排序）。
   * GPU 半边：旧 RT 先整页备份到同尺寸 scratch，再 this.rt.setSize 原位放大——rt 与 rt.texture
   * 对象不变，已发给各 ImpostorField 的 uTex、页面里的 material.map 都不用重绑；然后按 repack 的
   * moved 映射把每个存活槽从 scratch 拷到新位置。最后一次性提交图集/槽位/frames 并 sync 注册的 Field。
   * 回滚：repack 不动旧图集，resize 之前失败 = 零副作用；resize 之后失败尽力把 scratch 按旧位置
   * 拷回，无论成败都抛出且 atlas/slots/frames 保持扩容前状态。
   */
  #grow() {
    let plan=null,newSize=0;
    for(let s=this.size*2;s<=this.maxSize;s*=2){plan=this.atlas.repack(s,s);if(plan){newSize=s;break;}}
    if(!plan)throw new Error('impostor 图集满了');
    const oldSize=this.size,r=this.renderer,prev=r.getRenderTarget(),face=r.getActiveCubeFace(),mip=r.getActiveMipmapLevel();
    const live=this.#entries.size>0,scratch=live?new THREE.WebGLRenderTarget(oldSize,oldSize,{depthBuffer:false}):null;
    try {
      if(live){const full={x:0,y:0,w:oldSize,h:oldSize};this.#blit(this.rt.texture,[{from:full,to:full}],oldSize,scratch);}
      this.rt.setSize(newSize,newSize);
      try {
        this.#clearTarget(this.rt);
        if(live)this.#blit(scratch.texture,[...plan.moved].map(([from,to])=>({from,to})),oldSize,this.rt);
      } catch(copyError) {
        // 像素已丢不得不管：尽力缩回去并按旧位置复原，再照样抛出（bookkeeping 未提交，保持一致）。
        if(live)try{this.rt.setSize(oldSize,oldSize);this.#clearTarget(this.rt);this.#blit(scratch.texture,[...plan.moved.keys()].map(f=>({from:f,to:f})),oldSize,this.rt);}catch{}
        throw copyError;
      }
    } finally {if(scratch)scratch.dispose();r.setRenderTarget(prev,face,mip);}
    this.atlas=plan.atlas;this.size=newSize;this.cleared=true;this.growths++;
    for(const e of this.#entries){e.slots=e.slots.map(s=>plan.moved.get(s));const fr=e.baked.frames,c=e.cell;
      for(let i=0;i<e.slots.length;i++){const s=e.slots[i];fr[i*4]=(s.x+8)/newSize;fr[i*4+1]=(s.y+8)/newSize;fr[i*4+2]=c/newSize;fr[i*4+3]=c/newSize;}}
    for(const f of this.#fields)f.syncFrames();
  }
  /** 整屏 quad 采 source 的 from 矩形，viewport+scissor 钉到 target 的 to 矩形（同 sprite-pack-c09 的搬运法）。 */
  #blit(texture,pairs,srcSize,target) {
    const r=this.renderer,geo=new THREE.PlaneGeometry(2,2),uv=geo.getAttribute('uv');
    const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,blending:THREE.NoBlending,depthTest:false}),quad=new THREE.Mesh(geo,mat);
    this.blitScene.add(quad);
    try {
      for(const {from,to} of pairs) {
        const u0=from.x/srcSize,u1=(from.x+from.w)/srcSize,v0=from.y/srcSize,v1=(from.y+from.h)/srcSize;
        uv.setXY(0,u0,v1);uv.setXY(1,u1,v1);uv.setXY(2,u0,v0);uv.setXY(3,u1,v0);uv.needsUpdate=true;
        target.viewport.set(to.x,to.y,to.w,to.h);target.scissor.copy(target.viewport);target.scissorTest=true;
        r.setRenderTarget(target);r.render(this.blitScene,this.blitCam);
      }
    } finally {
      this.blitScene.remove(quad);geo.dispose();mat.dispose();
      target.scissorTest=false;target.viewport.set(0,0,target.width,target.height);target.scissor.copy(target.viewport);
    }
  }
  #clearTarget(rt) {
    const r=this.renderer,color=r.getClearColor(new THREE.Color()),alpha=r.getClearAlpha();
    rt.scissorTest=false;rt.viewport.set(0,0,rt.width,rt.height);rt.scissor.copy(rt.viewport);
    try{r.setRenderTarget(rt);r.setClearColor(0,0);r.clear(true,true,true);}finally{r.setClearColor(color,alpha);}
  }
  /** 注册消费方：扩容重排后 baker 改写 baked.frames 并调 field.syncFrames()；untrack 解除。 */
  track(field){this.#fields.add(field);return field;}
  untrack(field){this.#fields.delete(field);}
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
  /** 1593215065423245313 残差：原调试画面删掉精灵后槽位留暗淡残影，不是清透明。与 sprite-pack-c09 同参数——RGBA 乘 0.38（opacity .62 的乘性混合）。 */
  #dimSlots(slots) {
    if(!this._dim){this._dimScene=new THREE.Scene();this._dimCam=new THREE.OrthographicCamera(-1,1,1,-1,-1,1);
      this._dim=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.62,depthTest:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.ZeroFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor}));
      this._dimScene.add(this._dim);}
    this.#withTarget(()=>{for(const slot of slots){this.rt.viewport.set(slot.x,slot.y,slot.w,slot.h);this.rt.scissor.copy(this.rt.viewport);this.rt.scissorTest=true;this.renderer.setRenderTarget(this.rt);const ac=this.renderer.autoClear;this.renderer.autoClear=false;try{this.renderer.render(this._dimScene,this._dimCam);}finally{this.renderer.autoClear=ac;}}});
  }
  /** Detach consumers before releasing: their UVs become available for reuse.
   *  residue=true 时槽位留 ×0.38 压暗残影（sprite-pack-c09 同口径的调试残影），否则清透明。 */
  release(baked, { residue = false } = {}) {
    const entry=baked&&this.#allocations.get(baked);if(!entry)return false;
    if(residue)this.#dimSlots(entry.slots);else this.#clearSlots(entry.slots); // If GPU op fails, keep ownership for a retry.
    for(const slot of entry.slots)this.atlas.free(slot);this.#allocations.delete(baked);this.#entries.delete(entry);return true;
  }

}

/**
 * 一组同种网格的 impostor 实例（树冠 / 云）。
 * 实例矩阵：平移 = 网格原点所在位置，Y 旋转 = 朝向，缩放 = 大小。
 */
export class ImpostorField {
  constructor(texture, baked, max, { cloud = false, horizon = false, uTime = { value: 0 }, uLight = { value: 1 }, sphere = false, baker = null, windAmt = 0, cloudParallax = 0 } = {}) {
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
        uWindAmt: { value: windAmt },
        uCloudParallax: { value: cloudParallax },
        uBend: { value: cloud ? 0 : .06 },
        uPitch: { value: new THREE.Vector4(...pitchU) },
      },
      defines: { CLOUD: cloud ? 1 : 0, HORIZON: horizon ? 1 : 0, VIEWS, PITCHES: P, NFRAMES: VIEWS * P, SPHERE: sphere ? 1 : 0 },
      vertexShader: /* glsl */ `
        ${CLOUD_DRIFT_GLSL}
        ${CLOUD_WIND_BOB_GLSL}
        attribute vec3 aColor;
        attribute float aYaw;
        attribute float aCloudDepth;
        uniform float uDepthMotion;
        uniform float uWindAmt;
        uniform float uCloudParallax;
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
            // 1852334860137849222 前景云层次：aCloudDepth×uCloudParallax 得 cd，外层云的漂移与
            // 起伏同除 cd（clouddeck「v ∝ 1/depth」同口径）；parallax=0 时 /1.0 逐位等同旧行为。
            float cd = mix(1.0, max(1.0, aCloudDepth), uCloudParallax);
            center.x += cloudDrift(uTime,aYaw) / cd;   // 沿风向慢慢飘，飘出去从另一边回来
            // REACode engine/impostor.js 的云风材质（uWindAmt：树 0 / 云 0.6）：相位取实例位置，
            // 三轴异频起伏，整圈云不一块板一起滑。
            center += cloudWindBob(uTime, im[3].xyz, uWindAmt) / cd;
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
    // 图集扩容重排时 baker 调 syncFrames()：uFrames 就地改写即随下次渲染上传。
    this.baked = baked; this.framesAttr = fr;
    if (baker) baker.track(this);
  }

  /** 扩容/重排后把 baked.frames 的最新 UV 写回 uFrames 各 Vector4。 */
  syncFrames() { for (let i = 0; i < this.framesAttr.length; i++) this.framesAttr[i].fromArray(this.baked.frames, i * 4); }

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
