// =====================================================================
//  航空艇搭乘与驾驶：垂绳 [F] 攀爬登艇 · WASD 驾驶 · Space 升 / Ctrl 降
//  [C] 驾驶员第一人称（隐藏艇体，眼前无自身遮挡）/ 舱外跟拍
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
import { groundLiftAt } from "../world/hills.js";

const BOARD_RANGE = 5.0;   // 绳尾感应半径（可跳起抓绳）
const CLIMB_TIME = 1.7;    // 攀爬动画时长
const FLY_DIST = 16;       // 乘客第三人称：舱外跟拍
const PILOT_DIST = 0.12;   // 驾驶员第一人称：贴眼，几乎无身后拉距
const PILOT_FOV = 82;      // 驾驶员广角，开阔远景
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
/** 驾驶员眼位：吊舱前端内侧，面朝艇首 +Z（相对飞艇原点=气囊中心） */
const PILOT_SEAT_LOCAL = new THREE.Vector3(0, -3.32, 1.72);

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
  getObstacle = null, // () => ({ dir, topRadial, angularRadius }) 建筑净空区（圣城）
  playerGroup = null, // 驾驶员视角时隐藏角色模型，避免挡视野
}) {
  /** @type {'idle'|'climbing'|'flying'} */
  let state = "idle";
  /** @type {'passenger'|'pilot'} 舱外跟拍 / 驾驶员第一人称 */
  let viewMode = "passenger";
  let climbT = 0;
  let prevDist = 0;
  let prevFov = 60;
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

  function refreshFlyHint() {
    if (state !== "flying") return;
    if (viewMode === "pilot") {
      setHint(
        "[<kbd>C</kbd>] 舱外视角 · [<kbd>W</kbd>][<kbd>S</kbd>] 进退 · [<kbd>A</kbd>][<kbd>D</kbd>] 转向 · " +
          "[<kbd>Space</kbd>/<kbd>Ctrl</kbd>] 升/降 · [<kbd>F</kbd>] 下艇"
      );
    } else {
      setHint(
        "[<kbd>C</kbd>] 驾驶员视角 · [<kbd>W</kbd>][<kbd>S</kbd>] 进退 · [<kbd>A</kbd>][<kbd>D</kbd>] 转向 · " +
          "[<kbd>Space</kbd>/<kbd>Ctrl</kbd>] 升/降 · [<kbd>F</kbd>] 下艇"
      );
    }
  }

  /** 驾驶员视角：隐藏飞艇与角色自身，避免气囊/吊舱挡在眼前 */
  function applyViewVisibility() {
    const a = airship();
    if (viewMode === "pilot" && state === "flying") {
      if (a) a.visible = false;
      if (playerGroup) playerGroup.visible = false;
    } else {
      if (a) a.visible = true;
      if (playerGroup) playerGroup.visible = true;
    }
  }

  function applyCameraForView() {
    if (viewMode === "pilot") {
      // 第一人称：贴眼、沿艇首向前看（不走身后高位俯视，避免看向地面）
      cameraRig?.setFirstPerson?.(true);
      cameraRig?.setFov?.(PILOT_FOV);
    } else {
      cameraRig?.setFirstPerson?.(false);
      cameraRig?.setDist?.(FLY_DIST);
      cameraRig?.setFov?.(prevFov);
    }
    applyViewVisibility();
  }

  function setViewMode(mode) {
    if (mode !== "passenger" && mode !== "pilot") return;
    if (viewMode === mode) return;
    viewMode = mode;
    applyCameraForView();
    refreshFlyHint();
    if (mode === "pilot") {
      toast("驾驶员视角 · 眼前无艇体遮挡 · 再按 C 回到舱外", 2.6);
    } else {
      toast("舱外跟拍 · 再按 C 切换驾驶员视角", 2.2);
    }
  }

  function pilotSeat(out) {
    const a = airship();
    if (!a) return null;
    out.copy(PILOT_SEAT_LOCAL).applyQuaternion(a.quaternion).add(a.position);
    return out;
  }

  function dismount() {
    const a = airship();
    state = "idle";
    viewMode = "passenger";
    player.riding = false;
    if (a) {
      a.userData.flying = false;
      a.visible = true;
      // 从绳尾滑落：站在绳尾末端，交还重力（自由落体回地面）
      const rb = ropeBottom(_tmp);
      if (rb) {
        player.position.copy(rb).addScaledVector(_up, 0.2);
      }
    }
    if (playerGroup) playerGroup.visible = true;
    player.velocity.set(0, 0, 0);
    cameraRig?.setFirstPerson?.(false);
    if (cameraRig?.setDist && prevDist) cameraRig.setDist(prevDist);
    cameraRig?.setFov?.(prevFov);
    setHint(null);
    toast("已滑下航空艇 · 抓稳绳子，落地小心！", 2.6);
  }

  /** 飞艇方向正下方的地形抬升（岛内丘高，岛外 0）——球面方向 → 平面 (x,z) 反解 */
  function terrainLiftUnder(dir) {
    const lat = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    const flatDist = (Math.PI / 2 - lat) * planetRadius;
    if (flatDist < 1e-6) return groundLiftAt(0, 0);
    const lon = Math.atan2(dir.z, dir.x);
    return groundLiftAt(Math.cos(lon) * flatDist, Math.sin(lon) * flatDist);
  }

  /** 期望艇首指向 target 的驾驶偏航角（与 captureYaw 同一套基准） */
  function yawToFace(pos, target) {
    _up.copy(_dir);
    quatYToDir(_dir, _q0);
    _f0.copy(FWD_LOCAL).applyQuaternion(_q0);
    _f0.addScaledVector(_up, -_f0.dot(_up)).normalize();
    _fwd.copy(target).sub(pos);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
    if (_fwd.lengthSq() < 1e-6) return yaw;
    _fwd.normalize();
    _tmp.crossVectors(_f0, _fwd);
    return Math.atan2(_tmp.dot(_up), _f0.dot(_fwd));
  }

  /**
   * 视角控制（面板「居中/环视/到顶」）：飞行中把飞艇摆到指定方向与高度，
   * 艇首转向 lookTarget。返回是否成功（仅 flying 状态可用）。
   */
  function setPose(dir, hoverAlt, lookTarget) {
    if (state !== "flying") return false;
    const a = airship();
    if (!a) return false;
    _dir.copy(dir).normalize();
    hover = THREE.MathUtils.clamp(hoverAlt, HOVER_FLOOR, HOVER_MAX);
    a.position.copy(_dir).multiplyScalar(planetRadius + hover);
    if (lookTarget) yaw = yawToFace(a.position, lookTarget);
    quatYToDir(_dir, _q0);
    _qYaw.setFromAxisAngle(_yAxis, yaw);
    a.quaternion.copy(_q0).multiply(_qYaw);
    return true;
  }

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    // C：飞行中切换驾驶员 / 舱外视角
    if (e.code === "KeyC") {
      if (state !== "flying") return;
      e.preventDefault();
      setViewMode(viewMode === "pilot" ? "passenger" : "pilot");
      return;
    }

    if (e.code !== "KeyF") return;
    if (state === "idle") {
      const a = airship();
      if (!a || !nearRope()) return;
      e.preventDefault();
      state = "climbing";
      climbT = 0;
      climbFrom.copy(player.position);
      player.riding = true;
      player.velocity.set(0, 0, 0);
      viewMode = "passenger";
      prevDist = cameraRig?.getDist ? cameraRig.getDist() : 0;
      prevFov = cameraRig?.getFov?.() ?? cameraRig?.getDefaultFov?.() ?? 60;
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
        viewMode = "passenger";
        _dir.copy(a.position).normalize();
        hover = a.userData.hover ?? 20;
        yaw = captureYaw(a);
        a.userData.flying = true;
        a.userData.flown = true; // 飞过后不再自动回锚湖沼上空
        applyCameraForView();
        refreshFlyHint();
        toast("已登上航空艇 · WASD 驾驶 · C 驾驶员视角 · F 下艇", 3.4);
      }
      return true;
    }

    /* ---------- flying：WASD 驾驶 ---------- */
    a.userData.flying = true;
    player.riding = true;
    player.velocity.set(0, 0, 0);
    refreshFlyHint();

    // 转向（A 左转 / D 右转，绕星球法线）
    const turn = (keys?.KeyA ? 1 : 0) - (keys?.KeyD ? 1 : 0);
    yaw += turn * TURN_SPEED * dt;
    // 升降（Space 升 / Ctrl 降；不用 Shift，避免和系统截图 Cmd+Shift+4 冲突）
    const vert =
      (keys?.Space ? 1 : 0) -
      ((keys?.ControlLeft || keys?.ControlRight) ? 1 : 0);
    // 当地地表高度 = 基础半径 + 峡谷沉降量（谷外为 0）→ hover 下限随地形下沉
    const groundDrop = canyonOffsetDir(_dir);
    let hoverMin = Math.max(HOVER_FLOOR, groundDrop + GROUND_CLEAR);
    // 地形跟随：山体抬升处自动抬高下限，飞越山脊不再穿坡
    const lift = terrainLiftUnder(_dir);
    if (lift > 0) hoverMin = Math.max(hoverMin, lift + GROUND_CLEAR);
    // 注：圣城上空不再强制抬升到建筑顶端之上——由玩家用 Space/Ctrl 自行控制升降。
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

    // 乘客：舱顶甲板；驾驶员：吊舱前端，面朝艇首水平向前
    if (viewMode === "pilot") {
      const seat = pilotSeat(_seat);
      if (seat) player.position.copy(seat);
      // 严格水平朝向艇首（切平面内），相机据此向前看，不朝地面
      player.forward.copy(_fwd);
      player.facing.copy(_fwd);
      applyViewVisibility();
    } else {
      const seat = deckSeat(_seat);
      if (seat) player.position.copy(seat);
      player.forward.copy(_fwd);
      player.facing.copy(_fwd);
      applyViewVisibility();
    }

    return true;
  }

  function forceExit() {
    if (state === "idle") return;
    const a = airship();
    state = "idle";
    viewMode = "passenger";
    player.riding = false;
    if (a) {
      a.userData.flying = false;
      a.userData.ropeState = "idle";
      a.visible = true;
    }
    if (playerGroup) playerGroup.visible = true;
    cameraRig?.setFirstPerson?.(false);
    if (cameraRig?.setDist && prevDist) cameraRig.setDist(prevDist);
    cameraRig?.setFov?.(prevFov);
    setHint(null);
  }

  /**
   * [Q] 召唤飞艇：飞艇降临到玩家**面朝方向前方 ~10 单位、低空**——
   * 绳尾恰好触地，玩家平视即可看见、走到绳下按 [F] 抓绳。
   * （旧版放头顶 hover=20 高空：绳尾离地 7.1 米够不着，且飞出视锥外，
   *   体感像"召唤无效"。）
   * 仅 idle 状态可用（飞行中/攀爬中不可召唤）。召唤后标记 flown，防止回锚。
   */
  function summon() {
    if (state !== "idle") return false;
    const a = airship();
    if (!a) return false;
    // 玩家面朝方向（切平面投影）
    _up.copy(player.position).normalize();
    _fwd.copy(player.forward);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    _fwd.normalize();
    // 锚点 = 玩家球面位置沿面朝方向前移 10 单位（球面小范围弦≈弧）
    _dir.copy(player.position).addScaledVector(_fwd, 10).normalize();
    // 低空：绳尾在艇心下 12.9（吊舱 -3.5 + 绳挂点 -0.4 + 绳长 9），
    // hover 13.2 → 绳尾离地 0.3，玩家头部 dy≈1.3 落入抓绳判定窗。
    hover = 13.2;
    // 艇首朝玩家（玩家看到艇首正面与右前侧的登艇绳）
    _fwd.negate();
    // 反推偏航角：基准前向（局部+Z 经 quatYToDir）与期望前向的夹角
    quatYToDir(_dir, _q0);
    _f0.copy(FWD_LOCAL).applyQuaternion(_q0);
    _f0.addScaledVector(_up, -_f0.dot(_up)).normalize();
    _tmp.crossVectors(_f0, _fwd);
    yaw = Math.atan2(_tmp.dot(_up), _f0.dot(_fwd));
    // 定位飞艇
    a.position.copy(_dir).multiplyScalar(planetRadius + hover);
    a.quaternion.copy(_q0).multiply(_qYaw.setFromAxisAngle(_yAxis, yaw));
    a.userData.anchorDir = _dir.clone();
    a.userData.hover = hover;
    a.userData.yaw = yaw;
    // 标记已飞行：防止 messengerIsland 回锚逻辑把飞艇拉回湖沼
    a.userData.flown = true;
    return true;
  }

  return {
    update,
    forceExit,
    setPose,
    summon,
    isFlying: () => state === "flying",
    isPilotView: () => viewMode === "pilot" && state === "flying",
    getState: () => state,
  };
}
