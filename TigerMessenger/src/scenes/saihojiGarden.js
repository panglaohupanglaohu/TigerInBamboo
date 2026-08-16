// =====================================================================
//  场景：西芳寺（苔寺）景观 —— 太古巨型浮岛白鲸脊背上的苔海六景
//  - 六座苔海石庭整座扎根、承托在巨鲸脊背的墨绿苔原地壳上
//  - 平时巨鲸藏在地下（鲸身全沉、只见苔庭落在地表）；
//    扫描灯艇（莫比斯航空艇编队）掠过苔庭上空时才升空，
//    尾鳍随升空扬起 35°，随灯艇远去再缓缓藏回地下
//  - 鲸体：非等比拉伸山岳躯干 + 背部横向切平 + 巨型 Y 字尾鳍
//    （assets/leviathanIsland.js）；入口苔径/主石/枯瀑/岛群/空庭/回望
//    全部随鲸呼吸起伏
//  构建逻辑在 world/saihoji.js + assets/leviathanIsland.js。
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "../world/planet.js";
import { buildSaihojiPlanet, SAIHOJI_HUB, SAIHOJI_ZONES, latLonToGardenDir } from "../world/saihoji.js";
import {
  buildEcoLeviathanIsland,
  LEVIATHAN_GARDEN_SCALE,
} from "../assets/leviathanIsland.js";

/** 鲸体升空锚点：地壳板（背脊）悬停在球面 +24 上方，鲸腹不压苔丘 */
const WHALE_LIFT = 24;
/** 藏地锚点：鲸身整头沉入地下（背顶 = 锚点 +6 ≤ R−7），只见苔庭 */
const WHALE_BURIED_DEPTH = 13;
/** 藏地时苔庭岛留驻的地表高度（球面 +0.3） */
const PLATE_GROUND_LIFT = 0.3;
/** 扫描灯艇接近半径：进入则升空；退出须超出降藏半径（迟滞防抖） */
const RISE_RADIUS = 60;
const SINK_RADIUS = 70;

/** @type {import("./sceneApi.js").SceneModule} */
export const saihojiGardenScene = {
  id: "saihoji",
  name: "西芳寺 · 苔寺",
  description: "西芳寺苔海六景：整座庭园扎根太古浮岛白鲸，随鲸呼吸遨游天空",

  load(ctx) {
    const scene = ctx.scene;
    const R = ctx.planetRadius ?? PLANET_RADIUS;
    const opt = ctx.options || {};

    const built = buildSaihojiPlanet(scene, {
      planet: ctx.planet ?? null,
      radius: R,
      seed: opt.seed ?? 884,
      // 默认略降密度，避免同屏过重；可用 options 拉高
      mossCount: opt.mossCount ?? 120,
      rockCount: opt.rockCount ?? 28,
    });

    // ---------- 太古浮岛白鲸：栖于苔庭中枢，平时藏地、扫描灯艇掠过时升空 ----------
    const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
    const hubEast = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();
    const buriedR = R - WHALE_BURIED_DEPTH; // 鲸身全沉地下
    const risenR = R + WHALE_LIFT;
    const leviathan = buildEcoLeviathanIsland({
      basePos: hubDir.clone().multiplyScalar(buriedR),
      up: hubDir,
      forward: hubEast,
      minR: buriedR,
      maxR: risenR,
      plateWorldLift: R + PLATE_GROUND_LIFT,
    });
    const leviathanGroup = leviathan.group;
    const islandGroup = leviathan.island;
    scene.add(leviathanGroup);

    // 苔庭整组移上鲸背：把「球面苔庭」仿射变换进鲸体局部系——
    //   whaleLocal = Q⁻¹ · (p − hub·R) · S + (0, PLATE_Y, 0)
    // 六景组原点在 (0,0,0)（合并网格持有绝对坐标），按组整体套仿射；
    // 再按景区中心补回球面下陷 S·tan²/2R，使边缘石组/松树不陷进地壳板。
    const garden = built.group;
    scene.remove(garden);
    const invQ = leviathanGroup.quaternion.clone().invert();
    const S = LEVIATHAN_GARDEN_SCALE;
    const hubR = hubDir.clone().multiplyScalar(R);
    // 六景足迹质心（苔庭中枢偏在六景西缘）：按质心平移到地壳板中心，
    // 否则枯瀑/苔海岛群会悬在板外、西半板空置。
    const centroidEast = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), hubDir)
      .normalize();
    const centroidNorth = new THREE.Vector3().crossVectors(hubDir, centroidEast).normalize();
    let centroidX = 0;
    let centroidZ = 0;
    for (const zone of SAIHOJI_ZONES) {
      const d = latLonToGardenDir(zone.lat, zone.lon, new THREE.Vector3());
      centroidX += d.dot(centroidEast) * R;
      centroidZ += d.dot(centroidNorth) * R;
    }
    centroidX /= SAIHOJI_ZONES.length;
    centroidZ /= SAIHOJI_ZONES.length;
    // 鲸体局部 Z = east×up = −north（右手基）：北向分量映射时取反，
    // 因此 Z 向质心平移取 +S·centroid（X 向 = east 取 −S·centroid）。
    const shiftX = -S * centroidX;
    const shiftZ = +S * centroidZ;
    const zoneByName = new Map((built.landmarks.zones
      ? Object.values(built.landmarks.zones).map((z) => [z.definition?.name, z.definition])
      : []).filter(([, d]) => !!d));
    const sagAt = (worldPos) => {
      const proj = worldPos.dot(hubDir);
      return Math.max(0, worldPos.lengthSq() - proj * proj) / (2 * R);
    };
    for (const child of garden.children.slice()) {
      const p0 = child.position.clone();
      const q0 = child.quaternion.clone();
      // 六景组：按景区中心算下陷；其余（参道步级）：按自身世界位算
      const zoneDef = zoneByName.get(child.name?.replace(/^Saihoji:/, ""));
      const sag = zoneDef
        ? sagAt(latLonToGardenDir(zoneDef.lat, zoneDef.lon, new THREE.Vector3()).multiplyScalar(R))
        : sagAt(p0);
      const off = p0
        .clone()
        .sub(hubR)
        .multiplyScalar(S)
        .applyQuaternion(invQ);
      off.x += shiftX;
      off.z += shiftZ;
      off.y += sag * S + 0.05; // 相对岛面原点（islandGroup 局部 y=0 即板面）
      child.position.copy(off);
      child.quaternion.copy(invQ).multiply(q0);
      child.scale.multiplyScalar(S);
    }
    // 残余下陷逐株补偿：景区中心 sag 只在中心精确；松树/石组各自
    // 按自身球面位置补 (sag(p) − sag(center))，沿鲸背法向抬高——
    // 远端古松不得陷进地壳板。
    for (const zone of Object.values(built.landmarks.zones)) {
      const center = latLonToGardenDir(
        zone.definition.lat,
        zone.definition.lon,
        new THREE.Vector3()
      ).multiplyScalar(R);
      const sagC = sagAt(center);
      for (const obj of [...(zone.pines || []), ...(zone.stones || [])]) {
        const delta = sagAt(obj.position) - sagC;
        if (Math.abs(delta) > 1e-4) obj.position.addScaledVector(hubDir, delta);
      }
    }
    islandGroup.add(garden);

    // ---------- 扫描吸食感：松树波动 + 树叶螺旋升空被吸进灯艇 ----------
    // 扫描灯艇掠近时（同升空触发圈），古松按强度左右摇摆；
    // 树叶从树冠脱离、沿螺旋弧线飞向编队中心（扫描激光吸食语汇，
    // 与湖沼蜂鸟吸蜜同源）。灯艇远去后残叶快速消散。
    const pines = [];
    for (const zone of Object.values(built.landmarks.zones)) {
      for (const pine of zone.pines || []) {
        pine.userData._swayBase = pine.quaternion.clone();
        pines.push(pine);
      }
    }
    const leafRnd = (() => {
      let s = 9901 >>> 0;
      return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    })();
    const LEAF_COUNT = 44;
    const leafGroup = new THREE.Group();
    leafGroup.name = "saihoji-scan-leaves";
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 0.17, 0, 0.06, -0.05, 0, 0.15], 3)
    );
    leafGeo.setIndex([0, 1, 2]);
    leafGeo.computeVertexNormals();
    const leafMats = [0x3e8e52, 0x54a05a, 0x2e7d32, 0x6fae74].map(
      (c) =>
        new THREE.MeshBasicMaterial({
          color: c,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        })
    );
    const leafPool = [];
    for (let i = 0; i < LEAF_COUNT; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMats[i % leafMats.length]);
      leaf.visible = false;
      leaf.userData = {
        life: 0,
        dur: 2.0 + leafRnd() * 0.8,
        start: new THREE.Vector3(),
        phase: leafRnd() * Math.PI * 2,
        radius: 1.2 + leafRnd() * 1.8,
      };
      leafGroup.add(leaf);
      leafPool.push(leaf);
    }
    scene.add(leafGroup);

    // ---------- 藏地/升空状态机：扫描灯艇（莫比斯航空艇编队）掠过才升空 ----------
    let currentR = buriedR;
    let squad = null;
    const squadPos = new THREE.Vector3();
    const hubGround = hubDir.clone().multiplyScalar(R);
    const _toTarget = new THREE.Vector3();
    const _leafUp = new THREE.Vector3();
    const _leafSide = new THREE.Vector3();
    let scanSmooth = 0;
    let leafTimer = 0;
    let leafCursor = 0;
    const leafSpawn = () => {
      const pine = pines[(leafRnd() * pines.length) | 0] || null;
      const leaf = leafPool[leafCursor];
      leafCursor = (leafCursor + 1) % leafPool.length;
      if (!leaf) return;
      if (pine) {
        pine.updateWorldMatrix(true, false);
        pine.getWorldPosition(_leafUp);
        const h =
          (Number.isFinite(pine.userData?.height) ? pine.userData.height : 8) *
          (pine.userData?.pineScale ?? 1) *
          LEVIATHAN_GARDEN_SCALE *
          0.6;
        _leafUp.addScaledVector(hubDir, h + leafRnd() * 1.2);
      } else {
        _leafUp.copy(hubGround).addScaledVector(hubDir, 3 + leafRnd() * 4);
      }
      leaf.userData.start.copy(_leafUp);
      leaf.userData.life = 0;
      leaf.userData.dur = 2.0 + leafRnd() * 0.8;
      leaf.userData.phase = leafRnd() * Math.PI * 2;
      leaf.userData.radius = 1.2 + leafRnd() * 1.8;
      leaf.position.copy(_leafUp);
      leaf.scale.setScalar(0.5 + leafRnd() * 0.5);
      leaf.visible = true;
    };
    const updateLeaves = (dt, strength) => {
      for (const leaf of leafPool) {
        if (!leaf.visible) continue;
        const u = leaf.userData;
        // 灯艇远去：残叶快速消散
        u.life += dt * (strength > 0.02 ? 1 : 3);
        const e = Math.min(1, u.life / u.dur);
        if (e >= 1) {
          leaf.visible = false;
          continue;
        }
        const ee = e * e * (3 - 2 * e);
        _toTarget.copy(squadPos).sub(u.start);
        const dist = _toTarget.length();
        if (dist > 1e-4) _toTarget.multiplyScalar(1 / dist);
        _leafUp.copy(u.start).normalize();
        _leafSide.crossVectors(_leafUp, _toTarget);
        if (_leafSide.lengthSq() < 1e-8) _leafSide.set(1, 0, 0).addScaledVector(_leafUp, -_leafUp.x);
        _leafSide.normalize();
        leaf.position
          .copy(u.start)
          .addScaledVector(_toTarget, dist * ee)
          .addScaledVector(_leafSide, Math.sin(ee * Math.PI * 2.6 + u.phase) * u.radius * (1 - ee))
          .addScaledVector(_leafUp, Math.sin(ee * Math.PI) * 5.5);
        leaf.rotation.y += dt * 6.5;
        const s = (1 - ee) * (0.9 + (u.phase % 1) * 0.4) + 0.05;
        leaf.scale.setScalar(s);
      }
    };
    const update = (dt, t) => {
      const step = Math.min(1, Number(dt) || 0.016);
      if (!squad) squad = scene.getObjectByName("moebius-aircraft-squad") || null;
      let target = null;
      let scanDist = Infinity;
      if (squad) {
        // 编队组自身不动，成员逐帧摆到 formationCenter：
        // 读 _patrolCenter（updateAircraftHover 每帧刷新）为编队实时位置
        const center = squad.userData?._patrolCenter;
        if (center) squadPos.copy(center);
        else squad.getWorldPosition(squadPos);
        scanDist = squadPos.distanceTo(hubGround);
        if (scanDist < RISE_RADIUS) target = risenR; // 扫描灯艇接近 → 升空
        else if (scanDist > SINK_RADIUS) target = buriedR; // 远去 → 藏回地下
      } else {
        target = buriedR; // 无扫描灯艇的独立场景：永远藏地
      }
      if (target != null) {
        const k = 1 - Math.exp(-step * 0.22); // ~8s 的庄严升降
        currentR += (target - currentR) * k;
        if (Math.abs(target - currentR) < 0.02) currentR = target;
        leviathan.setAnchorRadius(currentR);
      }
      leviathan.update(dt, t);

      // ---- 扫描吸食感 ----
      const strength = Number.isFinite(scanDist)
        ? THREE.MathUtils.clamp(1 - scanDist / RISE_RADIUS, 0, 1)
        : 0;
      scanSmooth += (strength - scanSmooth) * Math.min(1, step * 2.2);
      if (scanSmooth > 0.008) {
        const tNow = Number(t) || 0;
        for (let i = 0; i < pines.length; i++) {
          const pine = pines[i];
          const base = pine.userData._swayBase;
          if (!base) continue;
          const a = Math.sin(tNow * 2.1 + i * 1.7) * 0.055 * scanSmooth;
          const b = Math.sin(tNow * 0.83 + i * 0.9) * 0.035 * scanSmooth;
          pine.quaternion.copy(base);
          pine.rotateX(a);
          pine.rotateZ(b);
        }
        // 岛面高于灯艇时不吸叶（鲸已升到灯艇上方，吸食方向会反向）
        const islandTopR = currentR + islandGroup.position.y;
        if (islandTopR < squadPos.length() + 6) {
          leafTimer -= step;
          while (leafTimer <= 0) {
            leafSpawn();
            leafTimer += 0.11 / Math.max(0.4, scanSmooth);
          }
        }
      } else if (scanSmooth > 0.001) {
        scanSmooth = 0;
      }
      updateLeaves(step, scanSmooth);
    };
    update(0, 0);

    return {
      id: "saihoji",
      group: leviathanGroup,
      // 苔庭已升空：地面碰撞剔除（浮岛不可步行，不参与地面寻路）
      colliders: [],
      landmarks: built.landmarks,
      debug: {
        mossCount: built.mossCount,
        placed: built.placed?.length ?? 0,
        onLeviathan: true,
        buriedR,
        risenR,
      },
      isWhaleRisen: () =>
        (currentR - buriedR) / Math.max(1e-3, risenR - buriedR) > 0.55,
      whaleLift01: () =>
        THREE.MathUtils.clamp(
          (currentR - buriedR) / Math.max(1e-3, risenR - buriedR),
          0,
          1
        ),
      update,
      dispose() {
        if (leafGroup.parent) leafGroup.parent.remove(leafGroup);
        leafGroup.traverse((o) => {
          if (o.geometry) o.geometry.dispose?.();
        });
        for (const m of leafMats) m.dispose?.();
        if (leviathanGroup.parent) leviathanGroup.parent.remove(leviathanGroup);
        leviathanGroup.traverse((o) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
            else o.material.dispose?.();
          }
        });
      },
    };
  },
};
