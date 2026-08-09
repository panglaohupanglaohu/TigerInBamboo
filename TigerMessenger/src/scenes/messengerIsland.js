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
import { createMoonLake } from "../world/lake.js";
import { buildChristchurchTramSystem } from "../world/tramSystem.js";
import { buildMoebiusCrystalMetropolis, GRAND_CRYSTAL } from "../world/moebiusCity.js";
import { loadCrystalLayoutFromStorage } from "../world/crystalCityLayout.js";
import { buildAbandonedGate } from "../world/abandonedGate.js";
import { isCanyonBgmPlaying, isCanyonBgmFinishing, setSwampBgm } from "../audio/sfx.js";
import { canyonOffsetDir, CANYON } from "../world/canyon.js";
import { FlockManager } from "../world/flock.js";
import { BirdVortexManager } from "../world/birdVortex.js";
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
import {
  buildOdysseyCitadel,
  CITADEL_TERRAIN_KEY,
  CITADEL_TERRAIN_OBJECTS_KEY,
} from "../world/odysseyCitadel.js";
import { CITADEL_TOWN_SPEC, CITADEL_LEVELS_KEY } from "../world/citadelTown.js";
import {
  buildCitadelRange,
  citadelRangeLiftDir,
  citadelSiteDir,
  rangeLocalToWorld,
} from "../world/citadelRange.js";
import { WORLD_SCALE } from "../world/worldScale.js";

/** 飞艇锚定用临时向量 */
const _asTmp = new THREE.Vector3();

/** 湖沼 BGM 进入判定（局部坐标：坑口半径 34，坑缘 y=0） */
const _swampLocal = new THREE.Vector3();
const SWAMP_BGM_ENTER_R = 33; // 进入判定半径（湖沼局部资产单位，不随世界半径放大）
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
    // 峡谷白鲸湖在水晶城建好后创建（见下方「花厅塔下方白鲸湖」），
    // 因为要拿到运行时算出的花厅塔方向与塔基高度。

    // ---------- 旧港码头 · 圣城深潭参天树下 ----------
    // 摆放依赖 rangeLocalToWorld（需圣城山脉先建），统一在圣城段落执行。
    // world/lake.js 的 HARBOR 常量仍被电车避障引用（tramSystem.js），不改动。
    const harborBuilt = buildOldHarborScene({ seed: 8844 });
    const harbor = harborBuilt.group;
    scene.add(harbor);
    let harborColliders = [];

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

    // 莫比斯水晶大都会：花厅+晶体汇聚较高山峦环带；布局可读搭建面板存档
    const moebius = buildMoebiusCrystalMetropolis(scene, R, {
      trackCurve: tramSystem.curve,
      layout: loadCrystalLayoutFromStorage() || undefined,
      useStorage: true,
    });

    // 3 艘气泡座舱分别围绕水晶城 3 座含花厅的建筑巡游。
    const bubblePods = createBubblePodsAroundFlowerBuildings(scene, moebius.crystals, { count: 3 });

    // ---------- 花厅塔下方双湖：沉在峡谷底，塔身自湖心拔起 ----------
    // 塔位是运行时从轨道曲线算出来的（computeTracksideGoldSites），
    // 所以这里用实际塔的 dir/root 定位，而不是硬编码经纬度（否则改线就漂移）。
    // 水面取塔基高度 root，电车在十余单位上方的高架桥凌空掠过，纵深拉满。
    const hallTowers = moebius.crystals.filter((c) => c.group?.userData?.bioLayers?.length);
    // 只保留这一个带白鲸的湖：湖心取母塔（花厅塔中体量最大者），塔身自湖心拔起
    const lakeHall = hallTowers[0] || null;
    const citySeaLake = createCitySeaLake(scene, R, {
      seed: 5521,
      centerDir: lakeHall?.dir,
      baseRadius: lakeHall?.root,
    });

    // ---------- 太古高山圣城要塞 + 五层贴地台地 ----------
    // 选址：lat 24.1 / lon 36.05（主岛东南旷野，三边测量定位的用户指定点）。
    // 旧 +16 黄土主峰与前景土坡均已取消；第五层台地直接贴住全球地表。
    // 五座台地湖泊由四道相邻层瀑布连接，不允许跨层跌落。
    // 主建筑重构版：三层马斯塔巴 + 黄金瓜棱穹顶 + 宣礼塔/红砖角楼；
    // 四级清透水帘连接五座白石梯湖；底部雾气与涟漪落入下一级水面。
    // 地形编辑器保存的台地参数同时驱动台地和梯湖，确保两者永远同层。
    let citadelContour;
    try {
      const saved = JSON.parse(localStorage.getItem(CITADEL_TERRAIN_KEY) || "null");
      if (saved && (Number.isFinite(saved.baseRadius) || Array.isArray(saved.terraces))) {
        citadelContour = saved;
      }
    } catch { /* 损坏存档回落内置台地参数 */ }
    const citadelRange = buildCitadelRange(scene, R, citadelContour);
    const citadelDir = citadelSiteDir(new THREE.Vector3());

    // ---------- 旧港码头 + 古战船 · 护城河外岸（贴地） ----------
    // 码头落在护城河外岸前侧偏左（避开正前瀑布水道）；栈桥 +X 朝河心，
    // 古战船系泊在环带水面上。自带 harbor-water 隐藏，水面由护城河承担。
    {
      const pad = citadelRange.moat?.userData?.harborPadLocal ?? {
        lx: -22.8,
        lz: 24.6,
        toWaterX: 0.66,
        toWaterZ: -0.75,
      };
      const harborLx = pad.lx;
      const harborLz = pad.lz;
      // 与 placeRangeAsset(siteUpright) 同构：落在高度场表面 + 站点法向
      rangeLocalToWorld(harborLx, harborLz, R, harbor.position);
      const siteUp = citadelSiteDir(new THREE.Vector3());
      // 桩底 y=0 对齐地表；微抬 0.04 防与高度场 z-fight，不悬空
      harbor.position.addScaledVector(siteUp, 0.04);
      // 朝向河心：用护城河局部切平面上的 toWater 向量投到世界切向
      const toWater = new THREE.Vector3()
        .addScaledVector(citadelRange.right, pad.toWaterX)
        .addScaledVector(citadelRange.fwd, pad.toWaterZ)
        .normalize();
      toWater.addScaledVector(siteUp, -toWater.dot(siteUp)).normalize();
      const zAxis = new THREE.Vector3().crossVectors(toWater, siteUp).normalize();
      // 局部 +Y = 站点法向（贴地），+X 朝护城河水面，栈桥伸入环带
      harbor.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(toWater, siteUp, zAxis)
      );
      harbor.updateMatrixWorld(true);
      const harborWater = harbor.getObjectByName("harbor-water");
      if (harborWater) harborWater.visible = false;
      // 船坐在护城河水面上：甲板仍高，船体略低于甲板、贴水吃水
      const boat = harborBuilt.landmarks.boat;
      if (boat) {
        const moatWaterY = citadelRange.moat?.userData?.moatSpec?.waterY ?? 0.16;
        // 码头局部 y：水面高度 + 船底浮力余量（相对桩脚 Y=0）
        boat.position.y = Math.max(moatWaterY + 0.12, 0.28);
      }
      harborColliders = [
        { position: harbor.position.clone(), radius: 3.8 },
        {
          position: harborBuilt.landmarks.crane.getWorldPosition(new THREE.Vector3()),
          radius: 1.15,
        },
      ];
    }
    // 圣城搭建面板/编辑器（citadelEditorPanel / townscaper.html）保存的布局优先；
    // 无存档时回落到内置 CITADEL_TOWN_SPEC。
    let citadelSpec;
    try {
      const saved = JSON.parse(localStorage.getItem(CITADEL_LEVELS_KEY) || "null");
      if (saved && (Array.isArray(saved) || Array.isArray(saved.terraces))) {
        citadelSpec = saved;
      }
    } catch { /* 损坏存档回落内置 SPEC */ }
    let citadelTerrainObjects;
    try {
      const saved = JSON.parse(
        localStorage.getItem(CITADEL_TERRAIN_OBJECTS_KEY) || "[]"
      );
      if (Array.isArray(saved)) citadelTerrainObjects = saved;
    } catch { /* 损坏存档回落空地貌对象 */ }
    const odysseyCitadel = buildOdysseyCitadel({
      dir: citadelDir,
      faceDir: moonLake?.centerWorld || null,
      groundRadius: R + citadelRangeLiftDir(citadelDir), // 主峰平顶
      planetRadius: R,
      seed: 20260808,
      spec: citadelSpec,
      contour: citadelContour,
      terrainObjects: citadelTerrainObjects,
    });
    scene.add(odysseyCitadel);

    // Boids 鸟群：先在峡谷方向占位，建门后整群迁移到叹息之门城头（见下方 migrate）
    const canyonDir = latLonToDir(CANYON.lat, CANYON.lon, new THREE.Vector3());
    const flock = new FlockManager(scene, {
      count: 18,
      planetRadius: R,
      centerDir: canyonDir,
      windDir: new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), canyonDir).normalize(),
      obstacles: moebius.crystals,
    });

    // 水晶城花厅「忽聚忽散」鸟群：保留在母皇塔楼顶（不迁移）
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
    const bookshopX = 11.5 * WORLD_SCALE;
    const bookshopZ = 5.5 * WORLD_SCALE;
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
      // 太古高山圣城要塞主殿墙体足域（0.4 缩放后基座半宽 4.8 + 余量）：
      // 仅挡穿墙，送信人可沿折返石阶走上顶层台地、经平桥抵达棕色正门门廊。
      { position: odysseyCitadel.position.clone(), radius: 6.0 },
    ];
    if (moonLake?.deepCollider) colliders.push(moonLake.deepCollider);

    // ---------- 太古双子要塞巨门：轨道离开草地、即将入谷 ----------
    // 三重圆拱形状不变 + 左右阶梯巨塔夹道（通道 10）陶土赤红
    const abandonedGate = buildAbandonedGate({
      curve: tramSystem.curve,
      planetRadius: R,
      setback: 6,
    });
    scene.add(abandonedGate);

    // ---------- 万鸟归巢 · 十二组群任务系统（3面×4组 ≈ 1000 只 · 观者可见侧聚群） ----------
    // A 盘旋双子塔 · B 墙→地觅食 · C 地→墙攀附（B/C 随机交换）· D 面↔面通勤
    let birdVortex = null;
    {
      const seat = abandonedGate.userData?.seatRoot;
      const gateDir = seat
        ? new THREE.Vector3(0, 1, 0).applyQuaternion(seat.quaternion).normalize()
        : (() => {
            const u = abandonedGate.userData?.anchor?.gateU;
            if (Number.isFinite(u) && tramSystem.curve) {
              return tramSystem.curve.getPointAt(u, new THREE.Vector3()).normalize();
            }
            return canyonDir.clone();
          })();
      const gateRight = seat
        ? new THREE.Vector3(1, 0, 0).applyQuaternion(seat.quaternion).normalize()
        : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), gateDir).normalize();
      const gateUp = seat
        ? new THREE.Vector3(0, 1, 0).applyQuaternion(seat.quaternion).normalize()
        : gateDir.clone();
      const gateFwd = seat
        ? new THREE.Vector3(0, 0, 1).applyQuaternion(seat.quaternion).normalize()
        : new THREE.Vector3().crossVectors(gateDir, gateRight).normalize();
      const gateOrigin = seat
        ? seat.position.clone()
        : gateDir.clone().multiplyScalar(R + canyonOffsetDir(gateDir));

      birdVortex = new BirdVortexManager(scene, {
        count: 1000,
        origin: gateOrigin,
        up: gateUp,
        right: gateRight,
        forward: gateFwd,
        // 双螺旋长河：水面(Y≈25) → 高架桥(Y≈40) → 飞艇层(Y≈60) 盘旋爬升
        yFloor: 15,
        yCeil: 62,
        // 硬性指标：环绕半径 6.0–15.0 随机波动（松散包裹双子要塞夹道）
        rMin: 6,
        rMax: 15,
        getTram: () =>
          tramSystem.getNearestTram?.(gateOrigin) || tramSystem.tram || null,
      });
      birdVortex.setGateFrame({
        origin: gateOrigin,
        up: gateUp,
        right: gateRight,
        forward: gateFwd,
        respawn: true,
      });

      // 旧 Boids 仍锚在门周作为「近景可读」备份层（旋涡是主体）
      flock.setHome?.(gateDir, {
        altMin: 10,
        altMax: 36,
        homeRadius: 22,
        homeWeight: 1.1,
        windDir: gateFwd,
        respawn: true,
      });
      if (flock?.root) flock.root.visible = true;
    }

    // 安置沉降 pass（全部地形建完后）：被苔丘/土坡/营地埋住的树/石抬回地表，
    // 走廊压平后悬空的岩石落回地面——树木种在草坡上，而不是被埋
    settleBuriedAssets(scene, colliders);

    return {
      id: "messenger",
      platforms,
      hills,
      clouds,
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
        boat: harborBuilt.landmarks.boat,
        moebius,
        abandonedGate, // 太古双子要塞：三重圆拱 + 左右阶梯塔（入谷门槛）
        bubblePods, // 围绕水晶城 3 座花厅建筑巡游的气泡座舱
        citySeaLake, // 水晶城旁海水湖 · 湖沼生物培育 · 气泡艇潜行
        citadelRange, // 圣城黄土坡 · 五级梯湖 · 四段水帘瀑布
        odysseyCitadel, // 太古高山圣城要塞：三层内缩主殿 + 黄金穹顶 + 宣礼塔 + 断崖瀑布
        airship, // 莫比斯航空艇（垂绳登艇 · WASD 驾驶）
        flock, // 旧峡谷 Boids（已让位给旋涡，root 隐藏）
        birdVortex, // 万鸟归巢 · InstancedMesh 垂直旋涡风暴（叹息之门）
        hallFlock, // 花厅楼顶忽聚忽散 Boids（保留在水晶城）
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

        // 圣城梯湖：四段水帘、雾气与涟漪；城堡本体保持静态。
        citadelRange.pilgrimageCascades.update?.(dt, t);
        // 护城河：阶梯量化水波 + 方块浪花
        citadelRange.moat?.update?.(dt, t);
        odysseyCitadel.update?.(dt, t);

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

        // 万鸟旋涡：螺旋 + 光暗实例色 + 电车排斥 + 观者可见侧聚群
        if (birdVortex) {
          const tram =
            tramSystem.getNearestTram?.(runtime?.player?.position) ||
            tramSystem.tram ||
            null;
          // 观者 = 送信人位置（步行/乘车均是视角所在），驱动盘旋鸟河向可见面聚拢
          birdVortex.update(dt, t, {
            tram,
            viewer: runtime?.player?.position || null,
          });
        }
        // 门周 Boids 备份层（近景可辨）
        if (flock?.root?.visible) flock.update(dt, t);

        // 花厅楼顶忽聚忽散：仍环绕母皇塔尖
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
          // 重置涉水系数（月牙湖判定在自己的 update 里写）
          player.wadeFactor = 1;
        }
      },
      debug: { playZone, camp, farSide, harbor },
    };
  },
};
