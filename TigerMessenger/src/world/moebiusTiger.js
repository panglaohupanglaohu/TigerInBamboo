// 湖沼虎运行时：原模型工厂已归入 assets；巡游与灯谜保留在世界逻辑层。
import * as THREE from "three";
import { createMoebiusTigerModel, TIGER_SCALE } from "../assets/characters/moebiusTiger.js";
import { showBubble, hideBubble } from "../ui/hud.js";
import { PLANET_RADIUS } from "./planet.js";

export function createMoebiusTiger(rnd = Math.random, roam = null, modelOptions = {}) {
  const tiger = createMoebiusTigerModel(rnd, modelOptions);
  if (roam) attachRoamBehavior(tiger, roam);
  return tiger;
}

/* -------------------------------------------------------------------
 *  巡游 + 饮水 + 见送信人跳下相见
 *  roam: { rim, steps, drink, speed? }
 *  update(dt, t, runtime?)  runtime.player → 触发跳下相见
 * ------------------------------------------------------------------- */
const GREET_SEE_R = 32; // 坑缘看见送信人的水平距离（湖沼本地）
const GREET_MEET_R = 3.2; // 走到面前的距离
const WATER_WALK_Y = 25.15; // 湖沼水面 +0.15：水墨虎踏水而行（主人验收 2026-08-29）
const GREET_STAY = 10; // 相见停留（够说完灯谜）
const GREET_COOLDOWN = 18; // 结束后冷却，避免反复跳
const GREET_JUMP_DUR = 0.95;
const GREET_JUMP_PEAK = 4.2; // 抛物线跳起高度

const _greetFrom = new THREE.Vector3();
const _greetTo = new THREE.Vector3();
const _greetPlayer = new THREE.Vector3();

function attachRoamBehavior(tiger, roam) {
  if (!roam.rim?.length || !roam.steps?.length) return;
  const speed = roam.speed ?? 2.4;
  const rim = roam.rim;
  const steps = roam.steps;
  const up = [...steps].reverse();
  let mode = "patrol";
  let wp = 0;
  let pause = 0;
  let drinkT = 0;
  let queue = steps;
  let qi = 0;
  let greetStayT = 0;
  let greetCd = 0;
  /** @type {{ t: number, dur: number, peak: number }|null} */
  let jump = null;

  /**
   * 球面贴地：与 applySwampSphereFit 同公式，消除坑缘“平面斜坡”悬空感。
   * pathY = 设计路径高度（如 SWAMP_GROUND_Y 或石阶 y）
   */
  function groundY(x, z, pathY) {
    let scale = 1;
    let o = tiger.parent;
    while (o) {
      if (Number.isFinite(o.userData?.factoryScale)) {
        scale = o.userData.factoryScale;
        break;
      }
      if (Number.isFinite(o.parent?.userData?.factoryScale)) {
        scale = o.parent.userData.factoryScale;
        break;
      }
      o = o.parent;
      if (!o || o === o.parent) break;
    }
    const Rs = PLANET_RADIUS / Math.max(1e-4, scale);
    const d = Math.hypot(x, z);
    const drop = d >= Rs ? 0 : Rs - Math.sqrt(Math.max(0, Rs * Rs - d * d));
    return pathY - drop;
  }

  /**
   * 坑面设计高度（脚底 pathY，不含球面 drop）。
   * 按径向在坑缘 ↔ 饮水点之间插值；更靠内则沿同坡度外推。
   * 切勿用送信人 pl.y：那是角色原点/身体高度，会导致跟随悬空。
   */
  function surfacePathY(x, z) {
    const d = Math.hypot(x, z);
    const rimY = rim[0].y;
    const drink = roam.drink;
    const rimR = Math.hypot(rim[0].x, rim[0].z) || 1;
    const drinkR = drink ? Math.hypot(drink.x, drink.z) : rimR * 0.7;
    const drinkY = drink && Number.isFinite(drink.y) ? drink.y : rimY - 17.5;
    if (d >= rimR) return rimY;
    const denom = drinkR - rimR;
    if (Math.abs(denom) < 1e-4) return rimY;
    // y(d) = rimY + (d - rimR) * slope；向坑内 d↓ 时 y↓
    return rimY + (d - rimR) * ((drinkY - rimY) / denom);
  }

  /** 当前脚底贴地高度 */
  function feetOnGround(x = tiger.position.x, z = tiger.position.z) {
    return groundY(x, z, surfacePathY(x, z));
  }

  const seek = (target, dt, arrive, spd = speed, pathY) => {
    if (!target) return true;
    const dx = target.x - tiger.position.x;
    const dz = target.z - tiger.position.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) return true;
    const step = Math.min(d, spd * dt);
    tiger.position.x += (dx / d) * step;
    tiger.position.z += (dz / d) * step;
    tiger.rotation.y = Math.atan2(dx, dz);
    // 水平移动时同步贴地：优先显式 pathY，否则用目标设计 y（路径点），再不则径向地表
    const py = Number.isFinite(pathY)
      ? pathY
      : Number.isFinite(target.y)
        ? target.y
        : surfacePathY(tiger.position.x, tiger.position.z);
    tiger.userData._baseY = groundY(tiger.position.x, tiger.position.z, py);
    return false;
  };

  /** 送信人 → 虎父节点本地坐标 */
  function playerLocal(player) {
    if (!player?.position || !tiger.parent) return null;
    _greetPlayer.copy(player.position);
    tiger.parent.worldToLocal(_greetPlayer);
    return _greetPlayer;
  }

  /** 开跳：从当前坑缘/高处跃向送信人近旁 */
  function beginGreetJump(pl) {
    _greetFrom.copy(tiger.position);
    _greetFrom.y = tiger.userData._baseY ?? tiger.position.y;
    // 落点：送信人身前约 2.8，脚底贴坑面（不用 pl.y）
    const dx = pl.x - tiger.position.x;
    const dz = pl.z - tiger.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const stop = Math.max(0, d - 2.8);
    const tx = tiger.position.x + (dx / d) * stop;
    const tz = tiger.position.z + (dz / d) * stop;
    var landY = feetOnGround(tx, tz);
    if (Math.hypot(tx, tz) < 27 && landY < 25.2) landY = WATER_WALK_Y; // 湖沼水域内 → 落在水面
    _greetTo.set(tx, landY, tz);
    jump = { t: 0, dur: GREET_JUMP_DUR, peak: GREET_JUMP_PEAK * TIGER_SCALE * 2.2 };
    mode = "greet-jump";
    tiger.userData._greeting = true;
    tiger.userData._drinking = false;
    tiger.rotation.y = Math.atan2(dx, dz);
  }

  tiger.userData._walking = false;
  tiger.userData._drinking = false;
  tiger.userData._greeting = false;
  tiger.position.copy(rim[0]);
  tiger.userData._baseY = groundY(rim[0].x, rim[0].z, rim[0].y);
  tiger.position.y = tiger.userData._baseY;

  const prevUpdate = tiger.userData.update;
  tiger.userData.update = function (dt, t, runtime) {
    const player = runtime?.player ?? null;
    if (greetCd > 0) greetCd -= dt;

    // 强制饮水（旧接口）
    if (tiger.userData.forceDrink && mode === "patrol") {
      mode = "to-steps";
      tiger.userData.forceDrink = false;
    }

    // 送信人一进入湖沼（进坑）→ 虎必从坑缘跃下相见（主人验收 2026-08-29）：
    // 不再受虎的视野半径限制——进沼即相见；重复进出仍有短暂冷却防刷。
    if (
      player &&
      greetCd <= 0 &&
      (mode === "patrol" ||
        mode === "to-steps" ||
        mode === "descend" ||
        mode === "drink" ||
        mode === "ascend")
    ) {
      const pl = playerLocal(player);
      if (pl) {
        const horiz = Math.hypot(pl.x - tiger.position.x, pl.z - tiger.position.z);
        // 送信人在湖沼坑内（比坑缘低）或已足够近
        const rimY = rim[0].y;
        const playerBelow = pl.y < rimY - 2;
        const playerInCrater = Math.hypot(pl.x, pl.z) < 30; // 坑内（坑缘半径 37 的内侧）
        if (playerInCrater || (horiz < GREET_SEE_R && (playerBelow || horiz < 14))) {
          beginGreetJump(pl);
        }
      }
    }

    tiger.userData._walking = false;
    tiger.userData._drinking = false;
    if (mode !== "greet-jump" && mode !== "greet-meet" && mode !== "greet-stay") {
      tiger.userData._greeting = false;
    }

    if (mode === "greet-jump" && jump) {
      // 抛物线跃下：水平 ease + 竖直 sin 拱
      jump.t += dt;
      const u = Math.min(1, jump.t / jump.dur);
      const ease = u * u * (3 - 2 * u);
      tiger.position.x = _greetFrom.x + (_greetTo.x - _greetFrom.x) * ease;
      tiger.position.z = _greetFrom.z + (_greetTo.z - _greetFrom.z) * ease;
      const baseY = _greetFrom.y + (_greetTo.y - _greetFrom.y) * ease;
      tiger.userData._baseY = baseY + Math.sin(u * Math.PI) * jump.peak;
      tiger.userData._walking = false;
      tiger.userData._greeting = true;
      // 腾空时略收腿感：用 drinking 低头的反面——保持机警抬头
      if (u >= 1) {
        jump = null;
        mode = "greet-meet";
        tiger.userData._baseY = _greetTo.y;
      }
    } else if (mode === "greet-meet") {
      tiger.userData._greeting = true;
      const pl = playerLocal(player);
      if (!pl) {
        // 人走了：回坑缘
        mode = "ascend";
        queue = up;
        qi = 0;
      } else {
        // 踏水跟随：跟随高度用水面（主人验收 2026-08-29 水墨虎水上行走）
        _greetTo.set(pl.x, WATER_WALK_Y, pl.z);
        if (seek(_greetTo, dt, GREET_MEET_R, speed * 1.35, WATER_WALK_Y)) {
          const dx = pl.x - tiger.position.x;
          const dz = pl.z - tiger.position.z;
          if (dx * dx + dz * dz > 1e-6) tiger.rotation.y = Math.atan2(dx, dz);
          tiger.userData._baseY = WATER_WALK_Y;
          mode = "greet-stay";
          greetStayT = GREET_STAY;
        } else {
          tiger.userData._walking = true;
          tiger.userData._baseY = WATER_WALK_Y;
        }
      }
    } else if (mode === "greet-stay") {
      tiger.userData._greeting = true;
      const pl = playerLocal(player);
      if (pl) {
        const dx = pl.x - tiger.position.x;
        const dz = pl.z - tiger.position.z;
        if (dx * dx + dz * dz > 1e-6) tiger.rotation.y = Math.atan2(dx, dz);
        // 人若缓步走动：保持脚在水面
        const horiz = Math.hypot(dx, dz);
        if (horiz > GREET_MEET_R * 1.15 && horiz < GREET_SEE_R * 0.85) {
          const pathY = WATER_WALK_Y;
          _greetTo.set(pl.x, pathY, pl.z);
          seek(_greetTo, dt, GREET_MEET_R, speed * 1.1, pathY);
          tiger.userData._walking = true;
        }
        tiger.userData._baseY = WATER_WALK_Y;
        // 人跑远则提前结束
        if (horiz > GREET_SEE_R * 0.85) greetStayT = 0;
      } else {
        tiger.userData._baseY = feetOnGround();
      }
      greetStayT -= dt;
      if (greetStayT <= 0) {
        tiger.userData._greeting = false;
        greetCd = GREET_COOLDOWN;
        mode = "ascend";
        queue = up;
        qi = 0;
      }
    } else if (mode === "patrol") {
      if (pause > 0) pause -= dt;
      else if (seek(rim[wp], dt, 0.8)) {
        pause = 1.2 + Math.random() * 1.6;
        wp = (wp + 1) % rim.length;
        if (wp === 0) mode = "to-steps";
      } else tiger.userData._walking = true;
      tiger.userData._baseY = groundY(
        tiger.position.x,
        tiger.position.z,
        rim[wp]?.y ?? rim[0].y
      );
    } else if (mode === "to-steps") {
      if (seek(steps[0], dt, 0.7)) {
        mode = "descend";
        queue = steps;
        qi = 0;
      } else tiger.userData._walking = true;
      tiger.userData._baseY = groundY(
        tiger.position.x,
        tiger.position.z,
        steps[0].y
      );
    } else if (mode === "descend") {
      tiger.userData._walking = true;
      if (qi < queue.length && seek(queue[qi], dt, 0.6)) qi++;
      const ty = qi < queue.length ? queue[qi].y : roam.drink.y;
      const targetY = groundY(tiger.position.x, tiger.position.z, ty);
      tiger.userData._baseY += (targetY - tiger.userData._baseY) * Math.min(1, dt * 3);
      if (qi >= queue.length) {
        mode = "drink";
        drinkT = 5 + Math.random() * 3;
        queue = up;
        qi = 0;
      }
    } else if (mode === "drink") {
      tiger.userData._drinking = true;
      drinkT -= dt;
      tiger.userData._baseY = groundY(
        tiger.position.x,
        tiger.position.z,
        roam.drink.y
      );
      if (drinkT <= 0) mode = "ascend";
    } else if (mode === "ascend") {
      tiger.userData._walking = true;
      if (qi < queue.length && seek(queue[qi], dt, 0.6)) qi++;
      const ty = qi < queue.length ? queue[qi].y : rim[0].y;
      const targetY = groundY(tiger.position.x, tiger.position.z, ty);
      tiger.userData._baseY += (targetY - tiger.userData._baseY) * Math.min(1, dt * 3);
      if (qi >= queue.length) {
        mode = "patrol";
        wp = 1;
        queue = steps;
        qi = 0;
      }
    }
    tiger.userData._mode = mode;
    prevUpdate(dt, t);
  };
}

/* -------------------------------------------------------------------
 *  与送信人对话气泡
 *  虎：「两家秋雨一家声，你猜」
 *  送信人：「芭蕉与荷」
 * ------------------------------------------------------------------- */
// 相见跳下后近距离说话；略放大以免落地后对不上
const TIGER_TALK_RANGE = 7.5;
const TIGER_LINE_HOLD = 3.2;
const TIGER_REPLY_HOLD = 2.8;
const TIGER_COOLDOWN = 14;
const _tigerBubbleWorld = new THREE.Vector3();
const _playerWorld = new THREE.Vector3();

/**
 * 每帧：若送信人靠近湖沼虎，弹出对答气泡。
 * @param {{ tiger?: THREE.Object3D|null, player?: object, camera?: THREE.Camera, dt?: number, isGameStarted?: () => boolean, isBlocked?: () => boolean }} deps
 */
export function updateSwampTigerDialog({
  tiger,
  player,
  camera,
  dt = 0.016,
  isGameStarted = () => true,
  isBlocked = () => false,
}) {
  if (!tiger || !player || !camera || !isGameStarted()) {
    if (tiger?.userData?._dialog?.active) {
      hideBubble();
      tiger.userData._dialog.active = false;
      tiger.userData._dialog.phase = "idle";
    }
    return false;
  }

  if (!tiger.userData._dialog) {
    tiger.userData._dialog = {
      phase: "idle", // idle | tiger | messenger | cool
      timer: 0,
      active: false,
    };
  }
  const d = tiger.userData._dialog;
  const speech = tiger.userData.speech || {
    line: "两家秋雨一家声，你猜",
    reply: "芭蕉与荷",
  };

  tiger.getWorldPosition(_tigerBubbleWorld);
  _playerWorld.copy(player.position);
  const dist = _tigerBubbleWorld.distanceTo(_playerWorld);
  const near = dist <= TIGER_TALK_RANGE;

  if (isBlocked()) {
    if (d.active) {
      hideBubble();
      d.active = false;
    }
    return false;
  }

  if (d.phase === "idle") {
    if (near) {
      d.phase = "tiger";
      d.timer = TIGER_LINE_HOLD;
      d.active = true;
    }
  } else if (d.phase === "tiger") {
    d.timer -= dt;
    _tigerBubbleWorld.y += 1.15 * (tiger.scale?.x || TIGER_SCALE) * 2.2;
    projectAndShow(speech.line, _tigerBubbleWorld, camera);
    d.active = true;
    if (d.timer <= 0) {
      d.phase = "messenger";
      d.timer = TIGER_REPLY_HOLD;
    }
  } else if (d.phase === "messenger") {
    d.timer -= dt;
    _playerWorld.y += 2.2;
    projectAndShow(speech.reply, _playerWorld, camera);
    d.active = true;
    if (d.timer <= 0) {
      hideBubble();
      d.active = false;
      d.phase = "cool";
      d.timer = TIGER_COOLDOWN;
    }
  } else if (d.phase === "cool") {
    d.timer -= dt;
    if (d.timer <= 0) {
      d.phase = "idle";
      // 仍站在旁边则不会立刻连刷：需先离开再靠近
      if (near) d.timer = 0.5;
    }
  }

  // 中途走开：收起并进入冷却
  if (!near && (d.phase === "tiger" || d.phase === "messenger")) {
    hideBubble();
    d.active = false;
    d.phase = "cool";
    d.timer = 4;
  }

  return d.active;
}

function projectAndShow(text, worldPos, camera) {
  _tigerBubbleWorld.copy(worldPos);
  _tigerBubbleWorld.project(camera);
  if (_tigerBubbleWorld.z < 1) {
    showBubble(
      text,
      (_tigerBubbleWorld.x * 0.5 + 0.5) * window.innerWidth,
      (-_tigerBubbleWorld.y * 0.5 + 0.5) * window.innerHeight,
      { large: true } // 湖沼虎灯谜加大字号
    );
  } else {
    hideBubble();
  }
}

/** 从场景里找湖沼虎（placement wrap / zone 均可） */
export function findSwampTiger(scene) {
  if (!scene) return null;
  let found = null;
  scene.traverse((o) => {
    if (found) return;
    if (o.userData?.kind === "moebius-swamp-tiger") found = o;
    if (o.userData?.tiger?.userData?.kind === "moebius-swamp-tiger") {
      found = o.userData.tiger;
    }
  });
  return found;
}
