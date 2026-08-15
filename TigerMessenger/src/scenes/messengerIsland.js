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
import { createMoonLake, LAKE } from "../world/lake.js";
import { buildChristchurchTramSystem } from "../world/tramSystem.js";
import { buildWorldCanal, buildCanalJunctionBox } from "../world/canalSystem.js";
import { buildCanalLakeLink } from "../world/canalLakeLink.js";
import { createCanalBoatPatrol } from "../world/canalBoats.js";
import { buildMoebiusCrystalMetropolis, GRAND_CRYSTAL } from "../world/moebiusCity.js";
import { loadCrystalLayoutFromStorage } from "../world/crystalCityLayout.js";
import { buildAbandonedGate } from "../world/abandonedGate.js";
import { isCanyonBgmPlaying, isCanyonBgmFinishing, setSwampBgm } from "../audio/sfx.js";
import { canyonOffsetDir, CANYON } from "../world/canyon.js";
import { FlockManager } from "../world/flock.js";
import { BirdVortexManager } from "../world/birdVortex.js";
import {
  createCitadelTerraceBirds,
  collectInfiltrationThreats,
} from "../world/citadelTerraceBirds.js";
import { GATE, GATE_DEPTH } from "../world/abandonedGate.js";
import { AirshipEscortManager } from "../world/airshipEscort.js";
import { buildImpastoMossyGround } from "../world/mossyGround.js";
import { swampMidwayDir, placeMoebiusSwampOnSphere } from "../world/moebiusSwamp.js";
import { SAIHOJI_ZONES } from "../world/saihoji.js";
import { updateClouds } from "../assets/lowPoly.js";
import { buildStartingCamp } from "../world/startingCamp.js";
import {
  createMoebiusAircraftSquad,
  updateAircraftHover,
} from "../assets/moebiusAircraft.js";
import { createBubblePod, createBubblePodsAroundFlowerBuildings, updateBubblePodPatrol } from "../assets/bubblePod.js";
import { groundLiftAt } from "../world/hills.js";
import { placeObjectOnSphere, latLonToDir, flatXZToLatLon } from "../world/sphereMath.js";
import { createGrassTuft } from "../assets/bookshop.js";
import { createBookshopHydrangeas } from "../assets/hydrangea.js";
import { createLowPolyFlower, INK_FLOWER_COLORS } from "../assets/lowPoly.js";
import { createCatalogObject } from "../core/buildingCatalog.js";
import { buildOldHarborScene } from "../assets/harbor.js";
import { createHarborLogistics } from "../assets/harborLogistics.js";
import { createMoebiusAirship, placeMoebiusAirshipAbove } from "../assets/moebiusAirship.js";
import { createCitySeaLake, CITY_SEA_LAKE } from "../world/citySeaLake.js";
import {
  buildOdysseyCitadel,
  CITADEL_TERRAIN_KEY,
  CITADEL_TERRAIN_OBJECTS_KEY,
  citadelTerrainKey,
  citadelTerrainObjectsKey,
} from "../world/odysseyCitadel.js";
import {
  CITADEL_TOWN_SPEC,
  CITADEL_LEVELS_KEY,
  citadelLevelsKey,
} from "../world/citadelTown.js";
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
    let canalSys = null; // 星海运河环线（连通各场景，地面浅沟）
    let canalBoats = null; // 运河巡游古战船（可 F 登船 WASD 驾驶）
    let canalLakeLink = null; // 运河↔大湖落差互联（瀑布船道+升船机）

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
    /** 装船物流换船时写回 landmarks.boat（return 前赋值） */
    let messengerLandmarks = null;

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

    // ---------- 旧港码头 + 古战船 · 圣城深潭参天大树下（贴地） ----------
    // 参天树（圣池深潭参天树，range 局部 -15.2,42）旁、离地面最近的深潭湖泊
    // （range 局部 ~1,43）边上。码头整组落在岸地树荫下，栈桥朝向潭心。
    {
      const TREE_LX = -15.2;
      const TREE_LZ = 42.0;
      const POOL_LX = 1.0;
      const POOL_LZ = 43.0;
      // 树根旁偏潭约 1.0：仍在岸上，树冠正下方
      const toPoolFlatX = POOL_LX - TREE_LX;
      const toPoolFlatZ = POOL_LZ - TREE_LZ;
      const flatLen = Math.hypot(toPoolFlatX, toPoolFlatZ) || 1;
      const harborLx = TREE_LX + (toPoolFlatX / flatLen) * 1.0;
      const harborLz = TREE_LZ + (toPoolFlatZ / flatLen) * 1.0;
      // 与 placeRangeAsset(siteUpright) 同构：落在高度场表面 + 站点法向
      rangeLocalToWorld(harborLx, harborLz, R, harbor.position);
      const siteUp = citadelSiteDir(new THREE.Vector3());
      // 桩底 y=0 对齐地表；微抬 0.04 防与高度场 z-fight，不悬空
      harbor.position.addScaledVector(siteUp, 0.04);
      const poolC = rangeLocalToWorld(POOL_LX, POOL_LZ, R, new THREE.Vector3());
      const toPool = poolC.sub(harbor.position);
      toPool.addScaledVector(siteUp, -toPool.dot(siteUp)).normalize();
      const zAxis = new THREE.Vector3().crossVectors(toPool, siteUp).normalize();
      // 局部 +Y = 站点法向（贴地），+X 朝潭，栈桥沿地面伸向深潭
      harbor.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(toPool, siteUp, zAxis)
      );
      harbor.updateMatrixWorld(true);
      const harborWater = harbor.getObjectByName("harbor-water");
      if (harborWater) harborWater.visible = false;
      // 船保持建造时的甲板高度（约 0.61），与栈桥同高、坐在码头上
      const boat = harborBuilt.landmarks.boat;
      if (boat && boat.position.y < 0.3) boat.position.y = 0.61;

      // 弹琴老人：从出生营地迁到码头，坐在起重机旁货柜叠边（码头局部坐标）
      // 营地小地图锚点仍留原处；碰撞 / elderMusic 跟老人世界位。
      const elder = camp?.landmarks?.elder;
      const crane = harborBuilt.landmarks.crane;
      const cratesByCrane = harborBuilt.landmarks.cratesByCrane;
      if (elder && crane) {
        elder.removeFromParent();
        harbor.add(elder);
        // 靠起重机与 cratesByCrane 之间、甲板面坐姿；略偏岸侧不挡搬运动线
        const deckTop =
          cratesByCrane?.position?.y ?? crane.position.y ?? 0.51;
        const seat = new THREE.Vector3(
          (crane.position.x + (cratesByCrane?.position.x ?? 2.2)) * 0.5 - 0.75,
          deckTop,
          (crane.position.z + (cratesByCrane?.position.z ?? 1.0)) * 0.5 + 0.15
        );
        elder.position.copy(seat);
        // 坐姿面朝栈桥活动：船 / 搬运班组 / 起重机
        elder.rotation.set(0, Math.PI * 0.55, 0);
        elder.updateMatrixWorld(true);
        const elderWorld = elder.getWorldPosition(new THREE.Vector3());
        const elderCol = camp.colliders?.find((c) => c.kind === "elder");
        if (elderCol) elderCol.position.copy(elderWorld);
        else camp.colliders?.push({ position: elderWorld.clone(), radius: 0.8, kind: "elder" });
        harborBuilt.landmarks.elder = elder;
      }

      harborColliders = [
        { position: harbor.position.clone(), radius: 3.8 },
        {
          position: (crane || harborBuilt.landmarks.crane).getWorldPosition(
            new THREE.Vector3()
          ),
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
    odysseyCitadel.updateMatrixWorld(true);

    // ---------- 各台地鸟群 ×20：白天漩涡 · 夜栖屋顶 · 纸士兵经过惊飞后立刻落下 ----------
    const terraceBirds = createCitadelTerraceBirds(scene, odysseyCitadel, {
      contour: citadelContour,
      getTram: () => tramSystem?.tram || null,
      getInfiltration: () => citadelRange?.nightInfiltration || null,
    });
    // 兼容旧引用：台地 1 旋涡
    const birdVortex = terraceBirds.primary;

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

    // ---------- 莫比斯湖沼：挪到书店镇中心（湖边书店）----------
    // 湖沼坑口半径 34×scale≈17 世界单位：中心取书店旁 21 单位，
    // 坑缘恰好擦书店门前草地（书店在湖边，可走入坑缘/跳入湖沼）。
    // 注册 mapUid → 地图编辑器可选中/拖动/存档（无存档时默认在此）。
    let moebiusSwamp = null;
    {
      const swampScale = 0.5;
      const swamp = createCatalogObject("moebiusSwamp", { seed: 7711, scale: swampScale });
      swamp.userData.mapUid = "world-swamp";
      const bookUp = bookshop.position.clone().normalize();
      const tang = new THREE.Vector3(1, 0, 0)
        .addScaledVector(bookUp, -bookUp.x)
        .normalize();
      const target = bookshop.position.clone().addScaledVector(tang, 21);
      const lift = Math.max(0, target.length() - R);
      placeMoebiusSwampOnSphere(swamp, target.clone().normalize(), R, swampScale, lift);
      scene.add(swamp);
      moebiusSwamp = swamp;
    }

    // ---------- 书店镇气泡艇：停泊在书店上空、绕店轻缓巡游，可 [F] 登艇驾驶 ----------
    // 加入花厅巡游舰队，复用同一套驾驶/潜行/气泡弹逻辑（updateBubblePodPatrol 会遍历舰队）。
    {
      const shopPod = createBubblePod({ scale: 0.72, accent: 0xffd98e });
      const shopUp = bookshop.position.clone().normalize();
      const shopRight = new THREE.Vector3(1, 0, 0).applyQuaternion(bookshop.quaternion).normalize();
      const shopFront = new THREE.Vector3(0, 0, 1).applyQuaternion(bookshop.quaternion).normalize();
      shopPod.userData.orbit = {
        center: bookshop.position.clone(),
        up: shopUp,
        right: shopRight,
        front: shopFront,
        radius: 4.5,   // 绕书店外缘（collideRadius 3.2 之外）轻缓环绕
        altitude: 3.2, // 书店上空约 3.2 单位悬浮
        phase: 0.7,
        speed: 0.3,
      };
      shopPod.userData.hoverPhase = 0.7;
      shopPod.userData.anchorDirection = shopUp.clone();
      shopPod.userData.bookshopPod = true;
      bubblePods.add(shopPod);
    }

    // ---------- 运河交汇古堡（第二城堡实例）----------
    // 摆脱「只能在高山圣城建古堡」：运河环线经过月亮湖侧畔，此处放置
    // 同款可编辑古堡（独立存档键 tm.citadel.levels.canal-junction.v1），
    // 运河在它身边交汇；搭建面板可切换目标实例编辑。
    // 选址：月亮湖 → 白鲸海湖航段中点方向（开阔水面，不与其他场景重叠）。
    const moonLakeLatLon = flatXZToLatLon(LAKE.x, LAKE.z, R);
    const canalJunctionDir = latLonToDir(
      (moonLakeLatLon.lat + CITY_SEA_LAKE.lat) * 0.5,
      (moonLakeLatLon.lon + CITY_SEA_LAKE.lon) * 0.5,
      new THREE.Vector3()
    );
    let canalJunctionCitadel = null;
    let canalJunctionStorage = null;
    let canalJunctionBox = null;
    {
      const cjsLevelsKey = citadelLevelsKey("canal-junction");
      const cjsTerrainKey = citadelTerrainKey("canal-junction");
      const cjsObjectsKey = citadelTerrainObjectsKey("canal-junction");
      canalJunctionStorage = { levels: cjsLevelsKey, terrain: cjsTerrainKey, objects: cjsObjectsKey };
      let cjSpec;
      try {
        const saved = JSON.parse(localStorage.getItem(cjsLevelsKey) || "null");
        if (saved && (Array.isArray(saved) || Array.isArray(saved.terraces))) cjSpec = saved;
      } catch { /* 回落 SPEC */ }
      let cjContour;
      try {
        const saved = JSON.parse(localStorage.getItem(cjsTerrainKey) || "null");
        if (saved) cjContour = saved;
      } catch { /* 回落默认 */ }
      let cjObjects;
      try {
        const saved = JSON.parse(localStorage.getItem(cjsObjectsKey) || "[]");
        if (Array.isArray(saved)) cjObjects = saved;
      } catch { /* 空 */ }
      // 朝向运河切向（月亮湖方向）：古堡正门对着运河流向
      const faceDir = moonLake?.centerWorld || canalJunctionDir;
      // ---------- 运河交汇堤岸方框（Townscaper 式城堡地基）----------
      // 运河在此交汇：堤岸围出的矩形方框 = 城堡建立之处（高亮四边 + 角灯）。
      // 方框中心即古堡台地中心，古堡正门朝向运河切向。
      const junctionBox = buildCanalJunctionBox(scene, R, {
        centerDir: canalJunctionDir,
        forwardDir: moonLake?.centerWorld || canalJunctionDir,
        halfLength: 22,
        halfWidth: 18,
        waterLift: 0.6,
        highlight: true,
      });
      scene.add(junctionBox.group);
      canalJunctionBox = junctionBox.group; // 高亮构建区：点选/切换目标用

      canalJunctionCitadel = buildOdysseyCitadel({
        dir: canalJunctionDir,
        faceDir,
        groundRadius: R,
        planetRadius: R,
        seed: 918273,
        spec: cjSpec,
        contour: cjContour,
        terrainObjects: cjObjects,
        instanceId: "canal-junction",
        floors: 12, // 运河交汇古堡：Townscaper 式高塔，12 层（高山为 5 层）
        skipOuterTerrain: true, // 不建外围台地：运河堤岸方框就是地基
        townBaseLift: 0.62, // 镇体基座落在方框水面平台（约 CANAL_WATER_LIFT）
      });
      scene.add(canalJunctionCitadel);
      canalJunctionCitadel.updateMatrixWorld(true);

      // 镇体基座对齐方框实心平台顶面（水面 + 微抬），不嵌入平台
      const platformTop = canalJunctionDir
        .clone()
        .multiplyScalar(R + (junctionBox.group.userData.waterLift ?? 0.6) + 0.1);
      canalJunctionCitadel.position.copy(platformTop);
      canalJunctionCitadel.quaternion.copy(junctionBox.quaternion);
      canalJunctionCitadel.updateMatrixWorld(true);
      junctionBox.group.userData.citadel = canalJunctionCitadel;
    }

    // ---------- 星海运河环线：连通各主要场景，在地面挖出的浅沟 ----------
    // 控制点取各场景方向（世界位 normalize），用 CatmullRom 闭合样条稍曲折绕行；
    // 形态是贴地沟渠（河床/水面/两侧立壁/岸顶土埂），不是埋进球心的地下通道。
    // 场景锚点动态取运行时方向（门在轨道上、海湖可搬迁、圣城在峡谷侧）。
    // 注意：bookshop / canyonDir 在本段之上才初始化，必须置于其后以避免暂时性死区。
    const canalAnchors = [];
    const canalNames = [];
    const canalPush = (dir, name) => {
      if (dir?.isVector3 && dir.lengthSq() > 1e-6) {
        canalAnchors.push(dir.clone());
        canalNames.push(name);
      }
    };
    canalPush(bookshop?.position, "书店镇");
    canalPush(camp?.landmarks?.anchor?.position, "出发营地");
    canalPush(moonLake?.centerWorld || moonLake?.position, "月亮湖");
    canalPush(odysseyCitadel?.position, "高山圣城");
    canalPush(canalJunctionCitadel?.position, "运河交汇古堡");
    canalPush(moebius?.grand?.dir, "水晶城");
    canalPush(citySeaLake?.centerDir || latLonToDir(CITY_SEA_LAKE.lat, CITY_SEA_LAKE.lon), "白鲸海湖");
    // 叹息之门锚在轨道上，方向取峡谷兜底（门在入谷门槛附近）
    canalPush(canyonDir, "叹息之门");
    if (canalAnchors.length >= 3) {
      // 运河全程不断开：纳沃纳广场已横向偏离运河中线，河道完整露出
      const canal = buildWorldCanal(scene, R, {
        anchors: canalAnchors,
        names: canalNames,
        groundLift: citadelRangeLiftDir,
        // 护城河环带处护堤缺口：立壁/土埂断开、水面/河床连续（水系打通）。
        // 余量须盖住运河自身护堤横向展幅（半宽 6.3 + 壁/埂 ≈ 8.1），
        // 否则中心线在带外、壁体仍会伸入环带造成护堤交叉。
        embankGapTest: ((_dir, worldP) => {
          const ms = citadelRange.moat?.userData?.spec;
          if (!ms) return false;
          const lx = worldP.dot(citadelRange.right);
          const lz = worldP.dot(citadelRange.fwd);
          const r = Math.hypot(lx, lz);
          return r > ms.inner - 8.4 && r < ms.outer + 8.4;
        }),
      });
      canalSys = canal;
      // 护城河接入运河：护城河护堤在运河走廊开弧缺（两者护堤不交叉）
      citadelRange.linkCanalToMoat?.(canal.curve);
      // ---------- 纳沃纳广场延迟摆放：港口及参天大树正前方 ----------
      // 港口栈桥/参天大树在 range 局部 (-15.2,42)/(1,43) 一带；广场置于其正前方
      // （北缘域外平地），长轴横陈作前景舞台；木马另置城堡前方草地。运河北段自此以东
      // ~24 处南北贯通：广场东缘与河道留 5+ 净空，河道全程露出、两者零重叠。
      {
        let plazaGroup = null;
        scene.traverse((o) => {
          if (!plazaGroup && o.name === "citadel-navona-canal-plaza") plazaGroup = o;
        });
        if (!plazaGroup) {
          // yaw=π/2：长轴(+Z)转沿 +right（东西横陈）；木马落在第一层瀑布右侧草地
          citadelRange.placeNavonaPlaza(-10, 75, Math.PI / 2, odysseyCitadel);
        }
      }
      // 复制 10 艘古战船沿运河环线巡游（整体放大一倍），送信人可靠近 [F] 登船驾驶
      canalBoats = createCanalBoatPatrol(scene, canal, { count: 10, scale: 1.84 });
      // 利用落差互联互通：运河水沿阶梯瀑布船道跌入大湖，战船顺梯入湖巡游，
      // 归来时由出口升船机整厢抬回运河水位，形成闭环通航
      canalLakeLink = buildCanalLakeLink(scene, canal, citySeaLake);
      canalLakeLink?.attachAll?.(canalBoats.boats);

      // 旧港装船物流：纸士兵计数装货 → 满载离港入运河 →
      // 城堡雪山附近运河船走护城河进港继续装船
      {
        const dockBoat = harborBuilt.landmarks.boat;
        const dockCrane = harborBuilt.landmarks.crane;
        const squads = harborBuilt.squads || harborBuilt.landmarks.porterSquads || [];
        if (dockBoat && dockCrane && squads.length) {
          const logistics = createHarborLogistics({
            harbor,
            boat: dockBoat,
            crane: dockCrane,
            squads,
            scene,
          });
          logistics.bindWorld({
            canal,
            canalBoats,
            moat: citadelRange.moat,
            citadel: odysseyCitadel,
          });
          // boatRide / 小地图等通过 landmarks.boat 取当前泊位船
          logistics.setOnBoatChange((b) => {
            harborBuilt.landmarks.boat = b;
            if (messengerLandmarks) messengerLandmarks.boat = b;
          });
          harbor.userData.logistics = logistics;
          harborBuilt.logistics = logistics;
        }
      }
    }

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
    // ② 湖沼边缘：跟随湖沼新位置（书店镇中心旁），湖沼挪动后苔丘不再留在原锚地
    const mossSwamp = buildImpastoMossyGround({
      dir: moebiusSwamp
        ? moebiusSwamp.position.clone().normalize()
        : swampMidwayDir(bookshopX, bookshopZ, R),
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

    // ---------- 三重门千鸟漩涡（门廊 A/B/C/D 组群 · 随门搬迁） ----------
    const gateBirdVortex = new BirdVortexManager(scene, {
      // 默认约 1000 只 InstancedMesh；非 spiralOnly = 攀附门墙 + 双螺旋
      name: "bird-vortex-triple-gate",
      getTram: () =>
        tramSystem?.getNearestTram?.(abandonedGate.position) ||
        tramSystem?.tram ||
        null,
    });
    gateBirdVortex.syncToGate(abandonedGate, { respawn: true });
    gateBirdVortex.root.userData.anchor = { kind: "triple-gate" };

    // ---------- 叹息之门城头：小群 Boids 近景备份（穿门夹道） ----------
    {
      const seat = abandonedGate.userData?.seatRoot;
      seat?.updateWorldMatrix?.(true, false);
      const gateOrigin = new THREE.Vector3();
      const gateQ = new THREE.Quaternion();
      if (seat) {
        seat.getWorldPosition(gateOrigin);
        seat.getWorldQuaternion(gateQ);
      }
      const gateUp = seat
        ? new THREE.Vector3(0, 1, 0).applyQuaternion(gateQ).normalize()
        : canyonDir.clone();
      const gateRight = seat
        ? new THREE.Vector3(1, 0, 0).applyQuaternion(gateQ).normalize()
        : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), gateUp).normalize();
      const gateFwd = seat
        ? new THREE.Vector3(0, 0, 1).applyQuaternion(gateQ).normalize()
        : new THREE.Vector3().crossVectors(gateUp, gateRight).normalize();
      flock.setHome?.(gateUp, {
        altMin: 8,
        altMax: 32,
        homeRadius: 18,
        homeWeight: 1.15,
        windDir: gateFwd,
        respawn: true,
      });
      // 限制在三重门夹道内穿行
      flock.setCorridor?.({
        origin: gateOrigin.lengthSq() > 1e-6 ? gateOrigin : gateUp.clone().multiplyScalar(R),
        right: gateRight,
        up: gateUp,
        forward: gateFwd,
        halfWidth: Math.max(3.2, (GATE.channelWidth || 10) * 0.48),
        halfLength: Math.max(14, (GATE_DEPTH || 18) * 0.95),
        yMin: 3,
        yMax: 30,
        cloudCeilY: 40,
      });
      if (flock?.root) flock.root.visible = true;
    }

    // 安置沉降 pass（全部地形建完后）：被苔丘/土坡/营地埋住的树/石抬回地表，
    // 走廊压平后悬空的岩石落回地面——树木种在草坡上，而不是被埋
    settleBuriedAssets(scene, colliders);

    // 可变 landmarks：装船物流换船时更新 boat 引用
    messengerLandmarks = {
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
      citadelRange, // 圣城黄土坡 · 五级梯湖 · 四段水帘瀑布 · 纳沃纳双栖广场
      odysseyCitadel, // 太古高山圣城要塞：三层内缩主殿 + 黄金穹顶 + 宣礼塔 + 断崖瀑布
      canalJunctionCitadel, // 运河交汇古堡（第二城堡实例，独立存档键）
      canalJunctionBox, // 运河交汇高亮构建方框（堤岸 + 实心平台 + 高亮区）
      canalJunctionStorage, // { levels, terrain, objects } 存档键（编辑器切换目标用）
      airship, // 莫比斯航空艇（垂绳登艇 · WASD 驾驶）
      flock, // 叹息之门城头小群 Boids 近景备份
      gateBirdVortex, // 三重门千鸟漩涡（门廊攀附 + 双螺旋）
      birdVortex: gateBirdVortex, // 兼容旧引用：门体漩涡
      terraceBirds, // 五级台地各 20 只 · 随机栖顶 · 昼夜栖飞 · 纸士兵惊飞
      hallFlock, // 花厅楼顶忽聚忽散 Boids（保留在水晶城）
      escort, // 异星滑翔长翼鸟 · 航空艇生态护航队
      aircraftSquad, // 水晶城母塔↔书店低速往返的人字阵飞行器编队（含青柠驾驶舱光源）
      mossSaihoji, // 厚涂苔丘 · 西芳寺缘
      moebiusSwamp, // 莫比斯湖沼（默认在书店镇中心 · 地图编辑器可拖动）
      canal: canalSys, // 星海运河环线 · 地面浅沟 · 连通各场景
      canalBoats, // 运河巡游古战船 · 可 F 登船
      canalLakeLink, // 运河↔大湖落差互联（瀑布船道/升船机）
      mossSwamp, // 厚涂苔丘 · 湖沼边缘
      harborLogistics: harborBuilt.logistics || null,
    };

    return {
      id: "messenger",
      platforms,
      hills,
      clouds,
      moonLake,
      colliders,
      landmarks: messengerLandmarks,
      update(dt, t, runtime) {
        updatePlatformPulse(platforms, t);
        updateClouds(clouds, dt, t, { speed: P.windSpeed, dirDeg: P.windDir });
        tramSystem.update(dt, runtime?.player?.position);

        // 运河战船巡游（已搭乘的船跳过，由 boatRide 接管）
        canalBoats?.update?.(dt);

        // 旧港码头：两组剪纸士兵搬运货物上船的往返动画
        harborBuilt?.update?.(dt, t);

        // 运河↔大湖落差互联：升船机吊厢/配重 + 瀑布浪花动画
        canalLakeLink?.update?.(dt, t);

        // 3 艘气泡座舱分别围绕 3 座花厅建筑巡游
        updateBubblePodPatrol(bubblePods, t);

        // 水晶城海水湖：涟漪 + 培育白鲸/鳗/带鱼
        citySeaLake.update?.(dt, t);

        // 圣城梯湖：四段水帘、雾气与涟漪；城堡本体保持静态。
        citadelRange.pilgrimageCascades.update?.(dt, t);
        // 深夜：木马腹舱开启，纸士兵潜入；太鼓按玩家与木马距离启停。
        citadelRange.update?.(dt, t, {
          listener: runtime?.player?.position || null,
        });
        // 护城河：阶梯量化水波 + 方块浪花
        citadelRange.moat?.update?.(dt, t);
        // 纳沃纳双栖广场：喷泉动画 + 旱/汛水面插值
        citadelRange.navonaPlaza?.update?.(dt, t);
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

        // 三重门千鸟漩涡 + 门廊 Boids
        if (gateBirdVortex) {
          const tram =
            tramSystem.getNearestTram?.(runtime?.player?.position) ||
            tramSystem.tram ||
            null;
          gateBirdVortex.update(dt, t, {
            tram,
            viewer: runtime?.player?.position || null,
          });
        }
        // 五级台地鸟群：白天漩涡 · 夜栖屋顶 · 纸士兵经过惊飞、离开立刻落下
        if (terraceBirds) {
          const tram =
            tramSystem.getNearestTram?.(runtime?.player?.position) ||
            tramSystem.tram ||
            null;
          terraceBirds.update(dt, t, {
            phase: P.timeOfDay,
            tram,
            viewer: runtime?.player?.position || null,
            infiltration: citadelRange?.nightInfiltration || null,
          });
        }
        // 门周 Boids 备份层（近景可辨 · 夹道穿行）
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
