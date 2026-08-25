// =====================================================================
//  V5 光照 · LightingDirector（PLAN.md 第九章 9.4）
//  全项目唯一提交全局灯 / renderer exposure / 雾 / 天空 uniforms 的入口。
//  结构迁移自已验证样片 oskLightingPrototype.js：
//    一个太阳 key + 一个天空/地面 hemisphere fill + 低 ambient floor；
//    shadow fit / padding / near-far 收紧 / texel snapping。
//  开关 ?oskLightingV1=1：关闭时 rig 隐藏、旧四灯与渲染器设置逐字节恢复，
//  天空球 rotation.y = π/2 的主人裁决本模块从不触碰。
//  K7：freeze（冻结光照状态）、调试视图模式（debugViewMode.js，TODO 572/573）、
//  webglcontextlost/restored（lost 挂起阴影更新，restored 强制 shadow 全量
//  refit；各报一次结构化 console.warn，TODO 577）。
// =====================================================================
import * as THREE from "three";
import { composeLightingState, lightingWeatherName } from "./lightingState.js";
import { setLightingDebugViewMode, getLightingDebugViewMode } from "./debugViewMode.js";

const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _centroid = new THREE.Vector3();
const _size = new THREE.Vector3();
const _corner = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _cTmp = new THREE.Color();

function lightSpaceBounds(box, shadowCamera) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        _corner.set(x, y, z).applyMatrix4(shadowCamera.matrixWorldInverse);
        minX = Math.min(minX, _corner.x);
        minY = Math.min(minY, _corner.y);
        minZ = Math.min(minZ, _corner.z);
        maxX = Math.max(maxX, _corner.x);
        maxY = Math.max(maxY, _corner.y);
        maxZ = Math.max(maxZ, _corner.z);
      }
    }
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/**
 * @param {object} deps
 *   { scene, renderer, skyMat,
 *     legacy: { ambient, hemi, sun, fill },   // environment.js 旧四灯
 *     shadowMapSize?: 2048 }
 */
export function createLightingDirector({ scene, renderer, skyMat = null, legacy = {}, shadowMapSize = 2048 } = {}) {
  if (!scene || !renderer) throw new Error("lighting director requires scene and renderer");

  const legacyLights = [legacy.ambient, legacy.hemi, legacy.sun, legacy.fill].filter(Boolean);
  const legacyRenderer = {
    shadowEnabled: renderer.shadowMap.enabled,
    shadowType: renderer.shadowMap.type,
    toneMapping: renderer.toneMapping,
    exposure: renderer.toneMappingExposure,
    outputColorSpace: renderer.outputColorSpace,
  };
  const legacyBackground = scene.background?.isColor ? scene.background.clone() : null;
  const legacyFogColor = scene.fog?.color?.isColor ? scene.fog.color.clone() : null;
  const legacyFogDensity = scene.fog?.density ?? null;
  const legacySky = skyMat
    ? {
        top: skyMat.uniforms.topColor?.value?.clone(),
        mid: skyMat.uniforms.midColor?.value?.clone(),
        bot: skyMat.uniforms.botColor?.value?.clone(),
        cloud: skyMat.uniforms.cloudColor?.value?.clone(),
      }
    : null;

  // ---------- V5 rig：一个太阳 key + 一个 hemi fill + 低 ambient floor ----------
  const root = new THREE.Group();
  root.name = "osk-lighting-v5";
  root.visible = false;
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xffffff, 0.25);
  ambient.name = "osk-v5-ambient-floor";
  root.add(ambient);

  const hemi = new THREE.HemisphereLight(0xd8f2ef, 0xb6a790, 0.96);
  hemi.name = "osk-v5-sky-ground-fill";
  root.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe2b9, 1.7);
  sun.name = "osk-v5-key-sun";
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.025;
  root.add(sun);
  root.add(sun.target);

  let enabled = false;
  let focusTargets = []; // 阴影焦点对象集合（城堡/玩家/木马/关键战斗单位），取包围盒并集
  let lastFit = null;
  let lastFitReason = "init";
  let lastFitDir = new THREE.Vector3(1, 0, 0);
  let lastFitCentroid = new THREE.Vector3(Infinity, 0, 0); // 焦点质心代理（移动检测用）
  let shadowHelper = null; // shadow coverage 调试视图（CameraHelper）
  let trims = { sunMul: 1, ambientMul: 1 };
  let moebiusFactor = 0;
  // K4 闪电短时 override：只叠加在合成结果上，不触碰主题表与旧灯；
  // 攻击快（tau 0.06s）、恢复慢（tau 1.1s），雷暴结束后平滑回基线
  let lightningTarget = 0;
  let lightningSmooth = 0;
  // 平滑状态（smoothLighting）：数值向目标一阶逼近
  let smoothed = null;
  // K7 freeze：冻结光照状态（面板调试；冻结时 update 完全 no-op）
  let frozen = false;
  // K7-577 context loss：lost 挂起阴影/状态更新（不抛异常），restored 后
  // 下一帧强制 shadow 全量 refit + 平滑状态重建；结构化 warn 只报一次
  let contextLost = false;
  let contextRebuildPending = false;
  let contextWarned = false;

  function onContextLost() {
    if (contextLost) return;
    contextLost = true;
    if (!contextWarned) {
      contextWarned = true;
      console.warn("[v5-lighting] webglcontextlost", {
        code: "V5_CONTEXT_LOST",
        scope: "lightingDirector",
        action: "suspend-shadow-updates",
      });
    }
  }

  function onContextRestored() {
    if (!contextLost) return;
    contextLost = false;
    contextRebuildPending = true; // 下次 update 做完整重建（fitShadow refit + 平滑重置）
  }

  // 监听挂在渲染 canvas 上（Three WebGLRenderer.domElement）；无 DOM 环境（Node 单测
  // 的 mock renderer）静默跳过，处理器同时经返回值暴露供测试直调。
  const contextCanvas = renderer.domElement;
  if (contextCanvas?.addEventListener) {
    contextCanvas.addEventListener("webglcontextlost", onContextLost);
    contextCanvas.addEventListener("webglcontextrestored", onContextRestored);
  }

  function unionFocusBox() {
    _box.makeEmpty();
    let any = false;
    for (const target of focusTargets) {
      if (!target) continue;
      target.updateWorldMatrix?.(true, true);
      const b = new THREE.Box3().setFromObject(target);
      if (b.isEmpty()) continue;
      _box.union(b);
      any = true;
    }
    return any ? _box : null;
  }

  // 轻量焦点质心：只取各目标根节点的世界位置（不深遍历），供每帧移动检测用
  function focusCentroid(out) {
    out.set(0, 0, 0);
    let n = 0;
    for (const target of focusTargets) {
      if (!target) continue;
      target.getWorldPosition(_corner);
      out.add(_corner);
      n++;
    }
    if (!n) return null;
    out.multiplyScalar(1 / n);
    return out;
  }

  /**
   * 阴影拟合：focus 包围盒并集 → 光空间 bounds → padding 1.16 → near/far 收紧
   * → texel snapping（中心对齐纹素网格，相机缓慢平移时阴影不游泳）。
   */
  function fitShadow(direction, reason = "refit") {
    const box = unionFocusBox();
    if (!box) return null;
    box.getCenter(_center);
    box.getSize(_size);
    const radius = Math.max(_size.length() * 0.5, 1);

    sun.target.position.copy(_center);
    sun.position.copy(_center).addScaledVector(direction, radius * 3.2);
    sun.target.updateMatrixWorld(true);
    sun.updateMatrixWorld(true);
    sun.shadow.updateMatrices(sun);

    const bounds = lightSpaceBounds(_box, sun.shadow.camera);
    const padding = 1.16;
    const width = Math.max((bounds.maxX - bounds.minX) * padding, 1);
    const height = Math.max((bounds.maxY - bounds.minY) * padding, 1);
    const span = Math.max(width, height);
    const texel = span / shadowMapSize;
    const centerX = Math.round(((bounds.minX + bounds.maxX) * 0.5) / texel) * texel;
    const centerY = Math.round(((bounds.minY + bounds.maxY) * 0.5) / texel) * texel;
    const cam = sun.shadow.camera;
    cam.left = centerX - span * 0.5;
    cam.right = centerX + span * 0.5;
    cam.bottom = centerY - span * 0.5;
    cam.top = centerY + span * 0.5;
    cam.near = Math.max(0.1, -bounds.maxZ - radius * 0.2);
    cam.far = Math.max(cam.near + 1, -bounds.minZ + radius * 0.2);
    cam.updateProjectionMatrix();

    lastFit = Object.freeze({
      span,
      texel,
      near: cam.near,
      far: cam.far,
      center: _center.toArray(),
      sunDirection: direction.toArray(),
      reason,
    });
    lastFitReason = reason;
    lastFitDir.copy(direction);
    if (focusCentroid(_centroid)) lastFitCentroid.copy(_centroid);
    if (shadowHelper) shadowHelper.update();
    return lastFit;
  }

  /** 仅当太阳方向偏 >2° 或焦点质心移动超过 1.5 纹素时才重拟合（避免每帧重算） */
  function maybeRefit(direction) {
    if (!focusTargets.length) return;
    if (!lastFit) {
      fitShadow(direction, "init");
      return;
    }
    if (lastFitDir.angleTo(direction) > (2 * Math.PI) / 180) {
      fitShadow(direction, "sun-direction");
      return;
    }
    // 移动检测用质心代理（getWorldPosition，O(焦点数)），避免每帧深遍历求包围盒
    if (!focusCentroid(_centroid)) return;
    if (_centroid.distanceTo(lastFitCentroid) > (lastFit.texel || 0.1) * 1.5) {
      fitShadow(direction, "focus-moved");
    }
  }

  function applyState(state, direction) {
    sun.color.set(state.sun.color);
    sun.intensity = state.sun.intensity;
    hemi.color.set(state.sky.skyColor);
    hemi.groundColor.set(state.sky.groundColor);
    // K7 面板 trim：skyMul/exposureMul 在导演层乘入（lightingState.js 不在本批改动范围）
    hemi.intensity = state.sky.intensity * (Number.isFinite(trims.skyMul) ? trims.skyMul : 1);
    ambient.intensity = state.ambientFloor;
    renderer.toneMappingExposure =
      state.exposure * (Number.isFinite(trims.exposureMul) ? trims.exposureMul : 1);
    if (scene.background?.isColor) scene.background.set(state.background);
    if (scene.fog) {
      scene.fog.color.set(state.fog.color);
      if ("density" in scene.fog) scene.fog.density = state.fog.density;
    }
    if (skyMat) {
      // 天空球三色：背景族微调（顶 = skyColor、中 = background、底 = 地平线略亮）
      skyMat.uniforms.topColor?.value.set(state.sky.skyColor);
      skyMat.uniforms.midColor?.value.set(state.background);
      skyMat.uniforms.botColor?.value.set(state.sky.groundColor);
      if (skyMat.uniforms.cloudColor) {
        // 深夜云带不再固定混入 35% 白色；只留轻微冷月轮廓，避免天空虽黑
        // 但大片云纹仍像白昼自发光，抢走火炬/窗灯的局部对比。
        const cloudWhiteMix = state.band === "night" ? 0.08 : state.band === "predawn" ? 0.18 : 0.35;
        _cTmp.set(state.sky.skyColor).lerp(new THREE.Color(1, 1, 1), cloudWhiteMix);
        skyMat.uniforms.cloudColor.value.copy(_cTmp);
      }
    }
    maybeRefit(direction);
  }

  function smoothNum(cur, target, k) {
    return cur + (target - cur) * k;
  }

  function smoothHex(cur, target, k) {
    // sRGB 通道线性逼近即可（导演平滑不是色彩科学路径）
    const a = parseInt(cur.slice(1), 16);
    const b = parseInt(target.slice(1), 16);
    const ch = (sh) => {
      const x = (a >> sh) & 255;
      const y = (b >> sh) & 255;
      return x + (y - x) * k;
    };
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return `#${c(ch(16))}${c(ch(8))}${c(ch(0))}`.toUpperCase();
  }

  return {
    root,
    lights: { ambient, hemi, sun },

    isEnabled: () => enabled,

    setEnabled(next) {
      next = next === true;
      if (next === enabled) return enabled;
      enabled = next;
      root.visible = enabled;
      for (const light of legacyLights) light.visible = !enabled;
      if (enabled) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.BasicShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // ACES 高光滚降：线性映射下近白 albedo（瀑布/船帆/浪花）在 2× 总照度必截断，
        // 样片 0% 截断门槛只有 tone mapping 能达成；legacy 保持 NoToneMapping 逐字节回退
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        lastFit = null; // 重新拟合
      } else {
        lightningTarget = 0;
        lightningSmooth = 0; // 关闭即清闪电 override，重开不得带着残留爆闪
        renderer.shadowMap.enabled = legacyRenderer.shadowEnabled;
        renderer.shadowMap.type = legacyRenderer.shadowType;
        renderer.toneMapping = legacyRenderer.toneMapping;
        renderer.toneMappingExposure = legacyRenderer.exposure;
        renderer.outputColorSpace = legacyRenderer.outputColorSpace;
        if (legacyBackground && scene.background?.isColor) scene.background.copy(legacyBackground);
        if (scene.fog) {
          if (legacyFogColor) scene.fog.color.copy(legacyFogColor);
          if (legacyFogDensity != null && "density" in scene.fog) scene.fog.density = legacyFogDensity;
        }
        if (skyMat && legacySky) {
          if (legacySky.top) skyMat.uniforms.topColor.value.copy(legacySky.top);
          if (legacySky.mid) skyMat.uniforms.midColor.value.copy(legacySky.mid);
          if (legacySky.bot) skyMat.uniforms.botColor.value.copy(legacySky.bot);
          if (legacySky.cloud) skyMat.uniforms.cloudColor.value.copy(legacySky.cloud);
        }
      }
      return enabled;
    },

    /** 阴影焦点：单个对象或对象数组（城堡/玩家/木马/关键战斗单位取包围盒并集） */
    setFocus(objects) {
      focusTargets = (Array.isArray(objects) ? objects : [objects]).filter(Boolean);
      lastFit = null;
    },

    /** 建筑 dirty（编辑器重建/地形件变更）：下一帧强制重拟合 shadow camera */
    invalidateShadowFit() {
      lastFit = null;
    },

    /** 阴影预设："paper" 硬边纸艺（BasicShadowMap）/ "soft" PCFSoft 对照 */
    setShadowPreset(preset) {
      const type = preset === "soft" ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
      if (renderer.shadowMap.type === type) return;
      renderer.shadowMap.type = type;
      renderer.shadowMap.needsUpdate = true;
      scene.traverse((o) => {
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) m.needsUpdate = true;
      });
    },

    /** caster/receiver 分类：建筑/台地/士兵/木马进入；粒子/UI/远云/透明水排除 */
    classifyShadowCasters(rootObject) {
      let casters = 0;
      let excluded = 0;
      rootObject?.traverse?.((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const shadowable = mats.some(
          (m) =>
            m.visible !== false &&
            !m.transparent &&
            !m.isMeshBasicMaterial &&
            m.side !== THREE.BackSide
        );
        const isParticle = o.isPoints || o.isLine || o.userData?.isTrail === true;
        if (shadowable && !isParticle) {
          o.castShadow = true;
          o.receiveShadow = true;
          casters++;
        } else {
          o.castShadow = false;
          excluded++;
        }
      });
      return { casters, excluded };
    },

    /** shadow coverage 调试视图：太阳 shadow camera 的 CameraHelper */
    setShadowDebugVisible(visible) {
      if (visible && !shadowHelper) {
        shadowHelper = new THREE.CameraHelper(sun.shadow.camera);
        shadowHelper.name = "osk-v5-shadow-debug";
        scene.add(shadowHelper);
      }
      if (shadowHelper) {
        shadowHelper.visible = visible === true;
        if (visible) shadowHelper.update();
      }
    },

    /** 调试数据：frustum、texel、利用率、重算原因 */
    getShadowDebugInfo() {
      const cam = sun.shadow.camera;
      return {
        mapSize: shadowMapSize,
        fit: lastFit,
        lastFitReason,
        focusCount: focusTargets.length,
        camera: { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom, near: cam.near, far: cam.far },
        shadowType: renderer.shadowMap.type === THREE.PCFSoftShadowMap ? "soft" : "paper",
      };
    },

    /** 开发面板调参：写入 trim（乘到 LightingState 上），不直接碰 Three Light */
    setTrims(next) {
      trims = { ...trims, ...next };
    },

    /** 莫比斯结界染色 0..1（主循环已做 2s 时间常数平滑） */
    setMoebiusFactor(f) {
      moebiusFactor = Math.max(0, Math.min(1, f || 0));
    },

    /** K4 闪电短时 override 0..1（由 localLightBridge 从 weather flash 采样） */
    setLightning(k) {
      lightningTarget = Math.max(0, Math.min(1, k || 0));
    },

    /** K7 freeze：冻结/解冻光照状态（冻结时 update no-op，画面保持当前光照） */
    setFrozen(f) {
      frozen = f === true;
      return frozen;
    },
    isFrozen: () => frozen,

    /**
     * K7 调试视图模式（TODO 573）：final/albedo/direct/shadow/sky/ao/bounce/
     * emissive/luminance/voxel/active-lights，白名单见 debugViewMode.js。
     * 此处只校验并记录模式状态（FEATURES 风格，见 lightingDebugView），并保留
     * 材质 override 钩子入口；各模式的真实 shader 视图矩阵/材质替换属于
     * 浏览器 GPU 阶段（后续接 scene.overrideMaterial 或注入 uniform），
     * Node 侧不伪造渲染效果。返回实际生效模式。
     */
    setDebugViewMode(mode) {
      return setLightingDebugViewMode(mode);
    },
    getDebugViewMode: () => getLightingDebugViewMode(),

    /** K7-577 context loss 状态（测试/面板只读；处理器同时暴露供无 DOM 环境直调） */
    isContextLost: () => contextLost,
    isContextRebuildPending: () => contextRebuildPending,
    handleContextLost: onContextLost,
    handleContextRestored: onContextRestored,

    /**
     * 每帧：合成目标 LightingState → 平滑逼近 → 应用。
     * 开关关闭时完全 no-op（旧管线由 dayNight/weather 照旧驱动）。
     * K7：frozen（面板冻结）与 contextLost（GPU 上下文丢失）同样 no-op。
     */
    update(dt, { timeOfDay, weather } = {}) {
      if (!enabled || frozen || contextLost) return;
      if (contextRebuildPending) {
        // context restored 后完整重建：shadow 全量 refit + 平滑状态从目标重播
        contextRebuildPending = false;
        lastFit = null;
        smoothed = null;
      }
      const target = composeLightingState({
        timeOfDay: timeOfDay ?? 0.5,
        weather: lightingWeatherName(weather ?? 0),
        trims,
        moebius: moebiusFactor,
      });
      // 一阶平滑（tau≈0.8s），太阳方向跳变仍立即生效（关键时刻边界）
      const k = Math.min(1, (dt || 0.016) / 0.8);
      if (!smoothed) {
        smoothed = target;
      } else {
        smoothed = {
          ...target,
          sun: {
            ...target.sun,
            intensity: smoothNum(smoothed.sun.intensity, target.sun.intensity, k),
          },
          sky: {
            ...target.sky,
            intensity: smoothNum(smoothed.sky.intensity, target.sky.intensity, k),
            skyColor: smoothHex(smoothed.sky.skyColor, target.sky.skyColor, k),
            groundColor: smoothHex(smoothed.sky.groundColor, target.sky.groundColor, k),
          },
          ambientFloor: smoothNum(smoothed.ambientFloor, target.ambientFloor, k),
          background: smoothHex(smoothed.background, target.background, k),
          fog: {
            color: smoothHex(smoothed.fog.color, target.fog.color, k),
            density: smoothNum(smoothed.fog.density, target.fog.density, k),
          },
        };
      }
      // K4 闪电 override：快速爬升、慢速释放，只叠加在输出副本上
      // （不写回 smoothed——否则叠加量回流进一阶平滑，形成正反馈爆闪）
      const tauL = lightningTarget > lightningSmooth ? 0.06 : 1.1;
      lightningSmooth +=
        (lightningTarget - lightningSmooth) * Math.min(1, (dt || 0.016) / tauL);
      let out = smoothed;
      if (lightningSmooth > 0.0005) {
        const k = lightningSmooth;
        out = {
          ...smoothed,
          sun: { ...smoothed.sun, intensity: smoothed.sun.intensity + 1.2 * k },
          sky: { ...smoothed.sky, intensity: smoothed.sky.intensity + 0.5 * k },
          ambientFloor: smoothed.ambientFloor + 0.9 * k,
        };
      }
      _dir.fromArray(smoothed.sun.direction).normalize();
      applyState(out, _dir);
    },

    /** 调试/验收：当前状态快照 */
    getState() {
      return {
        enabled,
        frozen,
        contextLost,
        debugViewMode: getLightingDebugViewMode(),
        sunIntensity: sun.intensity,
        hemiIntensity: hemi.intensity,
        ambientFloor: ambient.intensity,
        sunDirection: sun.position.clone().sub(sun.target.position).normalize().toArray(),
        shadowMapSize,
        fit: lastFit,
        trims: { ...trims },
        moebiusFactor,
        lightning: lightningSmooth, // K4 闪电 override 当前叠加量（0=已回基线）
      };
    },
  };
}
