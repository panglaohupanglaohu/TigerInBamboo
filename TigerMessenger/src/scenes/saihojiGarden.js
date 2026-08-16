// =====================================================================
//  场景：西芳寺（苔寺）景观 —— 太古巨型浮岛白鲸脊背上的苔海六景
//  - 六座苔海石庭整座扎根、承托在天空缓缓漂移的巨鲸脊背上
//  - 鲸体：非等比拉伸山岳躯干 + 背部横向切平墨绿苔原地壳
//    + 斜向上 35° 微翘的巨型 Y 字尾鳍（assets/leviathanIsland.js）
//  - 入口苔径 / 主石 / 枯瀑 / 岛群 / 空庭 / 回望 全部随鲸呼吸起伏
//  构建逻辑在 world/saihoji.js + assets/leviathanIsland.js。
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "../world/planet.js";
import { buildSaihojiPlanet, SAIHOJI_HUB, SAIHOJI_ZONES, latLonToGardenDir } from "../world/saihoji.js";
import {
  buildEcoLeviathanIsland,
  LEVIATHAN_PLATE_Y,
  LEVIATHAN_GARDEN_SCALE,
} from "../assets/leviathanIsland.js";

/** 鲸体栖息高度：地壳板（背脊）悬停在球面 +24 上方，鲸腹不压苔丘 */
const WHALE_LIFT = 24;

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

    // ---------- 太古浮岛白鲸：栖于苔庭中枢上方，承载整座苔庭 ----------
    const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
    const hubEast = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();
    const leviathan = buildEcoLeviathanIsland({
      basePos: hubDir.clone().multiplyScalar(R + WHALE_LIFT),
      up: hubDir,
      forward: hubEast,
    });
    const leviathanGroup = leviathan.group;
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
      off.y += sag * S + LEVIATHAN_PLATE_Y + 0.05;
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
    leviathanGroup.add(garden);

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
      },
      update(dt, t) {
        leviathan.update(dt, t);
      },
      dispose() {
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
