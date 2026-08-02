// 猛虎智能体：行为层（巡游路径、驻足状态机、物理刚体、缠竹尾）
// 身体由生物生成管线构建：数据仓库 → 骨骼装配 → 程序化蒙皮 → 状态机驱动
// 斑纹（拟狩野山乐《竹虎图》的斑斓）以顶点色注入；物理为 Cannon kinematic 刚体
import * as THREE from "../assets/vendor/three/three.module.js";
import * as CANNON from "../assets/vendor/cannon-es.js";
import { groundHeight } from "./environment.js";
import { GROUP } from "./physics.js";
import { BIOLOGICAL_TAXONOMY } from "./bio/BiologicalTaxonomyRegistry.js";
import { BioEntityMesh } from "./bio/BioEntityMesh.js";
import { attachAgentMind } from "./agentMind.js";

const ORANGE = new THREE.Color(0xd27a24);
const ORANGE_DEEP = new THREE.Color(0xb5621a);
const DARK = new THREE.Color(0x1d140d);
const CREAM = new THREE.Color(0xf2e8d5);

// 虎斑绘制：沿体长波浪斑纹 + 腹底留白（画谱"斑斓"意）；腿管画环纹、爪尖留白
// 腿管位置与 ProceduralSkinGenerator._legDefs 一致（虎 dimensions 导出值）
const LEG_REGIONS = [
  { x: -0.216, z: 0.65 }, { x: 0.216, z: 0.65 },
  { x: -0.202, z: -0.65 }, { x: 0.202, z: -0.65 },
];
function legRegionAt(x, z, y) {
  if (y > 1.01) return null;
  for (const L of LEG_REGIONS) {
    if (Math.hypot(x - L.x, z - L.z) < 0.17) return L; // 覆盖椭圆掌前沿
  }
  return null;
}

// 由 rendering 推导底色/斑色/腹白，兼容未传入渲染参数的默认虎色
function paletteFromRendering(rendering) {
  if (!rendering) return { base: ORANGE, deep: ORANGE_DEEP, dark: DARK, cream: CREAM };
  const base = new THREE.Color(rendering.baseColor ?? 0xd27a24);
  const dark = new THREE.Color(rendering.stripeColor ?? 0x1d140d);
  const cream = new THREE.Color(0xf2e8d5);
  const deep = base.clone().lerp(dark, 0.25);
  return { base, deep, dark, cream };
}

function paintTiger(geo, { freq = 14, belly = -0.38, contrast = 1, rendering } = {}) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const pal = paletteFromRendering(rendering);
  const pattern = rendering?.pattern || "stripes";
  const density = rendering?.stripeDensity ?? 0.6;
  const bellyLift = rendering?.bellyLightenAmt ?? 0.4;
  const stripeK = 0.4 + density * 0.6; // 密度越高，斑纹覆盖越强
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const legL = legRegionAt(x, z, y);
    if (legL) {
      // 腿管：橙底环纹（沿 y），爪部奶白自爪尖向上渐变消融（无硬边"白袜"）
      const ring = Math.sin(y * 22 + Math.sin(Math.atan2(z, x) * 4) * 0.8);
      const shade = THREE.MathUtils.clamp(0.45 + y * 0.4, 0, 1);
      c.copy(pal.deep).lerp(pal.base, shade);
      if (ring > 0.35) c.lerp(pal.dark, THREE.MathUtils.smoothstep(ring, 0.35, 0.9) * 0.7 * contrast * stripeK);
      // 袜口边缘绕腿微起伏（毛边感），白色比例随高度平滑归零
      const wob = Math.sin(Math.atan2(z - legL.z, x - legL.x) * 5) * 0.025;
      const sock = 1 - THREE.MathUtils.smoothstep(y, 0.07 + wob, 0.19 + wob);
      if (sock > 0) c.lerp(pal.cream, sock);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      continue;
    }
    const along = z;
    const across = Math.atan2(x, y + 1e-4);
    let wave = 0;
    if (pattern === "stripes") {
      const w1 = Math.sin(along * freq + Math.sin(across * 3 + along * 0.7) * 1.3);
      const w2 = Math.sin(across * 7 + along * 2.3); // 断续：虎纹不成环、节节垂落
      wave = w1 + w2 * 0.4;
    } else if (pattern === "spots") {
      const sx = Math.sin(x * 26) * Math.cos(z * 18);
      const sz = Math.sin(z * 26) * Math.cos(x * 18);
      wave = Math.max(sx, sz);
    } else if (pattern === "patch") {
      const s = Math.sin(x * 9 + z * 7) * Math.cos(z * 11 - x * 5);
      wave = s;
    } else { // solid
      wave = -1;
    }
    const shade = THREE.MathUtils.clamp(0.5 + y * 0.5, 0, 1);
    c.copy(pal.deep).lerp(pal.base, shade);
    if (wave > 0.2) {
      const k = THREE.MathUtils.smoothstep(wave, 0.2, 0.85) * contrast * stripeK;
      c.lerp(pal.dark, Math.min(k, 1));
    }
    // 腹底留白：以表面朝向为准 —— 只有明显朝下的面（ny < belly 阈值）才留白，
    // 平滑过渡；白腹藏在体下，顶视/侧视不再溢出"白翼"
    const ny = nrm ? nrm.getY(i) : 1;
    const cream = THREE.MathUtils.smoothstep(-ny, -belly - 0.15, -belly + 0.15) * bellyLift;
    if (cream > 0) c.lerp(pal.cream, cream);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

// 实验室通用接口：依 rendering 决定斑纹类型与配色
export function paintGeometry(geo, dim, anat, rendering) {
  paintTiger(geo, { rendering, contrast: 1 });
}


export class Tiger {
  constructor(scene, config, physics) {
    this.scene = scene;
    this.config = config;
    this.state = "巡游";
    this.pathT = 0;
    this._speedCur = 0;
    this._gaitCyc = 0;
    this._pauseTimer = (config.tiger.pauseInterval ?? 16) * (0.9 + Math.random() * 0.5); // 首次驻足计时
    this._pauseLeft = 0;
    this.obstacles = []; // 岩石刚体碰撞圈（由 main.js 注入 env.rockObstacles）
    this._buildPath();

    // —— 生物生成管线：数据仓库 → 骨骼装配 → 程序化蒙皮 → 聚合实体 ——
    const family = BIOLOGICAL_TAXONOMY.CARNIVORA.FELIDAE;
    const species = structuredClone(family.PANTHERA.TIGRIS);
    // 配置页皮毛参数注入渲染配置
    species.rendering.furLayers = config.tiger.furLayers ?? species.rendering.furLayers;
    species.rendering.furLength = species.rendering.furLength * (config.tiger.furLength ?? 1);
    this.entity = new BioEntityMesh(family, species, {
      paintGeometry: (geo) => paintTiger(geo, { contrast: config.tiger.stripeContrast }),
    });
    this.group = this.entity; // 兼容旧接口：group 即实体
    attachAgentMind(this, {
      id: "tiger-banlan",
      speciesId: "tiger",
      species: species.scientificName,
      role: "daughter",
      name: "斑阑",
    }, config);
    this._dialogIntentCd = 0;
    this._buildHeadDetails();
    scene.add(this.group);

    // —— 足迹：步态落地时留下爪印，离虎 5 米外消逝 ——
    this._prints = [];
    this._printGroup = new THREE.Group();
    scene.add(this._printGroup);
    this._prevPhases = [0, 0, 0, 0];

    // —— Cannon 刚体：躯干双球近似，kinematic 由路径驱动 ——
    if (physics) {
      this.body = new CANNON.Body({
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: GROUP.TIGER,
        collisionFilterMask: GROUP.BAMBOO | GROUP.GROUND | GROUP.ROCK,
      });
      this.body.addShape(new CANNON.Sphere(0.42), new CANNON.Vec3(0, 1.0, 0.5));
      this.body.addShape(new CANNON.Sphere(0.4), new CANNON.Vec3(0, 1.0, -0.5));
      physics.addBody(this.body);
      this._physics = physics;
      const p0 = this.path.getPointAt(0);
      this.body.position.set(p0.x, groundHeight(p0.x, p0.z), p0.z);
    }
  }

  /** 头部组合件：颅腔（前高后低+眉骨）+ 突出吻部 + 可动下颌 + 外炸颊髯
   *  + Shader 虎眼（缝隙瞳孔/咆哮放大发光）+ 立耳/鼻/须；颅吻挂 Head 骨，下颌挂 Jaw 骨 */
  _buildHeadDetails() {
    const contrast = this.config.tiger.stripeContrast;
    const head = this.entity.boneMap.get("Head");
    const jawBone = this.entity.boneMap.get("Jaw");
    const fur = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.85 });
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xb5621a, roughness: 0.85 });
    const cast = (m) => { m.castShadow = true; return m; };

    // 颅腔：压扁球、前高后低（顶微平），画额纹
    const craniumGeo = new THREE.SphereGeometry(0.17, 28, 22);
    craniumGeo.scale(1, 0.86, 0.94);
    paintTiger(craniumGeo, { freq: 22, belly: -99, contrast });
    const cranium = cast(new THREE.Mesh(craniumGeo, fur));
    cranium.position.set(0, 0.08, 0.12);
    cranium.rotation.x = 0.06;
    head.add(cranium);

    // 眉骨：眶上两道隆起（眼神深邃的根源）
    for (const s of [-1, 1]) {
      const brow = cast(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), lidMat));
      brow.scale.set(1.25, 0.5, 0.8);
      brow.position.set(s * 0.07, 0.148, 0.2);
      brow.rotation.set(-0.3, 0, s * 0.15);
      head.add(brow);
    }

    // 吻部：宽厚口鼻向前突出（咬合力），奶白
    const muzzleGeo = new THREE.SphereGeometry(0.095, 18, 14);
    muzzleGeo.scale(1.0, 0.72, 1.3);
    const muzzle = cast(new THREE.Mesh(muzzleGeo, creamMat));
    muzzle.position.set(0, -0.025, 0.245);
    head.add(muzzle);

    // 下颌：独立挂 Jaw 骨（锚点在颅颌交界，X 旋即咆哮），收在吻部下缘
    const jawGeo = new THREE.SphereGeometry(0.055, 14, 10);
    jawGeo.scale(0.85, 0.4, 1.1);
    const jawMesh = cast(new THREE.Mesh(jawGeo, creamMat));
    jawMesh.position.set(0, -0.015, 0.1);
    jawBone.add(jawMesh);

    // 颊髯：贴颊后掠的扁椭圆（前移内收压住吻-颅交界，下缘微外炸），奶白
    // 内缘没入颅腔与吻侧，杜绝"悬浮白块"的脱节感
    for (const s of [-1, 1]) {
      const ruff = cast(new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), creamMat));
      ruff.scale.set(0.55, 1.05, 1.15);
      ruff.position.set(s * 0.115, -0.045, 0.13);
      ruff.rotation.set(0.1, s * 0.45, s * 0.35);
      head.add(ruff);
    }

    // —— 虎眼：Shader 程序化虹膜（琥珀金 + 垂直缝瞳 + 照膜夜光） ——
    const eyeUniforms = {
      uPupilDilate: { value: 0.2 },                      // 0.15 细缝 → 0.85 浑圆
      uIrisColor: { value: new THREE.Color(0xd4af37) },  // 琥珀金
      uGlowIntensity: { value: 1.0 },
    };
    const eyeMat = new THREE.ShaderMaterial({
      uniforms: eyeUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform float uPupilDilate;
        uniform vec3 uIrisColor;
        uniform float uGlowIntensity;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - vec2(0.5);
          // X 轴按瞳孔系数缩放：缝隙（小系数）→ 浑圆（大系数）
          float d = length(vec2(center.x / uPupilDilate, center.y));
          vec3 col = uIrisColor;
          float pupilEdge = smoothstep(0.15, 0.16, d);
          col = mix(vec3(0.02), col, pupilEdge);
          col *= smoothstep(0.5, 0.3, length(center));
          gl_FragColor = vec4(col * uGlowIntensity, 1.0);
        }
      `,
    });
    this._eyeUniforms = eyeUniforms;
    const eyeGeo = new THREE.SphereGeometry(0.031, 24, 18);
    eyeGeo.rotateY(-Math.PI / 2); // UV 中心转向 +Z（瞳孔朝前）
    eyeGeo.scale(1, 0.92, 1);
    const linerGeo = new THREE.RingGeometry(0.033, 0.044, 24);
    const linerMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(s * 0.078, 0.075, 0.238);
      eye.rotation.y = s * -0.2; // 微外张视野
      head.add(eye);
      // 黑色眼线环（压住眼球边缘，威严感）
      const liner = new THREE.Mesh(linerGeo, linerMat);
      liner.position.set(s * 0.078, 0.075, 0.242);
      liner.rotation.y = s * -0.2;
      head.add(liner);
      // 眼下白色泪腺斑（夜林反光）
      const tear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), creamMat);
      tear.scale.set(1.3, 0.5, 0.8);
      tear.position.set(s * 0.078, 0.045, 0.225);
      head.add(tear);
      // 立耳：小而圆，竖直微外张，背黑前白
      const ear = cast(new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), darkMat));
      ear.scale.set(0.9, 1.3, 0.5);
      ear.position.set(s * 0.11, 0.22, 0.04);
      ear.rotation.set(-0.08, 0, s * -0.12);
      head.add(ear);
      const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), creamMat);
      earInner.scale.set(0.9, 1.2, 0.4);
      earInner.position.set(s * 0.108, 0.21, 0.085);
      earInner.rotation.copy(ear.rotation);
      head.add(earInner);
      // 虎须：每侧三根，自吻侧扇出
      for (let w = 0; w < 3; w++) {
        const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0008, 0.17, 3), creamMat);
        whisker.position.set(s * 0.08, -0.02 - w * 0.013, 0.33);
        whisker.rotation.z = -s * (Math.PI / 2 - 0.12);
        whisker.rotation.y = s * (0.1 + w * 0.12);
        head.add(whisker);
      }
    }

    // 鼻（红褐，挂吻突前端）+ 鼻下唇线 + 口吻横线
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.026, 0.024),
      new THREE.MeshStandardMaterial({ color: 0x7a3b33, roughness: 0.6 })
    );
    nose.position.set(0, 0.01, 0.362);
    head.add(nose);
    const lipLine = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.04, 0.009), darkMat);
    lipLine.position.set(0, -0.05, 0.355);
    head.add(lipLine);
    const mouthLine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.007, 0.009), darkMat);
    mouthLine.position.set(0, -0.075, 0.33);
    head.add(mouthLine);
  }

  _buildPath() {
    const r = this.config.tiger.patrolRadius;
    const pts = [
      [-16, -8], [-8, 2], [0.5, 9], [6, 12], [12, 5], [11, -6], [3, -13], [-8, -14],
    ].map(([x, z]) => new THREE.Vector3(x * r, 0, z * r)); // (0.5,9) 一段涉水过涧
    this.path = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.6);
    this.pathLength = this.path.getLength();
  }

  /** 起扑：猎物惊飞躲避，虎预判其空中落点截击（直跃版/追近后跃出版共用）。
   *  返回 pounce 状态：leapTo = 截击点（猎物飞行弧 t=0.55 处），dur 对齐截击时刻。 */
  _beginPounce(prey, gp, hcfg) {
    if (!prey._flight) prey._takeOff(prey._escapeTarget(gp), "惊飞");
    const f = prey._flight;
    const tI = Math.max(0.3, f.dur * 0.55);
    const intercept = new THREE.Vector3().lerpVectors(f.from, f.to, Math.min(tI / f.dur, 1));
    intercept.y = THREE.MathUtils.lerp(f.from.y, f.to.y, Math.min(tI / f.dur, 1))
      + Math.sin(Math.min(tI / f.dur, 1) * Math.PI) * (prey.opts?.flightArc ?? 1.6);
    const d = Math.hypot(intercept.x - gp.x, intercept.z - gp.z);
    this._resolveRocksPoint(intercept, 0.75); // 落点避开岩石刚体（着陆不进石）
    return {
      stage: "pounce",
      prey,
      t: 0,
      from: gp.clone(),
      leapTo: intercept,
      dur: Math.max(0.3, tI),
      arc: THREE.MathUtils.clamp(Math.max(d * 0.16, intercept.y * 0.9), 0.5, 2.2),
      rolled: false,
      caught: false,
      spin: 0,
    };
  }

  /** 捕食状态机（任意音乐播放时由 main.js 置 huntArmed）：
   *  选最近锦鸡；>30m 正常步行不狩猎；15~30m 奔跑逼近（约奔 10m）；奔进 10~25m
   *  窗口或 15m 内 → 跃起（预判空中落点截击，存在空捕概率）。
   *  空捕成功 → 前爪擒获 + 空中转体 + 子弹时间；扑空 → 就地思量后再猎。 */
  _huntStep(dt, baseSpeed) {
    const hcfg = this.config.hunt ?? {};
    const armed = this.huntArmed && hcfg.enabled !== false && this.pheasants?.length;
    if (!armed) {
      if (this._hunt) { this._hunt = null; this._huntCd = 6; }
      return null;
    }
    if (this._huntCd > 0) { this._huntCd -= dt; return null; }
    const gp = this.group.position;
    if (!this._hunt) {
      // 发现猎物：选【最近】的可见锦鸡（就近而猎，减少无效奔袭）
      let best = null, bd = Infinity;
      for (const p of this.pheasants) {
        if (!p.group.visible || p.state === "被获") continue;
        const d = gp.distanceTo(p.pos);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best || bd > (hcfg.stalkDistance ?? 30)) return null; // 超过 30 米：正常步行，不狩猎
      if (bd <= (hcfg.directPounceDistance ?? 15)) {
        // 距离小于 15 米：不起步直接跃起捕食
        this._hunt = this._beginPounce(best, gp, hcfg);
        return { label: "飞扑", stage: "pounce", targetSpeed: 0, dir: this._hunt.leapTo.clone().sub(gp), bioState: "ROAR", locked: true, leap: 0.3 };
      }
      this._hunt = { stage: "sprint", prey: best, t: 0 }; // 15~30 米：奔跑逼近
    }
    const H = this._hunt, prey = H.prey;
    if (prey.state === "被获" && !["feed", "carry", "pounce"].includes(H.stage)) { this._hunt = null; this._huntCd = 8; return null; }
    const pp = prey.pos;
    const d = Math.hypot(pp.x - gp.x, pp.z - gp.z);
    const dir = new THREE.Vector3(pp.x - gp.x, 0, pp.z - gp.z);
    switch (H.stage) {
      case "sprint": {
        if (d > (hcfg.stalkDistance ?? 30) * 1.3) { this._hunt = null; this._huntCd = 5; return null; }
        // 奔进 10~25 米跃起窗口（默认 ≤20m，约奔 10m）或猎物惊逃 → 起扑
        if (d <= (hcfg.pounceDistance ?? 20) || prey.state === "奔逃" || prey.state === "惊飞") {
          const next = this._beginPounce(prey, gp, hcfg);
          this._hunt = next;
          return { label: "飞扑", stage: "pounce", targetSpeed: 0, dir: next.leapTo.clone().sub(gp), bioState: "ROAR", locked: true, leap: 0.3 };
        }
        return { label: "奔跑", stage: "sprint", targetSpeed: baseSpeed * (hcfg.sprintSpeed ?? 3.0), dir, bioState: "WALK", crouch: 0.15 };
      }
      case "pounce": {
        H.t += dt / H.dur;
        const t = Math.min(H.t, 1);
        gp.x = THREE.MathUtils.lerp(H.from.x, H.leapTo.x, t);
        gp.z = THREE.MathUtils.lerp(H.from.z, H.leapTo.z, t);
        gp.y = groundHeight(gp.x, gp.z) + Math.sin(t * Math.PI) * H.arc + (H.caught ? Math.sin(t * Math.PI) * 0.6 : 0);
        // 空捕判定：临近截击点且未掷签 → 按概率空中捕获
        if (!H.rolled && H.t >= 0.82) {
          H.rolled = true;
          if (Math.random() < (hcfg.airCatchProbability ?? 0.35)) {
            H.caught = true;
            // 前爪够着锦鸡：挂到前足骨，同时触发空中转体 + 子弹时间
            const paw = this.entity.boneMap.get("FLFoot") || this.entity.boneMap.get("FRFoot");
            if (paw) prey._carriedBy(paw);
            else prey._carriedBy(this.entity.boneMap.get("Head"));
            H.spin = (Math.random() < 0.5 ? -1 : 1) * Math.PI * 2 * 1.25; // 空中转体一周余
            this.slowmoLeft = hcfg.bulletTimeDuration ?? 1.6;             // 子弹时间慢镜头
            this.onAirCatch?.(gp.clone());
          }
        }
        if (H.caught) {
          // 空中转体：在剩余滞空段绕身轴旋转
          this.group.rotation.y += H.spin * dt * 0.9;
        }
        if (t >= 1) {
          // 落地：雪花半球飞溅（跃起击杀力度）
          this.onLeapLand?.(gp.clone());
          if (H.caught) {
            // 由前爪转衔于口，进入献获
            prey._carriedBy(this.entity.boneMap.get("Head"));
            H.stage = "carry"; H.t = 0;
            return { label: "献获", stage: "carry", targetSpeed: 0, dir, bioState: "IDLE", locked: true };
          }
          // 扑空（锦鸡逃脱）：虎是捕猎者，不消失不重生——就地落住进入「思量」，
          // 随后从此处重新判断下一次捕食路线
          this._hunt = { stage: "ponder", prey, t: 0, dir: dir.clone() };
          return { label: "思量", stage: "ponder", targetSpeed: 0, dir, bioState: "IDLE", locked: true, crouch: 0.22 };
        }
        return { label: H.caught ? "空捕" : "飞扑", stage: "pounce", targetSpeed: 0, dir, bioState: "ROAR", locked: true, leap: Math.min(t * 1.8, 1) };
      }
      case "ponder": {
        // 思量：在不成功地点驻留，缓转头扫视判断；结束即快速转向下一次捕食
        H.t += dt;
        if (H.t >= (hcfg.ponderDuration ?? 2.4)) {
          this._hunt = null;
          this._huntCd = 0.6; // 短冷却：立即从不成功地点重新规划捕食路线
          return null;
        }
        const scan = Math.sin(H.t * 1.7) * 0.85; // 左右扫视
        const yaw0 = Math.atan2(H.dir.x, H.dir.z) + scan;
        return {
          label: "思量", stage: "ponder", targetSpeed: 0,
          dir: new THREE.Vector3(Math.sin(yaw0), 0, Math.cos(yaw0)),
          bioState: "IDLE", locked: true, crouch: 0.22,
        };
      }
      case "carry": {
        // 叼着猎物去见母亲（雪兔）：抵达 2.5m 即放下献获，与母相伴片刻
        const mother = this._mother;
        if (!mother) { this._hunt = null; this._huntCd = 10; return null; }
        const rp = mother.group.position;
        const rd = Math.hypot(rp.x - gp.x, rp.z - gp.z);
        const rdir = new THREE.Vector3(rp.x - gp.x, 0, rp.z - gp.z);
        if (rd < 2.5) {
          const drop = new THREE.Vector3(
            gp.x + (rdir.x / Math.max(rd, 1e-3)) * 1.0, 0,
            gp.z + (rdir.z / Math.max(rd, 1e-3)) * 1.0
          );
          drop.y = groundHeight(drop.x, drop.z);
          prey._dropAt(this.scene, drop);
          this._hunt = null;
          this._huntCd = hcfg.cooldown ?? 15;
          this._with = 5; // 与母亲相伴（对话自然触发）
          return null;
        }
        return { label: "献获", stage: "carry", targetSpeed: baseSpeed * 0.9, dir: rdir, bioState: "WALK", locked: false, crouch: 0 };
      }
    }
    return null;
  }

  /** 把巡游相位对齐到离当前位置最近的路径点（觅母离径后平滑回归） */
  _syncPathT(pos) {
    let best = 0, min = Infinity;
    for (let i = 0; i < 64; i++) {
      const p = this.path.getPointAt(i / 64);
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < min) { min = d; best = i; }
    }
    this.pathT = best / 64;
  }

  /** 岩石刚体避让：把点推出岩体碰撞圈（径向推出→自然沿切向滑绕；两遍处理重叠岩组） */
  _resolveRocksPoint(v, margin = 0.55) {
    const rocks = this.obstacles;
    if (!rocks?.length) return v;
    for (let pass = 0; pass < 2; pass++) {
      for (const r of rocks) {
        const dx = v.x - r.x, dz = v.z - r.z;
        const min = r.r + margin;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-4;
        v.x = r.x + (dx / d) * min;
        v.z = r.z + (dz / d) * min;
      }
    }
    return v;
  }

  /** 每帧：grove 可为 null；传入了才做缠尾；rabbit（母亲）传入则启用觅母接近 */
  update(dt, time, grove, rabbit) {
    const cfg = this.config.tiger;
    const baseSpeed = 1.15 * cfg.speed;

    // 帧首撤销上帧的头颈瞄准增量：让步态驱动器从干净基线插值，瞄准量不逐帧累积
    if (this._aimApplied) {
      const a = this._aimApplied;
      a.neck?.rotation && (a.neck.rotation.y -= a.ny);
      if (a.head) { a.head.rotation.y -= a.hy; a.head.rotation.x -= a.hx; }
      this._aimApplied = null;
    }

    // —— 捕食（音乐触发）：潜行 → 爆发 → 飞扑 → 叼起献母，优先于觅母与巡游 ——
    this._mother = rabbit;
    const huntCtl = this._huntStep(dt, baseSpeed);

    // —— 觅母：发现母亲（雪兔）则缓步接近（不扑不快）；
    // 近身相伴片刻后回归巡游，跟丢了也放弃 ——
    this._approachCd = Math.max(0, (this._approachCd ?? 0) - dt);
    let stalk = null;
    let motherDistance = Infinity;
    if (!huntCtl && rabbit && rabbit.group.visible !== false) {
      const rd = this.group.position.distanceTo(rabbit.group.position);
      motherDistance = rd;
      if ((this._with ?? 0) > 0) {
        this._with -= dt;
        stalk = "stay";
        if (this._with <= 0 || rd > 4.5) { this._with = 0; this._approachCd = 30; stalk = null; }
      } else if (this._approachCd <= 0 && rd < 7) {
        stalk = rd < 2.0 ? "stay" : "approach";
        if (stalk === "stay") this._with = 6;
      }
    }
    this._dialogIntentCd = Math.max(0, this._dialogIntentCd - dt);
    if (!huntCtl && stalk === "stay" && motherDistance < 2.8 && this._dialogIntentCd <= 0) {
      this.mind.signal("dialog", {
        target: rabbit?.mind?.identity?.id || "rabbit-mother",
        context: this._hunt ? "献获后陪伴" : "竹林里与母亲相伴",
      });
      this._dialogIntentCd = 4;
    }

    // —— 行为层：捕食 / 觅母 / 巡游 / 驻足观望（内驱力计时器） ——
    let targetSpeed = baseSpeed;
    if (huntCtl) {
      targetSpeed = huntCtl.targetSpeed;
      this.state = huntCtl.label;
    } else if (stalk === "approach") {
      targetSpeed = baseSpeed * 0.35; // 有意接近，但不要太快
      this.state = "接近";
    } else if (stalk === "stay") {
      targetSpeed = 0;
      this.state = "相伴";
    } else if (this._pauseLeft > 0) {
      this._pauseLeft -= dt;
      targetSpeed = 0;
      this.state = "驻足";
    } else {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pauseLeft = cfg.pauseDuration ?? 2.4;
        this._pauseTimer = (cfg.pauseInterval ?? 16) * (0.8 + Math.random() * 0.6);
      }
      this.state = "巡游";
    }
    this._speedCur += (targetSpeed - this._speedCur) * Math.min(dt * 3, 1);
    const moving = THREE.MathUtils.clamp(this._speedCur / baseSpeed, 0, 1);

    // —— 运动层：捕食直趋猎物 / 觅母直趋 / 沿巡游路径 ——
    const gp = this.group.position;
    let targetYaw;
    if (huntCtl) {
      if (!huntCtl.locked) {
        const dir = huntCtl.dir;
        const dist = dir.length();
        if (dist > 1.2) {
          dir.normalize();
          gp.x += dir.x * this._speedCur * dt;
          gp.z += dir.z * this._speedCur * dt;
        }
        this._resolveRocksPoint(gp); // 岩石刚体：绕石而行
        gp.y = groundHeight(gp.x, gp.z);
      }
      gp.y -= (huntCtl.crouch ?? 0) * 0.16; // 潜行深压身位（匍匐）
      targetYaw = Math.atan2(huntCtl.dir.x, huntCtl.dir.z);
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, 0, 0.1);
      this._syncPathT(gp); // 巡游相位跟到最近点，收兵回归时不瞬移
    } else if (stalk) {
      const rp = rabbit.group.position;
      const dir = new THREE.Vector3(rp.x - gp.x, 0, rp.z - gp.z);
      const dist = dir.length();
      if (stalk === "approach" && dist > 1.6) {
        dir.normalize();
        gp.x += dir.x * this._speedCur * dt;
        gp.z += dir.z * this._speedCur * dt;
      }
      this._resolveRocksPoint(gp); // 岩石刚体：绕石而行
      gp.y = groundHeight(gp.x, gp.z);
      targetYaw = Math.atan2(dir.x, dir.z);
      this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, 0, 0.1);
      this._syncPathT(gp); // 巡游相位跟到最近点，回归路径时不瞬移
    } else {
      this.pathT = (this.pathT + (this._speedCur * dt) / this.pathLength) % 1;
      const p = this.path.getPointAt(this.pathT);
      const offPath = Math.hypot(p.x - gp.x, p.z - gp.z);
      if (offPath > 1.6) {
        // 离径（捕猎/觅母/思量之后）：径直走回路径附近，虎不瞬移、不消失重生
        const d = Math.max(offPath, 1e-4);
        gp.x += ((p.x - gp.x) / d) * this._speedCur * dt;
        gp.z += ((p.z - gp.z) / d) * this._speedCur * dt;
        this._resolveRocksPoint(gp); // 岩石刚体：绕石而行
        gp.y = groundHeight(gp.x, gp.z);
        targetYaw = Math.atan2(p.x - gp.x, p.z - gp.z);
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, 0, 0.1);
      } else {
        const tan = this.path.getTangentAt(this.pathT);
        const y = groundHeight(p.x, p.z);
        const ahead = this.path.getPointAt((this.pathT + 0.01) % 1);
        const slope = (groundHeight(ahead.x, ahead.z) - y) * 0.8;
        gp.set(p.x, y, p.z);
        this._resolveRocksPoint(gp); // 岩石刚体：路径穿石处滑绕而过
        gp.y = groundHeight(gp.x, gp.z);
        targetYaw = Math.atan2(tan.x, tan.z);
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, THREE.MathUtils.clamp(slope, -0.2, 0.2), 0.1);
      }
    }
    // 捕食全程身体跟踪猎物当前位置（跃起未擒时也随猎物移动修正朝向；思量/空擒转体除外）
    const huntPrey = this._hunt?.prey;
    const trackPrey = huntCtl && huntPrey && !this._hunt.caught
      && huntPrey.state !== "被获" && !["ponder", "carry"].includes(this._hunt.stage);
    if (trackPrey) targetYaw = Math.atan2(huntPrey.pos.x - gp.x, huntPrey.pos.z - gp.z);
    this.group.rotation.y += shortestAngle(this.group.rotation.y, targetYaw) * Math.min(dt * (trackPrey ? 7 : 4), 1);

    // 物理刚体随动：kinematic 体需要速度量才能正确推挤竹竿（限速防脉冲）
    if (this.body) {
      const bp = this.body.position;
      const inv = 1 / Math.max(dt, 1e-4);
      const vx = THREE.MathUtils.clamp((gp.x - bp.x) * inv, -4, 4);
      const vz = THREE.MathUtils.clamp((gp.z - bp.z) * inv, -4, 4);
      this.body.velocity.set(vx, 0, vz);
      bp.set(gp.x, gp.y, gp.z);
      this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0);
    }

    // —— 骨骼动画（状态机驱动器） ——
    // 步态相位按速度积分；匍匐时叠加 cadence（小步快走），使脚下与位移严格同步、不打滑
    this._gaitCyc = (this._gaitCyc + (this._speedCur / 1.25) * (huntCtl?.cadence ?? 1) * dt) % 1;
    // 状态映射：行进→WALK；驻足→IDLE；驻足偶发咆哮→ROAR
    const roar = this.state === "驻足" && Math.sin(time * 0.8) > 0.85;
    const bioState = huntCtl?.bioState ?? (moving > 0.25 ? "WALK" : roar ? "ROAR" : "IDLE");
    this.entity.setBehaviorState(bioState);
    this.entity.tick({
      time, dt, gait: this._gaitCyc, moving,
      gaitAmp: huntCtl?.gaitAmp ?? 1,
      locomotion: huntCtl?.stage === "sprint" ? "gallop" : undefined, // 爆发切奔跃步态
      leap: huntCtl?.leap ?? 0,       // 飞跃姿态（出膛直线）
      crouch: huntCtl?.crouch ?? 0,   // 匍匐膝折身沉
    });

    // 虎头锁定猎物：身体未转足的偏角由颈/头骨补足（无论匍匐、奔跑、跃起；
    // 空擒转体/献获/思量除外——猎物已入爪口或已脱离追击）。
    // 增量记在 _aimApplied，下一帧首撤销，避免与驱动器插值叠加累积。
    if (trackPrey) {
      const dx = huntPrey.pos.x - gp.x, dz = huntPrey.pos.z - gp.z;
      const dy = huntPrey.pos.y - (gp.y + 1.0); // 猎物相对头高（≈1m）的仰角
      const yawErr = shortestAngle(this.group.rotation.y, Math.atan2(dx, dz));
      const pitchErr = Math.atan2(dy, Math.max(Math.hypot(dx, dz), 1e-3));
      const neck = this.entity.boneMap.get("Neck"), head = this.entity.boneMap.get("Head");
      const ay = THREE.MathUtils.clamp(yawErr, -0.9, 0.9);
      const ap = THREE.MathUtils.clamp(-pitchErr, -0.55, 0.55); // 骨局部绕 +X 正转为低头
      const applied = { neck, head, ny: ay * 0.3, hy: ay * 0.7, hx: ap * 0.7 };
      if (neck) neck.rotation.y += applied.ny;
      if (head) {
        head.rotation.y += applied.hy;
        head.rotation.x += applied.hx;
      }
      this._aimApplied = applied;
    }

    // 虎眼生理联动：驻足细缝、行走微张、咆哮怒目浑圆 + 照膜金光
    if (this._eyeUniforms) {
      const u = this._eyeUniforms;
      const tD = bioState === "ROAR" ? 0.85 : bioState === "WALK" ? 0.3 : 0.15;
      const tG = bioState === "ROAR" ? 1.8 : 1.0;
      const k = Math.min(dt * 4, 1);
      u.uPupilDilate.value += (tD - u.uPupilDilate.value) * k;
      u.uGlowIntensity.value += (tG - u.uGlowIntensity.value) * k;
    }

    // 匍匐姿态完全由 FelineLocomotionController._stalk 自管（四肢小步快走 / 脊柱 S 扭 / 尾低垂扫摆），
    // 此处不再手动覆盖骨骼，避免打断尾与躯干的连贯动作。

    // —— 足迹：落地瞬间留印，5 米外消逝 ——
    this._updatePrints(moving);

    // —— 尾：缠竹叠加（在驱动器默认摆动之上） ——
    this._updateTailCurl(dt, grove);
  }

  /** 足迹：四腿进入支撑期（爪落地）时在爪位留下爪印；距虎超 5 米即移除 */
  _updatePrints(moving) {
    const feet = [
      { bone: "FLFoot", phase: 0.25 }, { bone: "FRFoot", phase: 0.75 },
      { bone: "BLFoot", phase: 0.0 }, { bone: "BRFoot", phase: 0.5 },
    ];
    const SWING = 0.35;
    feet.forEach((f, i) => {
      const p = ((this._gaitCyc + f.phase) % 1 + 1) % 1;
      const prev = this._prevPhases[i];
      // 摆动期→支撑期的沿 = 落地
      if (moving > 0.3 && prev < SWING && p >= SWING) this._dropPrint(f.bone);
      this._prevPhases[i] = p;
    });
    // 消逝：距虎 5 米外移除
    const tp = this.group.position;
    for (let i = this._prints.length - 1; i >= 0; i--) {
      const pr = this._prints[i];
      if (pr.position.distanceTo(tp) > 5) {
        this._printGroup.remove(pr);
        pr.geometry.dispose();
        pr.material.dispose();
        this._prints.splice(i, 1);
      }
    }
  }

  _dropPrint(boneName) {
    const foot = this.entity.boneMap.get(boneName);
    if (!foot) return;
    const w = new THREE.Vector3();
    foot.getWorldPosition(w);
    const geo = new THREE.CircleGeometry(0.085, 10);
    geo.scale(0.85, 1.35, 1); // 椭圆爪印
    const mat = new THREE.MeshBasicMaterial({
      color: 0x5a5348, transparent: true, opacity: 0.42, depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -this.group.rotation.y; // 顺虎行进方向
    m.position.set(w.x, groundHeight(w.x, w.z) + 0.015, w.z);
    m.renderOrder = 1;
    this._printGroup.add(m);
    this._prints.push(m);
    // 上限 60 枚，先进先出
    while (this._prints.length > 60) {
      const old = this._prints.shift();
      this._printGroup.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
  }

  /** 缠竹尾：虎身侧后有竹时，尾中后段卷向竹竿（配置 tiger.tailCurl 可开关） */
  _updateTailCurl(dt, grove) {
    const B = this.entity.boneMap;
    let curl = null;
    if (grove && this.config.tiger.tailCurl) {
      const maxDist = this.config.tiger.tailCurlDistance ?? 1.75;
      const hit = grove.nearestTo(this.group.position, maxDist);
      if (hit) {
        const b = hit.bamboo;
        const local = this.group.worldToLocal(new THREE.Vector3(b.x, b.baseY, b.z));
        if (local.z < 0.3 && local.z > -2.2 && Math.abs(local.x) < 1.4) {
          curl = { w: THREE.MathUtils.smoothstep(maxDist - hit.dist, 0, 0.9), side: Math.sign(local.x) || 1 };
        }
      }
    }
    this._curlW = THREE.MathUtils.lerp(this._curlW ?? 0, curl ? curl.w : 0, Math.min(dt * 5, 1));
    const w = this._curlW;
    if (curl) this._lastCurlSide = curl.side;
    const side = curl ? curl.side : this._lastCurlSide;
    if (w > 0.02 && side) {
      // 缠卷幅度自尾根到尾梢递进（五节链）
      const amps = [0.4, 0.9, 1.5, 2.0, 2.4];
      for (let i = 1; i <= 5; i++) {
        const T = B.get(`Tail${i}`);
        if (!T) break;
        T.rotation.y = THREE.MathUtils.lerp(T.rotation.y, side * amps[i - 1], w * Math.min(i * 0.4, 1));
      }
    }
  }
}

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
