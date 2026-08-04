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

const BOARD_RANGE = 5.0;   // 绳尾感应半径（可跳起抓绳）
const CLIMB_TIME = 1.7;    // 攀爬动画时长
const FLY_DIST = 16;       // 驾驶时相机拉远
const SPEED = 9.0;         // 前后推进速度
const TURN_SPEED = 1.5;    // 转向角速度 rad/s
const VERT_SPEED = 8.0;    // 升降速度
const HOVER_MIN = 8;
// 水晶城晶皇塔尖约在半径 121（峡谷台阶根基 33.6 + 塔高 87.2）；
// 升限必须越过塔顶才能真正"飞过"水晶城 → R+90 = 130
const HOVER_MAX = 90;

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

/**
 * @param {object} deps
 * @param {object} deps.player
 * @param {() => import("three").Object3D|null} deps.getAirship
 * @param {object} deps.cameraRig
 * @param {object} deps.keys createInput 返回的按键表（e.code 键名）
 * @param {number} deps.planetRadius
 * @param {HTMLElement|null} deps.elHint
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 */
export function createAirshipRide({
  player,
  getAirship,
  cameraRig,
  keys,
  planetRadius,
  elHint,
  toast = () => {},
}) {
  /** @type {'idle'|'climbing'|'flying'} */
  let state = "idle";
  let climbT = 0;
  let prevDist = 0;
  let yaw = 0;      // 绕局部 +Y（星球法线）的驾驶偏航
  let hover = 20;   // 当前悬浮高度
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

  /**
   * 每帧调用。
   * @returns {boolean} 是否接管玩家控制
   */
  function update(dt) {
    const a = airship();

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
    hover = THREE.MathUtils.clamp(hover + vert * VERT_SPEED * dt, HOVER_MIN, HOVER_MAX);
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

  return {
    update,
    isFlying: () => state === "flying",
    getState: () => state,
  };
}
