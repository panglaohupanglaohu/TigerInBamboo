// 禽类躯体构建器：参数化程序化鸟体（身体/头颈/冠/喙/双翼/尾扇/双腿）
// 默认红腹锦鸡配色与雉科比例；lab 页与自定义物种可按尺寸与体色生成任意小鸟
// shape 覆写比例（雁形目长颈/肥体/短尾/阔翼等），缺省逐项回落雉科默认值
// 返回 { group, head, wings, tail, legs, parts } —— head/wings/legs 供行为层做啄食/扑翼/垂脚动画
// wings: [{pivot, side, mesh}]，mesh 供飞行时翼展 morph（scale.y 翼展、scale.z 翼弦）
import * as THREE from "three";

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
    neckR: 0.075,                  // 颈球半径
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

  // 头颈：颈前伸 + 羽冠 + 锥喙 + 侧目
  const head = new THREE.Group();
  head.position.set(...S.neckPos);
  const neckGeo = new THREE.SphereGeometry(S.neckR, 16, 12);
  neckGeo.scale(...S.neckScale);
  paint(neckGeo, (x, y, z, c) => c.copy(NECK).lerp(ACC, THREE.MathUtils.clamp(y * 5 + 0.4, 0, 1)));
  head.add(cast(new THREE.Mesh(neckGeo, mat())));
  // 独立头球（长颈禽类：颈球只是颈，喙与目附于头球）
  if (S.headR > 0) {
    const skullGeo = new THREE.SphereGeometry(S.headR, 16, 12);
    paint(skullGeo, (x, y, z, c) => c.copy(NECK).lerp(ACC, THREE.MathUtils.clamp(y * 5 + 0.4, 0, 1)));
    const skull = cast(new THREE.Mesh(skullGeo, mat()));
    skull.position.set(...S.headPos);
    head.add(skull);
  }
  if (S.crestCount > 0) {
    const crestGeo = new THREE.ConeGeometry(0.02, 0.12, 6);
    crestGeo.translate(0, 0.06, 0);
    const crestMat = new THREE.MeshStandardMaterial({ color: crestColor, roughness: 0.8 });
    for (let i = 0; i < S.crestCount; i++) {
      const crest = new THREE.Mesh(crestGeo, crestMat);
      crest.position.set((i - (S.crestCount - 1) / 2) * 0.018, 0.1, -0.01);
      crest.rotation.x = -1.35 - (i % 2) * 0.2; // 向后上方披散（锦鸡金丝冠掠过披肩）
      head.add(crest);
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
    head.add(cape);
  }
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(S.beakR, S.beakLen, 8),
    new THREE.MeshStandardMaterial({ color: S.beakColor, roughness: 0.6 })
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(...S.beakPos);
  head.add(beak);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14100a });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(S.eyeR, 8, 6), eyeMat);
    eye.position.set(s * S.eyePos[0], S.eyePos[1], S.eyePos[2]);
    head.add(eye);
  }
  group.add(head); parts.push(head);

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

  group.scale.setScalar(k);
  return { group, head, wings, tail, legs, parts };
}
