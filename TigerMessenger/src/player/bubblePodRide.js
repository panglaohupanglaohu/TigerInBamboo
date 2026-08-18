// =====================================================================
//  气泡艇搭乘 · 十字准星瞄准 · [G] 发射麻醉弹 · 海水湖潜行
//  - 靠近气泡艇 [F] 登艇 / 下艇
//  - WASD 驾驶 · Space 上浮 · Shift/C 潜行（水晶城海水湖内可下潜）
//  - 鼠标 / 游戏手柄右摇杆 / 触控环视 → 十字光标瞄准
//  - [G] 或手柄 RT → 发射麻醉弹（飞鸟坠落 · 飞行器 20 发坠地 · 士兵卧倒）
// =====================================================================
import * as THREE from "three";
import {
  createBubbleShot,
  updateBubbleShot,
  stickBubbleShot,
  findNearestBubblePod,
} from "../assets/bubblePod.js";
import { sedateWarshipCrewNearest } from "../assets/harbor.js";
import { quatYToDir } from "../world/sphereMath.js";
import {
  sedateObject,
  applyAircraftTranqHit,
  isAircraftKnocked,
  TRANQ_DURATION,
  TRANQ_DURATION_BIRD,
  TRANQ_HIT_R_BIRD,
  TRANQ_HIT_R_SOLDIER,
  TRANQ_HIT_R_AIRCRAFT,
  TRANQ_HITS_AIRCRAFT,
} from "../world/tranquilizer.js";
import { setBubblePodCannonBgm } from "../audio/sfx.js";

const BOARD_RANGE = 5.2;
const FIRE_COOLDOWN = 0.09;
const AIM_MOUSE_SENS = 0.00165;
const AIM_STICK_SPEED = 1.85;
const AIM_LIMIT = 0.82;
const DEADZONE = 0.14;

const FLY_SPEED = 11;
const FLY_SPEED_DIVE = 7.5;
const VERT_SPEED = 6.5;
const TURN_SPEED = 1.65;
/** 空中最低离地高度（非湖内） */
const AIR_MIN_HOVER = 2.2;
/** 空中最高高度 */
const AIR_MAX_HOVER = 55;

const _muzzle = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _q0 = new THREE.Quaternion();
const _qYaw = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();

/**
 * @param {object} deps
 * @param {THREE.PerspectiveCamera} deps.camera
 * @param {object} deps.cameraRig
 * @param {object} deps.player
 * @param {THREE.Object3D} [deps.playerGroup]
 * @param {() => THREE.Object3D|null} deps.getFleet
 * @param {() => object|null} [deps.getSeaLake] 水晶城海水湖（含 containsWorldPos / maxDive）
 * @param {THREE.Scene} deps.scene
 * @param {number} deps.planetRadius
 * @param {Record<string, boolean>} [deps.keys]
 * @param {HTMLElement|null} [deps.elHint]
 * @param {HTMLElement|null} [deps.elCrosshair]
 * @param {HTMLElement|null} [deps.elDiveTint] 潜行青蓝滤镜
 * @param {(msg: string, dur?: number) => void} [deps.toast]
 * @param {() => void} [deps.exitOtherRides]
 */
export function createBubblePodRide({
  camera,
  cameraRig,
  player,
  playerGroup = null,
  getFleet,
  getSeaLake = () => null,
  scene,
  planetRadius,
  keys = null,
  elHint = null,
  elCrosshair = null,
  elDiveTint = null,
  toast = () => {},
  exitOtherRides = () => {},
  /** @type {() => object|null} 场景 landmarks，供麻醉弹索敌 */
  getLandmarks = () => null,
}) {
  const _hitPos = new THREE.Vector3();
  let riding = false;
  let pod = null;
  let fireCd = 0;
  let prevCamDist = 0;
  let yaw = 0;
  let hover = 8; // 相对当地地表的高度（或潜深时为 surfaceR 之下）
  let submerged = false;
  let wasSubmerged = false;
  let thirdPerson = false; // C 键切换第一/第三视角
  let firing = false; // 鼠标左键按住连发
  const muzzleFlames = []; // 炮口火焰（小锥体，不挡视野）
  const aim = { x: 0, y: 0 };
  const shots = [];
  const _flameLook = new THREE.Vector3();
  let pointerLocked = false;

  window.addEventListener("mousemove", (e) => {
    if (!riding) return;
    if (pointerLocked) {
      aim.x = THREE.MathUtils.clamp(aim.x + e.movementX * AIM_MOUSE_SENS, -AIM_LIMIT, AIM_LIMIT);
      aim.y = THREE.MathUtils.clamp(aim.y - e.movementY * AIM_MOUSE_SENS, -AIM_LIMIT, AIM_LIMIT);
    } else {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      aim.x = THREE.MathUtils.clamp(((e.clientX - cx) / cx) * 0.9, -AIM_LIMIT, AIM_LIMIT);
      aim.y = THREE.MathUtils.clamp((-(e.clientY - cy) / cy) * 0.9, -AIM_LIMIT, AIM_LIMIT);
    }
    syncCrosshairDom();
  });

  window.addEventListener("mousedown", (e) => {
    if (!riding || e.button !== 0) return;
    e.preventDefault();
    firing = true;
    tryFire();
    const canvas = document.querySelector("canvas");
    if (canvas && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) firing = false;
  });
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement != null;
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyG") return;
    if (!riding) return;
    e.preventDefault();
    tryFire();
  });

  // C 键：第一/第三视角切换（驾驶中）
  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyC") return;
    if (!riding) return;
    e.preventDefault();
    thirdPerson = !thirdPerson;
    setCanopyVisible(thirdPerson); // 第三视角显示泡罩，第一视角隐藏
    toast(thirdPerson ? "第三视角 · 艇外跟拍" : "第一视角 · 驾驶舱", 1.8);
  });

  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.code !== "KeyF") return;
    if (riding) {
      e.preventDefault();
      dismount();
      return;
    }
    const fleet = getFleet?.();
    const near = findNearestBubblePod(fleet, player.position, BOARD_RANGE);
    if (!near) return;
    e.preventDefault();
    mount(near);
  });

  function setHint(html) {
    if (!elHint) return;
    if (html) {
      elHint.innerHTML = html;
      elHint.classList.add("show");
    } else {
      elHint.classList.remove("show");
    }
  }

  function syncCrosshairDom() {
    if (!elCrosshair) return;
    if (!riding) {
      elCrosshair.classList.remove("show");
      return;
    }
    elCrosshair.classList.add("show");
    const px = (aim.x * 0.5 + 0.5) * 100;
    const py = (-aim.y * 0.5 + 0.5) * 100;
    elCrosshair.style.left = `${px}%`;
    elCrosshair.style.top = `${py}%`;
  }

  function showCrosshair(on) {
    if (!elCrosshair) return;
    elCrosshair.classList.toggle("show", !!on);
    if (on) syncCrosshairDom();
  }

  function setDiveTint(amount) {
    if (!elDiveTint) return;
    const a = THREE.MathUtils.clamp(amount, 0, 1);
    elDiveTint.style.opacity = String(a * 0.72);
    elDiveTint.classList.toggle("show", a > 0.02);
  }

  /**
   * 座舱内视角时隐藏泡罩（含其描边子件）与高光环/弧线，避免反向壳黑边、
   * 装饰高光在舱内形成灰膜挡视野；第三视角/下艇时恢复。
   */
  function setCanopyVisible(visible) {
    if (!pod) return;
    pod.traverse((o) => {
      if (
        o.name === "bubble-shell" ||
        o.name === "bubble-highlight-ring" ||
        o.name === "bubble-highlight-arc" ||
        // 第一人称时隐藏装饰环（已降到臀部高度，仍可能在近景裁切）
        o.name === "equatorial-ring"
      ) {
        o.visible = visible;
      }
    });
  }

  function captureYaw(fromPod) {
    _up.copy(fromPod.position).normalize();
    _m.extractRotation(fromPod.matrixWorld);
    _fwd.set(0, 0, 1).applyMatrix4(_m);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
    if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
    _fwd.normalize();
    // 相对「正东切向」的近似偏航
    _right.crossVectors(_up, new THREE.Vector3(0, 1, 0));
    if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
    _right.normalize();
    const north = new THREE.Vector3().crossVectors(_right, _up).normalize();
    return Math.atan2(_fwd.dot(_right), _fwd.dot(north));
  }

  function mount(target) {
    exitOtherRides();
    pod = target;
    riding = true;
    player.riding = true;
    player.velocity.set(0, 0, 0);
    pod.userData.piloted = true;
    pod.userData._pilotBase = null; // 自由驾驶，不再锁巡游点
    aim.x = 0;
    aim.y = 0;
    thirdPerson = false; // 每次登艇默认第一视角
    setCanopyVisible(false); // 座舱内隐藏泡罩，视野清晰
    yaw = captureYaw(pod);
    hover = Math.max(AIR_MIN_HOVER, pod.position.length() - planetRadius);
    submerged = false;
    wasSubmerged = false;
    prevCamDist = cameraRig?.getDist ? cameraRig.getDist() : 0;
    if (cameraRig?.setDist) cameraRig.setDist(2.2);
    camera.fov = 68;
    camera.updateProjectionMatrix();
    if (playerGroup) playerGroup.visible = false;
    showCrosshair(true);
    setHint(hintHtml(false));
    toast("登上气泡艇 · WASD 驾驶 · [G]/左键 麻醉弹 · 飞鸟坠落/士兵卧倒", 3.8);
  }

  function hintHtml(isDive) {
    if (isDive) {
      return (
        "[<kbd>Space</kbd>] 上浮 · [<kbd>WASD</kbd>] 潜航 · [<kbd>G</kbd>] 麻醉弹 · [<kbd>F</kbd>] 下艇"
      );
    }
    return (
      "[<kbd>WASD</kbd>] 驾驶 · [<kbd>Space</kbd>/<kbd>Ctrl</kbd>] 升/潜 · " +
      "[<kbd>C</kbd>] 视角 · [<kbd>G</kbd>] 麻醉弹 · [<kbd>F</kbd>] 下艇"
    );
  }

  function dismount() {
    if (pod) {
      pod.userData.piloted = false;
      pod.userData._pilotBase = null;
      setCanopyVisible(true); // 下艇恢复泡罩显示
      // 潜行中下艇：抬到水面附近再落地
      const sea = getSeaLake?.();
      let exitPos = pod.position.clone();
      if (sea?.containsWorldPos?.(exitPos) && exitPos.length() < sea.surfaceR - 0.5) {
        exitPos.normalize().multiplyScalar(sea.surfaceR + 1.2);
      }
      const up = exitPos.clone().normalize();
      player.position.copy(exitPos).addScaledVector(up, -0.6);
      const side = new THREE.Vector3(1, 0, 0).applyQuaternion(pod.quaternion);
      side.addScaledVector(up, -side.dot(up));
      if (side.lengthSq() > 1e-6) {
        side.normalize();
        player.position.addScaledVector(side, 1.5);
      }
      // 放回巡游高度附近（空闲艇恢复花厅巡游）
      if (pod.userData.orbit) {
        // 不强制瞬移，下一帧 updateBubblePodPatrol 会拉回轨道
      }
    }
    pod = null;
    riding = false;
    player.riding = false;
    player.velocity.set(0, 0, 0);
    submerged = false;
    setDiveTint(0);
    if (playerGroup) playerGroup.visible = true;
    if (cameraRig?.setDist && prevCamDist) cameraRig.setDist(prevCamDist);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    showCrosshair(false);
    setHint(null);
    setBubblePodCannonBgm(false, { fade: 0.85 });
    if (document.pointerLockElement) document.exitPointerLock?.();
    toast("已离开气泡艇", 1.8);
  }

  function forceExit() {
    if (riding) dismount();
  }

  function pollGamepad(dt) {
    if (!riding) return;
    const pads = navigator.getGamepads?.() || [];
    let pad = null;
    for (const p of pads) {
      if (p) {
        pad = p;
        break;
      }
    }
    if (!pad) return;

    let rx = pad.axes[2] ?? 0;
    let ry = pad.axes[3] ?? pad.axes[5] ?? 0;
    if (Math.hypot(rx, ry) < DEADZONE) {
      rx = 0;
      ry = 0;
    } else {
      const len = Math.hypot(rx, ry);
      const scale = (len - DEADZONE) / (1 - DEADZONE);
      rx = (rx / len) * scale;
      ry = (ry / len) * scale;
    }
    aim.x = THREE.MathUtils.clamp(aim.x + rx * AIM_STICK_SPEED * dt, -AIM_LIMIT, AIM_LIMIT);
    aim.y = THREE.MathUtils.clamp(aim.y - ry * AIM_STICK_SPEED * dt, -AIM_LIMIT, AIM_LIMIT);
    syncCrosshairDom();

    const fireBtn =
      pad.buttons[7]?.pressed ||
      pad.buttons[5]?.pressed ||
      (pad.buttons[7]?.value ?? 0) > 0.55;
    if (fireBtn) tryFire();

    // 左摇杆辅助转向/推进（可选）
    // 已用 keys WASD；手柄左摇杆映射到虚拟键在此不写，保持键盘为主
  }

  function aimByDelta(dx, dy) {
    if (!riding) return;
    aim.x = THREE.MathUtils.clamp(aim.x + dx * 0.9, -AIM_LIMIT, AIM_LIMIT);
    aim.y = THREE.MathUtils.clamp(aim.y - dy * 0.9, -AIM_LIMIT, AIM_LIMIT);
    syncCrosshairDom();
  }

  function tryFire() {
    if (!riding || !pod || fireCd > 0) return false;
    fireCd = FIRE_COOLDOWN;

    _ndc.set(aim.x, aim.y);
    _ray.setFromCamera(_ndc, camera);
    _dir.copy(_ray.ray.direction).normalize();

    const muzzle = pod.userData.muzzle;
    if (muzzle) {
      pod.updateWorldMatrix(true, false);
      muzzle.getWorldPosition(_muzzle);
    } else {
      _muzzle.copy(camera.position).addScaledVector(_dir, 1.2);
    }
    _muzzle.addScaledVector(_dir, 0.85);

    // 炮弹颜色：恢复艇体 accent / 座舱面板青绿
    let color = pod.userData.accentColor || 0x8effd8;
    pod.traverse((c) => {
      if (c.name === "cockpit-panel" && c.material?.color) {
        color = c.material.color.getHex();
      }
    });

    shots.push(createBubbleShot(scene, _muzzle, _dir, color));

    // 炮口火焰：细长锥体沿射击方向，贴炮口、短促、不挡座舱视野
    spawnMuzzleFlame(_muzzle, _dir);
    setBubblePodCannonBgm(true);
    return true;
  }

  /** 炮口火焰（世界空间小锥，约 70ms 熄灭） */
  function spawnMuzzleFlame(origin, dir) {
    const root = new THREE.Group();
    root.name = "bubble-muzzle-flame";
    // 外焰橙 + 内焰亮黄，沿 +Z 伸出
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.28, 6, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff8a3a,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    outer.rotation.x = Math.PI / 2;
    outer.position.z = 0.14;
    root.add(outer);
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.16, 5, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2a8,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.z = 0.1;
    root.add(inner);

    root.position.copy(origin);
    _flameLook.copy(origin).addScaledVector(dir, 1);
    root.lookAt(_flameLook);
    // 略前推，避免贴镜头
    root.position.addScaledVector(dir, 0.12);
    scene.add(root);
    muzzleFlames.push({ root, outer, inner, age: 0, life: 0.07 });
  }

  /**
   * 驾驶 + 潜行 + 相机
   * @returns {boolean}
   */
  /**
   * 麻醉弹命中：对所有生物生效（鸟/飞行器/兵/桨手/系绳兵/兽类…）
   * @param {object} shot
   * @returns {boolean}
   */
  function tryTranqHit(shot) {
    if (!shot?.group || shot.hit || shot.popping || shot.stuck) return false;
    const lm = getLandmarks?.() || null;
    if (!lm) return false;
    const pos = shot.group.position;
    const rBird = TRANQ_HIT_R_BIRD;
    const rSol = TRANQ_HIT_R_SOLDIER;

    const applyHit = (hit, msg) => {
      if (!hit) return false;
      stickBubbleShot(shot, { ...hit, duration: hit.duration ?? TRANQ_DURATION });
      toast(msg, 1.6);
      return true;
    };

    const trySedateObject = (obj, msg, radius = rSol, kind = "soldier") => {
      if (!obj || obj.visible === false) return false;
      if (obj.userData?.sedated) return false;
      if (typeof obj.getWorldPosition === "function") obj.getWorldPosition(_hitPos);
      else _hitPos.copy(obj.position);
      if (_hitPos.distanceToSquared(pos) > radius * radius) return false;
      sedateObject(obj, TRANQ_DURATION, kind);
      stickBubbleShot(shot, {
        kind: "object",
        object: obj,
        duration: TRANQ_DURATION,
      });
      toast(msg, 1.6);
      return true;
    };

    // 1) Boids / 护航鸟（麻醉时长为士兵的 2 倍）
    for (const flock of [lm.flock, lm.hallFlock, lm.escort]) {
      const hit = flock?.sedateNearest?.(pos, rBird, TRANQ_DURATION_BIRD);
      if (applyHit(hit, "麻醉命中 · 飞鸟坠落")) return true;
    }
    // 2) 千鸟漩涡 / 台地鸟群
    for (const v of [
      lm.gateBirdVortex,
      lm.birdVortex,
      lm.terraceBirds?.primary,
    ]) {
      const hit = v?.sedateNearest?.(pos, rBird, TRANQ_DURATION_BIRD);
      if (applyHit(hit, "麻醉命中 · 飞鸟坠落")) return true;
    }
    const terraceFlocks = lm.terraceBirds?.flocks;
    if (Array.isArray(terraceFlocks)) {
      for (const f of terraceFlocks) {
        const hit = f?.vortex?.sedateNearest?.(pos, rBird, TRANQ_DURATION_BIRD);
        if (applyHit(hit, "麻醉命中 · 飞鸟坠落")) return true;
      }
    }

    // 2.5) 莫比斯飞行器：攒满 20 发后像飞鸟一样坠地，再缓缓升空
    {
      const squad = lm.aircraftSquad;
      const acMembers = Array.isArray(squad?.userData?.members)
        ? squad.userData.members
        : squad?.userData?.kind === "moebius-aircraft"
          ? [squad]
          : [];
      let best = null;
      let bestD = Infinity;
      for (const m of acMembers) {
        if (!m || m.visible === false) continue;
        if (typeof m.getWorldPosition === "function") m.getWorldPosition(_hitPos);
        else _hitPos.copy(m.position);
        const sc = Math.max(1, m.scale?.x || 1);
        const rAc = TRANQ_HIT_R_AIRCRAFT * sc;
        const d2 = _hitPos.distanceToSquared(pos);
        if (d2 <= rAc * rAc && d2 < bestD) {
          bestD = d2;
          best = m;
        }
      }
      if (best) {
        const result = applyAircraftTranqHit(best);
        stickBubbleShot(shot, {
          kind: "object",
          object: best,
          duration: isAircraftKnocked(best) ? 40 : TRANQ_DURATION_BIRD,
        });
        if (result?.already) {
          toast("麻醉命中 · 飞行器已坠落", 1.2);
        } else if (result?.knocked) {
          toast("麻醉命中 · 飞行器坠落", 1.8);
        } else {
          const n = result?.hits || best.userData.tranqHits || 0;
          toast(`麻醉命中 · 飞行器 ${n}/${TRANQ_HITS_AIRCRAFT}`, 1.2);
        }
        return true;
      }
    }

    // 3) 战船桨手（划船士兵）— 部分被麻醉 → 船歪
    const boats = [];
    if (lm.boat) boats.push(lm.boat);
    if (Array.isArray(lm.canalBoats?.boats)) boats.push(...lm.canalBoats.boats);
    const logState = lm.harborLogistics?.getState?.();
    if (logState?.boat) boats.push(logState.boat);
    if (logState?.transitBoat) boats.push(logState.transitBoat);
    const harborRoot = lm.harbor || lm.oldHarbor;
    if (harborRoot?.landmarks?.boat) boats.push(harborRoot.landmarks.boat);
    for (const boat of boats) {
      if (!boat) continue;
      const hit = sedateWarshipCrewNearest(boat, pos, rSol, TRANQ_DURATION);
      if (applyHit(hit, "麻醉命中 · 桨手倒下 · 船身偏航")) return true;
    }

    // 4) 士兵：搬货 / 鼓声巡逻 / 夜间渗透 / 木马系绳
    const soldiers = [];
    const harbor = lm.harbor || lm.oldHarbor;
    const squads = harbor?.landmarks?.porterSquads || harbor?.squads || [];
    for (const sq of squads) {
      for (const p of sq?.userData?.porters || []) {
        if (p) soldiers.push(p);
      }
    }
    const logistics = lm.harborLogistics;
    if (logistics?.getPatrolSoldiers) {
      for (const s of logistics.getPatrolSoldiers() || []) soldiers.push(s);
    }
    const inf = lm.citadelRange?.nightInfiltration;
    const infSoldiers = inf?.root?.userData?.soldiers;
    if (Array.isArray(infSoldiers)) {
      for (const s of infSoldiers) {
        if (s?.visible) soldiers.push(s);
      }
    }
    // 木马「白天系绳」班组（仅 tie-soldier；夜潜兵走 infiltration 列表，不混入）
    const horse = lm.citadelRange?.trojanHorse;
    const tieSquad =
      horse?.userData?.tiedownSquad ||
      horse?.getObjectByName?.("horse-tiedown-squad");
    if (tieSquad?.visible !== false) {
      for (const c of tieSquad.children) {
        if (c.name === "tie-soldier" || c.userData?.kind === "tieSoldier") {
          soldiers.push(c);
        }
      }
    }

    for (const s of soldiers) {
      if (trySedateObject(s, "麻醉命中 · 士兵卧倒", rSol, "soldier")) return true;
    }

    // 5) 其他生物：狐狸、墨虎、白鲸等（userData.kind 或 landmarks）
    const creatures = [];
    const fox = lm.camp?.landmarks?.foxAli;
    if (fox) creatures.push(fox);
    // 场景中可遍历的生物 kind
    const creatureKinds = new Set([
      "fox",
      "moebius-swamp-tiger",
      "moebius-beluga-whale",
      "sea-beluga",
      "sea-eel",
      "sea-ribbon",
      "swamp-giant-flower",
    ]);
    if (scene) {
      scene.traverse((o) => {
        const k = o.userData?.kind;
        if (k && creatureKinds.has(k)) creatures.push(o);
      });
    }
    // 海水湖生物
    const lake = lm.citySeaLake;
    if (lake?.group) {
      lake.group.traverse((o) => {
        if (o.userData?.kind && String(o.userData.kind).startsWith("sea-")) {
          creatures.push(o);
        }
      });
    }
    for (const c of creatures) {
      if (trySedateObject(c, "麻醉命中 · 生物倒下", rSol * 1.15, "creature")) return true;
    }

    return false;
  }

  function update(dt) {
    if (fireCd > 0) fireCd = Math.max(0, fireCd - dt);
    for (let i = shots.length - 1; i >= 0; i--) {
      const shot = shots[i];
      // 飞行中检测命中 → 粘附（不再爆裂消失）
      if (!shot.dead && !shot.popping && !shot.stuck) {
        tryTranqHit(shot);
      }
      if (!updateBubbleShot(shot, dt, planetRadius)) shots.splice(i, 1);
    }
    // 炮口火焰：快速拉长后熄灭，体量小不挡视野
    for (let i = muzzleFlames.length - 1; i >= 0; i--) {
      const f = muzzleFlames[i];
      f.age += dt;
      const k = Math.min(1, f.age / f.life);
      const stretch = 1 + k * 0.85;
      f.root.scale.set(1 - k * 0.35, 1 - k * 0.35, stretch);
      if (f.outer?.material) f.outer.material.opacity = 0.88 * (1 - k);
      if (f.inner?.material) f.inner.material.opacity = 0.95 * (1 - k * 0.9);
      if (f.age >= f.life) {
        scene.remove(f.root);
        f.root.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        muzzleFlames.splice(i, 1);
      }
    }

    if (!riding) {
      if (elHint) {
        const fleet = getFleet?.();
        const near =
          !player.riding && findNearestBubblePod(fleet, player.position, BOARD_RANGE);
        setHint(
          near
            ? "[<kbd>F</kbd>] 登上气泡艇 · 海水湖可潜行 · [<kbd>G</kbd>] 麻醉弹"
            : null
        );
      }
      setDiveTint(0);
      return false;
    }

    if (!pod || !pod.parent) {
      forceExit();
      return false;
    }

    pollGamepad(dt);
    if (firing) tryFire(); // 鼠标左键按住连发

    const sea = getSeaLake?.() || null;
    const overSea = !!(sea && sea.containsWorldPos(pod.position));

    // ---------- 驾驶输入 ----------
    const k = keys || {};
    const turn = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    yaw += turn * TURN_SPEED * dt;
    const thrust = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    let riseIn = k.Space ? 1 : 0;
    let diveIn = k.ControlLeft || k.ControlRight ? 1 : 0;
    // 手柄：LT/LB 潜行，左摇杆 Y 也可升降
    const pads = navigator.getGamepads?.() || [];
    for (const pad of pads) {
      if (!pad) continue;
      if (pad.buttons[4]?.pressed) diveIn = 1;
      if (pad.buttons[6]?.pressed || (pad.buttons[6]?.value ?? 0) > 0.4) diveIn = 1;
      const ly = pad.axes[1] ?? 0;
      if (ly < -0.45) riseIn = 1;
      if (ly > 0.45) diveIn = 1;
    }

    // ---------- 高度 / 潜深 ----------
    // hover = 相对球心的海拔偏移（position.length - planetRadius）
    // 在海水湖内：可降到 surfaceLift - maxDive
    const surfaceLift = sea ? sea.waterLift : 0.14;
    const minHover = overSea ? surfaceLift - (sea?.maxDive ?? 10) : AIR_MIN_HOVER;
    const maxHover = AIR_MAX_HOVER;

    hover += (riseIn - diveIn) * VERT_SPEED * dt;
    hover = THREE.MathUtils.clamp(hover, minHover, maxHover);

    // 若试图在非海水区下潜到地表以下 → 钳到 AIR_MIN
    if (!overSea && hover < AIR_MIN_HOVER) hover = AIR_MIN_HOVER;

    submerged = overSea && hover < surfaceLift - 0.35;
    if (submerged && !wasSubmerged) {
      toast("气泡艇潜行 · 海水培育区", 2.2);
    }
    if (!submerged && wasSubmerged && overSea) {
      toast("浮出水面", 1.4);
    }
    wasSubmerged = submerged;

    // 潜行滤镜强度
    if (submerged && sea) {
      const depth = Math.max(0, surfaceLift - hover);
      setDiveTint(0.25 + (depth / Math.max(sea.maxDive, 1)) * 0.75);
    } else {
      setDiveTint(0);
    }

    // ---------- 球面运动 ----------
    _up.copy(pod.position).normalize();
    quatYToDir(_up, _q0);
    _qYaw.setFromAxisAngle(_yAxis, yaw);
    pod.quaternion.copy(_q0).multiply(_qYaw);

    _fwd.set(0, 0, 1).applyQuaternion(pod.quaternion);
    _fwd.addScaledVector(_up, -_fwd.dot(_up));
    if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
    else _fwd.set(0, 0, 1);

    const speed = submerged ? FLY_SPEED_DIVE : FLY_SPEED;
    _pos.copy(_up).multiplyScalar(planetRadius + hover);
    if (thrust !== 0) {
      _pos.addScaledVector(_fwd, thrust * speed * dt);
      _pos.normalize().multiplyScalar(planetRadius + hover);
    }
    pod.position.copy(_pos);
    _up.copy(pod.position).normalize();
    quatYToDir(_up, _q0);
    _qYaw.setFromAxisAngle(_yAxis, yaw);
    pod.quaternion.copy(_q0).multiply(_qYaw);

    // 潜行时轻微俯仰
    if (submerged) {
      pod.rotateX(0.12 + Math.sin(performance.now() * 0.002) * 0.03);
    }

    // ---------- 相机 ----------
    pod.updateWorldMatrix(true, false);
    if (thirdPerson) {
      // 第三视角：艇后上方跟拍，看向艇体
      _m.extractRotation(pod.matrixWorld);
      _fwd.set(0, 0, 1).applyMatrix4(_m);
      _fwd.addScaledVector(_up, -_fwd.dot(_up));
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, 1);
      _fwd.normalize();
      camera.position.copy(pod.position).addScaledVector(_up, 4.5).addScaledVector(_fwd, -9);
      camera.up.copy(_up);
      camera.lookAt(pod.position);
      camera.updateMatrixWorld(true);
    } else {
      // 第一视角：驾驶舱锚点，朝机头方向看出去（含准星瞄准）
      const anchor = pod.userData.cockpitAnchor;
      if (anchor) anchor.getWorldPosition(camera.position);
      else camera.position.copy(pod.position);

      camera.up.copy(_up);
      _m.extractRotation(pod.matrixWorld);
      _fwd.set(0, 0, 1).applyMatrix4(_m).normalize();
      camera.lookAt(camera.position.clone().add(_fwd));
      camera.updateMatrixWorld(true);

      _ndc.set(aim.x, aim.y);
      _ray.setFromCamera(_ndc, camera);
      camera.lookAt(
        camera.position.clone().addScaledVector(_ray.ray.direction, 12)
      );
    }

    // FOV：潜行略宽、略暗感；第三视角略广
    const targetFov = thirdPerson ? 60 : (submerged ? 74 : 68);
    if (Math.abs(camera.fov - targetFov) > 0.2) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 4));
      camera.updateProjectionMatrix();
    }

    player.position.copy(pod.position);
    player.velocity.set(0, 0, 0);

    setHint(hintHtml(submerged));
    syncCrosshairDom();
    return true;
  }

  return {
    update,
    forceExit,
    isRiding: () => riding,
    isSubmerged: () => submerged,
    aimByDelta,
    tryFire,
  };
}
