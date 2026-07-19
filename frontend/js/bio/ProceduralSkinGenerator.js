// 程序化网格生成器：根据物种数据算顶点、法线与骨骼权重
// 躯干/颈/吻为一根高细分轮廓管（颈细、胸隆、腹垂、胯圆、尾收），
// 四肢为附接管，合并为单一 BufferGeometry —— 无拼接断缝，弯曲时有肌肉延展感
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

// 躯干轮廓表（以 Panthera tigris 标定；z 位置 → [半径, 中心高度]）
// 生成时按物种 dimensions 等比缩放
const BASE_PROFILE = [
  [-1.95, 0.022, 0.86], // 尾尖（细长）
  [-1.75, 0.036, 0.89],
  [-1.55, 0.052, 0.93],
  [-1.30, 0.075, 0.97],
  [-1.05, 0.15, 1.00],  // 尾根/胯后
  [-0.80, 0.34, 1.02],  // 臀胯圆实
  [-0.45, 0.33, 0.98],  // 后腹
  [-0.10, 0.34, 0.94],  // 腰腹（略下垂）
  [0.25, 0.35, 0.98],   // 前腹
  [0.55, 0.36, 1.04],   // 胸腔隆起（肩）
  [0.80, 0.30, 1.08],   // 肩后颈起
  [1.02, 0.24, 1.12],   // 颈
  [1.24, 0.22, 1.16],   // 颈前/颅底
  [1.40, 0.19, 1.14],   // 吻部后（头部前探出肩线）
  [1.54, 0.10, 1.12],   // 吻尖
];
const BASE_DIM = { width: 0.72, height: 1.32, length: 3.1 };
const RADIAL = 24;      // 径向分段（圆润、消除棱角）
const RING_INTERP = 3;  // 相邻轮廓环间插值环数（平滑的关键）

export class ProceduralSkinGenerator {
  /**
   * @param {Object} dim - 物种 dimensions { width, height, length }
   * @param {Object} ref - 物种 anatomicalRef { withersHeight, tailLength }
   * @param {Array} bones - 装配器输出的扁平骨骼阵列（顺序即 skinIndex）
   * @returns {THREE.BufferGeometry} 含 skinIndex / skinWeight 权重
   */
  static generateSkinnedGeometry(dim, ref, bones) {
    const geo = this._buildBody(dim, ref);
    this._skinAll(geo, dim, ref, bones);
    return geo;
  }

  // ---------- 几何拓扑 ----------
  static _buildBody(dim, ref) {
    const kz = dim.length / BASE_DIM.length;
    const kw = dim.width / BASE_DIM.width;
    const kh = dim.height / BASE_DIM.height;
    const profile = BASE_PROFILE.map(([z, r, cy]) => [z * kz, r * kw, cy * kh]);

    // 主管：逐环生成 + 环间插值加密
    const ringPts = (r, t) => {
      const [z0, rad0, cy0] = profile[r];
      const [z1, rad1, cy1] = profile[r + 1];
      const z = z0 + (z1 - z0) * t, rad = rad0 + (rad1 - rad0) * t, cy = cy0 + (cy1 - cy0) * t;
      const pts = [];
      for (let k = 0; k < RADIAL; k++) {
        const a = (k / RADIAL) * Math.PI * 2;
        pts.push([Math.cos(a) * rad * 1.05, cy + Math.sin(a) * rad * 0.95, z, Math.cos(a), Math.sin(a)]);
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
        indices.push(a, c, b, b, c, d);
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
    for (const def of this._legDefs(dim)) {
      const topY = H * 0.95, pawY = 0.02;
      const legGeo = new THREE.CylinderGeometry(dim.width * 0.16, dim.width * 0.097, topY - pawY, 14, 12);
      legGeo.translate(0, (topY + pawY) / 2, 0);
      const pawGeo = new THREE.SphereGeometry(dim.width * 0.118, 12, 8);
      pawGeo.scale(1.05, 0.55, 1.3);
      pawGeo.translate(0, pawY + 0.02, 0.03);
      const leg = BufferGeometryUtils.mergeGeometries([legGeo, pawGeo]);
      leg.translate(def.x, 0, def.z);
      geos.push(leg);
    }
    const merged = BufferGeometryUtils.mergeGeometries(geos);
    merged.computeVertexNormals(); // 平滑着色：消除棱角
    return merged;
  }

  // 四肢管位置（几何与权重共用，保证剖分一致）
  static _legDefs(dim) {
    const lz = dim.length * 0.21; // 前后腿距拉开
    return [
      { x: -dim.width * 0.361, z: lz, key: "FL" },
      { x: dim.width * 0.361, z: lz, key: "FR" },
      { x: -dim.width * 0.375, z: -lz, key: "BL" },
      { x: dim.width * 0.375, z: -lz, key: "BR" },
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
        if (Math.hypot(x - L.x, z - L.z) < dim.width * 0.22) return L;
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
        // 腿管：按高度 y 分给 大腿/小腿/爪，与躯干骨平滑过渡
        if (y > H * 0.81) {
          const t = (y - H * 0.81) / (H * 0.14);
          i1 = leg.b1; w1 = 1 - t * 0.6; i2 = leg.spine; w2 = t * 0.6;
        } else if (y > H * 0.52) {
          const t = (H * 0.81 - y) / (H * 0.29);
          i1 = leg.b1; w1 = 1 - t * 0.85; i2 = leg.b2; w2 = t * 0.85;
        } else if (y > H * 0.19) {
          const t = (H * 0.52 - y) / (H * 0.33);
          i1 = leg.b2; w1 = 1 - t * 0.85; i2 = leg.bF; w2 = t * 0.85;
        } else {
          i1 = leg.bF; w1 = 1; i2 = leg.bF; w2 = 0;
        }
      } else if (z < -1.0 * kz) {
        // 尾：沿尾长向五节渐给（节多摆得柔；尾细长区 z -1.0~-1.95）
        const t = THREE.MathUtils.clamp((-1.0 * kz - z) / (0.95 * kz), 0, 1) * 4; // 0..4
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
}
