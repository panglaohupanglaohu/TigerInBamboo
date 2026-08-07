// =====================================================================
//  故事板引擎：受限 spec → 临时场景 Group + 时间线执行器
//  - 白名单二次校验：模型幻觉出的 id / 动作静默丢弃，绝不崩游戏
//    （与 memoryBridge.js「桥接失败静默退回」的既有风格一致）
//  - 生成物挂在独立 Group 下，不写 localStorage、不污染 mapEditor 存档
//  - 契约对齐 foxNpc/questSystem：factory 返回 { play, update, dispose }
// =====================================================================
import * as THREE from "three";
import { createCatalogObject } from "../core/buildingCatalog.js";
import { getStoryCatalogIds, KNOWN_ACTORS, STORY_ACTIONS, WEATHER_VALUE } from "./storyCatalog.js";
import { showToast, showBubble, hideBubble } from "../ui/hud.js";
import { P, saveParams } from "../core/params.js";

/** 单次故事板规模上限：防止模型一次刷爆场景 */
const LIMITS = Object.freeze({ entities: 24, count: 8, timeline: 60, bubbleSec: 2.6 });

const _bubble = new THREE.Vector3();
const _look = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/**
 * 白名单校验：非法条目静默剔除，返回规范化 spec + warnings
 * @param {any} spec
 */
export function validateSpec(spec) {
  const warnings = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return { title: "未命名故事板", entities: [], timeline: [], warnings: ["spec 不是对象"] };
  }

  const validIds = getStoryCatalogIds();
  const validActions = new Set(STORY_ACTIONS);

  const entities = [];
  const seenUid = new Set();
  for (const e of Array.isArray(spec.entities) ? spec.entities.slice(0, LIMITS.entities) : []) {
    if (!e || typeof e !== "object") continue;
    const type = String(e.type || "");
    if (!validIds.has(type)) {
      warnings.push(`资产 "${type || "(空)"}" 不在白名单内，已丢弃`);
      continue;
    }
    let uid = String(e.uid || "").trim() || `e${entities.length + 1}`;
    if (seenUid.has(uid)) uid = `${uid}_${entities.length + 1}`;
    seenUid.add(uid);
    const n = Number(e.count);
    entities.push({
      uid,
      type,
      count: Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), LIMITS.count) : 1,
      label: typeof e.label === "string" ? e.label.slice(0, 24) : "",
    });
  }

  // actor/target 允许的引用集合
  const refSet = new Set(seenUid);
  for (const a of KNOWN_ACTORS) refSet.add(a);

  const timeline = [];
  for (const s of Array.isArray(spec.timeline) ? spec.timeline.slice(0, LIMITS.timeline) : []) {
    if (!s || typeof s !== "object") continue;
    const type = String(s.type || "");
    if (!validActions.has(type)) {
      warnings.push(`动作 "${type || "(空)"}" 不被支持，已丢弃`);
      continue;
    }
    if (s.actor !== undefined && !refSet.has(String(s.actor))) {
      warnings.push(`动作 ${type} 的 actor "${s.actor}" 不存在，已丢弃`);
      continue;
    }
    if (s.target !== undefined && String(s.target) !== "near_player" && !refSet.has(String(s.target))) {
      warnings.push(`动作 ${type} 的 target "${s.target}" 不存在，已丢弃`);
      continue;
    }
    // spawn 必须指向已声明 entity
    if (type === "spawn") {
      const uid = String(s.uid || "");
      if (!seenUid.has(uid)) {
        warnings.push(`spawn 引用了未声明的 uid "${uid}"，已丢弃`);
        continue;
      }
      timeline.push({ type, uid });
      continue;
    }
    const step = { type };
    if (s.actor !== undefined) step.actor = String(s.actor);
    if (s.target !== undefined) step.target = String(s.target);
    if (type === "say") {
      step.text = String(s.text || "").slice(0, 80);
      if (!step.text) {
        warnings.push("say 缺少 text，已丢弃");
        continue;
      }
    } else if (type === "toast") {
      step.text = String(s.text || "").slice(0, 60);
      if (!step.text) {
        warnings.push("toast 缺少 text，已丢弃");
        continue;
      }
    } else if (type === "wait") {
      const sec = Number(s.seconds);
      step.seconds = Number.isFinite(sec) ? Math.min(Math.max(sec, 0), 20) : 1;
    } else if (type === "focusCamera") {
      const sec = Number(s.seconds);
      step.seconds = Number.isFinite(sec) ? Math.min(Math.max(sec, 0.2), 10) : 1.5;
    } else if (type === "moveTo") {
      const sp = Number(s.speed);
      step.speed = Number.isFinite(sp) ? Math.min(Math.max(sp, 0.3), 12) : 2.2;
      if (!step.target) {
        warnings.push("moveTo 缺少 target，已丢弃");
        continue;
      }
    } else if (type === "weather") {
      const v = String(s.value || "clear");
      if (!(v in WEATHER_VALUE)) {
        warnings.push(`weather 值 "${v}" 非法，已丢弃`);
        continue;
      }
      step.value = v;
    }
    timeline.push(step);
  }

  return {
    title: String(spec.title || "未命名故事板").slice(0, 40),
    entities,
    timeline,
    warnings,
  };
}

/**
 * 创建故事板引擎。
 * @param {object} deps
 * @param {THREE.Scene} deps.scene
 * @param {{ position: THREE.Vector3 }} deps.player
 * @param {number} deps.planetRadius
 * @param {{ position: THREE.Vector3, radius: number }[]} [deps.colliders] 主循环用的 assetColliders
 * @param {THREE.Camera} [deps.camera] 气泡世界→屏幕投影用
 * @param {{ setDist:(d:number)=>void, getDist:()=>number }} [deps.cameraRig] focusCamera 用
 */
export function createStoryEngine({ scene, player, planetRadius, colliders, camera, cameraRig }) {
  let group = null;
  let spec = null;
  let queue = [];
  let waitT = 0;
  /** uid -> Object3D[]（count>1 时多实例） */
  const spawned = new Map();
  /** 本次故事板推入 colliders 的条目，dispose 时精确回收 */
  const myColliders = [];
  /** 进行中的 moveTo */
  let moving = null;
  /** 气泡状态 */
  let bubble = { text: "", obj: null, timer: 0 };
  /** focusCamera 前的相机距离，用于还原 */
  let camRestore = null;
  let camTimer = 0;

  /** 玩家所在切平面基（球面法线 + 两个切向） */
  function playerBasis() {
    const up = player.position.clone().normalize();
    if (up.lengthSq() < 1e-8) up.set(0, 1, 0);
    _tan.set(0, 1, 0).cross(up);
    if (_tan.lengthSq() < 1e-8) _tan.set(1, 0, 0);
    _tan.normalize();
    const side = new THREE.Vector3().crossVectors(up, _tan).normalize();
    return { up, fwd: _tan.clone(), side };
  }

  /** 在玩家附近沿螺旋摆放，避免叠在一起 */
  function placeNearPlayer(object, index) {
    const { up, fwd, side } = playerBasis();
    const angle = index * 2.4;
    const radius = 2.5 + index * 1.1;
    const baseR = player.position.length() || planetRadius;
    object.position
      .copy(up)
      .multiplyScalar(baseR)
      .addScaledVector(fwd, Math.cos(angle) * radius)
      .addScaledVector(side, Math.sin(angle) * radius);
    // 贴回球面（半径按玩家所在高度，避免埋进地形或悬空）
    object.position.setLength(baseR);
    // 局部 +Y 对齐球面外法线
    _look.copy(object.position).normalize();
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _look);
    return object;
  }

  function spawnEntity(entity) {
    if (spawned.has(entity.uid)) return spawned.get(entity.uid);
    const list = [];
    for (let i = 0; i < entity.count; i++) {
      // 资产工厂可能因环境缺失（如 2D canvas）抛错：静默跳过，不能崩掉整局游戏
      let object = null;
      try {
        object = createCatalogObject(entity.type, {});
      } catch (err) {
        console.warn(`[story] 资产 ${entity.type} 创建失败，已跳过：`, err?.message || err);
        break;
      }
      if (!object) continue;
      placeNearPlayer(object, spawned.size * 3 + i);
      object.userData.storyUid = entity.uid;
      group.add(object);
      // 推入主循环碰撞体，保持球面物理一致
      const r = object.userData.collideRadius;
      if (colliders && Number.isFinite(r) && r > 0) {
        // __obj 只在本引擎内部使用：moveTo 时按对象反查并同步碰撞体位置
        const c = { position: object.position.clone(), radius: r, __obj: object };
        colliders.push(c);
        myColliders.push(c);
      }
      list.push(object);
    }
    if (list.length) spawned.set(entity.uid, list);
    return list;
  }

  /** actor/target 字符串 → 世界位置（找不到返回 null） */
  function resolvePosition(ref) {
    if (!ref) return null;
    if (ref === "near_player" || ref === "player" || ref === "messenger") {
      return player.position.clone();
    }
    const list = spawned.get(ref);
    if (list?.length) return list[0].position.clone();
    return null;
  }

  /** actor 字符串 → 可挂气泡的对象（player 用玩家位置代理） */
  function resolveActorObject(ref) {
    if (ref === "player" || ref === "messenger") return { position: player.position };
    const list = spawned.get(ref);
    return list?.length ? list[0] : null;
  }

  /** 执行一步；返回 true 表示需要等待（不立即取下一步） */
  function runStep(step) {
    switch (step.type) {
      case "spawn": {
        const ent = spec.entities.find((e) => e.uid === step.uid);
        if (ent) spawnEntity(ent);
        return false;
      }
      case "say": {
        const obj = resolveActorObject(step.actor);
        if (!obj) return false;
        bubble = { text: step.text, obj, timer: LIMITS.bubbleSec };
        waitT = LIMITS.bubbleSec;
        return true;
      }
      case "toast":
        showToast(step.text, 2.5);
        return false;
      case "wait":
        waitT = step.seconds;
        return true;
      case "moveTo": {
        const list = spawned.get(step.actor);
        const target = resolvePosition(step.target);
        if (!list?.length || !target) return false;
        moving = { obj: list[0], target, speed: step.speed };
        return true;
      }
      case "focusCamera": {
        const pos = resolvePosition(step.target);
        if (!pos || !cameraRig) return false;
        if (camRestore === null && cameraRig.getDist) camRestore = cameraRig.getDist();
        // 用距离拉近表达「特写」，不夺走玩家相机控制权
        const d = pos.distanceTo(player.position);
        cameraRig.setDist?.(Math.min(Math.max(d * 0.8, 5), 20));
        camTimer = step.seconds;
        waitT = step.seconds;
        return true;
      }
      case "weather": {
        P.weather = WEATHER_VALUE[step.value] ?? 0;
        saveParams();
        return false;
      }
      default:
        return false;
    }
  }

  function updateBubble() {
    if (bubble.timer <= 0 || !bubble.text || !bubble.obj || !camera) {
      if (bubble.text) {
        hideBubble();
        bubble = { text: "", obj: null, timer: 0 };
      }
      return;
    }
    // 与 foxNpc.js 同一手法：世界坐标沿外法线抬高后投影到屏幕
    _bubble.copy(bubble.obj.position);
    _look.copy(bubble.obj.position).normalize();
    _bubble.addScaledVector(_look, 1.4);
    _bubble.project(camera);
    if (_bubble.z < 1) {
      showBubble(
        bubble.text,
        (_bubble.x * 0.5 + 0.5) * window.innerWidth,
        (-_bubble.y * 0.5 + 0.5) * window.innerHeight
      );
    } else {
      hideBubble();
    }
  }

  function updateMoving(dt) {
    if (!moving) return;
    const { obj, target, speed } = moving;
    _tmp.copy(target).sub(obj.position);
    const dist = _tmp.length();
    if (dist < 0.35) {
      moving = null;
      return;
    }
    const step = Math.min(dist, speed * dt);
    obj.position.addScaledVector(_tmp.normalize(), step);
    // 贴回球面并重新对齐法线
    obj.position.setLength(target.length() || planetRadius);
    _look.copy(obj.position).normalize();
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _look);
    // 同步该实例的碰撞体
    const c = myColliders.find((x) => x.__obj === obj);
    if (c) c.position.copy(obj.position);
  }

  return {
    /** 从原始 spec 校验 → 生成场景 → 开始播放；返回校验后的 spec */
    play(rawSpec) {
      this.dispose();
      spec = validateSpec(rawSpec);
      group = new THREE.Group();
      group.name = `story:${spec.title}`;
      scene.add(group);
      queue = [...spec.timeline];
      waitT = 0;
      if (spec.warnings.length) {
        console.warn("[story] 已丢弃非法条目：", spec.warnings);
      }
      // 时间线里没写 spawn 时，兜底把所有 entity 直接摆出来
      if (!spec.timeline.some((s) => s.type === "spawn")) {
        for (const e of spec.entities) spawnEntity(e);
      }
      showToast(`故事板「${spec.title}」生成中…`, 2);
      return spec;
    },

    update(dt) {
      if (!group) return;
      updateBubble();
      updateMoving(dt);

      if (bubble.timer > 0) bubble.timer -= dt;
      if (camTimer > 0) {
        camTimer -= dt;
        if (camTimer <= 0 && camRestore !== null) {
          cameraRig?.setDist?.(camRestore);
          camRestore = null;
        }
      }

      if (waitT > 0) {
        waitT -= dt;
        return;
      }
      if (moving) return; // 移动未完成，先不推进
      if (!queue.length) return;
      // 一帧内连续消费所有「瞬时」步骤，遇到需要等待的就停
      for (let guard = 0; guard < 20 && queue.length; guard++) {
        const step = queue.shift();
        if (runStep(step)) break;
      }
    },

    /** 当前是否有故事板在运行 */
    isActive: () => !!group,
    /** 校验后的 spec（供 UI 展示 warnings） */
    getSpec: () => spec,

    dispose() {
      if (group) {
        scene.remove(group);
        group.traverse((o) => {
          o.geometry?.dispose?.();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
          else m?.dispose?.();
        });
      }
      // 精确回收本次推入的碰撞体，避免残留隐形墙
      if (colliders && myColliders.length) {
        for (const c of myColliders) {
          const i = colliders.indexOf(c);
          if (i >= 0) colliders.splice(i, 1);
        }
      }
      myColliders.length = 0;
      if (camRestore !== null) {
        cameraRig?.setDist?.(camRestore);
        camRestore = null;
      }
      camTimer = 0;
      if (bubble.text) hideBubble();
      bubble = { text: "", obj: null, timer: 0 };
      moving = null;
      group = null;
      spec = null;
      queue = [];
      waitT = 0;
      spawned.clear();
    },
  };
}
