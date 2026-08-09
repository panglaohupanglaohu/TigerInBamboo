// =====================================================================
//  BirdVortexManager · 万鸟归巢 · 十二组群任务系统（The Mega Bird Maelstrom）
//
//  高性能 InstancedMesh（1000 只 / 6 个 Draw Call）
//  · 五棱锥身体 + 三角薄翼 · 实例化墨线描边（addOutline 等效壳）
//  · 3 面 × 4 组 = 12 组 ≈ 83 只/组 = 1000：
//      A 组角度随观者方位压缩：电车/送信人靠近时，盘旋鸟河向「可见面」聚拢
//  · 地面锚点按星球曲率下沉：h = √(Rg²−d²) − Rg（精确球冠矢高公式）
//      面0 = 左塔壁面 · 面1 = 右塔壁面 · 面2 = 三重拱墙面
//      A 组：双子塔空域双螺旋盘旋（参数化阿基米德，半径 6–15，Y 随角爬升）
//      B 组：墙壁 → 地面觅食（从墙面集结点「一点散落」至地面散开觅食）
//      C 组：地面 → 墙壁攀附（与 B 互逆，随机等候错峰 → B/C 随机交换）
//      D 组：面与面之间通勤（每面一组，随机目标面 ⇄ 每对面都有交换）
//  · 迎光碎金 #FAD7A0 · 背光藏青 #2C3E50 硬色块实例色
//  约定：旋涡坐标系 = 叹息之门 seatRoot（+X 右 · +Y 上 · +Z 轨向）
// =====================================================================
import * as THREE from "three";
import { toonMat, INK_COLOR } from "../assets/toon.js";

/** 迎光碎金 / 背光藏青 */
export const VORTEX_LIT = new THREE.Color(0xfad7a0);
export const VORTEX_SHADE = new THREE.Color(0x2c3e50);

const DEFAULT_COUNT = 1000;
const COUNT_MIN = 50; // 允许圣城小群旋涡；门体仍默认 1000
const COUNT_MAX = 2400;

// ---------- 分组 ----------
const FACE_COUNT = 3; // 面0 左塔 · 面1 右塔 · 面2 三重拱墙
const GROUPS_PER_FACE = 4; // A/B/C/D
const GROUP_COUNT = FACE_COUNT * GROUPS_PER_FACE; // 12
const ROLE_A = 0; // 盘旋
const ROLE_B = 1; // 墙→地
const ROLE_C = 2; // 地→墙
const ROLE_D = 3; // 面↔面

// ---------- A 组旋涡场（门局部高度 / 水平半径） ----------
const R_MIN = 6.0;
const R_MAX = 15.0;
const R_BREATHE_AMP = 2.2;
const R_BREATHE_HZ = 0.7;
const FLARE_BASE = 0.8;
const FLARE_TOP = 0.4;
const R_CLAMP_MIN = 3.5;
const R_CLAMP_MAX = 22;
const Y_FLOOR = 15;
const Y_CEIL = 62;
const OMEGA_MIN = 0.55;
const OMEGA_MAX = 1.2;
const RISE_PER_RAD = 1.5;
const BOB_AMP = 5.0;
const BOB_HZ = 0.5;
const TRAM_SEP_R = 7.5;

// ---------- 双子塔 / 拱墙体量（与 abandonedGate 同规，gate 局部坐标） ----------
const TOWER_OFF = 5.0;
const TOWER_TIERS = [
  { w: 9.2, d: 16.0, h: 12.5, y0: 0.0 },
  { w: 8.0, d: 13.8, h: 11.0, y0: 11.75 },
  { w: 6.9, d: 11.8, h: 10.0, y0: 22.1 },
  { w: 5.9, d: 10.0, h: 8.5, y0: 31.5 },
];
const ARCH_PITCH = 13.2; // 三重拱沿轨中心距
const ARCH_HALF_DEPTH = 1.1; // 单片拱墙半厚
const ARCH_TOP = 15.0;
const ARCH_X_HALF = 8.2; // 拱墙横向半宽内缘
const ARCH_Z = [-ARCH_PITCH, 0, ARCH_PITCH]; // 三片拱墙中心 z（gate 局部）
const PASS_HALF = 3.0; // 券洞半宽（净宽 6.0，鸟可穿洞）
// 塔体内缘 x≈±4.26，券洞穿越通道必须收在其内侧，否则「过洞豁免」会把鸟
// 放进塔基实体里（这正是拱门右侧立面成片贴鸟的元凶之一）。
const TOWER_INNER_X = 4.26;
const ARCH_SPRING = 11.0; // 起拱线高

// ---------- 墙体动态避障（Obstacle Avoidance & Wall Push） ----------
/** 绝对安全距离锁：小于此值即被强行推开（世界单位） */
const WALL_SAFE = 3.0;
/** 每帧推开强度（0–1，越大越硬；0.5 = 一帧收敛一半穿透量） */
const WALL_PUSH_K = 0.5;
/** 攀附态豁免：栖息鸟允许贴到壁面 CLING 距离，不参与推开 */
const WALL_CLING = 0.12;

// ---------- B/C/D 行为节奏（秒） ----------
const BC_FLY_T = [6, 10]; // 墙↔地 单程
const D_FLY_T = [7, 12]; // 面↔面 单程
const WALL_WAIT = [2, 8]; // 壁上停留
const GROUND_WAIT = [3, 9]; // 地面觅食停留
const D_WAIT = [3, 10]; // 面上停留
/** 栖留抖翅：低幅低频 */
const PERCH_FLAP_AMP = 0.12;
const PERCH_FLAP_HZ = 5.5;
/** 单鸟尺度：1/5 微缩（翼展 0.5–0.9） */
const BIRD_SCALE_MIN = 0.18;
const BIRD_SCALE_MAX = 0.34;

// ---------- 扑翼 ----------
const FLAP_HZ = 16;
const FLAP_AMP = 0.55;

// ---------- 模块级临时量（零 GC） ----------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qFlap = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _off = new THREE.Vector3();
const _rad = new THREE.Vector3();
const _wallN = new THREE.Vector3(); // 避障出射法向（切向化速度用）
const _tan = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _tram = new THREE.Vector3();
const _viewer = new THREE.Vector3();
const _frameOrigin = new THREE.Vector3();
const _frameUp = new THREE.Vector3();
const _frameRight = new THREE.Vector3();
const _frameForward = new THREE.Vector3();
const _frameQ = new THREE.Quaternion();
const _col = new THREE.Color();
const _lit = VORTEX_LIT.clone();
const _shade = VORTEX_SHADE.clone();
const _sun = new THREE.Vector3(1, 0.4, 0.2).normalize();
const _dummy = new THREE.Object3D();

const rand = (a, b) => a + Math.random() * (b - a);
const smooth01 = (x) => x * x * (3 - 2 * x);
const wrapPi = (x) => {
  x = x % (Math.PI * 2);
  if (x > Math.PI) x -= Math.PI * 2;
  else if (x < -Math.PI) x += Math.PI * 2;
  return x;
};

// ---------- 观者可见侧聚群（电车/送信人靠近时盘旋鸟河向观者一面包拢） ----------
const VIEW_NEAR = 70; // 此距离内全聚拢
const VIEW_FAR = 180; // 此距离外完全散开
const VIEW_COMPRESS = 0.68; // 角度压缩强度（1→约 3 倍面密度）

// ---------- 送信人惊飞闪避 ----------
const PLAYER_SEP_R = 9; // 位置式闪避半径（逼近即被推开）
const STARTLE_R = 14; // 惊飞半径：停留中的鸟被惊起冲入飞行态
const STARTLE_DUR_MUL = 0.55; // 惊飞逃逸提速（行程时长压缩）
const STARTLE_MIN_DUR = 2.5;

/** 实例化反向壳描边（addOutline 的 InstancedMesh 等效实现） */
function outlineMatInstanced(thickness = 0.18) {
  const mat = new THREE.MeshBasicMaterial({
    color: INK_COLOR,
    side: THREE.BackSide,
    depthWrite: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tfloat tmHash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
\ttransformed += normal * (${thickness.toFixed(4)} * (0.7 + 0.5 * tmHash));`
    );
  };
  mat.customProgramCacheKey = () => `vortex-outline-${thickness}`;
  return mat;
}

/** 实例鸟材质：Basic + 实例色 = 碎金/藏青硬色块必见 */
function birdInstanceMat() {
  return new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
}

function makeWingGeo(side) {
  const s = new THREE.Shape();
  s.moveTo(0.05 * side, 0.28);
  s.lineTo(0.05 * side, -0.4);
  s.lineTo(0.95 * side, -0.04);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.01, 0);
  geo.computeVertexNormals();
  return geo;
}

/** 模板几何：五棱锥身体 + 左右三角翼（截图 / 目录预览用） */
export function createVortexBirdTemplate(color = 0xfad7a0) {
  const g = new THREE.Group();
  g.name = "vortex-bird-template";
  const mat = toonMat(color, { flatShading: true });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 5), mat);
  body.rotation.x = -Math.PI / 2;
  body.scale.set(0.75, 0.48, 1);
  const wingL = new THREE.Mesh(makeWingGeo(1), mat);
  const wingR = new THREE.Mesh(makeWingGeo(-1), mat);
  g.add(body, wingL, wingR);
  return g;
}

/**
 * @param {THREE.Scene|THREE.Object3D} scene
 * @param {{
 *   count?: number, origin?: THREE.Vector3, up?: THREE.Vector3,
 *   right?: THREE.Vector3, forward?: THREE.Vector3, sunDir?: THREE.Vector3,
 *   getTram?: () => THREE.Object3D|null,
 *   yFloor?: number, yCeil?: number, rMin?: number, rMax?: number,
 *   spiralOnly?: boolean, // true = 全体 A 组双螺旋长河（圣城等非门体锚点）
 *   name?: string,
 * }} [opts]
 */
export class BirdVortexManager {
  constructor(scene, opts = {}) {
    const count = THREE.MathUtils.clamp(
      Number.isFinite(opts.count) ? opts.count | 0 : DEFAULT_COUNT,
      COUNT_MIN,
      COUNT_MAX
    );
    this.count = count;
    this.scene = scene;
    this.getTram = opts.getTram || null;
    /** 全体走双螺旋盘旋，不攀附门体假想墙（用于高山圣城等） */
    this.spiralOnly = !!opts.spiralOnly;

    this.origin = (opts.origin || new THREE.Vector3(0, 40, 0)).clone();
    this.up = (opts.up || new THREE.Vector3(0, 1, 0)).clone().normalize();
    this.right = (opts.right || new THREE.Vector3(1, 0, 0)).clone().normalize();
    this.forward = (opts.forward || new THREE.Vector3(0, 0, 1)).clone().normalize();
    this.forward.addScaledVector(this.up, -this.forward.dot(this.up)).normalize();
    this.right.crossVectors(this.up, this.forward).normalize();
    this.forward.crossVectors(this.right, this.up).normalize();

    this.sunDir = (opts.sunDir || _sun).clone().normalize();
    this.yFloor = Number.isFinite(opts.yFloor) ? opts.yFloor : Y_FLOOR;
    this.yCeil = Number.isFinite(opts.yCeil) ? opts.yCeil : Y_CEIL;
    this.rMin = Number.isFinite(opts.rMin) ? opts.rMin : R_MIN;
    this.rMax = Number.isFinite(opts.rMax) ? opts.rMax : R_MAX;
    // 地面曲率：origin 到行星中心距离 = 门脚处地表半径
    this._groundR = Math.max(this.origin.length(), 1);
    // 观者聚群状态（平滑追踪）
    this._viewAz = 0;
    this._viewK = 0;

    this.root = new THREE.Group();
    this.root.name = opts.name || (this.spiralOnly ? "bird-vortex-spiral-river" : "bird-vortex-maelstrom");
    this.root.frustumCulled = false;
    scene.add(this.root);

    // 共享几何
    this._bodyGeo = new THREE.ConeGeometry(0.42, 1.15, 5);
    this._bodyGeo.rotateX(-Math.PI / 2);
    this._bodyGeo.scale(0.8, 0.5, 1);
    this._bodyGeo.computeVertexNormals();
    this._wingLGeo = makeWingGeo(1);
    this._wingRGeo = makeWingGeo(-1);
    this._wingLGeo.scale(1.35, 1.35, 1.35);
    this._wingRGeo.scale(1.35, 1.35, 1.35);

    this._bodyMat = birdInstanceMat();
    this._wingMat = birdInstanceMat();
    // 描边几何厚度 0.18 × 实例 scale(0.18–0.34) ≈ 世界 0.03–0.06：细鸟手绘墨线
    this._outlineMat = outlineMatInstanced(0.18);

    this.bodyMesh = new THREE.InstancedMesh(this._bodyGeo, this._bodyMat, count);
    this.wingLMesh = new THREE.InstancedMesh(this._wingLGeo, this._wingMat, count);
    this.wingRMesh = new THREE.InstancedMesh(this._wingRGeo, this._wingMat, count);
    this.bodyOut = new THREE.InstancedMesh(this._bodyGeo, this._outlineMat, count);
    this.wingLOut = new THREE.InstancedMesh(this._wingLGeo, this._outlineMat, count);
    this.wingROut = new THREE.InstancedMesh(this._wingRGeo, this._outlineMat, count);

    for (const m of [
      this.bodyMesh,
      this.wingLMesh,
      this.wingRMesh,
      this.bodyOut,
      this.wingLOut,
      this.wingROut,
    ]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = count;
      this.root.add(m);
    }

    const mkColorAttr = () => {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      return attr;
    };
    this.bodyMesh.instanceColor = mkColorAttr();
    this.wingLMesh.instanceColor = mkColorAttr();
    this.wingRMesh.instanceColor = mkColorAttr();

    // SoA 状态
    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.pz = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.vz = new Float32Array(count);
    // 分组
    this.role = new Uint8Array(count); // 0=A 1=B 2=C 3=D
    this.faceOf = new Uint8Array(count); // 当前所在面
    // A 组螺旋参数
    this.theta0 = new Float32Array(count);
    this.h0 = new Float32Array(count);
    this.omega = new Float32Array(count);
    this.rBase = new Float32Array(count);
    // B/C/D 锚点：主锚（墙面/当前面）+ 副锚（地面/目标面）
    this.pLX = new Float32Array(count);
    this.pLY = new Float32Array(count);
    this.pLZ = new Float32Array(count);
    this.pFX = new Float32Array(count);
    this.pFY = new Float32Array(count);
    this.pFZ = new Float32Array(count);
    this.aGX = new Float32Array(count);
    this.aGY = new Float32Array(count);
    this.aGZ = new Float32Array(count);
    this.aFX = new Float32Array(count);
    this.aFY = new Float32Array(count);
    this.aFZ = new Float32Array(count);
    // B/C/D 行程状态
    this.bcP = new Float32Array(count); // 0=主锚 → 1=副锚
    this.bcDir = new Float32Array(count); // +1 向副锚 · -1 向主锚
    this.bcMode = new Uint8Array(count); // 0=停留 · 1=飞行
    this.bcWait = new Float32Array(count);
    this.bcDur = new Float32Array(count);
    this.arcH = new Float32Array(count);
    // 通用
    this.phase = new Float32Array(count);
    this.scale = new Float32Array(count);
    this.spinSign = new Float32Array(count);

    this._groups = new Array(GROUP_COUNT).fill(null);
    this._seedBirds();
    this.update(0, 0, {});
  }

  /** 从三重门 seatRoot 读取最新世界坐标系并重锚鸟群 */
  syncToGate(gate, options = {}) {
    const seatRoot = gate?.userData?.seatRoot || gate;
    if (!seatRoot?.getWorldPosition || !seatRoot?.getWorldQuaternion) return false;
    seatRoot.updateWorldMatrix(true, false);
    seatRoot.getWorldPosition(_frameOrigin);
    seatRoot.getWorldQuaternion(_frameQ);
    _frameUp.set(0, 1, 0).applyQuaternion(_frameQ).normalize();
    _frameRight.set(1, 0, 0).applyQuaternion(_frameQ).normalize();
    _frameForward.set(0, 0, 1).applyQuaternion(_frameQ).normalize();
    this.setGateFrame({
      origin: _frameOrigin,
      up: _frameUp,
      right: _frameRight,
      forward: _frameForward,
      respawn: options.respawn,
    });
    return true;
  }

  /** 重锚到叹息之门（seat 坐标系） */
  setGateFrame(frame) {
    if (!frame?.origin) return this;
    this.origin.copy(frame.origin);
    this.up.copy(frame.up).normalize();
    this.forward.copy(frame.forward).normalize();
    this.forward.addScaledVector(this.up, -this.forward.dot(this.up)).normalize();
    if (frame.right) this.right.copy(frame.right).normalize();
    else this.right.crossVectors(this.up, this.forward).normalize();
    this.forward.crossVectors(this.right, this.up).normalize();
    if (frame.sunDir) this.sunDir.copy(frame.sunDir).normalize();
    this._groundR = Math.max(this.origin.length(), 1);
    if (frame.respawn !== false) {
      this._seedBirds();
      this.update(0, 0, {});
    }
    return this;
  }

  // ---------- 面锚点采样 ----------

  /**
   * 在指定面上采样一个攀附点（gate 局部坐标）。
   * 面0/1 = 双子塔（内壁40% · 外壁25% · 阶台顶20% · 端面15%）
   * 面2 = 三重拱墙（前后立面 + 墙顶沿）
   * @returns {{lx:number,ly:number,lz:number,fx:number,fy:number,fz:number}}
   */
  _spotOnFace(face) {
    return this._sanitizeSpot(this._spotOnFaceRaw(face));
  }

  _spotOnFaceRaw(face) {
    if (face === 2) {
      // 三重拱墙：立面避开券洞（|x|>3.4），z 落在某片拱的前/后面
      if (Math.random() < 0.18) {
        // 墙顶沿
        const a = Math.random() * Math.PI * 2;
        const xt = Math.min(ARCH_X_HALF, TOWER_INNER_X - 0.15);
        return {
          // 墙顶沿同样必须避开塔身（y=15 处塔体二层仍占 |x|≥4.36）
          lx: rand(-xt, xt),
          ly: ARCH_TOP + 0.05,
          lz: rand(-ARCH_PITCH - 1, ARCH_PITCH + 1),
          fx: Math.cos(a),
          fy: 0,
          fz: Math.sin(a),
        };
      }
      const zs = Math.random() < 0.5 ? -1 : 1;
      const arch = [-ARCH_PITCH, 0, ARCH_PITCH][(Math.random() * 3) | 0];
      const xs = Math.random() < 0.5 ? -1 : 1;
      return {
        // 上限收到塔体内缘：原用 ARCH_X_HALF(8.2) 会越过塔内缘(4.26)，
        // 把栖息鸟直接生成在塔基砖体内部 —— 贴墙死鸟的根因之一。
        lx: xs * rand(3.4, Math.min(ARCH_X_HALF, TOWER_INNER_X - 0.15)),
        ly: rand(1.0, ARCH_TOP - 1.0),
        lz: arch + zs * (ARCH_HALF_DEPTH + 0.06),
        fx: 0,
        fy: 0,
        fz: zs,
      };
    }
    const side = face === 0 ? -1 : 1;
    const tw = [0.34, 0.28, 0.22, 0.16];
    let pick = Math.random();
    let ti = 0;
    for (; ti < tw.length - 1; ti++) {
      if (pick < tw[ti]) break;
      pick -= tw[ti];
    }
    const t = TOWER_TIERS[ti];
    const xInner = TOWER_OFF - 0.08 * t.w;
    const xOuter = TOWER_OFF + 0.92 * t.w;
    const zHalf = t.d * 0.5;
    const facePick = Math.random();
    if (facePick < 0.4) {
      return {
        lx: side * (xInner - 0.08),
        ly: t.y0 + rand(0.8, t.h - 0.8),
        lz: rand(-(zHalf - 0.6), zHalf - 0.6),
        fx: -side, fy: 0, fz: 0,
      };
    }
    if (facePick < 0.65) {
      return {
        lx: side * (xOuter + 0.08),
        ly: t.y0 + rand(0.8, t.h - 0.8),
        lz: rand(-(zHalf - 0.6), zHalf - 0.6),
        fx: side, fy: 0, fz: 0,
      };
    }
    if (facePick < 0.85) {
      const a = Math.random() * Math.PI * 2;
      return {
        lx: side * rand(xInner + 0.4, xOuter - 0.4),
        ly: t.y0 + t.h + 0.05,
        lz: rand(-(zHalf - 0.6), zHalf - 0.6),
        fx: Math.cos(a), fy: 0, fz: Math.sin(a),
      };
    }
    const zs = Math.random() < 0.5 ? -1 : 1;
    return {
      lx: side * rand(xInner + 0.4, xOuter - 0.4),
      ly: t.y0 + rand(0.8, t.h - 0.8),
      lz: zs * (zHalf + 0.08),
      fx: 0, fy: 0, fz: zs,
    };
  }

  /**
   * 末端墙体复位：躲避玩家/电车的位移可能把鸟重新怼进砖体，
   * 故在所有位移算子之后再跑一次避障，确保「墙体不可穿透」是最终约束。
   */
  _reassertWalls(i) {
    _p.set(this.px[i], this.py[i], this.pz[i]);
    _vel.set(this.vx[i], this.vy[i], this.vz[i]);
    const flying = this.bcMode[i] === 1;
    this._avoidWalls(_p, _vel, i, flying ? WALL_SAFE : WALL_CLING);
    this.px[i] = _p.x;
    this.py[i] = _p.y;
    this.pz[i] = _p.z;
    this.vx[i] = _vel.x;
    this.vy[i] = _vel.y;
    this.vz[i] = _vel.z;
  }

  /**
   * 锚点消毒：把落在任一实体（拱墙 / 任意塔层）内部的栖息锚点，
   * 沿最短逃逸轴弹到表面外侧。
   *
   * 必须在「生成时」一次性做掉：逐帧推力只能修正位置，若锚点本身埋在砖里，
   * 鸟每帧都会被插值拉回墙体内部，表现为一动不动焊死在墙上的死鸟。
   */
  _sanitizeSpot(s) {
    const EPS = 0.1;
    for (let pass = 0; pass < 4; pass++) {
      let hit = false;
      // 拱墙
      for (let a = 0; a < 3; a++) {
        const dz = s.lz - ARCH_Z[a];
        if (Math.abs(s.lx) < PASS_HALF && s.ly < ARCH_SPRING) continue;
        if (
          Math.abs(s.lx) < ARCH_X_HALF &&
          s.ly < ARCH_TOP &&
          Math.abs(dz) < ARCH_HALF_DEPTH
        ) {
          s.lz = ARCH_Z[a] + (dz >= 0 ? 1 : -1) * (ARCH_HALF_DEPTH + EPS);
          hit = true;
        }
      }
      // 塔层
      for (let sg = -1; sg <= 1; sg += 2) {
        for (let k = 0; k < TOWER_TIERS.length; k++) {
          const tw = TOWER_TIERS[k];
          if (s.ly < tw.y0 || s.ly > tw.y0 + tw.h) continue;
          const cx = sg * (TOWER_OFF + tw.w * 0.42);
          const gx = Math.abs(s.lx - cx) - tw.w * 0.5;
          const gz = Math.abs(s.lz) - tw.d * 0.5;
          if (gx < 0 && gz < 0) {
            if (gx >= gz) s.lx = cx + (s.lx - cx >= 0 ? 1 : -1) * (tw.w * 0.5 + EPS);
            else s.lz = (s.lz >= 0 ? 1 : -1) * (tw.d * 0.5 + EPS);
            hit = true;
          }
        }
      }
      if (!hit) break;
    }
    return s;
  }

  /**
   * 地面高度（gate 局部 y）：星球曲率精确解。
   * 沿局部 up 的竖线与半径 Rg 球面的交点：h = √(Rg²−d²) − Rg（d = 水平偏移）。
   * 门脚 d≈22 处下沉 ≈ 5.8（Rg≈42），不用近似会明显悬空。
   */
  _groundY(lx, lz) {
    const R = this._groundR;
    const d2 = lx * lx + lz * lz;
    return Math.sqrt(Math.max(R * R - d2, 1)) - R + 0.3;
  }

  /** 指定面的地面觅食点（gate 局部）：统一落在门体沿轨两侧开阔地（|z|>15.5），
   *  避开塔基 footprint（|x| 4.3–13.5）与拱墙实体（|z|≤14.3 且 |x| 3–8.5），
   *  y 按星球曲率下沉贴地 */
  _groundSpot(face) {
    const zs = Math.random() < 0.5 ? -1 : 1;
    let lx;
    let lz;
    if (face === 2) {
      lx = rand(-7, 7);
      lz = zs * rand(16, 22);
    } else {
      const side = face === 0 ? -1 : 1;
      lx = side * rand(1, 7);
      lz = zs * rand(15.5, 22);
    }
    return { lx, ly: this._groundY(lx, lz), lz };
  }

  _randOtherFace(face) {
    let f = (Math.random() * FACE_COUNT) | 0;
    if (f === face) f = (f + 1) % FACE_COUNT;
    return f;
  }

  // ---------- 种子 ----------

  _seedBirds() {
    const n = this.count;
    const H = Math.max(this.yCeil - this.yFloor, 1);
    const gs = Math.max(1, Math.round(n / GROUP_COUNT));
    // 组级集结点：每面 4 组共用面，但 B/C 各有独立「一点散落」集结点与地面食堂
    // spiralOnly 不需要墙面/食堂锚点
    if (!this.spiralOnly) {
      for (let g = 0; g < GROUP_COUNT; g++) {
        const face = (g / GROUPS_PER_FACE) | 0;
        this._groups[g] = {
          face,
          rally: this._spotOnFace(face), // B/C 墙面集结点（一点）
          ground: this._groundSpot(face), // B/C 地面食堂中心
        };
      }
    } else {
      for (let g = 0; g < GROUP_COUNT; g++) {
        this._groups[g] = { face: 0, rally: null, ground: null };
      }
    }

    for (let i = 0; i < n; i++) {
      const g = Math.min(GROUP_COUNT - 1, (i / gs) | 0);
      // 圣城等：全体 A 组双螺旋长河
      const role = this.spiralOnly ? ROLE_A : g % GROUPS_PER_FACE;
      const face = this.spiralOnly ? 0 : this._groups[g].face;
      this.role[i] = role;
      this.faceOf[i] = face;
      this.phase[i] = Math.random() * Math.PI * 2;
      this.scale[i] = rand(BIRD_SCALE_MIN, BIRD_SCALE_MAX);
      this.spinSign[i] = Math.random() > 0.12 ? 1 : -1;

      if (role === ROLE_A) {
        // 双螺旋：奇偶两条流相位差 π
        const stream = i % 2;
        this.theta0[i] =
          stream * Math.PI + (i / n) * Math.PI * 2 * 3 + Math.random() * 0.9;
        this.h0[i] = Math.random() * H;
        this.omega[i] = rand(OMEGA_MIN, OMEGA_MAX);
        this.rBase[i] = rand(this.rMin, this.rMax);
        this.bcMode[i] = 1; // A 组恒为「飞行」扑翼档
        continue;
      }

      if (role === ROLE_B || role === ROLE_C) {
        // 主锚 = 墙面集结点 + 微抖动（「一点」）；副锚 = 地面散开觅食点
        const rally = this._groups[g].rally;
        // 沿「壁面切平面」散开，绝不沿法向抖动（沿法向 = 一半鸟被埋进砖体）
        const jn = Math.abs(rally.fx) > 0.5 ? 0 : rand(-1.6, 1.6); // 法向为 X 时锁 X
        const jt = Math.abs(rally.fz) > 0.5 ? 0 : rand(-1.6, 1.6); // 法向为 Z 时锁 Z
        // X 抖动后仍须留在塔体内缘之内，避免滑进相邻塔基
        // 抖动后再消毒一次：抖动可能把鸟从原壁面滑进相邻实体
        const js = this._sanitizeSpot({
          lx: rally.lx + jn,
          ly: rally.ly + rand(-1.5, 1.5),
          lz: rally.lz + jt,
        });
        this.pLX[i] = js.lx;
        this.pLY[i] = js.ly;
        this.pLZ[i] = js.lz;
        // 每只鸟停栖朝向各自偏摆，杜绝同组矩阵完全一致的「纸片堆叠」
        const yaw = rand(-0.7, 0.7);
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        this.pFX[i] = rally.fx * cy - rally.fz * sy;
        this.pFY[i] = rally.fy;
        this.pFZ[i] = rally.fx * sy + rally.fz * cy;
        const gc = this._groups[g].ground;
        const scatter = rand(1, 6); // 从一点散落开的半径
        const sa = Math.random() * Math.PI * 2;
        this.aGX[i] = gc.lx + Math.cos(sa) * scatter;
        this.aGZ[i] = gc.lz + Math.sin(sa) * scatter * 0.7;
        // 每只鸟的散落点单独按曲率求地面高度（不能沿用食堂中心的 y）
        this.aGY[i] = this._groundY(this.aGX[i], this.aGZ[i]);
        const fa = Math.random() * Math.PI * 2;
        this.aFX[i] = Math.cos(fa);
        this.aFY[i] = 0;
        this.aFZ[i] = Math.sin(fa);
        this.arcH[i] = rand(2.5, 5.5);
        this.bcDur[i] = rand(BC_FLY_T[0], BC_FLY_T[1]);
        // B 起始栖息墙面(p=0, 下行待发)；C 起始散落地面(p=1, 上行待发)
        // 随机初始等候 → B/C 在途中随机交错互换
        if (role === ROLE_B) {
          this.bcP[i] = 0;
          this.bcDir[i] = 1;
          this.bcWait[i] = rand(0, WALL_WAIT[1]);
        } else {
          this.bcP[i] = 1;
          this.bcDir[i] = -1;
          this.bcWait[i] = rand(0, GROUND_WAIT[1]);
        }
        this.bcMode[i] = 0;
        continue;
      }

      // ROLE_D：面上栖息，随机目标面通勤
      const spot = this._spotOnFace(face);
      this.pLX[i] = spot.lx;
      this.pLY[i] = spot.ly;
      this.pLZ[i] = spot.lz;
      this.pFX[i] = spot.fx;
      this.pFY[i] = spot.fy;
      this.pFZ[i] = spot.fz;
      this._pickDTarget(i);
      this.bcP[i] = 0;
      this.bcDir[i] = 1;
      this.bcMode[i] = 0;
      this.bcWait[i] = rand(0, D_WAIT[1]);
      this.bcDur[i] = rand(D_FLY_T[0], D_FLY_T[1]);
      this.arcH[i] = rand(5, 10);
    }
  }

  /** D 组：随机挑选 ≠ 当前面的目标面锚点（面与面之间随机交换） */
  _pickDTarget(i) {
    const tf = this._randOtherFace(this.faceOf[i]);
    const spot = this._spotOnFace(tf);
    this.aGX[i] = spot.lx;
    this.aGY[i] = spot.ly;
    this.aGZ[i] = spot.lz;
    this.aFX[i] = spot.fx;
    this.aFY[i] = spot.fy;
    this.aFZ[i] = spot.fz;
    this._dTargetFace = this._dTargetFace || new Uint8Array(this.count);
    this._dTargetFace[i] = tf;
  }

  // ---------- 帧更新 ----------

  /**
   * @param {number} dt
   * @param {number} t 秒
   * @param {{ sunDir?: THREE.Vector3, tram?: THREE.Object3D|null,
   *   viewer?: THREE.Vector3|THREE.Object3D|null }} [ctx]
   */
  update(dt, t, ctx = {}) {
    dt = Math.min(Math.max(dt, 0), 0.05);
    if (ctx.sunDir) this.sunDir.copy(ctx.sunDir).normalize();

    const tram =
      ctx.tram !== undefined ? ctx.tram : this.getTram ? this.getTram() : null;
    let hasTram = false;
    if (tram) {
      tram.getWorldPosition(_tram);
      hasTram = true;
    }

    // 观者（电车/送信人）方位追踪 → 可见侧聚群系数（平滑防跳变）
    const viewer =
      ctx.viewer !== undefined ? ctx.viewer : this.getViewer ? this.getViewer() : null;
    let hasViewer = false;
    if (viewer) {
      if (viewer.isVector3) _p2.copy(viewer);
      else if (viewer.getWorldPosition) viewer.getWorldPosition(_p2);
      else _p2.set(0, 0, 0);
      _viewer.copy(_p2);
      hasViewer = true;
      _off.copy(_p2).sub(this.origin);
      const vH = _off.dot(this.up);
      _off.addScaledVector(this.up, -vH); // 水平面内方位
      const dist = _off.length();
      if (dist > 1e-3) {
        const azT = Math.atan2(_off.dot(this.forward), _off.dot(this.right));
        this._viewAz += wrapPi(azT - this._viewAz) * Math.min(1, dt * 1.6);
      }
      const kT = 1 - THREE.MathUtils.smoothstep(dist, VIEW_NEAR, VIEW_FAR);
      this._viewK += (kT - this._viewK) * Math.min(1, dt * 1.6);
    } else {
      this._viewK = Math.max(0, this._viewK - dt * 1.6);
    }
    const viewCompress = 1 - VIEW_COMPRESS * this._viewK;

    const n = this.count;
    const H = Math.max(this.yCeil - this.yFloor, 1);

    for (let i = 0; i < n; i++) {
      const role = this.role[i];

      // ================= A 组：双子塔双螺旋盘旋 =================
      if (role === ROLE_A) {
        const spin = this.spinSign[i];
        const w = this.omega[i];
        const angRaw = this.theta0[i] + spin * w * t;
        // 可见侧聚群：盘旋角向观者方位压缩（观者近时可见面密度约 ×3）
        const ang =
          this._viewAz + wrapPi(angRaw - this._viewAz) * viewCompress;
        const cosA = Math.cos(ang);
        const sinA = Math.sin(ang);
        const climbed = this.h0[i] + w * t * RISE_PER_RAD;
        let hCyc = climbed % H;
        if (hCyc < 0) hCyc += H;
        const bob = Math.sin(t * BOB_HZ + i) * BOB_AMP;
        const h = this.yFloor + hCyc + bob;
        const flare = FLARE_BASE + FLARE_TOP * (hCyc / H);
        const breathe = Math.sin(t * R_BREATHE_HZ + i * 1.618) * R_BREATHE_AMP;
        const r = THREE.MathUtils.clamp(
          (this.rBase[i] + breathe) * flare,
          R_CLAMP_MIN,
          R_CLAMP_MAX
        );
        _p
          .copy(this.origin)
          .addScaledVector(this.up, h)
          .addScaledVector(this.right, cosA * r)
          .addScaledVector(this.forward, sinA * r);
        // 电车近距排斥（位置式）
        if (hasTram) {
          _off.copy(_p).sub(_tram);
          const dSq = _off.lengthSq();
          if (dSq < TRAM_SEP_R * TRAM_SEP_R && dSq > 1e-6) {
            const d = Math.sqrt(dSq);
            _p.addScaledVector(_off.multiplyScalar(1 / d), TRAM_SEP_R - d);
          }
        }
        // 送信人逼近闪避（位置式推开）
        if (hasViewer) {
          _off.copy(_p).sub(_viewer);
          const dSq = _off.lengthSq();
          if (dSq < PLAYER_SEP_R * PLAYER_SEP_R && dSq > 1e-6) {
            const d = Math.sqrt(dSq);
            _p.addScaledVector(_off.multiplyScalar(1 / d), PLAYER_SEP_R - d);
          }
        }
        // 解析速度（朝向）
        _rad
          .copy(this.right)
          .multiplyScalar(cosA)
          .addScaledVector(this.forward, sinA);
        _tan.crossVectors(this.up, _rad).multiplyScalar(spin);
        const dR =
          Math.cos(t * R_BREATHE_HZ + i * 1.618) * R_BREATHE_HZ * R_BREATHE_AMP * flare;
        const dH = w * RISE_PER_RAD + Math.cos(t * BOB_HZ + i) * BOB_HZ * BOB_AMP;
        _vel
          .copy(_tan)
          .multiplyScalar(r * w)
          .addScaledVector(this.up, dH)
          .addScaledVector(_rad, dR);
        // 盘旋组墙体避障（门体模式）；螺旋长河模式跳过假想门墙
        _vel.normalize();
        if (!this.spiralOnly) this._avoidWalls(_p, _vel, i);
        this.px[i] = _p.x;
        this.py[i] = _p.y;
        this.pz[i] = _p.z;
        this.vx[i] = _vel.x;
        this.vy[i] = _vel.y;
        this.vz[i] = _vel.z;
        continue;
      }

      // ================= B/C 组：墙↔地 觅食往返 =================
      if (role === ROLE_B || role === ROLE_C) {
        this._startle(i, hasViewer);
        this._stepCommute(i, dt, WALL_WAIT, GROUND_WAIT, BC_FLY_T, false);
        this._poseOnPath(i, t, true);
        this._dodgeViewer(i, hasViewer);
        this._reassertWalls(i);
        continue;
      }

      // ================= D 组：面↔面 通勤交换 =================
      this._startle(i, hasViewer);
      this._stepCommute(i, dt, D_WAIT, D_WAIT, D_FLY_T, true);
      this._poseOnPath(i, t, false);
      this._dodgeViewer(i, hasViewer);
      this._reassertWalls(i);
    }

    this._writeAllMatrices(t);
  }

  /** 送信人逼近惊飞：停留中的鸟被惊起，立即冲入飞行态并提速逃逸 */
  _startle(i, hasViewer) {
    if (!hasViewer || this.bcMode[i] !== 0) return;
    const dx = this.px[i] - _viewer.x;
    const dy = this.py[i] - _viewer.y;
    const dz = this.pz[i] - _viewer.z;
    if (dx * dx + dy * dy + dz * dz < STARTLE_R * STARTLE_R) {
      this.bcMode[i] = 1;
      this.bcWait[i] = 0;
      this.bcDur[i] = Math.max(STARTLE_MIN_DUR, this.bcDur[i] * STARTLE_DUR_MUL);
    }
  }

  /** 送信人位置式闪避：飞行途中逼近即被推开（下一帧参数路径自动收回） */
  _dodgeViewer(i, hasViewer) {
    if (!hasViewer || this.bcMode[i] !== 1) return;
    _off.set(this.px[i], this.py[i], this.pz[i]).sub(_viewer);
    const dSq = _off.lengthSq();
    if (dSq < PLAYER_SEP_R * PLAYER_SEP_R && dSq > 1e-6) {
      const d = Math.sqrt(dSq);
      _off.multiplyScalar(1 / d);
      const push = PLAYER_SEP_R - d;
      this.px[i] += _off.x * push;
      this.py[i] += _off.y * push;
      this.pz[i] += _off.z * push;
    }
  }

  /**
   * 通用行程状态机：停留计时 → 飞行推进 → 到锚翻面。
   * B/C：p=0 墙面主锚 ⇄ p=1 地面副锚（到墙下一次下行=B，到地下一次上行=C，
   *       随机等候时长使 B/C 在途中随机交换）。
   * D：p=0 当前面主锚 ⇄ p=1 目标面副锚（到达后副锚转正、再随机选新面）。
   */
  _stepCommute(i, dt, waitAtMain, waitAtSub, flyT, isD) {
    if (this.bcMode[i] === 1) {
      this.bcP[i] += (this.bcDir[i] * dt) / this.bcDur[i];
      if (this.bcDir[i] > 0 && this.bcP[i] >= 1) {
        this.bcP[i] = 1;
        this.bcMode[i] = 0;
        this.bcDir[i] = -1;
        this.bcWait[i] = rand(waitAtSub[0], waitAtSub[1]);
        if (isD) this._arriveDTarget(i);
      } else if (this.bcDir[i] < 0 && this.bcP[i] <= 0) {
        this.bcP[i] = 0;
        this.bcMode[i] = 0;
        this.bcDir[i] = 1;
        this.bcWait[i] = rand(waitAtMain[0], waitAtMain[1]);
      }
    } else {
      this.bcWait[i] -= dt;
      if (this.bcWait[i] <= 0) {
        this.bcMode[i] = 1;
        this.bcDur[i] = rand(flyT[0], flyT[1]);
      }
    }
  }

  /** D 组到达目标面：副锚转正，随机再选下一面（随机交换的落点） */
  _arriveDTarget(i) {
    this.pLX[i] = this.aGX[i];
    this.pLY[i] = this.aGY[i];
    this.pLZ[i] = this.aGZ[i];
    this.pFX[i] = this.aFX[i];
    this.pFY[i] = this.aFY[i];
    this.pFZ[i] = this.aFZ[i];
    this.faceOf[i] = this._dTargetFace[i];
    this._pickDTarget(i);
    this.bcP[i] = 0;
  }

  /**
   * 由行程进度解算世界坐标与朝向速度。
   * 路径 = 主副锚平滑插值 + sin 拱高弧线；飞行时横向微摆。
   * @param {boolean} groundHop 副锚端是否地面（停留时觅食蹦跳）
   */
  _poseOnPath(i, t, groundHop) {
    const p = THREE.MathUtils.clamp(this.bcP[i], 0, 1);
    const e = smooth01(p);
    const flying = this.bcMode[i] === 1;
    const wob = flying ? Math.sin(t * 3 + i * 1.7) * 0.3 * Math.sin(Math.PI * e) : 0;

    const lx = this.pLX[i] + (this.aGX[i] - this.pLX[i]) * e + wob;
    let ly =
      this.pLY[i] +
      (this.aGY[i] - this.pLY[i]) * e +
      Math.sin(Math.PI * e) * this.arcH[i];
    const lz = this.pLZ[i] + (this.aGZ[i] - this.pLZ[i]) * e + wob * 0.6;

    // 停留态微动作：墙面微颤 / 地面觅食蹦跳
    if (!flying) {
      if (groundHop && p > 0.5) ly += Math.abs(Math.sin(t * 6 + i * 1.7)) * 0.12;
      else ly += Math.sin(t * 2 + i) * 0.03;
    }

    _p
      .copy(this.origin)
      .addScaledVector(this.right, lx)
      .addScaledVector(this.up, ly)
      .addScaledVector(this.forward, lz);

    if (flying) {
      // 数值切线：前方采样 - 当前位置
      const e2 = smooth01(THREE.MathUtils.clamp(p + 0.02 * this.bcDir[i], 0, 1));
      const lx2 = this.pLX[i] + (this.aGX[i] - this.pLX[i]) * e2;
      const ly2 =
        this.pLY[i] +
        (this.aGY[i] - this.pLY[i]) * e2 +
        Math.sin(Math.PI * e2) * this.arcH[i];
      const lz2 = this.pLZ[i] + (this.aGZ[i] - this.pLZ[i]) * e2;
      _p2
        .copy(this.origin)
        .addScaledVector(this.right, lx2)
        .addScaledVector(this.up, ly2)
        .addScaledVector(this.forward, lz2);
      _vel.copy(_p2).sub(_p);
      if (_vel.lengthSq() < 1e-8) _vel.set(this.pFX[i], this.pFY[i], this.pFZ[i]);
      _vel.normalize();
    } else {
      // 停留朝向：墙面端朝壁法向，地面端朝随机水平
      const useSub = groundHop ? p > 0.5 : false;
      const fx = useSub ? this.aFX[i] : this.pFX[i];
      const fy = useSub ? this.aFY[i] : this.pFY[i];
      const fz = useSub ? this.aFZ[i] : this.pFZ[i];
      _vel
        .copy(this.right)
        .multiplyScalar(fx)
        .addScaledVector(this.up, fy)
        .addScaledVector(this.forward, fz);
      if (_vel.lengthSq() < 1e-8) _vel.copy(this.forward);
    }

    // ---- 墙体避障 ----
    // 飞行个体：完整安全距离锁（3.0）向外推开。
    // 栖息个体：不豁免，改用「贴面模式」——只把已嵌入砖体的鸟弹回表面外侧，
    // 保留其抓附壁面的观感，同时根除埋进墙皮的穿模。
    this._avoidWalls(_p, _vel, i, flying ? WALL_SAFE : WALL_CLING);

    this.px[i] = _p.x;
    this.py[i] = _p.y;
    this.pz[i] = _p.z;
    this.vx[i] = _vel.x;
    this.vy[i] = _vel.y;
    this.vz[i] = _vel.z;
  }

  /**
   * 要塞墙体动态避障排斥力（Obstacle Avoidance & Wall Push）。
   *
   * 在 gate 局部基（right/up/forward）内求解——此坐标系下三片拱墙与双子塔
   * 均为轴对齐盒体，可用精确 SDF 求最近出射方向，避免世界系斜置导致的错推。
   *
   * @param {THREE.Vector3} p     世界坐标，就地修正
   * @param {THREE.Vector3} v     单位速度，就地做切向化（贴壁滑移）
   * @param {number} i            实例索引
   * @param {number} [safe]       安全距离：飞行用 WALL_SAFE，栖息用 WALL_CLING
   */
  _avoidWalls(p, v, i, safe = WALL_SAFE) {
    _off.copy(p).sub(this.origin);
    let lx = _off.dot(this.right);
    let ly = _off.dot(this.up);
    let lz = _off.dot(this.forward);

    let pushX = 0;
    let pushY = 0;
    let pushZ = 0;

    // ---- 1) 三片拱墙：X∈[-8.2,8.2]，Y∈[0,15]，Z∈{-13.2,0,13.2}±1.1 ----
    // 券洞 |x|<3.0 且 y<11.0 为通透空腔，允许穿越，不施加排斥。
    for (let a = 0; a < 3; a++) {
      const dz = lz - ARCH_Z[a];
      // 券洞豁免：净宽 ±3.0 全段放行。塔体内缘在 |x|≈4.26，整个券洞通道
      // 都在塔体之外，故无需再收窄；收窄反而会在门洞里造出一道「隐形墙」，
      // 把正常穿门的鸟一直往洞壁上顶。
      if (Math.abs(lx) < PASS_HALF && ly < ARCH_SPRING) continue;

      // 到该片墙实体的轴向间隙（负值 = 已在实体内）
      const gx = Math.abs(lx) - ARCH_X_HALF;
      const gy = ly - ARCH_TOP;
      const gz = Math.abs(dz) - ARCH_HALF_DEPTH;

      // 仅当 X/Y 已落在墙板投影内（或紧邻），Z 向才构成撞墙风险
      if (gx > safe || gy > safe) continue;

      if (gz < safe) {
        // 穿透（gz<0）：全额刚性弹出到表面外 safe，一帧解决，杜绝残留埋墙
        // 接近（gz≥0）：按 WALL_PUSH_K 柔性推开，形成平滑的扩半径绕飞
        const pen = safe - gz;
        const k = gz < 0 ? 1 : WALL_PUSH_K;
        pushZ += (dz >= 0 ? 1 : -1) * pen * k;
      }
    }

    // ---- 2) 双子塔：每侧 4 层锥收盒体，取最近层做 SDF 推开 ----
    for (let s = -1; s <= 1; s += 2) {
      for (let k = 0; k < TOWER_TIERS.length; k++) {
        const tw = TOWER_TIERS[k];
        const cx = s * (TOWER_OFF + tw.w * 0.42);
        const hx = tw.w * 0.5;
        const hz = tw.d * 0.5;
        if (ly < tw.y0 - safe || ly > tw.y0 + tw.h + safe) continue;

        const gx = Math.abs(lx - cx) - hx;
        const gz2 = Math.abs(lz) - hz;
        if (gx > safe || gz2 > safe) continue;

        // 取间隙较大的轴作为出射方向 = 最短逃逸路径（盒体 SDF 标准解）
        const gap = Math.max(gx, gz2);
        if (gap >= safe) continue; // 已在安全距离外，绝不可施加负（吸向墙）推力
        const pen = safe - gap;
        const kk = gap < 0 ? 1 : WALL_PUSH_K;
        if (gx >= gz2) pushX += (lx - cx >= 0 ? 1 : -1) * pen * kk;
        else pushZ += (lz >= 0 ? 1 : -1) * pen * kk;
      }
    }

    if (pushX === 0 && pushY === 0 && pushZ === 0) return;

    // 限幅，防止单帧弹射造成位置突跳（需容纳最深穿透的全额弹出）
    const MAXP = 12.0;
    pushX = THREE.MathUtils.clamp(pushX, -MAXP, MAXP);
    pushZ = THREE.MathUtils.clamp(pushZ, -MAXP, MAXP);

    lx += pushX;
    ly += pushY;
    lz += pushZ;

    p.copy(this.origin)
      .addScaledVector(this.right, lx)
      .addScaledVector(this.up, ly)
      .addScaledVector(this.forward, lz);

    // 速度切向化：抵消指向墙面的法向分量，产生自然「擦墙滑翔」而非硬顶
    _wallN
      .copy(this.right)
      .multiplyScalar(pushX)
      .addScaledVector(this.forward, pushZ);
    if (_wallN.lengthSq() > 1e-8) {
      _wallN.normalize();
      const into = v.dot(_wallN);
      if (into < 0) v.addScaledVector(_wallN, -into * 1.25);
      if (v.lengthSq() < 1e-8) v.copy(this.forward);
      v.normalize();
    }
  }

  _writeAllMatrices(t) {
    const n = this.count;
    _sun.copy(this.sunDir);
    const sunSide = _sun.dot(this.right);

    for (let i = 0; i < n; i++) {
      _p.set(this.px[i], this.py[i], this.pz[i]);
      _vel.set(this.vx[i], this.vy[i], this.vz[i]);
      // ---- 飞行切线朝向：正脸/尖嘴实时对齐速度方向（含俯仰）----
      // 关键：不再把 forward 压平到水平面——压平会抹掉俯冲/爬升姿态，
      // 且令同一集结点的栖息鸟退化成完全相同的矩阵，堆叠成「死纸片」。
      if (_vel.lengthSq() > 1e-8) _fwd.copy(_vel).normalize();
      else {
        // 退化兜底：用绕轴切向，保证每只鸟朝向仍互不相同
        _off.copy(_p).sub(this.origin);
        const h = _off.dot(this.up);
        _off.addScaledVector(this.up, -h);
        if (_off.lengthSq() > 1e-6) {
          _rad.copy(_off).normalize();
          _fwd.crossVectors(this.up, _rad).normalize();
        } else _fwd.copy(this.forward);
      }

      // 用「倾斜的 up」构造正交基：保留切线俯仰，同时给出转弯侧倾（banking）
      _up.copy(this.up);
      if (Math.abs(_fwd.dot(_up)) > 0.995) {
        // near-vertical 俯冲/垂直爬升：换参考轴避免叉积退化
        _up.copy(this.forward);
      }
      _right.crossVectors(_up, _fwd);
      if (_right.lengthSq() < 1e-8) {
        _right.crossVectors(this.right, _fwd);
        if (_right.lengthSq() < 1e-8) _right.copy(this.right);
      }
      _right.normalize();
      // 由 right×fwd 反解真正的 up —— 这一步让机体绕切线自然滚转
      _up.crossVectors(_fwd, _right).normalize();
      _m.makeBasis(_right, _up, _fwd);
      _q.setFromRotationMatrix(_m);

      const sc = this.scale[i];
      _s.set(sc, sc, sc);
      _dummy.position.copy(_p);
      _dummy.quaternion.copy(_q);
      _dummy.scale.copy(_s);
      _dummy.updateMatrix();
      this.bodyMesh.setMatrixAt(i, _dummy.matrix);
      this.bodyOut.setMatrixAt(i, _dummy.matrix);

      // 扑翼：飞行全速（16Hz）；栖留低幅低频偶发颤翅
      const flying = this.bcMode[i] === 1;
      const flap = flying
        ? Math.sin(t * FLAP_HZ + i * 0.5 + this.phase[i]) * FLAP_AMP
        : Math.sin(t * PERCH_FLAP_HZ + this.phase[i]) * PERCH_FLAP_AMP;
      _e.set(0, 0, flap);
      _qFlap.setFromEuler(_e);
      _dummy.quaternion.copy(_q).multiply(_qFlap);
      _dummy.updateMatrix();
      this.wingLMesh.setMatrixAt(i, _dummy.matrix);
      this.wingLOut.setMatrixAt(i, _dummy.matrix);
      _e.set(0, 0, -flap);
      _qFlap.setFromEuler(_e);
      _dummy.quaternion.copy(_q).multiply(_qFlap);
      _dummy.updateMatrix();
      this.wingRMesh.setMatrixAt(i, _dummy.matrix);
      this.wingROut.setMatrixAt(i, _dummy.matrix);

      // 光暗硬色块：偏太阳一侧碎金，背侧藏青
      _off.copy(_p).sub(this.origin);
      const side = _off.dot(this.right);
      const lit = sunSide >= 0 ? side > 0 : side < 0;
      _col.copy(lit ? _lit : _shade);
      this.bodyMesh.setColorAt(i, _col);
      this.wingLMesh.setColorAt(i, _col);
      this.wingRMesh.setColorAt(i, _col);
    }

    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.wingLMesh.instanceMatrix.needsUpdate = true;
    this.wingRMesh.instanceMatrix.needsUpdate = true;
    this.bodyOut.instanceMatrix.needsUpdate = true;
    this.wingLOut.instanceMatrix.needsUpdate = true;
    this.wingROut.instanceMatrix.needsUpdate = true;
    if (this.bodyMesh.instanceColor) this.bodyMesh.instanceColor.needsUpdate = true;
    if (this.wingLMesh.instanceColor) this.wingLMesh.instanceColor.needsUpdate = true;
    if (this.wingRMesh.instanceColor) this.wingRMesh.instanceColor.needsUpdate = true;
  }

  /** 样本鸟世界坐标（验收用） */
  getBirdPosition(i, out = new THREE.Vector3()) {
    const j = ((i % this.count) + this.count) % this.count;
    return out.set(this.px[j], this.py[j], this.pz[j]);
  }

  /** 统计：平均高度 / 半径（门局部） */
  sampleStats() {
    let hSum = 0;
    let rSum = 0;
    let litN = 0;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      _p.set(this.px[i], this.py[i], this.pz[i]);
      _off.copy(_p).sub(this.origin);
      hSum += _off.dot(this.up);
      _off.addScaledVector(this.up, -_off.dot(this.up));
      rSum += _off.length();
      if (_off.dot(this.right) > 0) litN++;
    }
    return {
      count: n,
      meanHeight: hSum / n,
      meanRadius: rSum / n,
      litRatio: litN / n,
    };
  }

  dispose() {
    if (this.root.parent) this.root.parent.remove(this.root);
    for (const g of [this._bodyGeo, this._wingLGeo, this._wingRGeo]) g.dispose();
    for (const m of [this._bodyMat, this._wingMat, this._outlineMat]) m.dispose();
    this.root.clear();
  }
}
