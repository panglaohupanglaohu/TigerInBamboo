// =====================================================================
//  苔庭丛松（2026-11-13 用户海岸松树参考图）
//  一丛 4–6 棵：高而细、近直略弯、外倾 2–8° 的灰橙斑驳树干；下部约 58% 光秃；
//  上部约 40% 由疏密错落的横伸枝、分离针叶簇与外露枯枝组成，
//  深灰绿；枝条斜伸托住叶垫；丛中最高偏后一棵树冠稀疏、枝条发黑（近枯）。
//  模型以「树高 = 1」建造，摆放时整体缩放到目标高度；每棵树 2 个网格
//  （树皮 + 针叶，顶点色），材质全局共享，不逐棵释放。
//  只供苔庭（world/saihoji.js + saihojiPineLayout.js）使用；主岛林带 /
//  圣城台地仍用 saihojiPineOptimized.js 的 Blender 古松，未改。
// =====================================================================
import * as THREE from "three";
import { samplePath, smoothRoutedPath } from "../../../townscaper-web/REACodeRefactoring/src/core/path-samples.js";

/** 原苔庭古松在鲲背岛局部坐标中的实测平均高（25 株，2026-11-11 node 实测 5.4479）。 */
export const SAIHOJI_LEGACY_PINE_MEAN_HEIGHT = 5.4479;
/** 用户要求：新松平均高 = 原 × 2.5；2026-11-26 用户要求「松树及其之间距离等比例放大4倍」→ ×10。
 * 簇内根距按 dx·H 布点（saihojiPineLayout.arrangeSaihojiPines），树高 ×4 时间距自动同比 ×4。 */
export const SAIHOJI_CLUSTER_PINE_HEIGHT_FACTOR = 10;
export const SAIHOJI_CLUSTER_PINE_MEAN_HEIGHT =
  SAIHOJI_LEGACY_PINE_MEAN_HEIGHT * SAIHOJI_CLUSTER_PINE_HEIGHT_FACTOR;
/** 树干光秃段占树高比例（参考图约 55–60%） */
export const SAIHOJI_CLUSTER_PINE_BARE_FRACTION = 0.58;
const TRUNK_BASE_RADIUS = 0.022; // × 树高（参考图根部干径 ≈ 0.054H）

/**
 * 一丛 6 棵的模板（单位：丛平均树高 H）。x 向右、+z 为丛前（近观者）、−z 为丛后。
 * 2026-11-11 06:48 用户再次给图：「改成图示形状，位置关系按图示，数量按图示，去掉其他松树」。
 * 按参考图逐棵量（图宽 1116 px，平均树高 ≈ 834 px 作 H；根部 x → dx，根部纵向位置差 → dz）：
 *   左四棵一组：D 左倾约 9°、冠向左；B 最前、左组最高、微 S 弯、宽冠；C 紧贴 B 后（根距 0.056H）；E 最矮、冠向两侧铺开；
 *   中间空开约 0.2H；右两棵一组：A 偏后、最高、稀疏近枯（枝发黑）；F 在 A 右前、冠向右。
 *   dx/dz：根部位置；h：相对高；lean：外倾角（度）；leanAz：外倾方位（弧度，0=+x 右，π=左）；spread：枝条主伸展方位；reach：枝长倍率
 */
const CLUSTER_6 = Object.freeze([
  { key: "D", dx: -0.23, dz: 0.01, h: 0.95, lean: 9, leanAz: Math.PI + 0.1, spread: Math.PI, reach: 1.05 },
  { key: "B", dx: -0.13, dz: 0.06, h: 1.12, lean: 3, leanAz: Math.PI - 0.3, spread: Math.PI / 2 + 0.3, reach: 1.3 },
  { key: "C", dx: -0.105, dz: 0.01, h: 0.91, lean: 3, leanAz: -0.3, spread: -Math.PI / 2 - 0.2, reach: 1.0 },
  { key: "E", dx: -0.01, dz: 0.05, h: 0.83, lean: 3, leanAz: 0.2, spread: 0.3, reach: 1.25 },
  { key: "A", dx: 0.2, dz: -0.08, h: 1.17, lean: 3, leanAz: Math.PI - 0.2, sparse: true, spread: -Math.PI / 2 },
  { key: "F", dx: 0.27, dz: -0.06, h: 0.96, lean: 4, leanAz: 0.1, spread: 0, reach: 1.1 },
]);

/**
 * 苔庭只留这一丛 6 棵（2026-11-11 06:49 用户：「松树数量也按照图示的来，去掉其他的松树」）。
 * 丛中心为鲲背岛局部坐标的期望值，实际由 saihojiPineLayout 在真实地壳上就近找可用位（避浅池 / 石组）。
 *   mirror：模板左右镜像（不镜像，保持图示左右关系）；drop：去掉的成员；scale：该丛平均高倍率；zone：簿记归属景区。
 *   原西丛 / 东丛（共 10 棵）已去掉；旧版见 /tmp/pine-backup-20261111 与 artifacts/backups/pines-20261111。
 */
export const SAIHOJI_PINE_CLUSTERS = Object.freeze([
  { id: "grove", zone: "master-stones", cx: 0.6, cz: -3.1, yaw: Math.PI + 0.15, scale: 1, mirror: false, drop: [] },
]);

/** 展开所有成员，并把全体平均高度精确归一到 SAIHOJI_CLUSTER_PINE_MEAN_HEIGHT。 */
export function saihojiClusterMembers() {
  const out = [];
  let seed = 7301;
  for (const cluster of SAIHOJI_PINE_CLUSTERS) {
    for (const m of CLUSTER_6) {
      if (cluster.drop.includes(m.key)) continue;
      const sx = cluster.mirror ? -1 : 1;
      out.push({
        cluster: cluster.id,
        zone: cluster.zone,
        key: m.key,
        seed: seed++,
        dx: m.dx * sx,
        dz: m.dz,
        rel: m.h * cluster.scale,
        lean: m.lean,
        // 镜像：方位角关于 z 轴翻转
        leanAz: cluster.mirror ? Math.PI - m.leanAz : m.leanAz,
        // 枝条主伸展方位：两端树沿丛长轴向外，中间树向丛前后（−z / +z）铺开
        spread: cluster.mirror ? Math.PI - m.spread : m.spread,
        reach: m.reach ?? 1,
        sparse: !!m.sparse,
      });
    }
  }
  const mean = out.reduce((s, m) => s + m.rel, 0) / out.length;
  for (const m of out) m.height = (m.rel / mean) * SAIHOJI_CLUSTER_PINE_MEAN_HEIGHT;
  return out;
}

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let _materials = null;
function materials() {
  if (_materials) return _materials;
  const bark = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1 });
  bark.name = "SaihojiClusterPine_Bark";
  const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  leaf.name = "SaihojiClusterPine_Needles";
  for (const m of [bark, leaf]) m.userData = { shared: true, revision: "saihoji-reference-pine-20261113" };
  _materials = { bark, leaf };
  return _materials;
}

const BARK = [0xb8b1a3, 0xa8a395, 0xc0b5a3, 0x8e8c80, 0xc9bfad].map((c) => new THREE.Color(c));
const DEAD = new THREE.Color(0x3b3632);
const NEEDLE_DARK = new THREE.Color(0x28372f);
const NEEDLE_MID = new THREE.Color(0x3b4a40);
const NEEDLE_TOP = new THREE.Color(0x59665a);

/** 简单网格累加器（非索引 → 平面着色），顶点色逐面。 */
class Builder {
  constructor() { this.pos = []; this.col = []; this.nor = []; }
  tri(a, b, c, color, normals = null) {
    const face=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));if(face.lengthSq()<1e-20)return;face.normalize();
    for(const n of normals||[face,face,face])this.nor.push(n.x,n.y,n.z);
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }
  quad(a, b, c, d, color, normals=null) { this.tri(a, b, c, color,normals?[normals[0],normals[1],normals[2]]:null); this.tri(a, c, d, color,normals?[normals[0],normals[2],normals[3]]:null); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("normal",new THREE.Float32BufferAttribute(this.nor,3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** 沿折线做 n 边棱柱管，radii 与 points 一一对应。 */
function tube(builder, points, radii, sides, colorAt) {
  // Reuse the current REACodeRefactoring arc-length code; never copy a second sampler.
  const originalCount=points.length,source=points.map(p=>p.toArray()),cumulative=[0];
  for(let i=1;i<points.length;i++)cumulative.push(cumulative[i-1]+points[i].distanceTo(points[i-1]));
  const smooth=smoothRoutedPath(source,{perSeg:2});
  let length=0;for(let i=1;i<smooth.length;i++)length+=new THREE.Vector3(...smooth[i]).distanceTo(new THREE.Vector3(...smooth[i-1]));
  const sampled=samplePath(smooth,{spacing:Math.max(.0001,length/Math.max(1,smooth.length-1)),maxSamples:64});
  const oldRadii=radii;
  radii=sampled.distances.map(d=>{const at=d/Math.max(length,1e-8)*cumulative.at(-1);let i=1;while(i<cumulative.length-1&&cumulative[i]<at)i++;const u=(at-cumulative[i-1])/Math.max(1e-8,cumulative[i]-cumulative[i-1]);return THREE.MathUtils.lerp(oldRadii[i-1],oldRadii[i],u);});
  points=sampled.points.map(p=>new THREE.Vector3(...p));
  const sourceColor=(i,k)=>colorAt(Math.min(originalCount-1,Math.floor(i/Math.max(1,points.length-1)*(originalCount-1))),k);
  const rings = points.map((p, i) => {
    const next = points[Math.min(i + 1, points.length - 1)];
    const prev = points[Math.max(i - 1, 0)];
    const dir = next.clone().sub(prev).normalize();
    const ref = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(dir, ref).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u).normalize();
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      ring.push(p.clone().addScaledVector(u, Math.cos(a) * radii[i]).addScaledVector(v, Math.sin(a) * radii[i]));
    }
    return ring;
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const normal=(row,col)=>rings[row][col].clone().sub(points[row]).normalize();
      builder.quad(rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k], sourceColor(i, k),[normal(i,k),normal(i,k2),normal(i+1,k2),normal(i+1,k)]);
    }
  }
  // 顶盖
  const last = rings[rings.length - 1], tip = points[points.length - 1];
  for (let k = 0; k < sides; k++) builder.tri(last[(k + 1) % sides], tip, last[k], sourceColor(rings.length - 1, k));
}

/** 扁平云团叶垫：一圈参差的低多边形扁盘（上凸下平），半径 r、厚 t。 */
function needlePad(builder, center, r, t, rnd, tint = 0) {
  // Nine small sprays replace each solid disk. Needles are geometry, no alpha overdraw.
  const tufts=9;
  for(let j=0;j<tufts;j++){
    const a=j/tufts*Math.PI*2+rnd()*.5,d=Math.sqrt(rnd())*r*.8;
    const c=center.clone().add(new THREE.Vector3(Math.cos(a)*d,(rnd()-.35)*t*.8,Math.sin(a)*d*.85));
    const radius=r*(.15+rnd()*.1),core=NEEDLE_DARK.clone().lerp(NEEDLE_MID,tint*.08);
    const top=c.clone().add(new THREE.Vector3(0,t*.08,0));
    for(let k=0;k<6;k++){
      const q=k/6*Math.PI*2,qn=(k+1)/6*Math.PI*2;
      builder.tri(c.clone().add(new THREE.Vector3(Math.cos(q)*radius,-t*.1,Math.sin(q)*radius)),top,c.clone().add(new THREE.Vector3(Math.cos(qn)*radius,-t*.1,Math.sin(qn)*radius)),core);
    }
    for(let k=0;k<18;k++){
      const az=k/18*Math.PI*2+rnd()*.4,dir=new THREE.Vector3(Math.cos(az),.3+rnd()*.9,Math.sin(az)).normalize();
      const extent=r*(.30+rnd()*.22),width=extent*(.05+rnd()*.03),side=new THREE.Vector3(-dir.z,0,dir.x).normalize().multiplyScalar(width);
      const base=c.clone().addScaledVector(dir,-extent*.15),tip=c.clone().addScaledVector(dir,extent);
      const col=NEEDLE_MID.clone().lerp(NEEDLE_TOP,rnd()*.35+tint*.12);
      builder.tri(base.clone().add(side),tip,base.clone().sub(side),col);
    }
  }
}

/** 云团叶垫：主垫 + 2–3 个错落的副垫，边缘参差、厚薄不一（黑松层片）。 */
function cloudPad(builder, center, r, t, rnd, tint = 0) {
  needlePad(builder, center, r, t, rnd, tint);
  // 2026-11-11 参考图：叶团是厚实、参差的一团团（不是薄伞盘）→ 副垫 4–6 个，上下错落
  const n = 2 + ((rnd() * 2) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.8, d = r * (0.45 + rnd() * 0.4);
    const c = center.clone().add(new THREE.Vector3(Math.cos(a) * d, (rnd() - 0.35) * t * 1.6, Math.sin(a) * d));
    needlePad(builder, c, r * (0.5 + rnd() * 0.22), t * (0.75 + rnd() * 0.3), rnd, tint * 0.8);
  }
}

/**
 * 单棵丛松（树高 1）。opts: seed, lean(度), leanAz(弧度), sparse, outward(弧度：枝条主伸展方向), reach(枝长倍率)
 * 返回根 Group（userData.kind='gardenPine'），子网格：树皮（含枝）与叶垫（userData.pineCrown=true）。
 */
export function createSaihojiClusterPine(opts = {}) {
  const seed = opts.seed ?? 1;
  const rnd = rng(seed * 2654435761);
  const lean = THREE.MathUtils.degToRad(opts.lean ?? 4);
  const leanAz = opts.leanAz ?? 0;
  const sparse = !!opts.sparse;
  const outward = opts.outward ?? leanAz;
  const leanDir = new THREE.Vector3(Math.cos(leanAz), 0, Math.sin(leanAz));
  const bendDir = new THREE.Vector3(-leanDir.z, 0, leanDir.x);
  const bendAmp = (rnd() - 0.5) * 0.035;

  // 树干中心线：外倾 + 一道缓弯
  const SEG = 14;
  const trunkAt = (t) => {
    const p = new THREE.Vector3(0, t, 0);
    p.addScaledVector(leanDir, Math.tan(lean) * t + 0.005 * t * t);
    p.addScaledVector(bendDir, bendAmp * Math.sin(Math.PI * t));
    return p;
  };
  const trunkTop = 0.97;
  const points = [], radii = [];
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * trunkTop;
    points.push(trunkAt(t));
    const flare = i === 0 ? 1.25 : 1;
    radii.push(TRUNK_BASE_RADIUS * flare * (1 - 0.62 * (t / trunkTop)));
  }
  const bark = new Builder(), leaf = new Builder();
  const barkCol = [];
  for (let i = 0; i <= SEG; i++) barkCol.push(Array.from({ length: 8 }, (_, k) => BARK[(k + seed) % BARK.length].clone().lerp(BARK[0],.58).offsetHSL(0,0,(rnd()-.5)*.035)));
  tube(bark, points, radii, 8, (i, k) => (sparse && i > SEG * 0.55 ? BARK[3].clone().lerp(DEAD, 0.5) : barkCol[i][k]));

  // 枝 + 叶垫：枝起于树高 0.555–0.91，最低叶垫约 0.57–0.6（下部约 58% 光秃）
  const tiers = sparse ? 7 : 5 + ((rnd() * 2) | 0);
  for (let i = 0; i < tiers; i++) {
    const f = i / Math.max(1, tiers - 1);
    const t = 0.57 + f * 0.34 + (rnd() - 0.5) * 0.02;   // 叶垫加厚后起枝点上移，保持下部约 58% 光秃
    const base = trunkAt(t);
    // 方位：交替两侧，整体偏向丛外
    const side = i % 2 === 0 ? 1 : -1;
    const az = outward + side * (0.6 + rnd() * 0.9) + (rnd() - 0.5) * 0.4;
    const len = (0.14 - f * 0.055) * (0.85 + rnd() * 0.3) * (sparse ? 1.1 : 1) * (opts.reach ?? 1);
    const dir = new THREE.Vector3(Math.cos(az), 0.3 + f * 0.3 + rnd() * 0.15, Math.sin(az)).normalize();   // 参考图枝条斜向上约 30–45°
    const mid = base.clone().addScaledVector(dir, len * 0.55);
    mid.y -= len * 0.05;
    const end = base.clone().addScaledVector(dir, len);
    const deadBranch = sparse && i > 0;
    const bc = deadBranch ? DEAD : BARK[1];
    tube(bark, [base, mid, end], [0.007, 0.0055, 0.0035], 4, () => bc);
    if (sparse) {
      // 枯枝状：再分两根黑色细枝，叶垫很少很小
      for (let j = 0; j < 3; j++) {
        const a2 = az + (j ? 0.7 : -0.7);
        const d2 = new THREE.Vector3(Math.cos(a2), 0.35, Math.sin(a2)).normalize();
        const tip=mid.clone().addScaledVector(d2,len*.62);
        tube(bark,[mid,tip],[.0025,.0006],3,()=>DEAD);
        for(let k=0;k<3;k++){const fork=tip.clone().add(new THREE.Vector3(Math.cos(a2+k*.8)*len*.28,.012+k*.006,Math.sin(a2+k*.8)*len*.28));tube(bark,[tip,fork],[.0012,.00025],3,()=>DEAD);}
      }
      if (!deadBranch) needlePad(leaf, end.clone().add(new THREE.Vector3(0, 0.012, 0)), 0.045 + rnd() * 0.02, 0.016, rnd, 0.2);
      continue;
    }
    // Exposed forked twigs keep the crown readable between needle sprays.
    for(let j=0;j<2;j++){const twigEnd=end.clone().add(new THREE.Vector3(Math.cos(az+(j?1:-1)*.7)*len*.3,.015,Math.sin(az+(j?1:-1)*.7)*len*.3));tube(bark,[mid,twigEnd],[.0022,.0006],3,()=>BARK[3]);}
    // One branch carries several separated needle sprays.
    const padR = (0.11 - f * 0.04) * (0.85 + rnd() * 0.3);
    cloudPad(leaf, end.clone().add(new THREE.Vector3(0, 0.02, 0)), padR, 0.045, rnd, f);
    if (rnd() < 0.85) {
      const p2 = mid.clone().addScaledVector(new THREE.Vector3(Math.cos(az + side * 0.8), 0, Math.sin(az + side * 0.8)), padR * 0.6);
      needlePad(leaf, p2.add(new THREE.Vector3(0, 0.024, 0)), padR * 0.65, 0.035, rnd, f * 0.6);
    }
  }
  // 树顶冠垫
  const top = points[points.length - 1];
  if (sparse) {
    tube(bark, [top, top.clone().add(new THREE.Vector3(0.03, 0.05, -0.01))], [0.004, 0.0015], 3, () => DEAD);
    // The reference elder has a bare, broken crown rather than a green cap.
  } else {
    cloudPad(leaf, top.clone().add(new THREE.Vector3(0, 0.018, 0)), 0.085, 0.045, rnd, 1);
  }

  // Small longitudinal bark scars, merged into the bark mesh.
  for(let i=0;i<50;i++){const h=.07+rnd()*.79,a=rnd()*Math.PI*2,normal=new THREE.Vector3(Math.cos(a),0,Math.sin(a)),tangent=new THREE.Vector3(-Math.sin(a),0,Math.cos(a)),c=trunkAt(h).addScaledVector(normal,TRUNK_BASE_RADIUS*(1-.62*h/.97)+.0004),w=.0018+rnd()*.0015,l=.01+rnd()*.025;
    bark.quad(c.clone().addScaledVector(tangent,-w*.5).add(new THREE.Vector3(0,l*.8,0)),c.clone().addScaledVector(tangent,w*.6).add(new THREE.Vector3(0,l,0)),c.clone().addScaledVector(tangent,w).add(new THREE.Vector3(0,-l*.7,0)),c.clone().addScaledVector(tangent,-w).add(new THREE.Vector3(0,-l,0)),BARK[3]);}
  const mats = materials();
  const root = new THREE.Group();
  root.name = "saihojiClusterPine";
  const barkMesh = new THREE.Mesh(bark.geometry(), mats.bark);
  barkMesh.name = `saihoji-cluster-pine-${seed}-bark`;
  const leafMesh = new THREE.Mesh(leaf.geometry(), mats.leaf);
  leafMesh.name = `saihoji-cluster-pine-${seed}-needles`;
  leafMesh.userData.pineCrown = true;
  for (const m of [barkMesh, leafMesh]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }
  const box = new THREE.Box3().union(barkMesh.geometry.boundingBox).union(leafMesh.geometry.boundingBox);
  root.userData = {
    kind: "gardenPine",
    sourceSeed: seed,
    collideRadius: TRUNK_BASE_RADIUS * 1.6,
    height: box.max.y - box.min.y,
    modelHeightUnit: 1,
    clusterPine: { sparse, lean: opts.lean ?? 4, leanAz, bareFraction: SAIHOJI_CLUSTER_PINE_BARE_FRACTION, trunkBaseRadius: TRUNK_BASE_RADIUS },
    pineOptimization: { asset: "saihoji-reference-pine-20261113", procedural: true, geometryApplied: true },
  };
  return root;
}

/** 树干光秃比例实测：最低叶垫 / 枝条起点的高度 ÷ 树高（模型空间）。 */
export function measureClusterPineBare(root) {
  let lowestBranch = Infinity, h = 0;
  root.traverse((n) => {
    if (!n.isMesh) return;
    const p = n.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      h = Math.max(h, p.getY(i));
      if (n.userData.pineCrown) lowestBranch = Math.min(lowestBranch, p.getY(i));
    }
  });
  return { lowestCrown: lowestBranch, height: h, bareFraction: lowestBranch / h };
}
