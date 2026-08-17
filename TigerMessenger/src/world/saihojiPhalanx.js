// =====================================================================
//  西芳寺罗马方阵：鼓声平息 + 苔庭鲸升空后，战船一艘艘运兵上岸，
//  长矛围边、短剑盾第二层、核心英格兰长弓，对莫比斯 aircraft 攒箭。
//  鲸起即告警 → 全营整队：长弓手在北翼排成两列，矛/盾结成护壁；
//  aircraft 悬停盘顶吸食，羽箭逐箭削弱其吸取力；绳索小队抛绳挂上
//  鲸身两侧，拔河式把苔庭鲸拉回地面（低级文明 vs 高级文明的拉锯）。
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "./planet.js";
import { SAIHOJI_HUB } from "./saihoji.js";
import { latLonToDir, quatYToDir } from "./sphereMath.js";
import {
  isInfiltrationMissionActive,
  cuePhalanxAlarmOnce,
  rearmPhalanxAlarm,
} from "../audio/sfx.js";
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
// 羽箭池上限：机队中箭数只做计数，吸取力由 moebiusAircraft 逐箭渐进计算
const ARROW_POOL = 150;

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
  // 与长弓上搭箭同尺度（fig×2 后约 0.68），撒放时才不会突然变短；
  // 放大 1.5 倍 + 加色拖尾：长距离攒射在空中清晰可见
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.92, 5),
    new THREE.MeshBasicMaterial({ color: 0x9a7a4a })
  );
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.14, 5),
    new THREE.MeshBasicMaterial({ color: 0xcfd6da })
  );
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.52;
  g.add(head);
  const fletch = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.11, 0.016),
    new THREE.MeshBasicMaterial({ color: 0xe04c3e })
  );
  fletch.position.x = -0.36;
  g.add(fletch);
  // 亮色拖尾（加色混合）：飞行轨迹如流星
  const trail = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.055, 0.055),
    new THREE.MeshBasicMaterial({
      color: 0xaee8ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  trail.name = "arrow-trail";
  trail.userData.isTrail = true;
  trail.position.x = -0.72;
  g.add(trail);
  g.userData.fly = 0;
  g.userData.from = new THREE.Vector3();
  g.userData.to = new THREE.Vector3();
  g.userData.arcUp = new THREE.Vector3(0, 1, 0);
  g.userData.miss = 0;
  g.visible = false;
  return g;
}

/** 长枪（投掷标枪）：比箭长一倍、更粗，枪头 + 红缨 + 加色拖尾 */
function makeJavelin() {
  const g = new THREE.Group();
  g.name = "phalanx-javelin";
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 1.3, 5),
    new THREE.MeshBasicMaterial({ color: 0x6b4f2a })
  );
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.18, 5),
    new THREE.MeshBasicMaterial({ color: 0xc9d1d6 })
  );
  head.rotation.z = -Math.PI / 2;
  head.position.x = 0.72;
  g.add(head);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.034, 0.16, 5),
    new THREE.MeshBasicMaterial({ color: 0xb83028 })
  );
  band.rotation.z = Math.PI / 2;
  band.position.x = -0.34;
  g.add(band);
  const trail = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.075, 0.075),
    new THREE.MeshBasicMaterial({
      color: 0xd8e8ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  trail.name = "javelin-trail";
  trail.position.x = -0.95;
  g.add(trail);
  g.userData.fly = 0;
  g.userData.from = new THREE.Vector3();
  g.userData.to = new THREE.Vector3();
  g.userData.arcUp = new THREE.Vector3(0, 1, 0);
  g.userData.miss = 0;
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
  let wasWhaleUp = false;
  const waves = [];
  const arrows = [];
  for (let i = 0; i < ARROW_POOL; i++) {
    const a = makeArrow();
    root.add(a);
    arrows.push(a);
  }
  let arrowI = 0;
  // 长枪兵的投枪池：比箭更长更粗，掷向盘顶机队
  const javelins = [];
  for (let i = 0; i < 44; i++) {
    const j = makeJavelin();
    root.add(j);
    javelins.push(j);
  }
  let javelinI = 0;
  // 命中火花/受创烟：池化小网格（加色火花 + 半透明烟）
  const sparkPool = [];
  const smokePool = [];
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 4),
      new THREE.MeshBasicMaterial({
        color: 0xffe8a0,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sp.visible = false;
    root.add(sp);
    sparkPool.push(sp);
  }
  for (let i = 0; i < 14; i++) {
    const sm = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 4),
      new THREE.MeshBasicMaterial({
        color: 0x2a2a30,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      })
    );
    sm.visible = false;
    root.add(sm);
    smokePool.push(sm);
  }
  let sparkI = 0;
  let smokeI = 0;

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
      _tmp.copy(_up).multiplyScalar(PLANET_RADIUS + groundLift(_up))
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
    root.userData._fireCalls = (root.userData._fireCalls || 0) + 1;
    const a = arrows[arrowI % arrows.length];
    arrowI++;
    if (a.parent !== root) root.attach(a);
    a.userData.stuck = false;
    a.userData.miss = 0;
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
    // 目标点：成员当前位置 + 固定散布（世界偏移，随成员移动）
    toAc.getWorldPosition(_tmpB);
    a.userData.aimOff = new THREE.Vector3(
      (Math.random() - 0.5) * 6.8,
      (Math.random() - 0.5) * 3.4,
      (Math.random() - 0.5) * 6.8
    );
    _tmpB.add(a.userData.aimOff);
    a.userData.from.copy(a.position);
    a.userData.to.copy(_tmpB);
    _tmpB.sub(a.position);
    if (_tmpB.lengthSq() > 1e-8) {
      a.quaternion.setFromUnitVectors(_axisX, _tmpB.normalize());
    }
  }

  const _sparkTmp = new THREE.Vector3();
  const _smokeUp = new THREE.Vector3(0, 1, 0);

  function spawnSpark(worldPos) {
    const sp = sparkPool[sparkI % sparkPool.length];
    sparkI++;
    sp.visible = true;
    sp.position.copy(worldPos);
    sp.scale.setScalar(0.7 + Math.random() * 0.9);
    sp.userData.t = 0;
  }

  function spawnSmoke(worldPos) {
    const sm = smokePool[smokeI % smokePool.length];
    smokeI++;
    sm.visible = true;
    sm.position.copy(worldPos);
    sm.scale.setScalar(0.8 + Math.random() * 1.1);
    sm.userData.t = 0;
    sm.userData.up = worldPos.clone().normalize();
  }

  function updateArrows(dt) {
    for (const a of arrows) {
      if (!a.visible) continue;
      const u = a.userData;
      if (u.stuck) {
        // 扎在机身上的箭：微颤（受创感）
        if (u.wobble > 0) {
          u.wobble -= dt;
          a.position.x += Math.sin(u.wobble * 31) * 0.01 * u.wobble;
        }
        continue;
      }
      if (u.miss > 0) {
        // 脱靶：箭沿径向坠落（球面世界下坠方向 = 指向球心）
        u.miss += dt / 0.75;
        a.position.addScaledVector(
          _tmp.copy(a.position).normalize(),
          -dt * 5.5
        );
        a.rotation.x += dt * 4;
        const m = Math.min(1, u.miss);
        a.scale.setScalar(1 - m * 0.5);
        if (m >= 1) {
          a.visible = false;
          a.scale.setScalar(1);
        }
        continue;
      }
      // 追踪飞行：目标点每帧跟随成员（带滞后），箭弧优美追射
      const ac = u.target;
      let tgt = null;
      if (ac?.parent) {
        ac.getWorldPosition(_sparkTmp);
        if (u.aimOff) _sparkTmp.add(u.aimOff);
        u.to.lerp(_sparkTmp, Math.min(1, dt * 2.1));
        tgt = _sparkTmp;
      } else {
        u.miss = 0.01; // 目标没了：直接坠落
        continue;
      }
      u.fly += dt / 1.15;
      const p = Math.min(1, u.fly);
      a.position.lerpVectors(u.from, u.to, p);
      a.position.addScaledVector(u.arcUp, Math.sin(p * Math.PI) * 3.2);
      // 箭身顺飞行方向
      _tmp.copy(u.to).sub(u.from).normalize();
      a.quaternion.setFromUnitVectors(_axisX, _tmp);
      // 拖尾随速度闪烁
      const trail = a.children.find((c) => c.userData?.isTrail) || a.getObjectByName?.("arrow-trail");
      if (trail?.material) trail.material.opacity = 0.3 + 0.35 * Math.sin(p * Math.PI);
      if (p < 1) continue;
      // 落地判定：命中判定圈 = 成员半径（散布+滞后决定脱靶率）
      const tip = a.position.clone();
      const acPos = _sparkTmp.clone();
      if (ac?.parent && tip.distanceTo(acPos) < 5.2) {
        // 命中：箭头扎进机体（随机姿态），计数 + 火花 + 烟 + 冲击
        ac.attach(a);
        u.stuck = true;
        u.wobble = 1.6 + Math.random() * 0.8;
        a.scale.setScalar(0.9 + Math.random() * 0.25);
        ac.userData.arrowHits = (ac.userData.arrowHits || 0) + 1;
        spawnSpark(tip);
        if (Math.random() < 0.5) spawnSmoke(tip);
      } else {
        u.miss = 0.01; // 脱靶：坠落
      }
    }
    // 火花/烟 寿命
    for (const sp of sparkPool) {
      if (!sp.visible) continue;
      sp.userData.t += dt;
      const e = Math.min(1, sp.userData.t / 0.28);
      sp.scale.multiplyScalar(1 + dt * 6);
      sp.material.opacity = 0.95 * (1 - e);
      if (e >= 1) sp.visible = false;
    }
    for (const sm of smokePool) {
      if (!sm.visible) continue;
      sm.userData.t += dt;
      const e = Math.min(1, sm.userData.t / 1.4);
      sm.position.addScaledVector(
        sm.userData.up || _smokeUp,
        dt * 1.6
      );
      sm.scale.multiplyScalar(1 + dt * 0.9);
      sm.material.opacity = 0.4 * (1 - e);
      if (e >= 1) sm.visible = false;
    }
  }

  // 投枪专用临时向量（与箭矢共用 _sparkTmp/_axisX，但飞行用独立向量避免互踩）
  const _jvTmpA = new THREE.Vector3();
  const _jvTmpB = new THREE.Vector3();
  const _jvUp = new THREE.Vector3(0, 1, 0);

  /** 长枪兵掷出手中的长枪（从枪尖所在的手位出手，飞向机队成员） */
  function throwJavelin(from, toAc) {
    const j = javelins[javelinI % javelins.length];
    javelinI++;
    if (j.parent !== root) root.attach(j);
    j.userData.stuck = false;
    j.userData.miss = 0;
    j.visible = true;
    j.userData.fly = 0;
    j.userData.target = toAc;
    const spear = from.userData.equipment?.spear;
    if (spear) {
      spear.getWorldPosition(_tmp);
    } else {
      from.getWorldPosition(_tmp);
      from.getWorldQuaternion(_q);
      _tmp.add(_tmpB.set(0.3, 0.45, 0).applyQuaternion(_q));
    }
    j.position.copy(_tmp);
    from.getWorldQuaternion(_q);
    j.userData.arcUp.set(0, 1, 0).applyQuaternion(_q).normalize();
    toAc.getWorldPosition(_tmpB);
    j.userData.aimOff = new THREE.Vector3(
      (Math.random() - 0.5) * 4.6,
      (Math.random() - 0.5) * 2.4,
      (Math.random() - 0.5) * 4.6
    );
    _tmpB.add(j.userData.aimOff);
    j.userData.from.copy(j.position);
    j.userData.to.copy(_tmpB);
    _tmpB.sub(j.position);
    if (_tmpB.lengthSq() > 1e-8) {
      j.quaternion.setFromUnitVectors(_axisX, _tmpB.normalize());
    }
  }

  /** 投枪运动：追踪飞行（更重更慢、弧更高）→ 命中扎入机队 / 脱靶坠落 */
  function updateJavelins(dt) {
    for (const j of javelins) {
      if (!j.visible) continue;
      const u = j.userData;
      if (u.stuck) {
        if (u.wobble > 0) {
          u.wobble -= dt;
          j.position.x += Math.sin(u.wobble * 27) * 0.012 * u.wobble;
        }
        continue;
      }
      if (u.miss > 0) {
        u.miss += dt / 0.9;
        j.position.addScaledVector(_jvTmpA.copy(j.position).normalize(), -dt * 6);
        j.rotation.x += dt * 3;
        const m = Math.min(1, u.miss);
        j.scale.setScalar(1 - m * 0.5);
        if (m >= 1) {
          j.visible = false;
          j.scale.setScalar(1);
        }
        continue;
      }
      const ac = u.target;
      if (ac?.parent) {
        ac.getWorldPosition(_sparkTmp);
        if (u.aimOff) _sparkTmp.add(u.aimOff);
        u.to.lerp(_sparkTmp, Math.min(1, dt * 1.7));
      } else {
        u.miss = 0.01;
        continue;
      }
      u.fly += dt / 1.5;
      const p = Math.min(1, u.fly);
      j.position.lerpVectors(u.from, u.to, p);
      j.position.addScaledVector(u.arcUp, Math.sin(p * Math.PI) * 4.5);
      _jvTmpB.copy(u.to).sub(u.from).normalize();
      j.quaternion.setFromUnitVectors(_axisX, _jvTmpB);
      const trail = j.getObjectByName?.("javelin-trail");
      if (trail?.material) trail.material.opacity = 0.25 + 0.3 * Math.sin(p * Math.PI);
      if (p < 1) continue;
      const tip = j.position.clone();
      const acPos = _sparkTmp.clone();
      if (ac?.parent && tip.distanceTo(acPos) < 5.2) {
        ac.attach(j);
        u.stuck = true;
        u.wobble = 1.8 + Math.random() * 0.8;
        j.scale.setScalar(0.95 + Math.random() * 0.2);
        ac.userData.arrowHits = (ac.userData.arrowHits || 0) + 1;
        spawnSpark(tip);
        if (Math.random() < 0.6) spawnSmoke(tip);
      } else {
        u.miss = 0.01;
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
    detachRopes();
    resetFightFormation();
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
    for (const j of javelins) {
      if (j.parent && j.parent !== root) j.parent.remove(j);
      j.visible = false;
      j.userData.stuck = false;
    }
    for (const sp of sparkPool) sp.visible = false;
    for (const sm of smokePool) sm.visible = false;
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
      const s = spawnSoldier(i < 3 ? "longbow" : i < 4 ? "gladius" : "spear");
      const offR = (i - 2) * 0.8;
      const offF = ((i % 2) - 0.5) * 0.8;
      // 下车点贴地（电车在轨上，士兵落到地面后步行）
      const fromDir = fromWorld.clone().normalize();
      const from = fromDir
        .clone()
        .multiplyScalar(PLANET_RADIUS + groundLift(fromDir))
        .addScaledVector(rightN, offR)
        .addScaledVector(fwdN, offF);
      // 目标 = 槽位 + 队内偏移
      const target = slotDir
        .clone()
        .multiplyScalar(PLANET_RADIUS + groundLift(slotDir))
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
      .multiplyScalar(PLANET_RADIUS + groundLift(out));
  }

  /**
   * 地面抬升：苔庭地壳板（含苔丘，板面 R+0.3 + 苔 0.1）上的士兵站到苔面上，
   * 板外贴地（R+0.08）——草坪不能埋住士兵。
   * @param {THREE.Vector3} dir 球面方向（单位向量）
   */
  function groundLift(dir) {
    const ex = Math.abs(dir.dot(east)) * PLANET_RADIUS;
    const nz = Math.abs(dir.dot(ringNorth)) * PLANET_RADIUS;
    return ex <= 13 && nz <= 8 ? 0.45 : 0.08;
  }

  /**
   * 落位士兵的两态行为：
   *  - 鲸未升起：在苔庭内分散巡查（随机漫步点，人人相位不同）；
   *  - 鲸升起：告警整队——长弓手奔向北翼两列、矛/盾结成护壁（整理队伍）。
   * @param {THREE.Object3D} s 士兵（须已存 formationPos = 阵位）
   */
  function patrolSoldier(s, dt, whaleUp) {
    if (!s.userData.formationPos) return;
    // 战斗期（fightFormed 在拔河全程锁定，鲸被拽到半空也保持列阵）或鲸起
    const inFight = whaleUp || fightFormed;
    const u = s.userData.patrol || (s.userData.patrol = {
      t: 0,
      wait: 4 + Math.random() * 5,
      from: null,
      to: null,
      returning: false,
    });
    if (inFight) {
      if (!u.returning) {
        u.returning = true;
        u.t = 0;
        u.from = s.position.clone();
      }
      // 目标：战斗站位（长弓两列 / 矛盾护壁）；未分配则先分配
      if (!s.userData.fightPos) assignFightStation(s);
      const goal = s.userData.fightPos || s.userData.formationPos;
      const dist = u.from.distanceTo(goal);
      u.t = Math.min(1, u.t + dt / Math.max(5, dist * 0.32)); // 告警奔跑列阵
      const e = u.t * u.t * (3 - 2 * u.t);
      slerpDir(
        u.from.clone().normalize(),
        goal.clone().normalize(),
        e,
        _tmp
      );
      _tmp.multiplyScalar(PLANET_RADIUS + groundLift(_tmp));
      s.position.copy(_tmp);
      // 行军时面向目的地；到站后姿态交给射击循环（仰望机队）——
      // 不再每帧整设，否则会把射手的仰射姿态打回水平（长弓手瞄地）
      if (u.t < 1) {
        surfaceBasis(_tmp.normalize(), landDir, _up, _fwd, _right);
        s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
      }
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
    _tmp.multiplyScalar(PLANET_RADIUS + groundLift(_tmp));
    s.position.copy(_tmp);
    surfaceBasis(_tmp.normalize(), u.to.clone().normalize(), _up, _fwd, _right);
    s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
  }

  // ---------- 战斗列阵：告警后长弓北翼两列、矛/盾护壁（整理队伍） ----------
  // 鲸身总长 72（半长 36）、半宽 17.6：战斗列阵必须排在鲸身侧缘之外，
  // 北翼（ringNorth）距中心 19/22 两列长弓、27/30 两行护壁，全部面向盘顶机队。
  const FIGHT_LINE_Y = [19, 22]; // 长弓两列（北距）
  const FIGHT_LINE_X = 24; // 列半宽
  const FIGHT_LINE_SPACE = 2.4;
  const FIGHT_SHIELD_Y = [27, 30]; // 矛/盾两行
  const FIGHT_SHIELD_X = 30;
  const FIGHT_SHIELD_SPACE = 3.0;
  let fightSlotLongbow = 0;
  let fightSlotShield = 0;
  let fightFormed = false;

  function fightStationDir(slotIdx, role, out) {
    let y, x;
    if (role === "longbow") {
      const perCol = Math.floor((FIGHT_LINE_X * 2) / FIGHT_LINE_SPACE) + 1; // 21
      const col = Math.min(FIGHT_LINE_Y.length - 1, (slotIdx / perCol) | 0);
      const i = slotIdx % perCol;
      y = FIGHT_LINE_Y[col];
      x = -FIGHT_LINE_X + i * FIGHT_LINE_SPACE;
    } else {
      const perRow = Math.floor((FIGHT_SHIELD_X * 2) / FIGHT_SHIELD_SPACE) + 1; // 21
      const row = Math.min(FIGHT_SHIELD_Y.length - 1, (slotIdx / perRow) | 0);
      const i = slotIdx % perRow;
      y = FIGHT_SHIELD_Y[row];
      x = -FIGHT_SHIELD_X + i * FIGHT_SHIELD_SPACE;
    }
    const r = Math.sqrt(x * x + y * y);
    const d = r / PLANET_RADIUS;
    return out
      .copy(landDir)
      .multiplyScalar(Math.cos(d))
      .addScaledVector(east, (x / r) * Math.sin(d))
      .addScaledVector(ringNorth, (y / r) * Math.sin(d))
      .normalize();
  }

  function assignFightStation(s) {
    const role = s.userData.phalanxRole;
    const isBow = role === "longbow";
    const dir = fightStationDir(
      isBow ? fightSlotLongbow++ : fightSlotShield++,
      isBow ? "longbow" : "shield",
      new THREE.Vector3()
    );
    s.userData.fightPos = dir
      .clone()
      .multiplyScalar(PLANET_RADIUS + 0.08);
    s.userData.fightSlot = isBow ? fightSlotLongbow : fightSlotShield;
  }

  function resetFightFormation() {
    fightFormed = false;
    fightSlotLongbow = 0;
    fightSlotShield = 0;
  }

  function updateGarrison(dt, whaleUp) {
    for (const g of garrison) {
      const arrived = g.u >= 1;
      if (!arrived) g.u = Math.min(1, g.u + dt / 20);
      const e = g.u * g.u * (3 - 2 * g.u);
      for (const s of g.soldiers) {
        if (s.userData.ropeTeam) continue;
        if (arrived) {
          // 落位：鲸未升起 → 苔庭内分散巡查；鲸起 → 列阵/护壁
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

  // ---------- 绳索小队：告警后抛绳挂鲸身、拔河式拉回地面 ----------
  // 4 队（东/西/北/南）× 3 人：锚点在地面、绳头挂在鲸身中腰侧缘
  // （绳路避开鲸体，整段可见）；拉力汇入 root.userData.ropePull01 供苔庭鲸
  // 与机队吸取力做拉锯。
  const ROPE_TEAMS = 4;
  const ROPE_AXES = [1, -1, 1, -1]; // 东/西/北/南 符号
  const ROPE_HALF = [36, 36, 17.6, 17.6]; // 鲸身中腰半长/半宽（与 leviathanIsland 锁死几何一致）
  const ROPE_ANCHOR_DIST = [41, 41, 21.5, 21.5]; // 地面锚点距
  const ropeTeams = [];
  let ropesDispatched = false;
  const ropeMat = new THREE.MeshBasicMaterial({
    color: 0xc8a06a,
    side: THREE.DoubleSide,
  });
  const _ropeUp = new THREE.Vector3(0, 1, 0);
  const _ropeMid = new THREE.Vector3();
  const _ropeDir = new THREE.Vector3();
  const _ropeTgt = new THREE.Vector3();
  const _ropeTmpA = new THREE.Vector3();
  const _ropeTmpB = new THREE.Vector3();
  const _ropeTmpC = new THREE.Vector3();

  function ropeAxisDir(i, out) {
    if (i < 2) return out.copy(east).multiplyScalar(ROPE_AXES[i]);
    return out.copy(ringNorth).multiplyScalar(ROPE_AXES[i]);
  }

  function ensureRope(team) {
    if (team.rope) return team.rope;
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 5, 1, true),
      ropeMat
    );
    rope.name = "saihoji-rope";
    rope.visible = false;
    root.add(rope);
    team.rope = rope;
    return rope;
  }

  /** 绳头目标：鲸身中腰侧缘（随鲸升降） */
  function ropeTarget(i, out) {
    const lev = scene.getObjectByName("leviathanGroup");
    const anchorR = lev ? lev.position.length() : PLANET_RADIUS + 24;
    const alt = anchorR - 4.4; // 鲸体中腰高度
    ropeAxisDir(i, _ropeTmpA);
    return out
      .copy(landDir)
      .multiplyScalar(alt)
      .addScaledVector(_ropeTmpA, ROPE_HALF[i] + 1.5);
  }

  function setRopePose(team, vis) {
    const rope = ensureRope(team);
    const i = team.teamIdx;
    ropeTarget(i, _ropeTgt);
    rope.visible = vis;
    _ropeMid.copy(team.anchor).add(_ropeTgt).multiplyScalar(0.5);
    rope.position.copy(_ropeMid);
    _ropeDir.copy(_ropeTgt).sub(team.anchor);
    const len = Math.max(0.05, _ropeDir.length());
    _ropeDir.normalize();
    rope.quaternion.setFromUnitVectors(_ropeUp, _ropeDir);
    rope.scale.set(1, len, 1);
  }

  function detachRopes() {
    for (const team of ropeTeams) {
      if (team.rope?.parent) root.remove(team.rope);
      for (const s of team.soldiers) {
        s.userData.ropeTeam = undefined;
        s.userData.ropeLean = 0;
      }
    }
    ropeTeams.length = 0;
    ropesDispatched = false;
    root.userData.ropePull01 = 0;
  }

  function dispatchRopeTeams(allSoldiers) {
    if (ropesDispatched) return;
    ropesDispatched = true;
    // 优先矛兵（不射箭），其次剑盾，最后长弓
    const pool = allSoldiers.filter((s) => !s.userData.ropeTeam);
    const pick = (role) => {
      const i = pool.findIndex(
        (s) => s.userData.phalanxRole === role && !s.userData.ropeTeam
      );
      if (i < 0) return null;
      const s = pool[i];
      s.userData.ropeTeam = true;
      pool.splice(i, 1);
      return s;
    };
    for (let i = 0; i < ROPE_TEAMS; i++) {
      const aDir = ropeAxisDir(i, new THREE.Vector3());
      const d = ROPE_ANCHOR_DIST[i] / PLANET_RADIUS;
      const anchor = landDir
        .clone()
        .multiplyScalar(Math.cos(d))
        .addScaledVector(aDir, Math.sin(d))
        .normalize()
        .multiplyScalar(PLANET_RADIUS + 0.3);
      const team = {
        teamIdx: i,
        soldiers: [],
        anchor,
        state: "walk",
        t: 0,
        rope: null,
        pullT: 0,
      };
      for (let k = 0; k < 3; k++) {
        const s = pick("spear") || pick("gladius") || pick("longbow");
        if (!s) break;
        team.soldiers.push(s);
        s.userData.ropeOff = new THREE.Vector3((k - 1) * 1.1, 0, 0);
        s.userData.ropeStart = s.position.clone();
      }
      if (team.soldiers.length) ropeTeams.push(team);
    }
  }

  function updateRopeTeams(dt, t) {
    let pullSum = 0;
    for (const team of ropeTeams) {
      const lead = team.soldiers[0];
      if (!lead) continue;
      if (team.state === "walk") {
        // 全队跑向锚点（保持小横队）
        const dist = lead.position.distanceTo(team.anchor);
        team.t += dt / Math.max(3, dist * 0.3);
        const e = Math.min(1, team.t);
        const ee = e * e * (3 - 2 * e);
        for (const s of team.soldiers) {
          const off = s.userData.ropeOff;
          slerpDir(
            s.userData.ropeStart.clone().normalize(),
            team.anchor.clone().normalize(),
            ee,
            _tmp
          );
          _tmp.multiplyScalar(PLANET_RADIUS + groundLift(_tmp));
          s.position.copy(_tmp);
          surfaceBasis(_tmp.normalize(), team.anchor.clone().normalize(), _up, _fwd, _right);
          s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
          // 队内横排偏移（绕锚点切向）
          if (off) {
            _ropeTmpB.copy(_tmp).normalize();
            _ropeTmpC.crossVectors(_ropeTmpB, landDir).normalize();
            s.position.addScaledVector(_ropeTmpC, off.x);
          }
        }
        if (e >= 1) {
          team.state = "throw";
          team.t = 0;
        }
      } else if (team.state === "throw") {
        // 抛绳：0.9s 内绳从锚点伸到鲸身
        team.t += dt / 0.9;
        const e = Math.min(1, team.t);
        setRopePose(team, e > 0.15);
        if (e >= 1) {
          team.state = "pull";
          team.t = 0;
        }
      } else {
        // 拉拽：拉力爬升 + 士兵后仰（拔河）
        team.pullT = Math.min(1, team.pullT + dt / 3.5);
        setRopePose(team, true);
        const lean = 0.5 + Math.sin(t * 2.3 + team.teamIdx * 1.7) * 0.1;
        for (const s of team.soldiers) {
          s.userData.ropeLean = lean;
          // 面向鲸身
          surfaceBasis(s.position.clone().normalize(), landDir, _up, _fwd, _right);
          s.quaternion.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right));
        }
        pullSum += team.pullT;
      }
    }
    root.userData.ropePull01 = ropeTeams.length ? pullSum / ROPE_TEAMS : 0;
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
      // 残箭回收：撤阵时把扎在机队上的箭/枪取回
      for (const a of arrows) {
        if (a.parent && a.parent !== root) a.parent.remove(a);
        a.visible = false;
        a.userData.stuck = false;
      }
      for (const j of javelins) {
        if (j.parent && j.parent !== root) j.parent.remove(j);
        j.visible = false;
        j.userData.stuck = false;
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
      for (const s of w.soldiers) {
        if (s.userData.ropeTeam) continue;
        patrolSoldier(s, dt, whaleUp);
      }
    }

    // ---------- 告警 + 整队：鲸起瞬间响号角，全营奔向北翼列阵 ----------
    if (whaleUp && !wasWhaleUp) {
      cuePhalanxAlarmOnce();
    }
    if (whaleUp && !fightFormed) {
      fightFormed = true;
      fightSlotLongbow = 0;
      fightSlotShield = 0;
    }
    // 注：fightFormed/绳索小队在战斗期内保持（鲸被拽到半空不算落回，
    // 避免拔河拉锯时反复解散重排）；鲸落回地面后由 whaleReturned/reset 解散。
    wasWhaleUp = whaleUp;

    const squad = typeof getSquad === "function" ? getSquad() : null;
    const members = squad?.userData?.members || [];
    const live = members.filter((m) => m.parent);

    // ---------- 绳索小队：抛绳挂鲸、拔河拉回（告警后稍候出发） ----------
    if (whaleUp && !ropesDispatched && fightFormed) {
      const allS = [
        ...waves
          .filter((w) => w.state === "fight" || w.state === "ashore")
          .flatMap((w) => w.soldiers),
        ...garrison.flatMap((g) => g.soldiers),
      ];
      if (allS.length >= 4) dispatchRopeTeams(allS);
    }
    updateRopeTeams(dt, t);
    // 绳索士兵的后仰姿态（拔河）
    for (const team of ropeTeams) {
      for (const s of team.soldiers) {
        if (!s.userData.ropeLean) continue;
        s.rotateX(-s.userData.ropeLean);
      }
    }

    const shooters = [
      ...waves
        .filter((w) => w.state === "fight" || w.state === "ashore")
        .flatMap((w) => w.soldiers),
      ...garrison.flatMap((g) => g.soldiers),
    ];

    // ---------- aircraft 反击脉冲：光束闪爆推倒光束落点附近的士兵 ----------
    const gp = squad?.userData?.groundPulse;
    if (gp && whaleUp) {
      for (const s of shooters) {
        if (s.userData.ropeTeam) continue;
        s.getWorldPosition(_tmp);
        if (_tmp.distanceTo(gp.center) < gp.radius) {
          s.userData._stunT = 1.5;
          s.userData.patrol = null; // 打乱阵位，重新整队
          _tmpB.copy(_tmp).sub(gp.center).normalize().multiplyScalar(3.4);
          s.position.add(_tmpB);
          if (s.userData.bowCycle) s.userData.bowCycle.phase = "reach";
        }
      }
    }

    // ---------- 长弓手攒射：整理队伍后按列齐射，箭矢追射盘顶机队 ----------
    // 战斗期用 fightFormed 锁定（鲸被拽到半空也不停箭），直到鲸落回地面
    if ((whaleUp || fightFormed) && shooters.length && live.length) {
      for (const s of shooters) {
        if (s.userData.ropeTeam) continue;
        // 冲击眩晕：跳过射击
        if (s.userData._stunT > 0) {
          s.userData._stunT -= dt;
          continue;
        }
        s.getWorldPosition(_tmp);
        // 面向机队（盘顶悬停位）：完整三维瞄准——机队在空中，箭手必须仰射
        _fwd.copy(squad.userData?._patrolCenter || _tmp).sub(_tmp);
        if (_fwd.lengthSq() > 1e-4) {
          _fwd.normalize();
          // 右手 = fwd × 径向（侧向），再正交化出体轴（含仰角，不再投影成水平）
          _right.crossVectors(_fwd, _tmp.clone().normalize());
          if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0).addScaledVector(_fwd, -_fwd.x);
          _right.normalize();
          _up.crossVectors(_right, _fwd).normalize();
          s.quaternion.slerp(
            _q.setFromRotationMatrix(_basis.makeBasis(_fwd, _up, _right)),
            0.08
          );
        }
        // 长枪兵：投掷手中的长枪（抬手 → 掷出 → 收手，掷完冷却再掷）
        if (s.userData.phalanxRole === "spear") {
          const th = s.userData.throwState || (s.userData.throwState = { t: -4, phase: "rest" });
          const armR = s.userData.parts?.armR;
          if (th.phase === "rest") {
            th.t -= dt;
            if (th.t <= 0) {
              th.phase = "wind";
              th.t = 0;
            }
          } else if (th.phase === "wind") {
            th.t += dt / 0.5; // 0.5s 抬手
            const u = Math.min(1, th.t);
            if (armR) armR.rotation.z = 1.28 + (-0.9 - 1.28) * u;
            if (u >= 1) {
              const tgt = live[javelinI % live.length];
              throwJavelin(s, tgt);
              th.phase = "recover";
              th.t = 0;
              th.cd = 6.5 + Math.random() * 5; // 投枪沉重：下一轮间隔更长
            }
          } else {
            th.t += dt / 0.6; // 0.6s 收手
            if (armR) armR.rotation.z = THREE.MathUtils.lerp(-0.9, 1.28, Math.min(1, th.t));
            if (th.t >= 1) {
              th.phase = "rest";
              th.t = -th.cd;
            }
          }
          continue;
        }
        if (s.userData.phalanxRole !== "longbow") continue;
        // 撒放即射：短冷却每帧递减（脉冲同步后错峰），只挡下一次撒放
        const cd0 = s.userData._shotCd || 0;
        if (cd0 > 0) s.userData._shotCd = cd0 - dt;
        const released = updateLongbowShot(s, dt);
        root.userData._relCalls = (root.userData._relCalls || 0) + 1;
        if (released) {
          root.userData._relTrue = (root.userData._relTrue || 0) + 1;
          s.userData._relCount = (s.userData._relCount || 0) + 1;
        }
        if (!released) continue;
        if ((s.userData._shotCd || 0) > 0) continue;
        s.userData._shotCd = 0.8 + Math.random() * 0.8;
        // 目标轮转：五架轮流挨箭（全编队可见中箭）
        const tgt = live[arrowI % live.length];
        fireArrow(s, tgt);
      }
    }
    // 箭矢/投枪运动（飞行/命中/脱靶坠落/火花烟）始终推进，鲸落也不冻结
    updateArrows(dt);
    updateJavelins(dt);
    // 调试/验收：累计发射箭数
    root.userData.arrowsFired = arrowI;
  }

  // 苔庭鲸故事线通过 root.userData 与此方阵松耦合：
  // 读 assembled（是否整队）作升空循环条件；终扫收束后置 resetRequested 撤阵。
  // 苔庭鲸故事线松耦合契约：
  //  - 鲸读 root.userData.assembled（是否整队）作升空循环条件；
  //  - 鲸恢复原位后调 root.userData.whaleReturned()，士兵撤阵登船返回高山圣城。
  root.userData.whaleReturned = () => {
    detachRopes();
    resetFightFormation();
    rearmPhalanxAlarm();
    returnRequested = true;
  };
  root.userData.reset = () => {
    root.userData.resetRequested = true;
  };
  return { root, update, isAssembled, reset: resetBattle };
}
