// =====================================================================
//  西芳寺罗马方阵：鼓声平息 + 苔庭鲸升空后，战船一艘艘运兵上岸，
//  长矛围边、短剑盾第二层、核心英格兰长弓，对莫比斯 aircraft 攒箭。
//  单机中箭 50 支后高度降到原来的一半。
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "./planet.js";
import { SAIHOJI_HUB } from "./saihoji.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import { isInfiltrationMissionActive } from "../audio/sfx.js";
import {
  createFisherBoat,
  createHarborPatrolSoldier,
  createGladiusSoldier,
  createLongbowSoldier,
  updateLongbowShot,
  updateWarshipOars,
} from "../assets/harbor.js";

const SHIP_COUNT = 2;
const SHIP_GAP = 16;
const GRID = 5;
const CELL = 0.72;
const ARROW_KILL = 50;

const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _basis = new THREE.Matrix4();

function hubDir(out = new THREE.Vector3()) {
  return latLonToDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, out);
}

function surfaceBasis(dir, face, outUp, outFwd, outRight) {
  outUp.copy(dir).normalize();
  outFwd.copy(face);
  outFwd.addScaledVector(outUp, -outFwd.dot(outUp));
  if (outFwd.lengthSq() < 1e-8) {
    outFwd.set(0, 0, 1).addScaledVector(outUp, -outUp.z);
  }
  outFwd.normalize();
  outRight.crossVectors(outUp, outFwd).normalize();
  outFwd.crossVectors(outRight, outUp).normalize();
}

function placeOnSphere(obj, dir, lift, face) {
  surfaceBasis(dir, face, _up, _fwd, _right);
  obj.position.copy(_up).multiplyScalar(PLANET_RADIUS + lift);
  obj.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
}

function roleAt(ix, iz) {
  const c = (GRID - 1) / 2;
  const cheb = Math.max(Math.abs(ix - c), Math.abs(iz - c));
  const man = Math.abs(ix - c) + Math.abs(iz - c);
  if (cheb >= 2) return "spear";
  if (man === 2) return "gladius";
  return "longbow";
}

const _axisX = new THREE.Vector3(1, 0, 0);

function makeArrow() {
  const g = new THREE.Group();
  g.name = "phalanx-arrow";
  // 与长弓上搭箭同尺度（fig×2 后约 0.68），撒放时才不会突然变短
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.64, 4),
    new THREE.MeshBasicMaterial({ color: 0x7a5a32 })
  );
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.1, 4),
    new THREE.MeshBasicMaterial({ color: 0x8a9498 })
  );
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.36;
  g.add(head);
  const fletch = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.07, 0.012),
    new THREE.MeshBasicMaterial({ color: 0xc43c32 })
  );
  fletch.position.x = -0.26;
  g.add(fletch);
  g.userData.fly = 0;
  g.userData.from = new THREE.Vector3();
  g.userData.to = new THREE.Vector3();
  g.userData.arcUp = new THREE.Vector3(0, 1, 0);
  g.visible = false;
  return g;
}

/**
 * @param {object} opts
 * @param {THREE.Scene} opts.scene
 * @param {() => boolean} opts.isWhaleRisen
 * @param {() => THREE.Group|null} opts.getSquad
 * @param {() => object|null} [opts.getTram] 电车系统（redTram/blueTram 实时位置）——
 *   白天源源不断的电车运兵：电车掠过苔庭附近时士兵下车、步行入阵
 */
export function createSaihojiPhalanxBattle({ scene, isWhaleRisen, getSquad, getTram }) {
  const root = new THREE.Group();
  root.name = "saihoji-phalanx-battle";
  scene.add(root);

  /**
   * 完整故事线状态机：
   *  atCastle（高山圣城，鼓声控制）→ 鼓声结束发船
   *  → sailOut（运兵：城堡 → 运河交汇处城堡 → 苔庭下岸）
   *  → fight（整队成阵，鲸起才攒箭对 aircraft 射击）
   *  → return（苔庭鲸恢复原位后，士兵撤阵登船返回高山圣城）
   *  → atCastle（重新受鼓声控制，等下一轮）
   */
  let phase = "atCastle";
  let quietT = 0;
  let shipIdx = 0;
  let nextShipIn = 0;
  let returnRequested = false;
  const waves = [];
  const arrows = [];
  for (let i = 0; i < 72; i++) {
    const a = makeArrow();
    root.add(a);
    arrows.push(a);
  }
  let arrowI = 0;

  const landDir = hubDir(new THREE.Vector3());
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), landDir).normalize();
  landDir.addScaledVector(east, 0.11).normalize();
  // 出发港：高山圣城（castleContainer）；中转：运河交汇处城堡（水上城堡）
  const castleDir = (() => {
    const c = scene.getObjectByName("castleContainer");
    if (c) return c.position.clone().normalize();
    return latLonToDir(24.1, 36.05, new THREE.Vector3());
  })();
  const junctionDir = (() => {
    const j = scene.getObjectByName("canal-junction-box");
    if (j?.userData?.up) return j.userData.up.clone().normalize();
    return latLonToDir(30.05, -63.02, new THREE.Vector3());
  })();
  // 去程：城堡 → 交汇处城堡（稍作停留）→ 苔庭下岸；回程反向
  const OUT_LEGS = [
    [castleDir, junctionDir, 0.44],
    [junctionDir, junctionDir, 0.12],
    [junctionDir, landDir, 0.44],
  ];
  const BACK_LEGS = [
    [landDir, junctionDir, 0.44],
    [junctionDir, junctionDir, 0.12],
    [junctionDir, castleDir, 0.44],
  ];
  const SAIL_TIME = 34; // 单程运兵时长（两段航程 + 交汇处停留）
  function pathDirAt(legs, u) {
    let acc = 0;
    for (const [a, b, w] of legs) {
      if (u <= acc + w) {
        const t = THREE.MathUtils.clamp((u - acc) / Math.max(1e-6, w), 0, 1);
        return a.clone().lerp(b, t).normalize();
      }
      acc += w;
    }
    return legs[legs.length - 1][1].clone().normalize();
  }

  function spawnSoldier(role) {
    const s =
      role === "longbow"
        ? createLongbowSoldier()
        : role === "gladius"
          ? createGladiusSoldier()
          : createHarborPatrolSoldier();
    s.userData.phalanxRole = role;
    if (role === "longbow") {
      const order = ["reach", "nock", "draw", "hold", "follow", "recover"];
      const holdFor = 0.18 + Math.random() * 0.16;
      s.userData.bowCycle = {
        phase: order[Math.floor(Math.random() * order.length)],
        t: Math.random() * 0.12,
        draw: 0,
        holdFor,
        seed: Math.random() * Math.PI * 2,
      };
      updateLongbowShot(s, 0);
    }
    s.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    return s;
  }

  function spawnWave(index, grid = GRID, ringIndex = null) {
    const boat = createFisherBoat();
    boat.name = `saihoji-troopship-${index}`;
    boat.scale.setScalar(1.7);
    boat.userData.kind = "saihoji-troopship";
    root.add(boat);

    const cohort = new THREE.Group();
    cohort.name = `saihoji-cohort-${index}`;
    cohort.visible = false;
    const soldiers = [];
    for (let iz = 0; iz < grid; iz++) {
      for (let ix = 0; ix < grid; ix++) {
        const role = roleAt(ix, iz);
        const s = spawnSoldier(role);
        s.userData.gx = ix;
        s.userData.gz = iz;
        cohort.add(s);
        soldiers.push(s);
      }
    }
    root.add(cohort);
    waves.push({
      boat,
      cohort,
      soldiers,
      u: 0,
      state: "sailOut",
      ringIndex, // 补给船下岸到环绕苔庭槽位；故事主阵 null = 中央
    });
  }

  function placeCohort(wave, origin, face) {
    surfaceBasis(origin, face, _up, _fwd, _right);
    const c = (GRID - 1) / 2;
    for (const s of wave.soldiers) {
      const lx = (s.userData.gx - c) * CELL;
      const lz = (s.userData.gz - c) * CELL;
      _tmp.copy(_up).multiplyScalar(PLANET_RADIUS + 0.08)
        .addScaledVector(_right, lx)
        .addScaledVector(_fwd, -lz);
      s.position.copy(_tmp);
      s.userData.formationPos = _tmp.clone(); // 鲸起时的归位点
      s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
    }
    wave.cohort.visible = true;
    wave.boat.visible = false;
  }

  function fireArrow(from, toAc) {
    const a = arrows[arrowI % arrows.length];
    arrowI++;
    if (a.parent !== root) root.attach(a);
    a.userData.stuck = false;
    a.visible = true;
    a.userData.fly = 0;
    a.userData.target = toAc;
    const nock = from.userData.equipment?.nockedArrow;
    if (nock) {
      nock.getWorldPosition(_tmp);
    } else {
      from.getWorldPosition(_tmp);
      from.getWorldQuaternion(_q);
      _tmp.add(_tmpB.set(0.25, 0.38, 0).applyQuaternion(_q));
    }
    a.position.copy(_tmp);
    from.getWorldQuaternion(_q);
    a.userData.arcUp.set(0, 1, 0).applyQuaternion(_q).normalize();
    toAc.getWorldPosition(_tmpB);
    _tmpB.x += (Math.random() - 0.5) * 1.6;
    _tmpB.y += (Math.random() - 0.5) * 0.9;
    _tmpB.z += (Math.random() - 0.5) * 1.6;
    a.userData.from.copy(a.position);
    a.userData.to.copy(_tmpB);
    _tmpB.sub(a.position);
    if (_tmpB.lengthSq() > 1e-8) {
      a.quaternion.setFromUnitVectors(_axisX, _tmpB.normalize());
    }
  }

  function updateArrows(dt) {
    for (const a of arrows) {
      if (!a.visible || a.userData.stuck) continue;
      a.userData.fly += dt / 0.55;
      const u = Math.min(1, a.userData.fly);
      a.position.lerpVectors(a.userData.from, a.userData.to, u);
      a.position.addScaledVector(a.userData.arcUp, Math.sin(u * Math.PI) * 1.8);
      if (u < 1) continue;
      const ac = a.userData.target;
      if (ac?.parent) {
        ac.attach(a);
        a.userData.stuck = true;
        ac.userData.arrowHits = (ac.userData.arrowHits || 0) + 1;
        if (ac.userData.arrowHits >= ARROW_KILL) {
          ac.userData.woundHeightMul = 0.5;
        }
      } else {
        a.visible = false;
      }
    }
  }

  /** 方阵是否已整队成阵（运兵船全部下岸）——苔庭鲸以此作为升空循环条件 */
  function isAssembled() {
    return (
      phase === "fight" ||
      garrison.length > 0 || // 电车运兵驻军也算就位（白天鲸可随时被扫描唤起）
      (shipIdx >= SHIP_COUNT && waves.length >= SHIP_COUNT && waves.every((w) => w.state !== "sailOut"))
    );
  }

  /** 硬重置（调试/热重载）：士兵撤阵清场，回到 atCastle 等下一轮鼓息运兵 */
  function resetBattle() {
    for (const w of waves) {
      root.remove(w.boat);
      root.remove(w.cohort);
    }
    waves.length = 0;
    shipIdx = 0;
    phase = "atCastle";
    quietT = 0;
    for (const g of garrison) {
      for (const s of g.soldiers) root.remove(s);
    }
    garrison.length = 0;
    for (const a of arrows) {
      if (a.parent && a.parent !== root) a.parent.remove(a);
      a.visible = false;
      a.userData.stuck = false;
    }
  }

  // ---------- 白天源源不断的运兵（电车下车 + 战船补给） ----------
  // 鼓声只控制故事大波次；白天（鼓息）苔庭驻军由两条补给线持续补充：
  //  - 有轨电车掠过苔庭附近（~27 单位航线）时，士兵下车步行入阵；
  //  - 故事部署期（下岸整队后）战船每 ~30s 补一小队（3×3）。
  const GARRISON_SQUAD = 5;
  const GARRISON_CAP = 16; // 源源不断：环绕苔庭两圈（12+4 槽）
  const TRAM_DROP_RADIUS = 42;
  const TRAM_CHECK_INTERVAL = 3;
  const REINFORCE_INTERVAL = 30;
  const RING_PER_RING = 12; // 每圈槽位数
  const RING_BASE_RADIUS = 20; // 内圈半径（苔庭板缘 12.5 之外）
  const RING_STEP = 4; // 外圈每圈外扩
  const garrison = [];
  let nextTramDrop = 5;
  let nextReinforce = 20;
  let waveSerial = 100;
  let ringCursor = 0; // 槽位游标：黄金角散列 → 排布永不重复
  const landingWorld = landDir.clone().multiplyScalar(PLANET_RADIUS);
  const ringNorth = new THREE.Vector3().crossVectors(landDir, east).normalize();

  /** 环绕苔庭的槽位方向：黄金角散列 + 逐圈外扩，永不重复 */
  function ringSlotDir(index, out) {
    const ring = (index / RING_PER_RING) | 0;
    const i = index % RING_PER_RING;
    const angle = i * 2.399963 + ring * 0.31; // 黄金角
    const radius = RING_BASE_RADIUS + ring * RING_STEP;
    const d = radius / PLANET_RADIUS;
    return out
      .copy(landDir)
      .multiplyScalar(Math.cos(d))
      .addScaledVector(east, Math.cos(angle) * Math.sin(d))
      .addScaledVector(ringNorth, Math.sin(angle) * Math.sin(d))
      .normalize();
  }

  function slerpDir(a, b, t, out) {
    const omega = a.angleTo(b);
    if (omega < 1e-5) return out.copy(a);
    const so = Math.sin(omega);
    return out
      .copy(a)
      .multiplyScalar(Math.sin((1 - t) * omega) / so)
      .addScaledVector(b, Math.sin(t * omega) / so)
      .normalize();
  }

  function spawnGarrisonSquad(fromWorld) {
    // 环绕苔庭槽位：黄金角散列，每个小队一个不重复的位置
    const slotIndex = ringCursor++;
    const slotDir = ringSlotDir(slotIndex, new THREE.Vector3());
    surfaceBasis(slotDir, landDir, _up, _fwd, _right);
    // spawnSoldier 内部会用模块临时向量（弓循环等），先拷出基向量
    const rightN = _right.clone();
    const fwdN = _fwd.clone();
    const soldiers = [];
    for (let i = 0; i < GARRISON_SQUAD; i++) {
      const s = spawnSoldier(i < 2 ? "longbow" : i < 4 ? "gladius" : "spear");
      const offR = (i - 2) * 0.8;
      const offF = ((i % 2) - 0.5) * 0.8;
      // 下车点贴地（电车在轨上，士兵落到地面后步行）
      const from = fromWorld
        .clone()
        .normalize()
        .multiplyScalar(PLANET_RADIUS + 0.08)
        .addScaledVector(rightN, offR)
        .addScaledVector(fwdN, offF);
      // 目标 = 槽位 + 队内偏移
      const target = slotDir
        .clone()
        .multiplyScalar(PLANET_RADIUS + 0.08)
        .addScaledVector(rightN, offR)
        .addScaledVector(fwdN, offF);
      s.userData.garrisonFrom = from.clone();
      s.userData.garrisonTo = target.clone();
      s.userData.formationPos = target.clone(); // 鲸起时的归位点
      s.userData.garrisonSeed = (slotIndex * GARRISON_SQUAD + i + 1) * 17;
      s.position.copy(from);
      root.add(s);
      soldiers.push(s);
    }
    garrison.push({ soldiers, u: 0, index: slotIndex });
  }

  function tryTramDrop() {
    if (garrison.length >= GARRISON_CAP) return;
    const tram = typeof getTram === "function" ? getTram() : null;
    const cars = [tram?.redTram, tram?.blueTram].filter((c) => c?.parent);
    if (!cars.length) return;
    let best = null;
    let bestD = Infinity;
    for (const car of cars) {
      car.getWorldPosition(_tmpB);
      const d = _tmpB.distanceTo(landingWorld);
      if (d < bestD) {
        bestD = d;
        best = _tmpB.clone();
      }
    }
    if (!best || bestD > TRAM_DROP_RADIUS) return;
    spawnGarrisonSquad(best);
  }

  /** 苔庭内随机巡查点（地壳板 25×14 内缩） */
  function patrolPoint(out) {
    const lx = (Math.random() - 0.5) * 22;
    const lz = (Math.random() - 0.5) * 11;
    return out
      .copy(landDir)
      .addScaledVector(east, lx / PLANET_RADIUS)
      .addScaledVector(ringNorth, lz / PLANET_RADIUS)
      .normalize()
      .multiplyScalar(PLANET_RADIUS + 0.08);
  }

  /**
   * 落位士兵的两态行为：
   *  - 鲸未升起：在苔庭内分散巡查（随机漫步点，人人相位不同）；
   *  - 鲸升起：返回各自阵位（槽位/主阵）攒箭。
   * @param {THREE.Object3D} s 士兵（须已存 formationPos = 阵位）
   */
  function patrolSoldier(s, dt, whaleUp) {
    if (!s.userData.formationPos) return;
    const u = s.userData.patrol || (s.userData.patrol = {
      t: 0,
      wait: 4 + Math.random() * 5,
      from: null,
      to: null,
      returning: false,
    });
    if (whaleUp) {
      if (!u.returning) {
        u.returning = true;
        u.t = 0;
        u.from = s.position.clone();
      }
      u.t = Math.min(1, u.t + dt / 14);
      const e = u.t * u.t * (3 - 2 * u.t);
      slerpDir(
        u.from.clone().normalize(),
        s.userData.formationPos.clone().normalize(),
        e,
        _tmp
      );
      _tmp.multiplyScalar(PLANET_RADIUS + 0.08);
      s.position.copy(_tmp);
      return;
    }
    u.returning = false;
    u.t += dt;
    if (!u.to || u.t >= u.wait) {
      u.t = 0;
      u.wait = 4 + Math.random() * 5;
      u.from = s.position.clone();
      patrolPoint((u.to = u.to || new THREE.Vector3()));
    }
    const e = Math.min(1, u.t / Math.max(1, u.wait));
    slerpDir(u.from.clone().normalize(), u.to.clone().normalize(), e, _tmp);
    _tmp.multiplyScalar(PLANET_RADIUS + 0.08);
    s.position.copy(_tmp);
    surfaceBasis(_tmp.normalize(), u.to.clone().normalize(), _up, _fwd, _right);
    s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
  }

  function updateGarrison(dt, whaleUp) {
    for (const g of garrison) {
      const arrived = g.u >= 1;
      if (!arrived) g.u = Math.min(1, g.u + dt / 20);
      const e = g.u * g.u * (3 - 2 * g.u);
      for (const s of g.soldiers) {
        if (arrived) {
          // 落位：鲸未升起 → 苔庭内分散巡查；鲸起 → 归位攒箭
          patrolSoldier(s, dt, whaleUp);
          continue;
        }
        slerpDir(
          s.userData.garrisonFrom.clone().normalize(),
          s.userData.garrisonTo.clone().normalize(),
          e,
          _tmp
        );
        _tmp.multiplyScalar(PLANET_RADIUS + 0.08);
        s.position.copy(_tmp);
        // 面向苔庭中心（环绕排布，人人朝内）
        surfaceBasis(_tmp.normalize(), landDir, _up, _fwd, _right);
        s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
      }
    }
  }

  function update(dt, t) {
    const drums = isInfiltrationMissionActive();
    if (drums) quietT = 0;
    else quietT += dt;
    const whaleUp = typeof isWhaleRisen === "function" ? !!isWhaleRisen() : false;

    // 循环条件（苔庭鲸 ↔ 机队交互）契约：root.userData.assembled 供鲸读，
    // whaleReturned 由鲸在恢复原位后调用。鼓声只控制 atCastle 的发船，
    // 士兵离城后不再受鼓声逻辑控制，直到返回高山圣城。
    root.userData.assembled = isAssembled();
    root.userData.phase = phase;
    if (root.userData.resetRequested) {
      root.userData.resetRequested = false;
      resetBattle();
      return;
    }
    // 苔庭鲸恢复原位 → 撤阵登船返回高山圣城（离城期不受鼓声影响）
    if (
      returnRequested &&
      (phase === "fight" ||
        waves.some((w) => w.state === "fight" || w.state === "ashore"))
    ) {
      returnRequested = false;
      phase = "return";
      for (const w of waves) {
        w.state = "return";
        w.u = 0;
        w.cohort.visible = false; // 撤阵
        w.boat.visible = true;
        placeOnSphere(w.boat, landDir, 0.18, landDir);
      }
      // 残箭回收：撤阵时把扎在机队上的箭取回
      for (const a of arrows) {
        if (a.parent && a.parent !== root) a.parent.remove(a);
        a.visible = false;
        a.userData.stuck = false;
      }
    }

    if (phase === "atCastle") {
      // 高山圣城 · 受鼓声控制：鼓声结束后才发船
      if (quietT > 1.6) {
        phase = "sailOut";
        shipIdx = 0;
        nextShipIn = 0.4;
      }
      return;
    }

    if (phase === "sailOut") {
      nextShipIn -= dt;
      if (shipIdx < SHIP_COUNT && nextShipIn <= 0) {
        spawnWave(shipIdx);
        shipIdx++;
        nextShipIn = SHIP_GAP;
      }
      let allLanded = shipIdx >= SHIP_COUNT;
      for (const w of waves) {
        if (w.state !== "sailOut") continue;
        allLanded = false;
        w.u = Math.min(1, w.u + dt / SAIL_TIME);
        const u = w.u * w.u * (3 - 2 * w.u);
        _tmp.copy(pathDirAt(OUT_LEGS, u));
        _tmpB.copy(pathDirAt(OUT_LEGS, Math.min(1, u + 0.02)));
        placeOnSphere(w.boat, _tmp, 0.18, _tmpB);
        updateWarshipOars?.(w.boat, dt, 0.85);
        if (w.u >= 1) {
          w.state = "ashore";
          if (Number.isFinite(w.ringIndex)) {
            // 补给船：下岸到环绕苔庭槽位（面朝苔庭中心）
            placeCohort(w, ringSlotDir(w.ringIndex, new THREE.Vector3()), landDir);
          } else {
            placeCohort(w, landDir, east);
          }
        }
      }
      if (allLanded && waves.every((w) => w.state === "ashore" || w.state === "fight")) {
        phase = "fight";
        for (const w of waves) w.state = "fight";
      }
    }

    if (phase === "return") {
      let allHome = true;
      for (const w of waves) {
        if (w.state !== "return") continue;
        allHome = false;
        w.u = Math.min(1, w.u + dt / SAIL_TIME);
        const u = w.u * w.u * (3 - 2 * w.u);
        _tmp.copy(pathDirAt(BACK_LEGS, u));
        _tmpB.copy(pathDirAt(BACK_LEGS, Math.min(1, u + 0.02)));
        placeOnSphere(w.boat, _tmp, 0.18, _tmpB);
        updateWarshipOars?.(w.boat, dt, 0.85);
        if (w.u >= 1) {
          w.state = "done";
          w.boat.visible = false;
        }
      }
      if (allHome) {
        // 回到高山圣城：重新受鼓声控制，等下一轮
        for (const w of waves) {
          root.remove(w.boat);
          root.remove(w.cohort);
        }
        waves.length = 0;
        shipIdx = 0;
        phase = "atCastle";
        quietT = 0;
      }
    }

    // —— 白天源源不断的运兵（鼓声暂停全线；电车下车 + 战船补给）——
    if (!drums) {
      nextTramDrop -= dt;
      if (nextTramDrop <= 0) {
        nextTramDrop = TRAM_CHECK_INTERVAL;
        tryTramDrop();
      }
      const deployed =
        phase === "fight" ||
        waves.some((w) => w.state === "ashore" || w.state === "fight");
      if (deployed) {
        nextReinforce -= dt;
        if (nextReinforce <= 0) {
          nextReinforce = REINFORCE_INTERVAL;
          if (waves.length < SHIP_COUNT + 6) {
            spawnWave(waveSerial++, 3, ringCursor++);
            nextShipIn = 0;
          }
        }
      }
    }
    updateGarrison(dt, whaleUp);

    // 故事波次（主阵/补给）落位后同样两态：鲸未升起 → 苔庭内分散巡查
    for (const w of waves) {
      if (w.state !== "ashore" && w.state !== "fight") continue;
      for (const s of w.soldiers) patrolSoldier(s, dt, whaleUp);
    }

    const squad = typeof getSquad === "function" ? getSquad() : null;
    const members = squad?.userData?.members || [];
    const live = members.filter((m) => m.parent);

    const shooters = [
      ...waves
        .filter((w) => w.state === "fight" || w.state === "ashore")
        .flatMap((w) => w.soldiers),
      ...garrison.flatMap((g) => g.soldiers),
    ];
    if (whaleUp && shooters.length) {
      const aim = live[0];
      if (aim) {
        aim.getWorldPosition(_tmpB);
        for (const s of shooters) {
          s.getWorldPosition(_tmp);
          _fwd.copy(_tmpB).sub(_tmp);
          surfaceBasis(_tmp, _fwd, _up, _fwd, _right);
          s.quaternion.slerp(_q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)), 0.08);
          if (s.userData.phalanxRole !== "longbow") continue;
          const released = updateLongbowShot(s, dt);
          if (!released || !live.length) continue;
          const tgt =
            live.find((m) => (m.userData.arrowHits || 0) < ARROW_KILL) ||
            live[((s.userData.garrisonSeed ?? 0) + ((s.userData.gx ?? 0) + (s.userData.gz ?? 0))) % live.length];
          fireArrow(s, tgt);
        }
      }
      updateArrows(dt);
    }
  }

  // 苔庭鲸故事线通过 root.userData 与此方阵松耦合：
  // 读 assembled（是否整队）作升空循环条件；终扫收束后置 resetRequested 撤阵。
  // 苔庭鲸故事线松耦合契约：
  //  - 鲸读 root.userData.assembled（是否整队）作升空循环条件；
  //  - 鲸恢复原位后调 root.userData.whaleReturned()，士兵撤阵登船返回高山圣城。
  root.userData.whaleReturned = () => {
    returnRequested = true;
  };
  root.userData.reset = () => {
    root.userData.resetRequested = true;
  };
  return { root, update, isAssembled, reset: resetBattle };
}
