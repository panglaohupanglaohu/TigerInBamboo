// =====================================================================
//  航空艇搭乘与驾驶：垂绳 [F] 攀爬登艇 · WASD 驾驶 · Space/Shift 升降
//  模式参考 tramRide：接管期间 update 返回 true，主循环跳过移动与碰撞。
//
//  约定（createMoebiusAirship）：
//    - 气囊艇首 = 局部 +Z；局部 +Y = 星球法线
//    - userData.rope：登机垂绳（几何原点 = 绳尾末端）
//    - userData.flying / userData.flown：驾驶接管 / 已飞行标记
// =====================================================================
import * as THREE from "three";
import { quatYToDir } from "../world/sphereMath.js";
import { canyonOffsetDir } from "../world/canyon.js";

const BOARD_RANGE = 5.0;   // 绳尾感应半径（可跳起抓绳）
const CLIMB_TIME = 1.7;    // 攀爬动画时长
const FLY_DIST = 16;       // 驾驶时相机拉远
const SPEED = 9.0;         // 前后推进速度
const TURN_SPEED = 1.5;    // 转向角速度 rad/s
const VERT_SPEED = 8.0;    // 升降速度
// 水晶城晶皇塔尖高逾谷内 50+；升限必须越过塔顶才能真正"飞过"水晶城
const HOVER_MAX = 90;
// hover 允许为负：峡谷最大塌陷 15，最低可降到「当地地表」+ GROUND_CLEAR。
// 每帧按飞艇所在方向的峡谷沉降量动态钳制（谷外地表 = 基础半径，不会穿地）。
const GROUND_CLEAR = 2.0; // 距当地地表的最小净空
const HOVER_FLOOR = -15 + GROUND_CLEAR; // 绝对下限（谷心地表 -15）

const FWD_LOCAL = new THREE.Vector3(0, 0, 1); // 艇首方向

const _up = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _f0 = new THREE.Vector3();
const _seat = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _q0 = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);

// ---------- [G] 投掷烟雾弹 ----------
const BOMB_SPEED = 26; // 抛射初速
const BOMB_GRAVITY = 22; // 朝球心的重力加速度
const BOMB_COOLDOWN = 0.55; // 投掷冷却
const BOMB_HIT_MARGIN = 0.7; // 距地表判定冗余
const SMOKE_PUFFS = 16; // 每枚烟雾弹的浓烟团数量
const SMOKE_LIFE_MIN = 4.5; // 烟雾最短寿命
const SMOKE_LIFE_MAX = 7.5; // 烟雾最长寿命

const _bombVel = new THREE.Vector3();
const _bombUp = new THREE.Vector3();

/** 一枚飞行中的烟雾弹（抛物线，命中地表引爆） */
function SmokeBomb(scene, pos, vel) {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial({ color: 0x2b2b2b, flatShading: true, roughness: 1 })
  );
  mesh.position.copy(pos);
  if (scene) scene.add(mesh);
  return { mesh, vel: vel.clone(), dead: false };
}

/** 烟雾弹触地 → 生成浓密烟雾团（纯视觉，不破坏周边） */
function spawnSmoke(scene, pos, up) {
  const group = new THREE.Group();
  group.position.copy(pos);
  const puffs = [];
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const r = 0.9 + Math.random() * 1.1;
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.55 + Math.random() * 0.25, 0.55 + Math.random() * 0.25, 0.58 + Math.random() * 0.22),
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
      })
    );
    // 落点法线方向上方半球内随机散布
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.4 + 0.3,
      (Math.random() - 0.5) * 2
    ).normalize();
    m.position.copy(dir).multiplyScalar(0.4 + Math.random() * 1.6);
    m.userData = {
      vel: dir.clone().multiplyScalar(1.2 + Math.random() * 1.8), // 上升 + 扩散
      life: SMOKE_LIFE_MIN + Math.random() * (SMOKE_LIFE_MAX - SMOKE_LIFE_MIN),
      age: 0,
      grow: 2.4 + Math.random() * 2.6, // 最终膨胀倍数
      maxOpacity: 0.62 + Math.random() * 0.22,
    };
    group.add(m);
    puffs.push(m);
  }
  // 淡红烟雾核心：中心一团极淡暖色烟，与灰白浓烟融为一体（非爆炸火光）
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.0, 1),
    new THREE.MeshBasicMaterial({
      color: 0xd98a6a,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
  );
  core.position.set(0, 0.6, 0);
  core.userData = {
    vel: new THREE.Vector3(0, 1.2, 0),
    life: SMOKE_LIFE_MIN + Math.random() * (SMOKE_LIFE_MAX - SMOKE_LIFE_MIN),
    age: 0,
    grow: 2.4,
    maxOpacity: 0.28,
    isCore: true,
  };
  group.add(core);
  puffs.push(core);
  if (scene) scene.add(group);
  return { group, puffs, dead: false };
}

function updateSmoke(smoke, dt, up) {
  let alive = false;
  for (const m of smoke.puffs) {
    const u = m.userData;
    if (u.age >= u.life) {
      m.material.opacity = 0;
      continue;
    }
    u.age += dt;
    const k = u.age / u.life; // 0→1
    m.position.addScaledVector(u.vel, dt);
    const s = 1 + (u.grow - 1) * Math.min(1, k * 1.6);
    m.scale.setScalar(s);
    let fade;
    // 淡红核心与灰白烟统一淡入淡出，融入整体浓烟
    fade = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
    m.material.opacity = u.maxOpacity * Math.max(0, fade);
    alive = true;
  }
  if (!alive) {
    smoke.dead = true;
    if (smoke.group.parent) smoke.group.parent.remove(smoke.group);
    smoke.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}

/**
 * @param {object} deps
 * @param {object} deps.player
 * @param {() => import("three").Object3D|null} deps.getAirship
 * @param {object} deps.cameraRig
 * @param {object} deps.keys createInput 返回的按键表（e.code 键名）
 * @param {number} deps.planetRadius
 * @param {import("three").Scene} deps.scene 烟雾弹/烟雾挂载场景
 * @param {HTMLElement|null} deps.elHint
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 */
export function createAirshipRide({
  player,
  getAirship,
  cameraRig,
  keys,
  planetRadius,
  scene,
  elHint,
  toast = () => {},
}) {
  /** @type {'idle'|'climbing'|'flying'} */
  let state = "idle";
  let climbT = 0;
  let prevDist = 0;
  let yaw = 0;      // 绕局部 +Y（星球法线）的驾驶偏航
  let hover = 20;   // 当前悬浮高度
  let bombCd = 0;   // 投掷冷却计时
  const bombs = []; // 飞行中的烟雾弹
  const smokes = []; // 已引爆的烟雾团
  const _dir = new THREE.Vector3();
  const climbFrom = new THREE.Vector3();

  function airship() {
    return getAirship ? getAirship() : null;
  }

  /** 绳尾末端世界位置 */
  function ropeBottom(out) {
    const a = airship();
    const rope = a?.userData?.rope;
    if (!rope) return null;
    rope.getWorldPosition(out);
    return out;
  }

  /** 吊舱甲板座位世界位置（站在舱顶栏杆上） */
  function deckSeat(out) {
    const a = airship();
    const gondola = a?.userData?.parts?.gondolaMesh;
    if (!gondola) return null;
    gondola.getWorldPosition(out);
    _up.copy(a.position).normalize();
    out.addScaledVector(_up, 0.55);
    return out;
  }

  function nearRope() {
    const rb = ropeBottom(_tmp);
    if (!rb) return false;
    return player.position.distanceTo(rb) <= BOARD_RANGE;
  }

  /** 由当前姿态反推驾驶偏航角，保证接管瞬间不跳变 */
  function captureYaw(a) {
    _up.copy(a.position).normalize();
    quatYToDir(_up, _q0);
    _f0.copy(FWD_LOCAL).applyQuaternion(_q0);
    _f0.addScaledVector(_up, -_f0.dot(_up));
    _fwd.copy(FWD_LOCAL).applyQuaternion(a.quaternion);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
    if (_f0.lengthSq() < 1e-6 || _fwd.lengthSq() < 1e-6) return 0;
    _f0.normalize();
    _fwd.normalize();
    _tmp.crossVectors(_f0, _fwd);
    return Math.atan2(_tmp.dot(_up), _f0.dot(_fwd));
  }

  function setHint(html) {
    if (!elHint) return;
    if (html) {
      elHint.innerHTML = html;
      elHint.classList.add("show");
    } else {
      elHint.classList.remove("show");
    }
  }

  function dismount() {
    const a = airship();
    state = "idle";
    player.riding = false;
    if (a) {
      a.userData.flying = false;
      // 从绳尾滑落：站在绳尾末端，交还重力（自由落体回地面）
      const rb = ropeBottom(_tmp);
      if (rb) {
        player.position.copy(rb).addScaledVector(_up, 0.2);
      }
    }
    player.velocity.set(0, 0, 0);
    if (cameraRig?.setDist && prevDist) cameraRig.setDist(prevDist);
    setHint(null);
    toast("已滑下航空艇 · 抓稳绳子，落地小心！", 2.6);
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyF") return;
    if (state === "idle") {
      const a = airship();
      if (!a || !nearRope()) return;
      e.preventDefault();
      state = "climbing";
      climbT = 0;
      climbFrom.copy(player.position);
      player.riding = true;
      player.velocity.set(0, 0, 0);
      prevDist = cameraRig?.getDist ? cameraRig.getDist() : 0;
      if (cameraRig?.setDist) cameraRig.setDist(FLY_DIST);
      toast("抓住垂绳，登上航空艇…", 1.8);
    } else if (state === "flying") {
      e.preventDefault();
      dismount();
    }
  });

  // [G] 投掷烟雾弹（仅驾驶中）：沿艇首抛射，触地炸出浓密烟雾，不破坏周边
  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyG") return;
    if (state !== "flying") return;
    if (bombCd > 0) return;
    const a = airship();
    if (!a) return;
    e.preventDefault();
    bombCd = BOMB_COOLDOWN;
    _bombUp.copy(a.position).normalize();
    // 投掷目标：绳尾末端附近（绳索垂在艇首，落点应贴近绳索）
    const rb = ropeBottom(_tmp);
    if (rb) {
      // 起点：绳尾下方一点，初速近似竖直向下 + 随艇微前冲，落点贴近绳索
      _pos.copy(rb).addScaledVector(_bombUp, -0.6);
      _bombVel.copy(_bombUp).multiplyScalar(-BOMB_SPEED * 0.55);
    } else {
      // 无绳索时兜底：艇首下方竖直投下
      _fwd.copy(FWD_LOCAL).applyQuaternion(a.quaternion);
      _fwd.addScaledVector(_bombUp, -_fwd.dot(_bombUp));
      if (_fwd.lengthSq() > 1e-6) _fwd.normalize(); else _fwd.set(0, 0, 1);
      _pos.copy(a.position).addScaledVector(_fwd, 1.0).addScaledVector(_bombUp, -2.0);
      _bombVel.copy(_bombUp).multiplyScalar(-BOMB_SPEED * 0.55);
    }
    bombs.push(SmokeBomb(scene, _pos.clone(), _bombVel));
    toast("投掷烟雾弹！", 1.2);
  });

  /**
   * 每帧调用。
   * @returns {boolean} 是否接管玩家控制
   */
  function update(dt) {
    const a = airship();

    // ---------- 推进烟雾弹飞行 / 烟雾散去（任何状态下都更新） ----------
    if (bombCd > 0) bombCd = Math.max(0, bombCd - dt);
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      // 朝球心重力
      _bombUp.copy(b.mesh.position).normalize();
      b.vel.addScaledVector(_bombUp, -BOMB_GRAVITY * dt);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += dt * 6;
      b.mesh.rotation.y += dt * 4;
      // 触地（含冗余）→ 引爆为烟雾（谷内按当地地表高度判定）
      _bombUp.copy(b.mesh.position).normalize();
      if (b.mesh.position.length() <= planetRadius + canyonOffsetDir(_bombUp) + BOMB_HIT_MARGIN) {
        smokes.push(spawnSmoke(scene, b.mesh.position.clone(), _bombUp));
        if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        bombs.splice(i, 1);
      }
    }
    for (let i = smokes.length - 1; i >= 0; i--) {
      updateSmoke(smokes[i], dt, _up);
      if (smokes[i].dead) smokes.splice(i, 1);
    }

    /* ---------- idle：绳尾感应提示 ---------- */
    if (state === "idle") {
      if (elHint) {
        const show = !!a && nearRope();
        elHint.classList.toggle("show", show);
        if (show) {
          elHint.innerHTML =
            "[<kbd>F</kbd>] 抓住垂绳 · 攀爬登上航空艇";
        }
      }
      return false;
    }

    if (!a) {
      state = "idle";
      player.riding = false;
      setHint(null);
      return false;
    }

    _up.copy(a.position).normalize();

    /* ---------- climbing：沿绳攀爬动画 ---------- */
    if (state === "climbing") {
      setHint(null);
      climbT += dt;
      const u = Math.min(1, climbT / CLIMB_TIME);
      const ease = u * u * (3 - 2 * u); // smoothstep
      const seat = deckSeat(_seat);
      if (!seat) {
        state = "idle";
        player.riding = false;
        return false;
      }
      player.position.lerpVectors(climbFrom, seat, ease);
      player.velocity.set(0, 0, 0);
      // 面朝艇身
      _fwd.copy(a.position).sub(player.position);
      _fwd.addScaledVector(_up, -_fwd.dot(_up));
      if (_fwd.lengthSq() > 1e-6) {
        _fwd.normalize();
        player.forward.copy(_fwd);
        player.facing.copy(_fwd);
      }
      if (climbT >= CLIMB_TIME) {
        state = "flying";
        _dir.copy(a.position).normalize();
        hover = a.userData.hover ?? 20;
        yaw = captureYaw(a);
        a.userData.flying = true;
        a.userData.flown = true; // 飞过后不再自动回锚湖沼上空
        setHint(
          "[<kbd>W</kbd>][<kbd>S</kbd>] 前进/后退 · [<kbd>A</kbd>][<kbd>D</kbd>] 转向 · " +
            "[<kbd>Space</kbd>/<kbd>Shift</kbd>] 升降 · [<kbd>F</kbd>] 下艇"
        );
        toast("已登上航空艇 · WASD 驾驶 · F 下艇", 3.2);
      }
      return true;
    }

    /* ---------- flying：WASD 驾驶 ---------- */
    a.userData.flying = true;
    player.riding = true;
    player.velocity.set(0, 0, 0);

    // 转向（A 左转 / D 右转，绕星球法线）
    const turn = (keys?.KeyA ? 1 : 0) - (keys?.KeyD ? 1 : 0);
    yaw += turn * TURN_SPEED * dt;
    // 升降（Space 升 / Shift 降）
    const vert =
      (keys?.Space ? 1 : 0) -
      ((keys?.ShiftLeft || keys?.ShiftRight) ? 1 : 0);
    // 当地地表高度 = 基础半径 + 峡谷沉降量（谷外为 0）→ hover 下限随地形下沉
    const groundDrop = canyonOffsetDir(_dir);
    const hoverMin = Math.max(HOVER_FLOOR, groundDrop + GROUND_CLEAR);
    hover = THREE.MathUtils.clamp(hover + vert * VERT_SPEED * dt, hoverMin, HOVER_MAX);
    a.userData.hover = hover;

    // 推进（W 前进 / S 后退）：沿艇首切向移动后重新投影回球面
    const thrust = (keys?.KeyW ? 1 : 0) - (keys?.KeyS ? 1 : 0);

    // 姿态：+Y 对齐法线 + 驾驶偏航
    quatYToDir(_dir, _q0);
    _qYaw.setFromAxisAngle(_yAxis, yaw);
    a.quaternion.copy(_q0).multiply(_qYaw);

    // 艇首世界方向（切平面内）
    _fwd.copy(FWD_LOCAL).applyQuaternion(a.quaternion);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
    if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
    else _fwd.set(0, 0, 1);

    if (thrust !== 0) {
      _pos.copy(_dir).multiplyScalar(planetRadius + hover);
      _pos.addScaledVector(_fwd, thrust * SPEED * dt);
      _dir.copy(_pos).normalize();
      // 偏航角随球面平行移动做微小补偿（防经线汇聚漂移）
      a.position.copy(_dir).multiplyScalar(planetRadius + hover);
      quatYToDir(_dir, _q0);
      _qYaw.setFromAxisAngle(_yAxis, yaw);
      a.quaternion.copy(_q0).multiply(_qYaw);
    } else {
      a.position.copy(_dir).multiplyScalar(planetRadius + hover);
    }

    // 玩家站在舱顶甲板上，面朝艇首
    const seat = deckSeat(_seat);
    if (seat) player.position.copy(seat);
    player.forward.copy(_fwd);
    player.facing.copy(_fwd);

    return true;
  }

  function forceExit() {
    if (state === "idle") return;
    const a = airship();
    state = "idle";
    player.riding = false;
    if (a) {
      a.userData.flying = false;
      a.userData.ropeState = "idle";
    }
    setHint(null);
  }

  return {
    update,
    forceExit,
    isFlying: () => state === "flying",
    getState: () => state,
  };
}
