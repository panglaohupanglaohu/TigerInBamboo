// =====================================================================
//  出生点场景：海岛悬崖瀑布营地
//  多层海岸（草坡→沙滩→浅海阶梯）/ 左侧荒山与山洞 / 崖壁叠瀑
//  太空水环远景 / 弹琴老人 NPC；全部 addOutline 墨线描边
//  坐标：平面设计坐标，逐件 placeObjectOnSphere 贴球（防大盘翘边）
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet, createLowPolyFlower, INK_FLOWER_COLORS } from "../assets/lowPoly.js";
import { createAncientPineTree } from "../assets/ancient.js";
import { createLowPolyFox } from "../assets/fox.js";
import { placeObjectOnSphere } from "./sphereMath.js";
import { groundLiftAt } from "./hills.js";
import { WORLD_SCALE } from "./worldScale.js";

const SAND = 0xd2c4a7; // 沙滩浅米
const SHALLOW = 0x2e8b9a; // 浅海水色
const ROCK = 0x8b8579; // 荒山土灰
const FALL = 0x00a896; // 叠瀑翠蓝
const FALL_LIGHT = 0x50c878; // 叠瀑浅层
const RING = 0xa3e4d7; // 太空水环

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 扁平不规则多边形（海岸过渡带用），底部中心贴地 */
function flatPatch(rnd, rx, rz, color, lift) {
  rx *= WORLD_SCALE;
  rz *= WORLD_SCALE;
  const segments = 10;
  const vertices = [0, 0.02, 0];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const j = 0.85 + rnd() * 0.3;
    vertices.push(Math.cos(a) * rx * j, 0.005 + rnd() * 0.02, Math.sin(a) * rz * j);
  }
  for (let i = 0; i < segments; i++) indices.push(0, i + 1, ((i + 1) % segments) + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toonMat(color, { side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  mesh.name = "camp-flat-patch"; // 薄装饰色块（沙滩/浅海），沉降 pass 不作地表
  mesh.userData.lift = lift;
  return mesh;
}

/** 荒山岩块：IcosahedronGeometry detail 0 + flatShading（facet 等效） */
function crag(size, mat, outline = 0.03) {
  const mesh = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(size, 0)), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.5);
  addOutline(mesh, outline);
  return mesh;
}

/**
 * 构建海岛悬崖瀑布营地。
 * @returns {{ group, colliders, landmarks }}
 */
export function buildStartingCamp(scene, R) {
  const rnd = lcg(20260802);
  const g = new THREE.Group();
  g.name = "starting-camp";
  const colliders = [];
  const put = (obj, x, z, lift, yaw = 0) => {
    const sx = x * WORLD_SCALE;
    const sz = z * WORLD_SCALE;
    placeObjectOnSphere(obj, sx, sz, lift, R);
    if (yaw) obj.rotateY(yaw);
    g.add(obj);
    return obj;
  };
  const layoutGroundLiftAt = (x, z) => groundLiftAt(x * WORLD_SCALE, z * WORLD_SCALE);

  // ---------- 1. 多层海岸线：沙滩（右/前，略低）→ 浅海（更低） ----------
  // 沙滩带：岛内缘 r13~19，lift 0.52（略低于草坡 0.6，阶梯下探）
  const beachSpots = [
    [6, 10, 2.6, 1.8], [9, 8, 2.8, 1.9], [12, 6, 2.5, 1.7], [8, 13, 2.7, 1.8],
    [4, 14, 2.4, 1.6], [12, 11, 2.6, 1.7], [15, 3, 2.3, 1.6], [15, 8, 2.4, 1.7],
    [10, 15, 2.5, 1.6], [16, 0, 2.2, 1.5],
  ];
  for (const [x, z, rx, rz] of beachSpots) {
    put(flatPatch(rnd, rx, rz, SAND, 0.52), x, z, 0.52, rnd() * Math.PI);
  }
  // 浅海带：岛缘外 r18~25，lift 0.18（低于沙滩，海水拍岸）
  const seaSpots = [
    [18, 6, 3.2, 2.4], [16, 12, 3.0, 2.2], [12, 16, 3.1, 2.3], [20, 0, 3.0, 2.2],
    [22, 8, 3.3, 2.4], [8, 19, 3.0, 2.2], [16, 16, 3.2, 2.3], [24, 4, 3.1, 2.2],
    [-9, 14, 2.6, 1.9], [-6, 17, 2.8, 2.0],
  ];
  for (const [x, z, rx, rz] of seaSpots) {
    put(flatPatch(rnd, rx, rz, SHALLOW, 0.18), x, z, 0.18, rnd() * Math.PI);
  }
  // 叠瀑落水口浅海（随级流反向）
  put(flatPatch(rnd, 2.8, 2.0, SHALLOW, 0.18), -15.4, 13, 0.18, rnd() * Math.PI);

  // 下海小台阶（草坡 → 沙滩）
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      facet(new THREE.BoxGeometry(1.2 - i * 0.15, 0.12, 0.5)),
      toonMat(0xb8ad96)
    );
    step.castShadow = true;
    addOutline(step, 0.012);
    put(step, 5.2 + i * 0.6, 9.2 + i * 0.7, 0.58 - i * 0.05, 0.3);
  }

  // ---------- 2. 左侧荒山与山洞（约 -18.1 处，玩家 3 倍高；整组西移让开电车轨道走廊，岩块不再压车体） ----------
  const rockMat = toonMat(ROCK);
  const HILL = { x: -18.1, z: 6.2 };
  // 底座三块围出缺口（山洞），顶部两块收拢
  const crags = [
    [HILL.x - 1.1, HILL.z + 0.2, 2.2, 1.1],
    [HILL.x + 1.2, HILL.z + 0.4, 1.9, 1.0],
    [HILL.x + 0.1, HILL.z - 1.1, 1.7, 0.9],
    [HILL.x - 0.5, HILL.z + 0.1, 1.3, 3.1], // 上层
    [HILL.x + 0.4, HILL.z - 0.2, 0.9, 4.3], // 峰顶 ≈ 玩家 3 倍
  ];
  for (const [x, z, size, lift] of crags) {
    const c = crag(size, rockMat);
    put(c, x, z, layoutGroundLiftAt(x, z) + lift * 0.55, rnd() * Math.PI);
    colliders.push({ position: c.position.clone(), radius: size * 0.9 });
  }
  // 山洞：底两块之间的暗色内凹口（朝营地开）
  const cave = new THREE.Mesh(
    facet(new THREE.BoxGeometry(1.5, 1.1, 1.0)),
    toonMat(0x2a2521)
  );
  addOutline(cave, 0.02);
  put(cave, HILL.x + 0.1, HILL.z + 1.05, layoutGroundLiftAt(HILL.x, HILL.z) + 0.05, 0.15);

  // ---------- 3. 崖壁叠瀑 + 太空水环 ----------
  // 旧版这里用 BoxGeometry 做四块“水板”，从侧面看会变成悬空绿板。
  // 改为多股窄而有厚度的水流，沿崖壁逐级下落，不再出现矩形占位面。
  // 随荒山岩群西移让开电车轨道走廊（原 -11.2 会被轨道穿过瀑布）
  const fallMat = toonMat(FALL, {
    emissive: FALL_LIGHT,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const fallMat2 = toonMat(FALL_LIGHT, {
    emissive: FALL,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  const FALL_X = -13.9;
  for (let i = 0; i < 4; i++) {
    const y = 2.75 - i * 0.95;
    const z = 8.2 + i * 1.1;
    const height = 1.15 - i * 0.06;
    const streamMat = i % 2 ? fallMat2 : fallMat;
    for (let streamIndex = -1; streamIndex <= 1; streamIndex++) {
      const stream = new THREE.Mesh(
        facet(new THREE.CylinderGeometry(0.075, 0.15, height, 6)),
        streamMat,
      );
      stream.position.set(streamIndex * 0.22, -height * 0.5, 0);
      stream.rotation.z = streamIndex * 0.07;
      stream.castShadow = false;
      put(stream, FALL_X - i * 0.45, z, layoutGroundLiftAt(FALL_X, z) + y, 0.12); // 级流向山西侧斜落，避开电车车道
    }
  }
  // 瀑底入水泡沫（随级流反向）
  for (const [dx, dz, s] of [[0.3, 12.4, 0.34], [0.9, 12.9, 0.26], [-0.2, 13.1, 0.22]]) {
    const foam = new THREE.Mesh(facet(new THREE.IcosahedronGeometry(0.3, 0)), toonMat(0xd8f2ec));
    foam.scale.set(s * 1.7, s * 0.4, s);
    put(foam, FALL_X - dx, dz, 0.24, rnd() * Math.PI);
  }
  // 太空水环（远景高空，半透明青绿巨环）
  const skyRing = new THREE.Mesh(
    new THREE.RingGeometry(76, 82, 64),
    new THREE.MeshBasicMaterial({
      color: RING,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  skyRing.position.set(40, 85, -70);
  skyRing.lookAt(0, 0, 0); // 面向营地/相机
  skyRing.renderOrder = 2;
  g.add(skyRing);

  // ---------- 4. 弹琴老人（山洞石旁，与树/岩保持 3 单位） ----------
  const elder = new THREE.Group();
  const cloth = toonMat(0x3a3f46); // 深灰衣
  const skin = toonMat(0xe8c39a);
  const beardMat = toonMat(0xf0ede6); // 白须
  // 坐姿身体
  const torso = new THREE.Mesh(facet(new THREE.BoxGeometry(0.5, 0.55, 0.4)), cloth);
  torso.position.y = 0.55;
  torso.castShadow = true;
  addOutline(torso, 0.018);
  elder.add(torso);
  // 前伸双腿（坐姿）
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(facet(new THREE.BoxGeometry(0.15, 0.16, 0.5)), cloth);
    leg.position.set(side * 0.14, 0.14, 0.3);
    addOutline(leg, 0.012);
    elder.add(leg);
  }
  // 头 + 白胡子
  const head = new THREE.Mesh(facet(new THREE.BoxGeometry(0.34, 0.32, 0.32)), skin);
  head.position.y = 1.05;
  head.castShadow = true;
  addOutline(head, 0.015);
  elder.add(head);
  const beard = new THREE.Mesh(facet(new THREE.BoxGeometry(0.28, 0.22, 0.1)), beardMat);
  beard.position.set(0, 0.9, 0.18);
  addOutline(beard, 0.01);
  elder.add(beard);
  // 膝上的琴（扁平长方体手风琴：棕身 + 奶白键条）
  const qin = new THREE.Mesh(facet(new THREE.BoxGeometry(0.58, 0.16, 0.3)), toonMat(0x8a5a3a));
  qin.position.set(0, 0.52, 0.34);
  qin.castShadow = true;
  addOutline(qin, 0.012);
  elder.add(qin);
  const keys = new THREE.Mesh(facet(new THREE.BoxGeometry(0.5, 0.05, 0.12)), beardMat);
  keys.position.set(0, 0.6, 0.38);
  keys.name = "elder-music-keys";
  addOutline(keys, 0.006);
  elder.add(keys);
  elder.userData.musicKeys = keys;
  const ELDER = { x: -17, z: 9 }; // 原 (-12.3,4.5) 被轨道穿过，移到山洞旁（距轨道 4.33）
  put(elder, ELDER.x, ELDER.z, layoutGroundLiftAt(ELDER.x, ELDER.z), 2.6); // 面转向营地
  // kind 标记：messengerIsland 会在圣城建成后把老人搬到第一层瀑布旁，
  // 并同步更新此碰撞体位置。
  colliders.push({ position: elder.position.clone(), radius: 0.8, kind: "elder" });
  // 营地锚点：小地图「出发营地」标记用。老人搬到圣城瀑布旁后，
  // 锚点仍指向营地（老人原位置）。
  const campAnchor = new THREE.Object3D();
  put(campAnchor, ELDER.x, ELDER.z, layoutGroundLiftAt(ELDER.x, ELDER.z));

  // ---------- 4b. 阿狸：与送信人体量相当的小狐狸（可互动 / 漫步） ----------
  // 插画风尖脸阿狸（V 眼 + 火焰大尾）；默认 scale 0.52
  const ali = createLowPolyFox({ scale: 0.52 });
  // 略靠营地内侧，避开老人 3 单位净空
  const ALI = { x: -8.6, z: 7.2 };
  put(ali, ALI.x, ALI.z, layoutGroundLiftAt(ALI.x, ALI.z), 0.9);
  ali.userData.homeFlat = { x: ALI.x, z: ALI.z };
  ali.userData.flatX = ALI.x;
  ali.userData.flatZ = ALI.z;
  ali.userData.yaw = 0.9;
  // 阿狸是可跟随 NPC，不参与玩家静态资产推挤；否则她追上玩家后，
  // resolveAssetColliders 会反复把送信人推出去，形成“阿狸带着人乱跑”。
  // 保留 userData.collider 供 NPC 自身同步/调试使用，但不加入 camp.colliders。
  const foxCol = { position: ali.position.clone(), radius: 0.38, kind: "npc" };
  ali.userData.collider = foxCol;

  // ---------- 5. 营地周边：古松两株 + 花草点缀 ----------
  // 原 (-7,13) 古松树冠压电车车体（全程扫描 d=2.88），移到 (-2,12.5)（轨道净空 7.26）
  for (const [x, z] of [[7, 2], [-2, 12.5]]) {
    const pine = createAncientPineTree();
    pine.scale.multiplyScalar(0.85);
    pine.userData.settle = true; // 后建地形（沙滩/苔丘）不得埋树，收尾沉降 pass 抬回地表
    put(pine, x, z, layoutGroundLiftAt(x, z), rnd() * Math.PI * 2);
    colliders.push({ position: pine.position.clone(), radius: 0.5 });
  }
  const campFlowers = [];
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 3 + rnd() * 5;
    const x = ELDER.x + Math.cos(a) * d;
    const z = ELDER.z + Math.sin(a) * d;
    if (Math.hypot(x - ELDER.x, z - ELDER.z) < 3) continue; // 老人净空 3 单位
    const flower = createLowPolyFlower(INK_FLOWER_COLORS[(rnd() * INK_FLOWER_COLORS.length) | 0]);
    put(flower, x, z, layoutGroundLiftAt(x, z) + 0.01, rnd() * Math.PI * 2);
    campFlowers.push(flower); // 收尾由场景层修剪贴轨花（轨道后建，此处未知）
  }

  scene.add(g);
  return {
    group: g,
    colliders,
    landmarks: { elder, anchor: campAnchor, foxAli: ali, skyRing, hillCenter: HILL, campFlowers },
  };
}
