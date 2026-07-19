// 程序化网格生成器：根据物种数据算顶点、法线与骨骼权重
// 躯干/颈/吻为一根高细分轮廓管（颈细、胸隆、腹垂、胯圆、尾收），
// 四肢为附接管，合并为单一 BufferGeometry —— 无拼接断缝，弯曲时有肌肉延展感
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// 两点间骨段圆柱（半径 rA→rB 渐细）：折叠后肢按骨骼绑定姿态成形的工具
function limbBetween(a, b, rA, rB) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rB, rA, len, 12, 6);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

// 躯干轮廓表（以 Panthera tigris altaica 解剖数据标定）
// z 位置 → [半径, 中心高度, 腹侧纵向缩放]
// 形体核心：前胸发达(0.32)、腰腹多肉微垂(0.24×0.86)、臀胯略窄(0.26)
// 尾不在此表：尾为独立锥形细分管（见 _buildBody 尾部段）
const BASE_PROFILE = [
  [-1.06, 0.03, 1.00, 1.0],   // 后封口
  [-1.05, 0.15, 1.00, 1.0],   // 尾根/胯后（尾管接口）
  [-0.85, 0.26, 1.00, 0.95],  // 臀胯骨盆（浑圆，窄于前胸）
  [-0.55, 0.24, 0.98, 0.9],   // 后腹过渡
  [-0.15, 0.24, 0.945, 0.86], // 腰腹多肉、腹线微垂
  [0.20, 0.255, 0.955, 0.95], // 腹前段（饱满）
  [0.50, 0.35, 1.02, 1.25],   // 前胸腔（发达深胸，拍击发力，左右前后向外膨隆）
  [0.75, 0.32, 1.06, 1.0],    // 肩峰（厚实）
  [0.95, 0.24, 1.10, 0.95],   // 颈
  [1.15, 0.20, 1.14, 0.95],   // 颈前
  [1.30, 0.15, 1.15, 0.9],    // 颅底（头由组合件构成）
  [1.34, 0.03, 1.15, 0.9],    // 封口
];
const BASE_DIM = { width: 0.72, height: 1.32, length: 3.1 };

// 兔科轮廓表（以 Lepus timidus 解剖数据标定，绝对尺寸：米）
// 形体核心：前胸窄小(0.05)、后臀蛋形肥大(0.11 = 2× 前胸)、弓背高隆、躯干 0.42m
const RABBIT_PROFILE = [
  [-0.170, 0.010, 0.200, 1.0],  // 后封口
  [-0.165, 0.070, 0.195, 0.95], // 臀端（尾管接口）
  [-0.120, 0.110, 0.200, 0.9],  // 后臀骨盆（蛋形大屁股）
  [-0.050, 0.100, 0.212, 0.85], // 后躯弓背最高
  [0.020, 0.075, 0.210, 0.8],   // 腰背
  [0.080, 0.058, 0.200, 0.8],   // 腰内收
  [0.125, 0.052, 0.195, 0.85],  // 前胸（窄小，流线落地支撑）
  [0.160, 0.042, 0.210, 0.9],   // 颈
  [0.195, 0.045, 0.235, 0.95],  // 头
  [0.230, 0.030, 0.230, 1.0],   // 吻
  [0.250, 0.008, 0.225, 1.0],   // 封口
];
const RABBIT_DIM = { width: 0.2, height: 0.3, length: 0.5 };
const RADIAL = 24;      // 径向分段（圆润、消除棱角）
const RING_INTERP = 3;  // 相邻轮廓环间插值环数（平滑的关键）

export class ProceduralSkinGenerator {
  /**
   * @param {Object} dim - 物种 dimensions { width, height, length }
   * @param {Object} ref - 物种 anatomicalRef { withersHeight, tailLength }
   * @param {Array} bones - 装配器输出的扁平骨骼阵列（顺序即 skinIndex）
   * @param {string} anatomyType - "DIGITIGRADE" | "UNGULIGRADE" | "SALTATORIAL"（兔科蛋形弓背轮廓）
   * @returns {THREE.BufferGeometry} 含 skinIndex / skinWeight 权重
   */
  static generateSkinnedGeometry(dim, ref, bones, anatomyType = "DIGITIGRADE", shape = {}) {
    const geo = this._buildBody(dim, ref, anatomyType, shape);
    if (anatomyType === "SALTATORIAL") this._skinSaltatorial(geo, dim, ref, bones);
    else this._skinAll(geo, dim, ref, bones);
    return geo;
  }

  // ---------- 几何拓扑 ----------
  static _buildBody(dim, ref, anatomyType = "DIGITIGRADE", shape = {}) {
    const BASE = anatomyType === "SALTATORIAL" ? RABBIT_DIM : BASE_DIM;
    const PROFILE = anatomyType === "SALTATORIAL" ? RABBIT_PROFILE : BASE_PROFILE;
    const kz = dim.length / BASE.length;
    const kw = dim.width / BASE.width;
    const kh = dim.height / BASE.height;
    // 形体旋钮：沿体长分区缩放半径（臀 25% / 腹 35% / 胸 25% / 头颈 15%）
    const { rumpScale = 1, bellyScale = 1, chestScale = 1, headScale = 1, legScale = 1, tailScale = 1 } = shape;
    const zoneScale = (ri) => {
      const f = ri / (PROFILE.length - 1);
      return f < 0.25 ? rumpScale : f < 0.6 ? bellyScale : f < 0.85 ? chestScale : headScale;
    };
    const profile = PROFILE.map(([z, r, cy, ys], ri) => [z * kz, r * kw * zoneScale(ri), cy * kh, ys]);

    // 主管：逐环生成 + 环间插值加密
    const ringPts = (r, t) => {
      const [z0, rad0, cy0, ys0] = profile[r];
      const [z1, rad1, cy1, ys1] = profile[r + 1];
      const z = z0 + (z1 - z0) * t, rad = rad0 + (rad1 - rad0) * t, cy = cy0 + (cy1 - cy0) * t;
      const ys = ys0 + (ys1 - ys0) * t;
      const pts = [];
      for (let k = 0; k < RADIAL; k++) {
        const a = (k / RADIAL) * Math.PI * 2;
        const sa = Math.sin(a);
        // 腹侧（下半）按 ys 缩放：腰腹上提、前胸加深
        const yScale = sa < 0 ? ys : 1;
        pts.push([Math.cos(a) * rad * 1.05, cy + sa * rad * 0.95 * yScale, z, Math.cos(a), Math.sin(a)]);
      }
      return pts;
    };
    const ringsAll = [];
    for (let r = 0; r < profile.length - 1; r++) {
      for (let t = 0; t < RING_INTERP; t++) ringsAll.push(ringPts(r, t / RING_INTERP));
    }
    ringsAll.push(ringPts(profile.length - 2, 1)); // 末环

    const positions = [], normals = [], uvs = [], indices = [];
    const totalRings = ringsAll.length;
    for (let r = 0; r < totalRings; r++) {
      for (let k = 0; k < RADIAL; k++) {
        const [x, y, z, nx, ny] = ringsAll[r][k];
        positions.push(x, y, z);
        normals.push(nx, ny, 0);
        uvs.push(k / RADIAL, r / (totalRings - 1));
      }
    }
    for (let r = 0; r < totalRings - 1; r++) {
      for (let k = 0; k < RADIAL; k++) {
        const k2 = (k + 1) % RADIAL;
        const a = r * RADIAL + k, b = r * RADIAL + k2;
        const c = (r + 1) * RADIAL + k, d = (r + 1) * RADIAL + k2;
        indices.push(a, b, c, b, d, c); // 外旋绕序：法线朝外（光照/留白/皮毛膨胀皆以法线为准）
      }
    }
    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    bodyGeo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    bodyGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    bodyGeo.setIndex(indices);

    // 四肢管（与权重剖分共用同一位置定义）
    const geos = [bodyGeo];
    const H = ref.withersHeight;
    const LS = legScale, TS = tailScale; // 旋钮：腿/尾管径倍率
    if (anatomyType === "SALTATORIAL") {
      // 兔科四肢：前肢细小近直立；后肢按骨骼绑定姿态折叠成形（网格即绑定姿态 → 不散架）
      for (const def of this._legDefs(dim)) {
        const front = def.key[0] === "F";
        const S = this._saltSegs(dim, ref, def);
        const parts = front
          ? [
              limbBetween(S.hip, S.knee, dim.width * 0.1 * LS, dim.width * 0.07 * LS),
              limbBetween(S.knee, S.ankle, dim.width * 0.07 * LS, dim.width * 0.05 * LS),
            ]
          : [
              limbBetween(S.hip, S.knee, dim.width * 0.3 * LS, dim.width * 0.17 * LS),  // 肥硕蛋形大腿
              limbBetween(S.knee, S.ankle, dim.width * 0.15 * LS, dim.width * 0.08 * LS), // 细长小腿
            ];
        const paw = new THREE.SphereGeometry(dim.width * 0.13 * LS, 10, 8);
        if (front) {
          paw.scale(0.8, 0.4, 1.6);
          paw.translate(def.x, 0.025, def.z + H * 0.02);
        } else {
          paw.scale(0.7, 0.35, 2.4); // 长脚掌（跳跃行标志）
          paw.translate(def.x, 0.028, S.ankle.z + H * 0.16);
        }
        parts.push(paw);
        geos.push(BufferGeometryUtils.mergeGeometries(parts));
      }
    } else {
      // 猫科四肢：轮廓环插值管（与躯干同法）——肩/大腿肌峰饱满外扩，
      // 腕/踝陡然内敛，肉垫掌部再宽、掌底外扩贴地；顶端没入躯干
      for (const def of this._legDefs(dim)) {
        const front = def.key[0] === "F";
        const leg = this._felineLegTube(def, dim, H, LS, front);
        // 一字步内倾：绕腿根向体轴微倾，脚掌收向中线
        const tilt = (front ? 0.07 : 0.05) * -Math.sign(def.x);
        leg.translate(-def.x, -H, -def.z);
        leg.rotateZ(tilt);
        leg.translate(def.x, H, def.z);
        geos.push(leg);
      }
    }

    // 独立尾管：锥形、纵向 30 段细分（尾根粗→尾尖细），权重按进度给五节尾骨
    // 长度取 anatomicalRef.tailLength（虎 1.0m / 兔 0.06m 绒尾）
    const salt = anatomyType === "SALTATORIAL";
    const tailLen = ref.tailLength;
    const tailGeo = new THREE.CylinderGeometry(
      dim.width * (salt ? 0.1 : 0.028) * TS, dim.width * (salt ? 0.14 : 0.0625) * TS, tailLen, 14, 30
    );
    tailGeo.rotateX(-Math.PI / 2); // 卧倒：锥尖朝 -Z（尾尖）
    tailGeo.translate(0, salt ? H * 0.92 : H * 1.03, (salt ? -0.165 * kz : -1.05 * kz) - tailLen / 2);
    geos.push(tailGeo);

    const merged = BufferGeometryUtils.mergeGeometries(geos);
    merged.computeVertexNormals(); // 平滑着色：消除棱角
    return merged;
  }

  // 兔科四肢骨段端点（几何生成与权重剖分共用，保证逐段同位）
  static _saltSegs(dim, ref, def) {
    const H = ref.withersHeight;
    const front = def.key[0] === "F";
    if (front) {
      return {
        hip: new THREE.Vector3(def.x, H * 0.86, def.z),
        knee: new THREE.Vector3(def.x, H * 0.52, def.z - H * 0.06),
        ankle: new THREE.Vector3(def.x, 0.035, def.z - H * 0.01),
        footTip: new THREE.Vector3(def.x, 0.028, def.z + H * 0.06),
      };
    }
    return {
      hip: new THREE.Vector3(def.x, H * 0.89, def.z),
      knee: new THREE.Vector3(def.x, H * 0.47, def.z + H * 0.3),
      ankle: new THREE.Vector3(def.x, 0.04, def.z + H * 0.06),
      footTip: new THREE.Vector3(def.x, 0.028, def.z + H * 0.32),
    };
  }

  // 猫科腿管：轮廓表（y → 半径）逐环插值成管 —— 消灭"竹节圆柱"
  // 肌峰饱满 → 腕踝内敛 → 肉垫再宽 → 掌底外扩；顶端没入躯干
  static _felineLegTube(def, dim, H, LS, front) {
    const prof = front
      ? [ // 前肢：肩臂肌峰外扩 → 前臂渐收 → 腕细 → 前掌宽厚
          [H * 1.00, 0.115], [H * 0.88, 0.160], [H * 0.62, 0.112],
          [H * 0.38, 0.086], [H * 0.16, 0.068], [H * 0.055, 0.092], [H * 0.02, 0.02],
        ]
      : [ // 后肢：扇形大腿峰 → 小腿收细 → 飞节内敛 → 后掌
          [H * 1.00, 0.120], [H * 0.90, 0.185], [H * 0.65, 0.132],
          [H * 0.38, 0.080], [H * 0.14, 0.062], [H * 0.055, 0.086], [H * 0.02, 0.02],
        ];
    const R = 14, INTERP = 2;
    const rows = [];
    for (let r = 0; r < prof.length - 1; r++) {
      for (let t = 0; t < INTERP; t++) {
        const f = t / INTERP;
        rows.push([
          prof[r][0] + (prof[r + 1][0] - prof[r][0]) * f,
          (prof[r][1] + (prof[r + 1][1] - prof[r][1]) * f) * LS,
        ]);
      }
    }
    rows.push([prof.at(-1)[0], prof.at(-1)[1] * LS]);

    const positions = [], uvs = [], indices = [];
    for (let r = 0; r < rows.length; r++) {
      const [y, rad] = rows[r];
      // 掌部塑形：底部环向前探出并纵向拉长、横向收窄 —— 椭圆肉垫掌，非圆管袜筒
      const paw = y < H * 0.1;
      const zOff = paw ? (H * 0.1 - y) * 0.55 : 0;
      const rx = paw ? rad * 0.92 : rad;
      const rz = paw ? rad * 1.3 : rad;
      for (let k = 0; k < R; k++) {
        const a = (k / R) * Math.PI * 2;
        positions.push(def.x + Math.cos(a) * rx, y, def.z + zOff + Math.sin(a) * rz);
        uvs.push(k / R, r / (rows.length - 1));
      }
    }
    for (let r = 0; r < rows.length - 1; r++) {
      for (let k = 0; k < R; k++) {
        const k2 = (k + 1) % R;
        const a = r * R + k, b = r * R + k2, c = (r + 1) * R + k, d = (r + 1) * R + k2;
        indices.push(a, b, c, b, d, c); // 外旋绕序：法线朝外
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3)); // 占位，merge 后统一重算
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    return g;
  }

  // 四肢管位置（几何与权重共用，保证剖分一致）
  // 前 0.30 / 后 0.28 体宽：猫科一字步的收紧站距（与装配器 ux 一致）
  static _legDefs(dim) {
    const lz = dim.length * 0.21; // 前后腿距拉开
    return [
      { x: -dim.width * 0.3, z: lz, key: "FL" },
      { x: dim.width * 0.3, z: lz, key: "FR" },
      { x: -dim.width * 0.28, z: -lz, key: "BL" },
      { x: dim.width * 0.28, z: -lz, key: "BR" },
    ];
  }

  // ---------- 顶点权重：按解剖区间精确分配 ----------
  static _skinAll(geo, dim, ref, bones) {
    const H = ref.withersHeight;
    const kz = dim.length / BASE_DIM.length;
    const idxOf = (name) => bones.findIndex((b) => b.name === name);
    const legs = this._legDefs(dim).map((d) => ({
      ...d,
      b1: idxOf(d.key + "1"), b2: idxOf(d.key + "2"), bF: idxOf(d.key + "Foot"),
      spine: idxOf(d.key[0] === "F" ? "Chest" : "Pelvis"),
    }));
    const legAt = (x, z, y) => {
      if (y > H * 0.96) return null; // 腿管顶端不超过 H*0.95
      for (const L of legs) {
        if (Math.hypot(x - L.x, z - L.z) < dim.width * 0.28) return L; // 覆盖大腿峰/椭圆掌前沿
      }
      return null;
    };

    const pos = geo.attributes.position;
    const skinIndices = new Uint16Array(pos.count * 4);
    const skinWeights = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      let i1 = idxOf("Mid"), w1 = 1, i2 = idxOf("Root"), w2 = 0;

      const leg = legAt(x, z, y);
      if (leg) {
        // 腿管：按高度 y 分给 大腿/小腿/爪；腿根 50/50 混向脊椎（韧带式无缝过渡）
        if (y > H * 0.81) {
          const t = (y - H * 0.81) / (H * 0.15);
          i1 = leg.b1; w1 = 1 - t * 0.5; i2 = leg.spine; w2 = t * 0.5;
        } else if (y > H * 0.52) {
          const t = (H * 0.81 - y) / (H * 0.29);
          i1 = leg.b1; w1 = 1 - t * 0.85; i2 = leg.b2; w2 = t * 0.85;
        } else if (y > H * 0.19) {
          const t = (H * 0.52 - y) / (H * 0.33);
          i1 = leg.b2; w1 = 1 - t * 0.85; i2 = leg.bF; w2 = t * 0.85;
        } else {
          i1 = leg.bF; w1 = 1; i2 = leg.bF; w2 = 0;
        }
      } else if (z < -1.052 * kz) {
        // 尾管：沿尾长向五节渐给（尾根→尾尖，相位延迟甩鞭的几何基础）
        const t = THREE.MathUtils.clamp((-1.052 * kz - z) / ref.tailLength, 0, 1) * 4; // 0..4
        const seg = Math.min(Math.floor(t), 3);
        const frac = t - seg;
        i1 = idxOf(`Tail${seg + 1}`); i2 = idxOf(`Tail${seg + 2}`);
        w1 = 1 - frac; w2 = frac;
      } else if (z < -0.55 * kz) {
        // 后躯：Pelvis ↔ Mid
        const t = (z + 1.25 * kz) / (0.7 * kz);
        i1 = idxOf("Pelvis"); w1 = 1 - t; i2 = idxOf("Mid"); w2 = t;
      } else if (z < 0) {
        // 腰腹：Pelvis/Mid 混合偏 Mid
        const t = (z + 0.55 * kz) / (0.55 * kz);
        w1 = 0.4 * (1 - t);
        i1 = idxOf("Pelvis"); i2 = idxOf("Mid"); w2 = 1 - w1;
      } else if (z < 0.55 * kz) {
        // 前腹：Mid ↔ Chest
        const t = z / (0.55 * kz);
        i1 = idxOf("Mid"); w1 = 1 - t; i2 = idxOf("Chest"); w2 = t;
      } else if (z < 1.0 * kz) {
        // 胸肩→颈：Chest ↔ Neck
        const t = (z - 0.55 * kz) / (0.45 * kz);
        i1 = idxOf("Chest"); w1 = 1 - t; i2 = idxOf("Neck"); w2 = t;
      } else if (z < 1.25 * kz) {
        // 颈→头：Neck ↔ Head
        const t = (z - 1.0 * kz) / (0.25 * kz);
        i1 = idxOf("Neck"); w1 = 1 - t; i2 = idxOf("Head"); w2 = t;
      } else {
        // 头/吻：Head 为主；下半给 Jaw（张嘴用）
        if (y < 1.06 * (dim.height / BASE_DIM.height)) {
          i1 = idxOf("Jaw"); w1 = 0.75; i2 = idxOf("Head"); w2 = 0.25;
        } else {
          i1 = idxOf("Head"); w1 = 0.85; i2 = idxOf("Neck"); w2 = 0.15;
        }
      }

      skinIndices[i * 4] = i1; skinIndices[i * 4 + 1] = i2;
      skinWeights[i * 4] = w1; skinWeights[i * 4 + 1] = w2;
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  }

  // ---------- 兔科顶点权重：四肢按"最近骨段"吸附、躯干按骨骼 z 区间，杜绝散架 ----------
  static _skinSaltatorial(geo, dim, ref, bones) {
    const kz = dim.length / RABBIT_DIM.length;
    const idxOf = (name) => bones.findIndex((b) => b.name === name);
    // 四肢骨段（与 _buildBody 的 SALTATORIAL 网格逐段同位）
    const segs = [];
    for (const def of this._legDefs(dim)) {
      const S = this._saltSegs(dim, ref, def);
      segs.push(
        { a: S.hip, b: S.knee, bone: idxOf(def.key + "1") },
        { a: S.knee, b: S.ankle, bone: idxOf(def.key + "2") },
        { a: S.ankle, b: S.footTip, bone: idxOf(def.key + "Foot") },
      );
    }
    const _ab = new THREE.Vector3(), _ap = new THREE.Vector3(), _q = new THREE.Vector3();
    const segDist = (p, a, b) => {
      _ab.subVectors(b, a); _ap.subVectors(p, a);
      const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1);
      return _q.copy(a).addScaledVector(_ab, t).distanceTo(p);
    };
    const LEG_R = dim.width * 0.36; // 骨段吸附半径
    // 脊柱骨 z 锚点（与装配器同公式：骨盆 -0.177L / 胸 +0.177L / 颈 0.287L / 头 0.387L）
    const L = dim.length;
    const pelvisZ = -0.177 * L, chestZ = 0.177 * L, neckZ = 0.287 * L, headZ = 0.387 * L;
    const tailRootZ = -0.165 * kz;

    const pos = geo.attributes.position;
    const p = new THREE.Vector3();
    const skinIndices = new Uint16Array(pos.count * 4);
    const skinWeights = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      let i1 = idxOf("Mid"), w1 = 1, i2 = idxOf("Mid"), w2 = 0;

      // 1) 四肢：最近骨段吸附
      let best = LEG_R, bone = -1;
      for (const s of segs) {
        const d = segDist(p, s.a, s.b);
        if (d < best) { best = d; bone = s.bone; }
      }
      if (bone >= 0) {
        i1 = bone; w1 = 1; i2 = bone; w2 = 0;
      } else if (p.z < tailRootZ) {
        // 2) 尾管：按进度给五节尾骨
        const t = THREE.MathUtils.clamp((tailRootZ - p.z) / ref.tailLength, 0, 1) * 4;
        const seg = Math.min(Math.floor(t), 3);
        const frac = t - seg;
        i1 = idxOf(`Tail${seg + 1}`); i2 = idxOf(`Tail${seg + 2}`);
        w1 = 1 - frac; w2 = frac;
      } else if (p.z < pelvisZ) {
        i1 = idxOf("Pelvis"); i2 = idxOf("Pelvis");
      } else if (p.z < 0) {
        const t = (p.z - pelvisZ) / -pelvisZ;
        i1 = idxOf("Pelvis"); w1 = 1 - t; i2 = idxOf("Mid"); w2 = t;
      } else if (p.z < chestZ) {
        const t = p.z / chestZ;
        i1 = idxOf("Mid"); w1 = 1 - t; i2 = idxOf("Chest"); w2 = t;
      } else if (p.z < neckZ) {
        const t = (p.z - chestZ) / (neckZ - chestZ);
        i1 = idxOf("Chest"); w1 = 1 - t; i2 = idxOf("Neck"); w2 = t;
      } else if (p.z < headZ) {
        const t = (p.z - neckZ) / (headZ - neckZ);
        i1 = idxOf("Neck"); w1 = 1 - t; i2 = idxOf("Head"); w2 = t;
      } else {
        // 头/吻：Head 为主（兔不咆哮，下颌不拆分）
        i1 = idxOf("Head"); w1 = 0.9; i2 = idxOf("Neck"); w2 = 0.1;
      }

      skinIndices[i * 4] = i1; skinIndices[i * 4 + 1] = i2;
      skinWeights[i * 4] = w1; skinWeights[i * 4 + 1] = w2;
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  }
}
