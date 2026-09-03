// =====================================================================
// S18 · OskSta 点光源 Light Volume（x.com/OskSta/status/1582757294672314368）
// 原文（2022-10-19）：
//   "I'm seeing if my light volume approach can work with point lights too."
//   "The low resolution is noticeable for sure."
//   "Especially when you move em around like this."
//   "But if you keep em big and soft and somewhat still I think it's gonna be good."
//
// 方法（与 S9/S10 同一 light volume 实验家族）：
//   · 点光源不画成动态像素光，而是**生成期烘进低分辨率光体积**；
//   · 低分辨率是已知代价 → 使用规则：灯要**大**（半径 ≥ LAMP_MIN_RADIUS）、
//     要**软**（smoothstep 软落、边界为 0）、**基本不动**（位置永不动画，
//     亮度只有 ≤ LAMP_BREATH_MAX 的慢呼吸）。
//
// 高山圣城落点：台城市基面上的一圈暖光灯（灯杆 + 自发光灯头 + 光体积壳
// + 前 REAL_LIGHT_BUDGET 盏真实 PointLight，其余只留光晕——与 K4 预算
// 纪律一致）。夜权重由 P.timeOfDay 驱动（正午 0 / 暮色爬升 / 午夜 1）。
// 本模块不 import params：getTimeOfDay 由宿主注入，Node 可直接单测。
// =====================================================================
import * as THREE from "three";

export const LIGHT_VOLUME_SCHEMA_VERSION = 3;
/** 低分辨率光体积：每盏灯 5³ lattice（Oskar：「low resolution is noticeable」是接受的代价） */
export const LIGHT_VOLUME_GRID = 5;
/** 大：光体积半径下限 */
export const LAMP_MIN_RADIUS = 4.0;
/** 光球可见壳半径缩放（主人验收 2026-08-28：所有季节光球减半）。
 *  只缩可见壳与壳内采样；PointLight 照明距离保持不变。 */
export const LIGHT_ORB_RADIUS_SCALE = 0.5;
/** 基本不动：亮度慢呼吸幅度上限（位置永不动画） */
export const LAMP_BREATH_MAX = 0.06;
/** 慢呼吸周期（秒）——远慢于观看可察觉的「移动」 */
export const LAMP_BREATH_PERIOD = 14;
/** 真实 PointLight 预算（2026-08-28 性能：8→4；光晕壳承担主要视觉，
 *  forward 渲染每个点光都进所有材质的片元循环，数量比半径更贵） */
export const REAL_LIGHT_BUDGET = 4;

/** 参考图夜港色温：灯 = 橙琥珀系，**阶梯光色**——低处饱和深橙，越往上越偏暖黄 */
export const HIGHLAND_LAMP_COLOR = 0xff8d42;
export const LAMP_COLOR_LOW = 0xff6f32;   // 水岸/前缘：珊瑚深橙
export const LAMP_COLOR_MID = 0xff8d42;   // 中城：火焰橙
export const LAMP_COLOR_HIGH = 0xffad64;  // 后排高处：柔暖黄
export const LAMP_COLOR_BEACON = 0xffc979; // 塔楼暖光冠
/** 湖面冷底光：只做宽而柔的低强度色域，暖倒影仍是画面焦点。 */
export const WATER_COOL_WASH_COLOR = 0x3158b2;
export const HIGHLAND_LAMP_BASE_Y = 4.95; // = HIGHLAND_TOWNSCAPER_BASE_Y

function hash01(n) {
  let x = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * 软落曲线：内圈全亮，向外 smoothstep 衰减，半径处恰为 0。
 * 「big and soft」的核心——没有硬边。
 */
export function falloff01(dist, radius) {
  if (!(radius > 0)) return 0;
  const t = Math.min(Math.max(dist / radius, 0), 1);
  const inner = 0.32;
  if (t <= inner) return 1;
  const u = (t - inner) / (1 - inner);
  return 1 - u * u * (3 - 2 * u);
}

/**
 * 圣城灯光布局（参考图 1:1，2026-08-28 主人验收）：
 * 暖橙灯群**下密上疏**——水岸/前缘最密（6），正门两侧（2），广场（1），
 * 后排高处只剩一盏小的（1）；旧港岸湾 3 盏（码头/古樟一带，贴地形顶面）；
 * 城市中轴上方 1 盏塔楼暖光冠（参考图里从内部透光的城塔）。
 * 数组顺序即真实点光源优先级：前缘 + 港口先拿预算（参考图的光在水边）。
 */
export function highlandLampLayout({ terrainHeightAt } = {}) {
  const baseY = HIGHLAND_LAMP_BASE_Y;
  const spots = [
    // 前缘水岸排（下城灯海，参考图最亮处）
    { x: -20, z: 20, r: 5.6, h: 2.1 },
    { x: -11.5, z: 21, r: 6.0, h: 2.3 },
    { x: -3.8, z: 21.2, r: 6.2, h: 2.2 },
    { x: 4.6, z: 21, r: 6.0, h: 2.3 },
    { x: 12.5, z: 20.6, r: 5.7, h: 2.1 },
    { x: 20, z: 19.6, r: 5.4, h: 2.0 },
    // 旧港岸湾（码头桩灯，贴岸湾地形顶面）
    { x: 13.5, z: 36.5, r: 5.2, h: 1.9, cove: true },
    { x: 20.2, z: 37.8, r: 5.0, h: 1.9, cove: true },
    { x: 16.8, z: 40.8, r: 4.8, h: 1.8, cove: true },
    // 正门两侧
    { x: -3.2, z: 14.5, r: 4.8, h: 2.4 },
    { x: 3.2, z: 14.5, r: 4.8, h: 2.4 },
    // 广场（中城，小而暗）
    { x: 0, z: 2, r: 4.4, h: 2.2, dim: true },
    // 后排高处（上疏：只剩一盏小的）
    { x: -6, z: -21, r: 4.0, h: 2.0, dim: true },
    // 塔楼暖光冠：城市中轴上方的体积暖光（参考图透光城塔）
    { x: 0, z: -2, r: 8.5, h: 0, beacon: true },
  ];
  return spots.map((spot, index) => {
    const jitter = hash01(index * 131 + 7);
    const x = spot.x + (jitter - 0.5) * 0.6;
    const y = spot.cove && terrainHeightAt ? terrainHeightAt(x, spot.z) : baseY;
    // 阶梯光色：低处饱和深橙 → 高处暖黄（参考图垂直层次）
    const color = spot.beacon ? LAMP_COLOR_BEACON
      : spot.dim ? LAMP_COLOR_HIGH
        : spot.z >= 17 ? LAMP_COLOR_LOW
          : LAMP_COLOR_MID;
    return {
      id: spot.beacon ? "highland-lamp-beacon" : `highland-lamp-${index}`,
      position: [x, y, spot.z],
      color,
      radius: spot.r,
      height: spot.h,
      phase: hash01(index * 43 + 11),
      beacon: Boolean(spot.beacon),
      dim: Boolean(spot.dim),
      cove: Boolean(spot.cove),
    };
  });
}

function fnv1a(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * 生成期烘焙：单盏灯的低分辨率光体积 lattice（5³，[0,1] 强度）。
 * 运行期只读这份烘焙（采样在 shader 的 3D 纹理里），不再逐帧计算。
 */
export function bakeLightVolume(lamp) {
  const g = LIGHT_VOLUME_GRID;
  const data = new Float32Array(g * g * g);
  const step = (lamp.radius * 2) / g;
  let index = 0;
  for (let iz = 0; iz < g; iz++) {
    for (let iy = 0; iy < g; iy++) {
      for (let ix = 0; ix < g; ix++) {
        const x = (ix + 0.5) * step - lamp.radius;
        const y = (iy + 0.5) * step - lamp.radius;
        const z = (iz + 0.5) * step - lamp.radius;
        data[index++] = falloff01(Math.hypot(x, y, z), lamp.radius);
      }
    }
  }
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) bytes[i] = Math.round(data[i] * 255);
  return {
    dims: [g, g, g],
    data,
    version: LIGHT_VOLUME_SCHEMA_VERSION,
    hash: `light-volume:${fnv1a(bytes)}`,
  };
}

/** 夜权重：正午 0 → 暮色爬升 → 午夜 1 → 晨光回落（0.28 朝霞时灯半灭）。 */
export function nightWeightAt(timeOfDay) {
  const tod = Number.isFinite(timeOfDay) ? timeOfDay : 0.5;
  const smooth = (t) => t * t * (3 - 2 * t);
  if (tod >= 0.62) return smooth(Math.min((tod - 0.62) / 0.16, 1)); // 0.62–0.78 暮色爬升
  if (tod >= 0.38) return 0;                                        // 白天
  if (tod >= 0.22) return 1 - smooth((tod - 0.22) / 0.16);          // 0.22–0.38 晨光回落
  return 1;                                                         // 深夜
}

/**
 * 挂载圣城光体积灯组。返回 { group, lamps, update, dispose }。
 * update 只改强度（呼吸 × 夜权重），绝不改位置——「somewhat still」。
 */
export function createHighlandLightVolumes(THREE_, parent, {
  lamps,
  getTimeOfDay = () => 0.5,
  terrainHeightAt,
  /** 海面在城堡局部坐标的 Y（岸湾灯倒影光斑贴水面用） */
  waterLocalY = 4.92,
  /** 球面湖泊的局部权威高度；提供时倒影逐顶点贴合曲面。 */
  waterHeightAt = null,
} = {}) {
  if (!THREE_?.Group || !parent) throw new Error("light volumes require THREE and parent");
  const lampList = lamps ?? highlandLampLayout({ terrainHeightAt });
  const group = new THREE.Group();
  group.name = "highland-light-volumes";
  group.userData.kind = "highland-light-volumes";

  // 共享的低分辨率体积 3D 纹理：所有灯同一条软落曲线，逐灯烘焙一份
  // （半径不同 → lattice 不同 → hash 不同）；烘焙一次，运行期只采样。
  const bakes = lampList.map((lamp) => bakeLightVolume(lamp));
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 1, metalness: 0, flatShading: true });
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b5b3e, roughness: 0.8, metalness: 0, flatShading: true,
    emissive: new THREE.Color(HIGHLAND_LAMP_COLOR), emissiveIntensity: 0,
  });
  const shellMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(HIGHLAND_LAMP_COLOR) },
      uIntensity: { value: 0 },
      uRadius: { value: 1 },
    },
    vertexShader: `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler3D uVolume;
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uRadius;
      varying vec3 vLocal;
      void main() {
        vec3 uvw = vLocal / (uRadius * 2.0) + 0.5;
        float a = texture(uVolume, uvw).r * uIntensity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });

  // 参考图水面不是镜子，而是深蓝底上的宽暖色拖影。用 UV 羽化 shader
  // 代替旧的窄矩形 MeshBasicMaterial：横向无硬边，纵向碎成缓慢流动的
  // 柔软光带；动态只发生在水纹亮度，灯与光体积本身仍保持基本不动。
  const makeWaterReflectionMaterial = (color, phase = 0) => {
    const material = new THREE_.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE_.AdditiveBlending,
      side: THREE_.DoubleSide,
      uniforms: {
        uColor: { value: new THREE_.Color(color) },
        uIntensity: { value: 0 },
        uTime: { value: 0 },
        uPhase: { value: phase },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uTime;
        uniform float uPhase;
        varying vec2 vUv;
        void main() {
          float across = smoothstep(0.0, 0.30, vUv.x)
            * (1.0 - smoothstep(0.70, 1.0, vUv.x));
          float along = pow(max(sin(vUv.y * 3.14159265), 0.0), 0.68);
          float broadRipple = 0.82 + 0.18 * sin(vUv.y * 24.0 - uTime * 0.72 + uPhase * 6.28318);
          float crossRipple = 0.88 + 0.12 * sin(vUv.x * 15.0 + vUv.y * 9.0 + uTime * 0.31);
          float alpha = across * along * broadRipple * crossRipple * uIntensity * 0.58;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    material.userData.semanticToken = "highland-soft-water-light";
    return material;
  };

  const entries = [];
  const waterEntries = [];
  const reflectionGroup = new THREE_.Group();
  reflectionGroup.name = "highland-water-light-reflections";
  reflectionGroup.userData.kind = "soft-dynamic-water-light";
  const conformReflectionToWater = (geometry, centerX, centerZ) => {
    const centerY = typeof waterHeightAt === "function"
      ? waterHeightAt(centerX, centerZ)
      : waterLocalY;
    const positions = geometry.getAttribute("position");
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const localX = positions.getX(vertex);
      const localZ = positions.getZ(vertex);
      const surfaceY = typeof waterHeightAt === "function"
        ? waterHeightAt(centerX + localX, centerZ + localZ)
        : waterLocalY;
      positions.setY(vertex, surfaceY - centerY);
    }
    positions.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return centerY;
  };
  lampList.forEach((lamp, index) => {
    const bake = bakes[index];
    const holder = new THREE.Group();
    holder.name = `highland-light-volume-${lamp.id}`;
    holder.position.fromArray(lamp.position);

    // 灯杆 + 自发光灯头（白天也在的实体）；塔楼暖光冠无杆无头
    if (!lamp.beacon) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, lamp.height, 6), poleMaterial);
      pole.position.y = lamp.height / 2;
      pole.name = "lamp-pole";
      holder.add(pole);
      const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), headMaterial);
      head.position.y = lamp.height + 0.16;
      head.name = "lamp-head";
      holder.add(head);
    }

    // 光体积壳：采样烘焙 lattice 的软光球（big & soft）；
    // 可见壳半径按 LIGHT_ORB_RADIUS_SCALE 缩放（2026-08-28 减半）
    const shellLift = lamp.beacon ? 3.2 : lamp.height + 0.16;
    const shellRadius = lamp.radius * LIGHT_ORB_RADIUS_SCALE;
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(shellRadius, 1), // detail 1：软光球足够（性能）
      shellMaterial.clone()
    );
    shell.material.uniforms.uRadius.value = shellRadius;
    shell.material.uniforms.uColor.value = new THREE_.Color(lamp.color);
    if (THREE_.Data3DTexture) {
      const tex = new THREE_.Data3DTexture(
        new Float32Array(bake.data),
        bake.dims[0], bake.dims[1], bake.dims[2]
      );
      tex.format = THREE_.RedFormat;
      tex.type = THREE_.FloatType;
      tex.minFilter = THREE_.LinearFilter;
      tex.magFilter = THREE_.LinearFilter;
      tex.unpackAlignment = 1;
      tex.needsUpdate = true;
      shell.material.uniforms.uVolume = { value: tex };
      shell.userData.volumeTexture = tex;
    }
    shell.position.y = shellLift;
    shell.name = "lamp-volume-shell";
    shell.renderOrder = 7;
    holder.add(shell);

    // 真实点光源：前 REAL_LIGHT_BUDGET 盏（预算纪律），其余只留光晕
    let light = null;
    if (index < REAL_LIGHT_BUDGET) {
      light = new THREE_.PointLight(lamp.color, 0, lamp.radius * 2.3, 2);
      light.position.y = shellLift;
      light.name = "lamp-point-light";
      holder.add(light);
    }

    holder.userData.lampId = lamp.id;
    holder.userData.bakeHash = bake.hash;
    group.add(holder);
    entries.push({ lamp, holder, shell, light, dimScale: lamp.dim ? 0.68 : 1 });

    // 岸湾灯 + 前缘水岸排：宽边羽化的暖色水面拖影。不使用 Reflector，
    // 也不把世界坐标重复加到 holder 局部坐标（旧版倒影错位的根因）。
    if (lamp.cove || lamp.position[2] >= 17) {
      const width = (lamp.cove ? 1.45 : 1.72) + hash01(index * 83 + 29) * 0.62;
      const length = (lamp.cove ? 7.2 : 8.8) + hash01(index * 97 + 13) * 1.7;
      const streakGeometry = new THREE_.PlaneGeometry(width, length, 2, 12);
      streakGeometry.rotateX(-Math.PI / 2); // 平躺，长轴沿 Z（指向湾外）
      const centerZ = lamp.position[2] + length * 0.5;
      const centerY = conformReflectionToWater(streakGeometry, lamp.position[0], centerZ);
      const streakMaterial = makeWaterReflectionMaterial(lamp.color, lamp.phase);
      const streak = new THREE_.Mesh(streakGeometry, streakMaterial);
      streak.name = "lamp-reflection-streak";
      streak.position.set(lamp.position[0], centerY + 0.035, centerZ);
      streak.rotation.y = (hash01(index * 109 + 5) - 0.5) * 0.12;
      streak.renderOrder = 8;
      streak.userData.sourceLampId = lamp.id;
      streak.userData.softEdges = true;
      streak.userData.dynamicWaterOnly = true;
      reflectionGroup.add(streak);
      entries[entries.length - 1].streak = streak;
      waterEntries.push({ mesh: streak, material: streakMaterial, phase: lamp.phase, intensityScale: 0.72 });
    }
  });

  // 一块很低强度的深钴蓝水域底光，把冷山体与湖面连成同一夜景；边缘
  // 同样由 shader 羽化，因此不会重新制造此前已经移除的白色硬条。
  const coolWashGeometry = new THREE_.PlaneGeometry(38, 24, 4, 14);
  coolWashGeometry.rotateX(-Math.PI / 2);
  const coolWashY = conformReflectionToWater(coolWashGeometry, 0, 40);
  const coolWashMaterial = makeWaterReflectionMaterial(WATER_COOL_WASH_COLOR, 0.37);
  const coolWash = new THREE_.Mesh(coolWashGeometry, coolWashMaterial);
  coolWash.name = "highland-water-cool-wash";
  coolWash.position.set(0, coolWashY + 0.02, 40);
  coolWash.renderOrder = 7;
  coolWash.userData.softEdges = true;
  reflectionGroup.add(coolWash);
  waterEntries.push({ mesh: coolWash, material: coolWashMaterial, phase: 0.37, intensityScale: 0.18 });
  reflectionGroup.userData.warmReflectionCount = waterEntries.length - 1;
  reflectionGroup.userData.coolWashCount = 1;
  group.add(reflectionGroup);

  group.userData.lampCount = lampList.length;
  group.userData.bakeHashes = bakes.map((bake) => bake.hash);
  group.userData.volumeShellCount = entries.length;
  group.userData.realLightCount = entries.filter((entry) => entry.light).length;
  group.userData.waterReflectionCount = waterEntries.length;

  let nightWeight = 0;
  const update = (t, forcedTimeOfDay = null) => {
    const time = Number.isFinite(t) ? t : 0;
    nightWeight = nightWeightAt(Number.isFinite(forcedTimeOfDay) ? forcedTimeOfDay : getTimeOfDay());
    headMaterial.emissiveIntensity = nightWeight * 1.35;
    for (const entry of entries) {
      // 慢呼吸：≤ LAMP_BREATH_MAX，周期秒级——「somewhat still」
      const breathe = 1 - LAMP_BREATH_MAX * (0.5 + 0.5 * Math.sin(time * (Math.PI * 2 / LAMP_BREATH_PERIOD) + entry.lamp.phase * Math.PI * 2));
      const intensity = nightWeight * breathe * entry.dimScale;
      entry.shell.material.uniforms.uIntensity.value = intensity;
      entry.shell.visible = intensity > 0.004;
      if (entry.light) entry.light.intensity = intensity * 1.15;
      if (entry.streak) {
        entry.streak.visible = intensity > 0.004;
      }
    }
    for (const waterEntry of waterEntries) {
      const shimmer = 0.94 + 0.06 * Math.sin(time * 0.48 + waterEntry.phase * Math.PI * 2);
      waterEntry.material.uniforms.uTime.value = time;
      waterEntry.material.uniforms.uIntensity.value = nightWeight * shimmer * waterEntry.intensityScale;
      waterEntry.mesh.visible = nightWeight > 0.004;
    }
  };
  update(0);
  group.userData.update = update;
  group.update = update;
  parent.add(group);

  const dispose = () => {
    for (const entry of entries) {
      entry.shell.geometry.dispose();
      entry.shell.material.dispose();
      entry.shell.userData.volumeTexture?.dispose?.();
      entry.holder.traverse((object) => {
        if (object.isMesh && object !== entry.shell) object.geometry?.dispose?.();
      });
    }
    for (const waterEntry of waterEntries) {
      waterEntry.mesh.geometry.dispose();
      waterEntry.material.dispose();
    }
    poleMaterial.dispose();
    headMaterial.dispose();
    group.removeFromParent();
  };

  return { group, lamps: lampList, bakes, update, dispose, get nightWeight() { return nightWeight; } };
}
