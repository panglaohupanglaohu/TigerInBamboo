// 禽类躯体构建器：参数化程序化鸟体（身体/头颈/冠/喙/双翼/尾扇/双腿）
// 默认红腹锦鸡配色与雉科比例；lab 页与自定义物种可按尺寸与体色生成任意小鸟
// shape 覆写比例（雁形目长颈/肥体/短尾/阔翼等），缺省逐项回落雉科默认值
// 返回 { group, head, wings, tail, legs, parts } —— head/wings/legs 供行为层做啄食/扑翼/垂脚动画
// wings: [{pivot, side, mesh}]，mesh 供飞行时翼展 morph（scale.y 翼展、scale.z 翼弦）
import * as THREE from "../../assets/vendor/three/three.module.js";

// 锥形管：沿曲线半径由 rBottom(曲线起点·靠身) 线性收至 rTop(曲线终点·靠头)
// 顶点排布与 THREE.TubeGeometry 完全一致（(TUB+1) 环 × (RAD+1) 顶点/环），兼容双骨骼权重循环
function makeTaperedTube(curve, tubularSegments, rBottom, rTop, radialSegments) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [], normals = [], uvs = [], indices = [];
  const P = new THREE.Vector3(), normal = new THREE.Vector3(), vertex = new THREE.Vector3();
  const vertsPerRing = radialSegments + 1;
  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments;
    const radius = rBottom + (rTop - rBottom) * u;     // 靠身粗 → 靠头细
    curve.getPointAt(u, P);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v), cos = -Math.cos(v);
      normal.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize();
      normals.push(normal.x, normal.y, normal.z);
      vertex.copy(P).addScaledVector(normal, radius);
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(u, j / radialSegments);
    }
  }
  for (let j = 1; j <= radialSegments; j++) {
    for (let i = 1; i <= tubularSegments; i++) {
      const a = vertsPerRing * (i - 1) + (j - 1);
      const b = vertsPerRing * i + (j - 1);
      const c = vertsPerRing * i + j;
      const d = vertsPerRing * (i - 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function buildAvianBody({
  height = 0.42,               // 站高（米），按 0.42m 基准等比缩放
  bodyColor = 0xa8261f,        // 体色（腹背主色）
  accentColor = 0xd9a520,      // 渐变强调色（金）
  neckColor = 0x1f5f3f,        // 颈色
  crestColor = 0xe3b93a,       // 冠色
  wingColor = 0x7a5a33,        // 翼色
  tailColor = 0x2b2016,        // 尾羽斑纹深色
  tailBaseColor = null,        // 尾羽底色（缺省用翼色）
  backColor = null,            // 上背色（与 rumpColor 成背侧渐变，缺省不分区）
  rumpColor = null,            // 腰/尾上覆羽色
  capeColor = null,            // 披肩色（锦鸡颈后扇形披肩，缺省无披肩）
  capeEdgeColor = 0x14100c,    // 披肩扇贝斑纹色
  wingPatchColor = null,       // 翼肩斑块色（缺省无）
  shape = {},                  // 比例覆写（见下方 S 的默认值）
} = {}) {
  // 雉科默认比例（与旧版硬编码逐点一致）；shape 只覆写给定键
  const S = {
    bodyScale: [0.15, 0.14, 0.23], // 身体椭球三轴半径
    bodyY: 0.22,                   // 身体中心高度
    neckPos: [0, 0.32, 0.16],      // 头颈组位置
    neckR: 0.075,                  // 颈球半径（基准）
    neckRBase: null,               // 颈根(靠身)半径，缺省 = neckR*1.13
    neckRTip: null,                // 颈梢(靠头)半径，缺省 = neckR*0.8（锥形：靠身粗、靠头细）
    neckScale: [1, 1, 1],          // 颈球三轴拉伸（雁：纵向伸长为长颈）
    headR: 0,                      // 独立头球半径（0=无独立头，颈球即头；雁：长颈顶端另有头球）
    headPos: [0, 0.05, 0.06],      // 头球中心（头颈组局部坐标）
    crestCount: 5,                 // 羽冠数（雁：0）
    beakR: 0.018, beakLen: 0.06, beakColor: 0xd8c9a3,
    beakPos: [0, 0.0, 0.1],        // 喙尖位置（头颈组局部坐标）
    eyePos: [0.045, 0.02, 0.05],   // 目位置（±x 对称）
    eyeR: 0.012,
    wingScale: [0.03, 0.09, 0.16], // 翼椭球三轴半径
    wingPivot: [0.09, 0.26, 0.02], // 翼根 pivot（±x 对称）
    wingTipX: 0.02,                // 翼面外移量
    tailPos: [0, 0.22, -0.2],      // 尾组位置
    tailLen: 0.55, tailW: 0.045,   // 尾羽长/宽
    tailCount: 5,                  // 尾羽片数
    legH: 0.14, legR: 0.008,       // 腿长/径
    legX: 0.04, legZ: 0,           // 腿位（±x 对称，z 偏后为游禽）
    legColor: 0xc9b48a,
    ...shape,
  };
  // 锥形颈半径：靠身粗（与身体前胸对接）、靠头细（与头部/喙衔接），缺省由 neckR 派生
  const neckRBase = S.neckRBase != null ? S.neckRBase : S.neckR * 1.13;
  const neckRTip  = S.neckRTip  != null ? S.neckRTip  : S.neckR * 0.8;
  const k = height / 0.42;
  const group = new THREE.Group();
  const parts = [];
  const cast = (m) => { m.castShadow = true; return m; };
  const paint = (geo, fn) => {
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      fn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  };
  const mat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const BODY = new THREE.Color(bodyColor), ACC = new THREE.Color(accentColor);
  const NECK = new THREE.Color(neckColor), WING = new THREE.Color(wingColor);
  const TAIL = new THREE.Color(tailColor);
  const TAILB = tailBaseColor != null ? new THREE.Color(tailBaseColor) : null;
  const BACK = backColor != null ? new THREE.Color(backColor) : null;
  const RUMP = rumpColor != null ? new THREE.Color(rumpColor) : null;
  const PATCH = wingPatchColor != null ? new THREE.Color(wingPatchColor) : null;
  const scratch = new THREE.Color();

  // 身体：横椭圆，腹背渐变
  const bodyGeo = new THREE.SphereGeometry(1, 24, 18);
  bodyGeo.scale(...S.bodyScale);
  paint(bodyGeo, (x, y, z, c) => {
    c.copy(BODY).lerp(ACC, THREE.MathUtils.clamp(y * 4 + 0.45 + z * 1.2, 0, 1));
    if (BACK && RUMP) {
      // 背部分区：颈后上背（backColor）→ 腰/尾上覆羽（rumpColor），腹面与前胸保持体色
      const dorsal = THREE.MathUtils.smoothstep(y, -0.03, 0.06);
      const chest = THREE.MathUtils.smoothstep(z, 0.06, 0.16); // 前胸不衰减则绿上会爬到胸口
      const t = 1 - THREE.MathUtils.smoothstep(z, -0.18, 0.14); // 0 颈后 → 1 尾根
      scratch.copy(BACK).lerp(RUMP, t);
      c.lerp(scratch, dorsal * (1 - chest));
    }
  });
  const body = cast(new THREE.Mesh(bodyGeo, mat()));
  body.position.y = S.bodyY;
  group.add(body); parts.push(body);

  // 头颈（科学建模 · 根治「断颈」）：连续高分段的「无缝皮肤」长颈 + 双骨骼线性插值权重
  // 整条颈是一张连续 SkinnedMesh 网格；沿中心线的顶点同时受相邻颈骨共同控制（各听一半），
  // 弯曲时皮肤被均匀拉伸/压缩，绝不再出现独立圆柱错位穿模的断裂切面。
  const L = S.neckR * S.neckScale[1] * 2;                 // 颈全长
  const np = new THREE.Vector3(...S.neckPos);             // 颈中段（原 head 组位置）
  const sz = S.neckScale[2];                              // 前后向（z）拉伸，烘焙进中心曲线
  // 颈部中心曲线（组局部坐标）：雁形目带 S 弯，雉科近直微膨
  const cLocal = S.neckSausage
    ? [ new THREE.Vector3(0, -L / 2, 0),
        new THREE.Vector3(0, -L / 6, S.neckR * 0.4 * sz),
        new THREE.Vector3(0, L / 6, -S.neckR * 0.3 * sz),
        new THREE.Vector3(0, L / 2, S.neckR * 0.25 * sz) ]
    : [ new THREE.Vector3(0, -L / 2, 0),
        new THREE.Vector3(0, -L / 4, S.neckR * 0.12 * sz),
        new THREE.Vector3(0, L / 4, S.neckR * 0.12 * sz),
        new THREE.Vector3(0, L / 2, 0) ];
  const curve = new THREE.CatmullRomCurve3(cLocal.map((p) => p.clone().add(np)));
  const TUB = 40, RAD = 14;                               // 纵向 40 段 · 径向 14 段（弯曲足够平滑）
  // 锥形管：靠身(曲线起点)粗 = neckRBase，靠头(曲线终点)细 = neckRTip
  const neckGeo = makeTaperedTube(curve, TUB, neckRBase, neckRTip, RAD);
  paint(neckGeo, (x, y, z, c) => c.copy(NECK).lerp(ACC, THREE.MathUtils.clamp(z * 4 + 0.5, 0, 1)));

  // 颈骨链：Spine_Chest(根/固定锚于体) → Neck_Lower(中段·动画句柄) → Neck_Upper(颈顶·挂头)
  const bChest = new THREE.Bone(); bChest.name = "Spine_Chest";
  bChest.position.copy(curve.getPoint(0.0));
  const bLow = new THREE.Bone(); bLow.name = "Neck_Lower";
  bLow.position.copy(curve.getPoint(0.5)).sub(curve.getPoint(0.0));
  const bUp = new THREE.Bone(); bUp.name = "Neck_Upper";
  bUp.position.copy(curve.getPoint(1.0)).sub(curve.getPoint(0.5));
  bChest.add(bLow); bLow.add(bUp);

  // 双骨骼线性插值权重：沿颈中心线 progress t∈[0,1]，上下两段各由相邻两骨平滑渐变，
  // 交界处顶点同时听两骨（各半），弯曲即为平滑弧线而非硬切。
  const pos = neckGeo.attributes.position;
  const skinIndices = [], skinWeights = [];
  const BONE = (n) => (n === "Spine_Chest" ? 0 : n === "Neck_Lower" ? 1 : 2);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / (RAD + 1)) / TUB;            // TubeGeometry：每环 (RAD+1) 顶点
    const wC = THREE.MathUtils.clamp(1 - t / 0.5, 0, 1);  // 基→0
    const wU = THREE.MathUtils.clamp((t - 0.5) / 0.5, 0, 1); // 顶→0
    const wL = 1 - wC - wU;                               // 中段最重
    let i1, i2, w1, w2;
    if (wC >= wU) { i1 = "Spine_Chest"; i2 = "Neck_Lower"; const s = wC + wL || 1; w1 = wC / s; w2 = wL / s; }
    else { i1 = "Neck_Lower"; i2 = "Neck_Upper"; const s = wL + wU || 1; w1 = wL / s; w2 = wU / s; }
    skinIndices.push(BONE(i1), BONE(i2), 0, 0);
    skinWeights.push(w1, w2, 0, 0);
  }
  neckGeo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  neckGeo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));

  const neckMesh = new THREE.SkinnedMesh(neckGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  neckMesh.castShadow = true;
  neckMesh.frustumCulled = false;
  group.add(neckMesh);
  group.add(bChest);                                      // 根骨挂组（与 SkinnedMesh 同级）
  parts.push(neckMesh, bChest);

  // 头球/冠/披肩/喙/目 皆挂在颈顶骨 Neck_Upper 上（bUp 的世界位即颈尖 curve.getPoint(1)）。
  // headGroup 锚在颈尖，并以「头球底背贴颈尖」的偏移落位，使头随颈尖真实变换一起运动，
  // 彻底消除原先把头座在颈中段(np)导致「颈上半截裸露、头是头脖子是脖子」的脱节。
  const headGroup = new THREE.Group();
  headGroup.position.set(0, S.headR - S.headPos[1], S.headR - S.headPos[2]);
  bUp.add(headGroup);
  const head = bLow;                                      // 动画句柄：旋转中段颈骨 → 整条颈平滑弯曲（不破面）
  const headBone = bUp;                                   // 颈顶骨：头/喙/冠挂其上；视线锁定补偿用（反推颈动）

  if (S.headR > 0) {
    const skullGeo = new THREE.SphereGeometry(S.headR, 16, 12);
    paint(skullGeo, (x, y, z, c) => c.copy(NECK).lerp(ACC, THREE.MathUtils.clamp(y * 5 + 0.4, 0, 1)));
    const skull = cast(new THREE.Mesh(skullGeo, mat()));
    skull.position.set(...S.headPos);
    headGroup.add(skull);
  }
  if (S.crestCount > 0) {
    const crestGeo = new THREE.ConeGeometry(0.02, 0.12, 6);
    crestGeo.translate(0, 0.06, 0);
    const crestMat = new THREE.MeshStandardMaterial({ color: crestColor, roughness: 0.8 });
    for (let i = 0; i < S.crestCount; i++) {
      const crest = new THREE.Mesh(crestGeo, crestMat);
      crest.position.set((i - (S.crestCount - 1) / 2) * 0.018, 0.1, -0.01);
      crest.rotation.x = -1.35 - (i % 2) * 0.2; // 向后上方披散（锦鸡金丝冠掠过披肩）
      headGroup.add(crest);
    }
  }
  // 锦鸡披肩：颈后扇形羽片罩于肩背，橙底缀黑色扇贝纹（capeColor 缺省则无）
  if (capeColor != null) {
    const CAPE = new THREE.Color(capeColor), CAPEEDGE = new THREE.Color(capeEdgeColor);
    const capeGeo = new THREE.SphereGeometry(0.088, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
    capeGeo.scale(1, 0.5, 1.4);
    paint(capeGeo, (x, y, z, c) => {
      const r = Math.hypot(x / 0.088, z / 0.123); // 0 顶心 → 1 边缘
      const band = r > 0.42 && Math.sin(r * 28.0) > 0.35; // 细扇贝横斑，橙底为主
      c.copy(band ? CAPEEDGE : CAPE);
      if (r < 0.3) c.lerp(ACC, 0.35 * (1 - r / 0.3)); // 顶心近冠处透金
    });
    const cape = cast(new THREE.Mesh(capeGeo, mat()));
    cape.position.set(0, 0.05, -0.042);
    cape.rotation.x = -0.62; // 自颈后向肩背披垂
    headGroup.add(cape);
  }
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(S.beakR, S.beakLen, 8),
    new THREE.MeshStandardMaterial({ color: S.beakColor, roughness: 0.6 })
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(...S.beakPos);
  headGroup.add(beak);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14100a });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(S.eyeR, 8, 6), eyeMat);
    eye.position.set(s * S.eyePos[0], S.eyePos[1], S.eyePos[2]);
    headGroup.add(eye);
  }

  // 双翼：贴体两侧的扁椭圆（飞时绕根扑动）
  // 翼面几何沿展向平移半展长：翼根钉在 pivot 原点，扑翼/翼展 morph 皆以贴体侧为轴
  const wings = [];
  const wingGeo = new THREE.SphereGeometry(1, 12, 8);
  wingGeo.scale(...S.wingScale);
  wingGeo.translate(0, -S.wingScale[1], 0);
  paint(wingGeo, (x, y, z, c) => {
    c.copy(WING).lerp(ACC, THREE.MathUtils.clamp(-z * 3 + 0.4, 0, 1));
    if (PATCH) {
      // 翼肩斑块（锦鸡钴蓝肩斑）：翼面前上区域
      const m = THREE.MathUtils.smoothstep(y, -0.09, -0.03) * THREE.MathUtils.smoothstep(z, 0.0, 0.09);
      c.lerp(PATCH, m * 0.85);
    }
  });
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * S.wingPivot[0], S.wingPivot[1], S.wingPivot[2]);
    const wing = cast(new THREE.Mesh(wingGeo, mat()));
    wing.position.x = s * S.wingTipX;
    pivot.add(wing);
    group.add(pivot);
    wings.push({ pivot, side: s, mesh: wing });
    parts.push(pivot);
  }

  // 尾扇：长羽数片，斑纹相间（z 向细分以解析横斑；片距按羽宽/羽长自适应保持交叠）
  const tail = new THREE.Group();
  tail.position.set(...S.tailPos);
  const tailGeo = new THREE.BoxGeometry(S.tailW, 0.008, S.tailLen, 1, 1, 24);
  tailGeo.translate(0, 0, -S.tailLen / 2 + 0.015);
  paint(tailGeo, (x, y, z, c) => {
    const band = Math.sin(z * 40) > 0.2;
    c.copy(band ? TAIL : (TAILB ?? WING)).lerp(ACC, band ? 0.05 : 0.18);
  });
  for (let i = 0; i < S.tailCount; i++) {
    const f = cast(new THREE.Mesh(tailGeo, mat()));
    f.rotation.y = (i - (S.tailCount - 1) / 2) * (S.tailW / S.tailLen) * 0.85;
    f.rotation.x = 0.12 + Math.abs(i - (S.tailCount - 1) / 2) * 0.05;
    tail.add(f);
  }
  group.add(tail); parts.push(tail);

  // 双腿：细杆分立（游禽可后置）；起降时垂脚、巡航收蹼
  const legMat = new THREE.MeshStandardMaterial({ color: S.legColor });
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(S.legR, S.legR, S.legH, 6), legMat);
    leg.position.set(s * S.legX, S.legH / 2, S.legZ);
    group.add(leg); legs.push(leg); parts.push(leg);
  }

  // 骨骼绑定：根骨已在场景图，缩放后刷新世界矩阵，再 bind（与 BioEntityMesh 同法）
  group.scale.setScalar(k);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([bChest, bLow, bUp]);
  neckMesh.bind(skeleton);
  neckMesh.normalizeSkinWeights(); // 绑定后归一权重（THREE.SkinnedMesh 方法，非 BufferGeometry）
  return { group, head, headBone, headGroup, spine: bChest, wings, tail, legs, parts };
}
