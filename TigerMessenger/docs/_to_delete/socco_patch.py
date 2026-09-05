import os
p = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/gateHaulerCraft.js")
s = open(p).read()

# ---- 1. 文件头补一段：这型艇就是 SOCCO ----
old_head = """//  与同目录 gatePodCraft（球根泡形侦察艇）是**两型不同的艇**：那型是细长高翼
//  侦察机，这型是没有翼的方箱运输艇，靠球形推进舱推着走。
//
//  局部坐标：+Z = 机头 · +Y = 天 · +X = 右。纯几何 + toonMat，无贴图。
// ============================================================================"""
new_head = """//  与同目录 gatePodCraft（球根泡形侦察艇）是**两型不同的艇**：那型是细长高翼
//  侦察机，这型是没有翼的方箱运输艇，靠球形推进舱推着走。
//
//  ---------------------------------------------------------------------------
//  这型艇就是 **SOCCO**（主人 2026-09-04 确认）
//  ---------------------------------------------------------------------------
//  苔庭之战里它是**贴海面飞行的气垫运输艇**：随 GatePodCraft 编队进场，
//  在苔庭岸边贴海悬停，放下尾门跳板，腹内 14 名先锋重甲兵冲出上岸；
//  撤离时同一道门攒绳索，人攀绳回腹。
//
//  所以本文件有两种用法，靠 `carrier` 开关分开，**互不影响**：
//    · `carrier: false`（默认）＝ 叹息之门旁的布景艇，形体与 2026-09-04 首版逐字相同
//    · `carrier: true`  ＝ SOCCO：多出气垫裙 / 海面气帘 / 尾门跳板 / 腹内 14 个座位 /
//                        尾门口 2 个绳锚。用 `createSoccoCraft()` 拿这一档
//
//  局部坐标：+Z = 机头 · +Y = 天 · +X = 右。纯几何 + toonMat，无贴图。
// ============================================================================"""
assert old_head in s
s = s.replace(old_head, new_head)

# ---- 2. createGateHaulerCraft 增加 carrier 开关 ----
old_sig = """export function createGateHaulerCraft({
  scale = 1,
  shell = 0xc9695a,
  belly = 0xf0e3d7,
  serial = 4,
  pilot = true,
} = {}) {"""
new_sig = """export function createGateHaulerCraft({
  scale = 1,
  shell = 0xc9695a,
  belly = 0xf0e3d7,
  serial = 4,
  pilot = true,
  carrier = false,
} = {}) {"""
assert old_sig in s
s = s.replace(old_sig, new_sig)

# ---- 3. 在 root.scale 之前插入 carrier 部件 ----
old_tail = """  root.scale.setScalar(scale);
  root.userData.haulerSerial = serial;
  root.userData.haulerLength = 7.6 * scale;
  return root;
}"""
new_tail = """  // ---------- 8. SOCCO 专属：气垫裙 / 气帘 / 尾门跳板 / 腹内座位 / 绳锚 ----------
  if (carrier) {
    buildSoccoCarrierParts(root, { matBelly, matTan, matTanDark, matDark, matShellDark });
  }

  root.scale.setScalar(scale);
  root.userData.haulerSerial = serial;
  root.userData.haulerLength = 7.6 * scale;
  root.userData.isSocco = carrier === true;
  return root;
}

// ============================================================================
//  SOCCO 载具化（主人 2026-09-04 需求）
//
//  设计约束，改之前先读：
//   · **尾门朝 −Z**：机体的尾在 −Z（推进舱、滑撬板都在那头），跳板必须从那儿放，
//     否则人从机头钻出来，和推进舱打架。
//   · **跳板铰链在腹板后沿**（y = −1.40, z = −2.62），关门时竖起封住尾口，
//     开门时绕 X 转到 −78°，末端刚好探到海面下一点（`SOCCO.rampReach`）。
//   · **腹内 14 个座位**：2 列 × 7 排。14 不是随手取的——GatePodCraft 3 台各索降 2 名 = 6，
//     20 − 6 = 14（主人 2026-09-04 定的编成）。座位数写成 `SOCCO.holdSeats`，
//     测试直接读它，不许在别处再写一份。
//   · **气帘不投影、不描边、不吃光**：它是海面被吹起的白痕，走 MeshBasicMaterial +
//     transparent，`renderOrder` 压在艇体下面。描边壳会把它变成一圈黑框。
// ============================================================================

/** SOCCO 的关键尺寸与编成常量（禁止在别处复制第二份）。 */
export const SOCCO = Object.freeze({
  /** 腹内座位数 = 20 名先锋兵 − GatePod 索降的 6 名 */
  holdSeats: 14,
  /** 尾门开到底的角度（弧度，绕 X 向下） */
  rampOpenAngle: -1.36,
  /** 跳板长度（局部单位） */
  rampLength: 2.9,
  /** 跳板放到底时末端相对腹板的下探深度 */
  rampReach: 2.85,
  /** 贴海巡航时腹板离海面的高度 */
  skimHeight: 1.15,
  /** 气帘白痕的最大半径 */
  sprayRadius: 3.6,
});

function buildSoccoCarrierParts(root, mats) {
  const { matBelly, matTan, matTanDark, matDark } = mats;

  // ---- 气垫裙：绕腹板一圈的圆角厚边 ----
  const skirt = new THREE.Group();
  skirt.name = "socco-skirt";
  const skirtMat = toonMat(0x6f5c4c, { flatShading: true });
  // 四条直边 + 四个圆角柱，拼成圆角矩形；不用 TorusGeometry 是因为它是正圆，
  // 而机体是方箱，正圆裙在四角会飘出去一大截。
  const halfX = 1.52;
  const halfZ = 2.74;
  const th = 0.34;
  for (const sx of [-1, 1]) {
    const side = mesh(new THREE.BoxGeometry(th, th, halfZ * 2 - th * 2), skirtMat, 0.01);
    side.position.set(sx * halfX, -1.52, -0.1);
    skirt.add(side);
  }
  for (const sz of [-1, 1]) {
    const end = mesh(new THREE.BoxGeometry(halfX * 2 - th * 2, th, th), skirtMat, 0.01);
    end.position.set(0, -1.52, -0.1 + sz * halfZ);
    skirt.add(end);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const corner = mesh(new THREE.CylinderGeometry(th / 2, th / 2, th, 8), skirtMat, 0.01);
      corner.position.set(sx * (halfX - th / 2), -1.52, -0.1 + sz * (halfZ - th / 2));
      skirt.add(corner);
    }
  }
  root.add(skirt);

  // ---- 气帘白痕：贴在裙下的一片扁圆盘，海面被吹起的水雾 ----
  //  不描边、不投影、不吃光：它是效果不是构件。
  const spray = new THREE.Mesh(
    new THREE.CircleGeometry(SOCCO.sprayRadius, 24),
    new THREE.MeshBasicMaterial({ color: 0xf2f7f8, transparent: true, opacity: 0.30, depthWrite: false })
  );
  spray.name = "socco-spray";
  spray.rotation.x = -Math.PI / 2;
  spray.position.set(0, -1.86, -0.1);
  spray.castShadow = false;
  spray.receiveShadow = false;
  spray.renderOrder = -2;
  spray.userData.transientFx = true;   // 不进静态合并
  root.add(spray);

  // ---- 尾门跳板：铰链在腹板后沿，关门竖起、开门放到海面 ----
  const hinge = new THREE.Group();
  hinge.name = "socco-ramp-hinge";
  hinge.position.set(0, -1.40, -2.62);
  const ramp = mesh(new THREE.BoxGeometry(1.9, 0.14, SOCCO.rampLength), matTan, 0.012);
  ramp.name = "socco-ramp";
  ramp.position.set(0, 0, -SOCCO.rampLength / 2);
  hinge.add(ramp);
  // 跳板上的防滑肋（与腹下导轨同一套语汇）
  for (let i = 0; i < 8; i++) {
    const rib = decal(new THREE.BoxGeometry(1.86, 0.04, 0.07), matTanDark);
    rib.position.set(0, 0.09, -0.35 - i * 0.32);
    hinge.add(rib);
  }
  // 两侧挡边，免得人从跳板上"走空"
  for (const sx of [-1, 1]) {
    const kerb = mesh(new THREE.BoxGeometry(0.10, 0.20, SOCCO.rampLength - 0.2), matTanDark, 0.008);
    kerb.position.set(sx * 0.95, 0.12, -SOCCO.rampLength / 2);
    hinge.add(kerb);
  }
  hinge.rotation.x = 0;                 // 0 = 关（跳板贴着腹板朝后平放）
  root.add(hinge);
  root.userData.soccoRamp = hinge;

  // ---- 尾口内壁（开门后能看见腹内，不至于是个黑洞）----
  const holdFloor = mesh(new THREE.BoxGeometry(1.94, 0.10, 4.3), matBelly, 0.010);
  holdFloor.name = "socco-hold-floor";
  holdFloor.position.set(0, -1.34, -0.35);
  root.add(holdFloor);
  for (const sx of [-1, 1]) {
    const wall = mesh(new THREE.BoxGeometry(0.10, 1.05, 4.3), matBelly, 0.010);
    wall.position.set(sx * 0.97, -0.82, -0.35);
    root.add(wall);
  }

  // ---- 腹内 14 个座位锚点：2 列 × 7 排 ----
  const hold = new THREE.Group();
  hold.name = "socco-hold";
  const seats = [];
  for (let i = 0; i < SOCCO.holdSeats; i++) {
    const col = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const seat = new THREE.Object3D();
    seat.name = `socco-seat-${i}`;
    // 排距 0.62，从尾口往机头排；人站着（局部 +Y 朝天，面朝 −Z 尾门）
    seat.position.set(col * 0.52, -1.22, -2.05 + row * 0.62);
    seat.rotation.y = Math.PI;          // 面朝尾门，随时能冲出去
    seat.userData.seatIndex = i;
    hold.add(seat);
    seats.push(seat);
  }
  root.add(hold);
  root.userData.soccoSeats = seats;

  // ---- 尾门口两个绳锚：撤离时从这里垂绳，人攀回腹内 ----
  const anchors = [];
  for (const sx of [-1, 1]) {
    const boss = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 8), matDark, 0.008);
    boss.rotation.z = Math.PI / 2;
    boss.position.set(sx * 0.86, -1.22, -2.55);
    boss.name = `socco-rope-anchor-${sx > 0 ? "r" : "l"}`;
    root.add(boss);
    anchors.push(boss);
  }
  root.userData.soccoRopeAnchors = anchors;
}

/**
 * 造一台 SOCCO（＝带货舱的重型运输艇）。
 * @param {object} [opts] 同 `createGateHaulerCraft`，`carrier` 强制为 true
 */
export function createSoccoCraft(opts = {}) {
  const craft = createGateHaulerCraft({ ...opts, carrier: true });
  craft.name = "socco-craft";
  return craft;
}

/**
 * 开合尾门。`open` 0 = 关（跳板收平贴腹）、1 = 全开（末端探到海面）。
 * 幂等、可反复调；不做插值（插值交给调用方的状态机，它才知道节奏）。
 */
export function setSoccoRamp(craft, open = 0) {
  const hinge = craft?.userData?.soccoRamp;
  if (!hinge) return 0;
  const k = Math.max(0, Math.min(1, open));
  hinge.rotation.x = SOCCO.rampOpenAngle * k;
  craft.userData.soccoRampOpen = k;
  return k;
}

/** 尾门是否已开到能放人（≥ 0.9） */
export function soccoRampReady(craft) {
  return (craft?.userData?.soccoRampOpen ?? 0) >= 0.9;
}

/**
 * 腹内座位（世界坐标）。撤离时也用它当"回位点"。
 * @returns {THREE.Vector3[]}
 */
export function soccoSeatWorldPositions(craft, out = []) {
  const seats = craft?.userData?.soccoSeats || [];
  craft?.updateWorldMatrix?.(true, true);
  out.length = 0;
  for (const s of seats) out.push(s.getWorldPosition(new THREE.Vector3()));
  return out;
}

/**
 * 跳板末端（世界坐标）——人就是从这儿踏出去上岸的。
 */
export function soccoRampFootWorld(craft, out = new THREE.Vector3()) {
  const hinge = craft?.userData?.soccoRamp;
  if (!hinge) return out.set(0, 0, 0);
  craft.updateWorldMatrix(true, true);
  return out.set(0, 0, -SOCCO.rampLength).applyMatrix4(hinge.matrixWorld);
}

const _scA = new THREE.Vector3();

/**
 * 贴海巡航：把艇压到离海面 `SOCCO.skimHeight`，气帘随速度脉动。
 *
 * **球面世界**：`up` 是径向（position.normalize()），不是 (0,1,0)。
 * 传 `seaRadius` 就把艇钉到那个半径上；不传就只做气帘与浮沉。
 *
 * @param {THREE.Object3D} craft
 * @param {{t?:number, seaRadius?:number, speed?:number}} [opts]
 */
export function updateSoccoSeaSkim(craft, { t = 0, seaRadius = null, speed = 1 } = {}) {
  if (!craft) return;
  if (Number.isFinite(seaRadius)) {
    _scA.copy(craft.position);
    if (_scA.lengthSq() > 1e-8) {
      const bob = Math.sin(t * 0.9) * 0.16 + Math.sin(t * 2.3) * 0.05;
      craft.position.copy(_scA.normalize().multiplyScalar(seaRadius + SOCCO.skimHeight + bob));
    }
  }
  const spray = craft.getObjectByName?.("socco-spray");
  if (spray) {
    // 气帘随速度胀缩：停下来时收成一圈薄雾，全速时铺开
    const pulse = 0.72 + 0.28 * Math.sin(t * 3.1);
    const k = 0.55 + 0.45 * Math.max(0, Math.min(1, speed));
    spray.scale.setScalar(k * pulse);
    if (spray.material) spray.material.opacity = 0.14 + 0.24 * k * pulse;
  }
}"""
assert old_tail in s
s = s.replace(old_tail, new_tail)
open(p, "w").write(s)
print("ok", len(s))
