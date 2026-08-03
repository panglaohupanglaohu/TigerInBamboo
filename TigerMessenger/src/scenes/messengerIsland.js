// =====================================================================
//  场景：信使主岛（可玩关卡）
//  - 球面平台 / 土坡 / 云环
//  - 游玩区 + 远侧自然点缀
//  - 月牙湖 + 湖畔老旧修船厂码头 + 背侧大湖
//  不包含西芳寺景观（见 saihojiGarden.js）
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "../world/planet.js";
import { P } from "../core/params.js";
import { buildWorld, updatePlatformPulse } from "../world/platforms.js";
import { buildHills } from "../world/hills.js";
import { decorateFarSide, decoratePlayZone, createCloudRing } from "../world/nature.js";
import {
  createGreatLake,
  createMoonLake,
  updateGreatLakeWade,
  HARBOR,
} from "../world/lake.js";
import { buildChristchurchTramSystem } from "../world/tramSystem.js";
import { buildMoebiusCrystalMetropolis, GRAND_CRYSTAL } from "../world/moebiusCity.js";
import { isCanyonBgmPlaying, isCanyonBgmFinishing } from "../audio/sfx.js";
import { canyonOffsetDir, CANYON } from "../world/canyon.js";
import { updateClouds } from "../assets/lowPoly.js";
import { buildStartingCamp } from "../world/startingCamp.js";
import { groundLiftAt } from "../world/hills.js";
import { placeObjectOnSphere, latLonToDir, flatXZToLatLon } from "../world/sphereMath.js";
import { createGrassTuft } from "../assets/bookshop.js";
import { createBookshopHydrangeas } from "../assets/hydrangea.js";
import { createLowPolyFlower, INK_FLOWER_COLORS } from "../assets/lowPoly.js";
import { createCatalogObject } from "../core/buildingCatalog.js";
import { buildOldHarborScene } from "../assets/harbor.js";
import { createMoebiusAirship, placeMoebiusAirshipAbove } from "../assets/moebiusAirship.js";

/** 飞艇锚定用临时向量 */
const _asTmp = new THREE.Vector3();

/** @type {import("./sceneApi.js").SceneModule} */
export const messengerIslandScene = {
  id: "messenger",
  name: "信使主岛",
  description: "送信玩法关卡：平台、土坡、月牙湖码头、背侧大湖、植被与云环",

  load(ctx) {
    const scene = ctx.scene;
    const R = ctx.planetRadius ?? PLANET_RADIUS;

    const platforms = buildWorld(scene);
    const hills = buildHills(scene, R);
    const clouds = createCloudRing(scene, R);
    const playZone = decoratePlayZone(scene, R);
    // 出生点场景（彻底重构）：海岛悬崖瀑布营地
    // 多层海岸 / 左侧荒山山洞 / 崖壁叠瀑 / 太空水环 / 弹琴老人
    const camp = buildStartingCamp(scene, R);
    const farSide = decorateFarSide(scene, R);
    // 月牙湖（主岛动线交汇）
    const moonLake = createMoonLake(scene, R);
    const greatLake = createGreatLake(scene, R);

    // ---------- 月牙湖旁 · 老旧修船厂码头（坐标与电车避障 HARBOR 共用） ----------
    const harborBuilt = buildOldHarborScene({ seed: 8844 });
    const harbor = harborBuilt.group;
    const harborX = HARBOR.x;
    const harborZ = HARBOR.z;
    const harborLift = groundLiftAt(harborX, harborZ);
    placeObjectOnSphere(harbor, harborX, harborZ, harborLift, R);
    harbor.rotateY(HARBOR.yaw);
    scene.add(harbor);
    harbor.updateMatrixWorld(true);
    const _wp = new THREE.Vector3();
    const harborColliders = [
      { position: harbor.position.clone(), radius: 3.8 },
      {
        position: harborBuilt.landmarks.crane.getWorldPosition(_wp.clone()),
        radius: 1.15,
      },
      {
        position: harborBuilt.landmarks.boat.getWorldPosition(_wp.clone()),
        radius: 1.45,
      },
    ];

    // 基督城有轨电车：北岛环线 + 跨赤道绕莫比斯主晶塔
    // 能量束目标：中央母体晶皇塔顶
    const grandDir = latLonToDir(
      GRAND_CRYSTAL.lat,
      GRAND_CRYSTAL.lon,
      new THREE.Vector3()
    );
    const grandTopTarget = grandDir
      .clone()
      .multiplyScalar(R + canyonOffsetDir(grandDir) + GRAND_CRYSTAL.h * 0.96);
    const tramSystem = buildChristchurchTramSystem(scene, R, {
      beamTarget: grandTopTarget,
    });

    // 莫比斯水晶大都会（南半球千座晶林，让开轨道走廊）
    const moebius = buildMoebiusCrystalMetropolis(scene, R, { trackCurve: tramSystem.curve });

    // Hard To Find Bookshop：与地图共用 createCatalogObject（同一工厂/参数）
    const bookshopX = 11.5;
    const bookshopZ = 5.5;
    const bookshopLift = groundLiftAt(bookshopX, bookshopZ);
    const bookshop = createCatalogObject("bookshop", {
      signLine1: "HARD TO FIND",
      signLine2: "BOOKSHOP",
    });
    // 稳定 uid：地图存档跨次加载可对齐，不必依赖初始化坐标
    bookshop.userData.mapUid = "world-bookshop";
    // 底部原点 = 球面 R+lift（与 mapEditor.applyPose 同序：place + rotateY）
    placeObjectOnSphere(bookshop, bookshopX, bookshopZ, bookshopLift, R);
    bookshop.rotateY(-0.5); // 立面朝向街道
    // 绣球花丛围绕书店（程序布局；单丛仍可用地图放置 hydrangea）
    bookshop.add(createBookshopHydrangeas());
    scene.add(bookshop);

    // 莫比斯湖沼：请用地图编辑器放置「莫比斯湖沼」(moebiusSwamp)
    // createMoebiusSwampPlacement / createCatalogObject("moebiusSwamp")

    // ---------- 莫比斯蒸汽航空艇：悬停在湖沼正上方 ----------
    const airship = createMoebiusAirship();
    airship.scale.setScalar(1.25);
    scene.add(airship);
    // 初始兜底锚点：湖沼默认方位（书店→水晶城中点再偏向书店 25%）
    {
      const { lat, lon } = flatXZToLatLon(bookshopX, bookshopZ, R);
      const bookDir = latLonToDir(lat, lon, new THREE.Vector3());
      const cityDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
      const mid = bookDir.clone().add(cityDir);
      if (mid.lengthSq() > 1e-8) mid.normalize();
      else mid.copy(cityDir);
      const dir = bookDir.lerp(mid, 0.25).normalize();
      placeMoebiusAirshipAbove(airship, dir, R, 20);
    }
    // 湖沼懒查找锚定状态（地图编辑器放置/移动后飞艇跟随）
    const airshipAnchor = { swamp: null, lastPos: new THREE.Vector3(), locked: false };

    // 坡下草地：草簇 + 小花环带（围绕书店山坡）
    {
      let s = 41;
      const rnd = () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0x100000000;
      };
      for (let i = 0; i < 16; i++) {
        const a = rnd() * Math.PI * 2;
        const d = 2.4 + rnd() * 2.2; // 坡腰到坡脚
        const x = bookshopX + Math.cos(a) * d;
        const z = bookshopZ + Math.sin(a) * d;
        const tuft = createGrassTuft();
        placeObjectOnSphere(tuft, x, z, groundLiftAt(x, z) + 0.01, R);
        tuft.rotateY(rnd() * Math.PI * 2);
        scene.add(tuft);
      }
      for (let i = 0; i < 7; i++) {
        const a = rnd() * Math.PI * 2;
        const d = 2.8 + rnd() * 2.0;
        const x = bookshopX + Math.cos(a) * d;
        const z = bookshopZ + Math.sin(a) * d;
        const flower = createLowPolyFlower(
          INK_FLOWER_COLORS[(rnd() * INK_FLOWER_COLORS.length) | 0]
        );
        placeObjectOnSphere(flower, x, z, groundLiftAt(x, z) + 0.01, R);
        scene.add(flower);
      }
    }

    const colliders = [
      ...playZone.colliders,
      ...camp.colliders,
      ...farSide.colliders,
      ...harborColliders,
      { position: bookshop.position.clone(), radius: bookshop.userData.collideRadius },
    ];
    if (moonLake?.deepCollider) colliders.push(moonLake.deepCollider);

    return {
      id: "messenger",
      platforms,
      hills,
      clouds,
      greatLake,
      moonLake,
      colliders,
      landmarks: {
        playZone,
        camp,
        farSide,
        bookshop,
        tramSystem,
        harbor,
        oldHarbor: harborBuilt,
        moebius,
        airship, // 莫比斯航空艇（垂绳登艇 · WASD 驾驶）
      },
      update(dt, t, runtime) {
        updatePlatformPulse(platforms, t);
        updateClouds(clouds, dt, t, { speed: P.windSpeed, dirDeg: P.windDir });
        tramSystem.update(dt, runtime?.player?.position);

        // 地图放置的湖沼/飞艇动效（鲸/舟/悬浮艇）
        scene.traverse((o) => {
          const kind = o.userData?.kind;
          if ((kind === "moebius-swamp" || kind === "moebius-airship") && o.userData.update) {
            o.userData.update(dt, t);
          }
        });

        // 飞艇跟随湖沼：找到地图放置的 moebiusSwamp 后锚到其正上方；
        // 地图编辑器移动湖沼时（位置变化）自动重新锚定。
        // 玩家已驾驶过（flown）或正在驾驶（flying）时不再回锚，飞艇归玩家支配。
        if (!airship.userData.flown && !airship.userData.flying) {
          let sw = airshipAnchor.swamp;
          if (!sw || !sw.parent) {
            sw = null;
            scene.traverse((o) => {
              if (!sw && o.userData?.kind === "moebius-swamp") sw = o;
            });
            airshipAnchor.swamp = sw;
            airshipAnchor.locked = false;
          }
          if (sw) {
            _asTmp.copy(sw.position);
            if (!airshipAnchor.locked || airshipAnchor.lastPos.distanceToSquared(_asTmp) > 0.25) {
              airshipAnchor.lastPos.copy(_asTmp);
              placeMoebiusAirshipAbove(airship, _asTmp.normalize(), R, 20, airship.userData.yaw ?? 0.7);
              airshipAnchor.locked = true;
            }
          }
        }

        // 鸟群：花厅巡航；电车驶出水晶城 → 送别伴飞（红车优先，不依赖是否乘车）
        {
          const bgmHold = isCanyonBgmPlaying() || isCanyonBgmFinishing();
          const escortTram =
            tramSystem.getFarewellEscortTram?.({ bgmHold }) || null;
          moebius.update?.(dt, t, { escortTram });
        }

        const player = runtime?.player;
        if (player) {
          // 先重置，再由大湖写 factor
          player.wadeFactor = 1;
          updateGreatLakeWade(player, greatLake);
        }
      },
      debug: { playZone, camp, farSide, harbor },
    };
  },
};
