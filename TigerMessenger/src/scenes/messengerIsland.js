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
import { buildHills, carveHillsForTrack } from "../world/hills.js";
import { decorateFarSide, decoratePlayZone, createCloudRing, settleBuriedAssets } from "../world/nature.js";
import {
  createGreatLake,
  createMoonLake,
  updateGreatLakeWade,
  HARBOR,
} from "../world/lake.js";
import { buildChristchurchTramSystem } from "../world/tramSystem.js";
import { buildMoebiusCrystalMetropolis, GRAND_CRYSTAL } from "../world/moebiusCity.js";
import { isCanyonBgmPlaying, isCanyonBgmFinishing, setSwampBgm } from "../audio/sfx.js";
import { canyonOffsetDir, CANYON } from "../world/canyon.js";
import { FlockManager } from "../world/flock.js";
import { AirshipEscortManager } from "../world/airshipEscort.js";
import { buildImpastoMossyGround } from "../world/mossyGround.js";
import { swampMidwayDir } from "../world/moebiusSwamp.js";
import { SAIHOJI_ZONES } from "../world/saihoji.js";
import { updateClouds } from "../assets/lowPoly.js";
import { buildStartingCamp } from "../world/startingCamp.js";
import {
  createMoebiusAircraftSquad,
  updateAircraftHover,
} from "../assets/moebiusAircraft.js";
import { createBubblePodsAroundFlowerBuildings, updateBubblePodPatrol } from "../assets/bubblePod.js";
import { groundLiftAt } from "../world/hills.js";
import { placeObjectOnSphere, latLonToDir, flatXZToLatLon } from "../world/sphereMath.js";
import { createGrassTuft } from "../assets/bookshop.js";
import { createBookshopHydrangeas } from "../assets/hydrangea.js";
import { createLowPolyFlower, INK_FLOWER_COLORS } from "../assets/lowPoly.js";
import { createCatalogObject } from "../core/buildingCatalog.js";
import { buildOldHarborScene } from "../assets/harbor.js";
import { createMoebiusAirship, placeMoebiusAirshipAbove } from "../assets/moebiusAirship.js";
import { createCitySeaLake } from "../world/citySeaLake.js";

/** 飞艇锚定用临时向量 */
const _asTmp = new THREE.Vector3();

/** 湖沼 BGM 进入判定（局部坐标：坑口半径 34，坑缘 y=0） */
const _swampLocal = new THREE.Vector3();
const SWAMP_BGM_ENTER_R = 33; // 进入判定半径（略收口，跨过坑缘才算进）
const SWAMP_BGM_EXIT_R = 37; // 离开判定半径（滞回，防坑缘抖动反复切歌）
const SWAMP_BGM_CEILING = 28; // 高于此局部高度视为飞越树冠，不算进入
let swampBgmInside = false;

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

    // 轨道走廊压平丘陵：轨道在岛面平铺不爬山，走廊上山体高于轨面会穿轨/穿车体
    carveHillsForTrack(hills.mesh, [tramSystem.curve, ...Object.values(tramSystem.curves || {})], R);

    // 营地花草不得长在电车轨道上：贴近车道采样点的花直接修剪
    {
      const trackPts = [tramSystem.curve, ...Object.values(tramSystem.curves || {})].flatMap((c) =>
        c.getPoints(320)
      );
      for (const flower of camp.landmarks.campFlowers || []) {
        if (trackPts.some((p) => p.distanceToSquared(flower.position) < 2.2 * 2.2)) {
          flower.removeFromParent();
        }
      }
    }

    // 莫比斯水晶大都会（南半球千座晶林，让开轨道走廊）
    const moebius = buildMoebiusCrystalMetropolis(scene, R, { trackCurve: tramSystem.curve });

    // 3 艘气泡座舱分别围绕水晶城 3 座含花厅的建筑巡游。
    const bubblePods = createBubblePodsAroundFlowerBuildings(scene, moebius.crystals, { count: 3 });

    // 水晶城旁大型海水湖：培育湖沼水生生物，气泡艇可在此潜行
    const citySeaLake = createCitySeaLake(scene, R, { seed: 5521 });

    // Boids 鸟群：低多边形手绘风群飞，漫游南半球大峡谷高空（35–45 高度带）
    // 三大定律 + 相位差扑翅 + 球心重力锁；晶塔柱体作避障障碍
    const canyonDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
    const flock = new FlockManager(scene, {
      count: 18,
      planetRadius: R,
      centerDir: canyonDir,
      windDir: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), canyonDir).normalize(),
      obstacles: moebius.crystals,
    });

    // 水晶城花厅鸟群：忽聚忽散，环绕在母皇塔花厅楼顶（塔尖上空 8 为家域中心）
    const grandTower = moebius.grand;
    const roofAlt = grandTower.root + grandTower.h - R; // 花厅楼顶海拔（谷心台阶根基 + 塔高）
    const hallFlock = new FlockManager(scene, {
      count: 12,
      planetRadius: R,
      centerDir: grandTower.dir,
      altMin: roofAlt - 2,
      altMax: roofAlt + 18,
      homeRadius: 12,
      homeWeight: 1.3, // 楼顶小空域：收紧家域缰绳
      windDir: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), grandTower.dir).normalize(),
      obstacles: moebius.crystals,
    });

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

    // 水晶城母塔 ↔ 书店：空中搜寻航线（途经湖沼）
    // 目的：像巨大蜂鸟一样发现湖沼水面落花，脱离阵型俯冲悬停吸蜜
    const cityDir = grandDir.clone().normalize();
    const bookshopDir = bookshop.position.clone().normalize();
    const aircraftHeight = 20; // 与莫比斯航空艇 placeMoebiusAirshipAbove(..., 20) 同高
    const aircraftSquad = createMoebiusAircraftSquad(cityDir, R, {
      count: 5,
      height: aircraftHeight,
      radius: 18, // 翼展拉开，像鲸群列阵
      spin: 0.03,
      formation: "v",
      whaleFlight: true,
      patrol: {
        dirA: cityDir,
        dirB: bookshopDir,
        maxSpeed: 1.65, // 与 P.aircraftSpeed 同级，沉重缓行
      },
    });
    scene.add(aircraftSquad);

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

    // 航空艇护航队：异星滑翔长翼鸟（尾流伴飞 · 6–15 环形圆柱结界 · 两级折叠长翼）
    const escort = new AirshipEscortManager(scene, airship, {
      count: 9,
      obstacles: moebius.crystals,
    });

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

    // ---------- 厚涂苔丘草地（Impasto Mossy Knolls）：西芳寺缘 + 湖沼边缘 ----------
    // 安全阻尼：电车铁轨采样点 / 书店大门（minDistance = 4，见 mossyGround.js）
    // flatten = true：苔丘连续地形在走廊内衰减为 0，防 bump 穿轨/穿车体
    const mossAvoidCommon = tramSystem.curve.getPoints(60).map((p) => ({
      position: p,
      radius: 1.2,
      flatten: true,
    }));
    mossAvoidCommon.push({
      position: bookshop.position,
      radius: bookshop.userData.collideRadius || 3,
      flatten: true,
    });
    // ① 西芳寺缘：入口苔径 ↔ 主石之庭 的路线间隙；草丛避开六景石组庭园
    const zoneAvoid = SAIHOJI_ZONES.map((z) => ({
      position: latLonToDir(z.lat, z.lon, new THREE.Vector3()).multiplyScalar(R),
      radius: z.radius + 1,
    }));
    const mossSaihoji = buildImpastoMossyGround({
      dir: latLonToDir(56, -120, new THREE.Vector3()),
      planetRadius: R,
      seed: 9101,
      yaw: 0.6,
      avoidWorld: [...mossAvoidCommon, ...zoneAvoid],
    });
    scene.add(mossSaihoji);
    // ② 湖沼边缘：湖沼默认锚地方向（书店 → 水晶城中点）
    const mossSwamp = buildImpastoMossyGround({
      dir: swampMidwayDir(bookshopX, bookshopZ, R),
      planetRadius: R,
      seed: 7743,
      yaw: 1.9,
      avoidWorld: mossAvoidCommon,
    });
    scene.add(mossSwamp);

    const colliders = [
      ...playZone.colliders,
      ...camp.colliders,
      ...farSide.colliders,
      ...harborColliders,
      { position: bookshop.position.clone(), radius: bookshop.userData.collideRadius },
    ];
    if (moonLake?.deepCollider) colliders.push(moonLake.deepCollider);

    // 安置沉降 pass（全部地形建完后）：被苔丘/土坡/营地埋住的树/石抬回地表，
    // 走廊压平后悬空的岩石落回地面——树木种在草坡上，而不是被埋
    settleBuriedAssets(scene, colliders);

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
        bubblePods, // 围绕水晶城 3 座花厅建筑巡游的气泡座舱
        citySeaLake, // 水晶城旁海水湖 · 湖沼生物培育 · 气泡艇潜行
        airship, // 莫比斯航空艇（垂绳登艇 · WASD 驾驶）
        flock, // Boids 低多边形手绘鸟群（南半球高空）
        hallFlock, // 花厅楼顶 Boids 鸟群（母皇塔尖环绕）
        escort, // 异星滑翔长翼鸟 · 航空艇生态护航队
        aircraftSquad, // 水晶城母塔↔书店低速往返的人字阵飞行器编队（含青柠驾驶舱光源）
        mossSaihoji, // 厚涂苔丘 · 西芳寺缘
        mossSwamp, // 厚涂苔丘 · 湖沼边缘
      },
      update(dt, t, runtime) {
        updatePlatformPulse(platforms, t);
        updateClouds(clouds, dt, t, { speed: P.windSpeed, dirDeg: P.windDir });
        tramSystem.update(dt, runtime?.player?.position);

        // 3 艘气泡座舱分别围绕 3 座花厅建筑巡游
        updateBubblePodPatrol(bubblePods, t);

        // 水晶城海水湖：涟漪 + 培育白鲸/鳗/带鱼
        citySeaLake.update?.(dt, t);

        // 地图放置的湖沼/飞艇动效（鲸/舟/悬浮艇）
        // 必须先于 aircraft：湖沼更新水面落花蜜源列表，供巨蜂鸟寻觅
        scene.traverse((o) => {
          const kind = o.userData?.kind;
          if ((kind === "moebius-swamp" || kind === "moebius-airship") && o.userData.update) {
            o.userData.update(dt, t, runtime);
          }
        });

        // 缓存湖沼根节点（地图放置 wrap）
        let swampRoot = airshipAnchor.swamp;
        if (!swampRoot || !swampRoot.parent) {
          swampRoot = null;
          scene.traverse((o) => {
            if (!swampRoot && o.userData?.kind === "moebius-swamp") swampRoot = o;
          });
          airshipAnchor.swamp = swampRoot;
          airshipAnchor.locked = false;
        }

        // 沿城↔书店航迹扫描近区：有概率发现湖沼 → 再蜂鸟吸蜜
        updateAircraftHover(aircraftSquad, t, dt, { swamp: swampRoot });

        // 飞艇跟随湖沼：找到地图放置的 moebiusSwamp 后锚到其正上方；
        // 地图编辑器移动湖沼时（位置变化）自动重新锚定。
        // 玩家已驾驶过（flown）或正在驾驶（flying）时不再回锚，飞艇归玩家支配。
        if (!airship.userData.flown && !airship.userData.flying) {
          const sw = swampRoot;
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

        // Boids 鸟群：三大定律 + 相位差扑翅 + 高度带锁 + 晶塔避障
        flock.update(dt, t);

        // 花厅楼顶鸟群：环绕母皇塔尖忽聚忽散
        hallFlock.update(dt, t);

        // 航空艇护航队：尾流场吸引 + 6–15 环形圆柱结界 + 两级折叠滑翔
        escort.update(dt, t);

        // 湖沼 BGM：进入莫比斯原初湖沼 → 《風之傳說》1:36–1:54（滞回防抖）
        {
          const p = runtime?.player;
          let swamp = null;
          if (p) {
            scene.traverse((o) => {
              if (!swamp && o.userData?.kind === "moebius-swamp") swamp = o;
            });
          }
          if (p && swamp) {
            // 湖沼可能刚被地图编辑器移动 → 强制刷新世界矩阵再逆变换
            swamp.updateWorldMatrix(true, false);
            _swampLocal.copy(p.position);
            swamp.worldToLocal(_swampLocal);
            const horiz = Math.hypot(_swampLocal.x, _swampLocal.z);
            if (swampBgmInside) {
              if (horiz > SWAMP_BGM_EXIT_R || _swampLocal.y > SWAMP_BGM_CEILING + 6) {
                swampBgmInside = false;
              }
            } else if (horiz < SWAMP_BGM_ENTER_R && _swampLocal.y < SWAMP_BGM_CEILING) {
              swampBgmInside = true;
            }
          } else {
            swampBgmInside = false;
          }
          setSwampBgm(swampBgmInside);
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
