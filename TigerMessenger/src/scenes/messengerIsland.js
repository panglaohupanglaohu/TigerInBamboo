// =====================================================================
//  场景：信使主岛（可玩关卡）
//  - 球面平台 / 土坡 / 云环
//  - 游玩区 + 远侧自然点缀
//  - 背侧大湖（月亮湖已按主人指示删除）
//  不包含西芳寺景观（见 saihojiGarden.js）
// =====================================================================
import { PLANET_RADIUS } from "../world/planet.js";
import { P } from "../core/params.js";
import { buildWorld, updatePlatformPulse } from "../world/platforms.js";
import { buildHills } from "../world/hills.js";
import { decorateFarSide, decoratePlayZone, createCloudRing } from "../world/nature.js";
import { createGreatLake, updateGreatLakeWade } from "../world/lake.js";
import { buildChristchurchTramSystem } from "../world/tramSystem.js";
import { updateClouds } from "../assets/lowPoly.js";
import { buildStartingCamp } from "../world/startingCamp.js";
import { groundLiftAt } from "../world/hills.js";
import { placeObjectOnSphere } from "../world/sphereMath.js";
import { createGrassTuft } from "../assets/bookshop.js";
import { createBookshopHydrangeas } from "../assets/hydrangea.js";
import { createLowPolyFlower, INK_FLOWER_COLORS } from "../assets/lowPoly.js";
import { createCatalogObject } from "../core/buildingCatalog.js";

/** @type {import("./sceneApi.js").SceneModule} */
export const messengerIslandScene = {
  id: "messenger",
  name: "信使主岛",
  description: "送信玩法关卡：平台、土坡、背侧大湖、植被与云环",

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
    const greatLake = createGreatLake(scene, R);

    // 基督城有轨电车：营地→书店→天桥→西芳寺 环形轨道
    const tramSystem = buildChristchurchTramSystem(scene, R);

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
      { position: bookshop.position.clone(), radius: bookshop.userData.collideRadius },
    ];

    return {
      id: "messenger",
      platforms,
      hills,
      clouds,
      greatLake,
      colliders,
      landmarks: {
        playZone,
        camp,
        farSide,
        bookshop,
        tramSystem,
      },
      update(dt, t, runtime) {
        updatePlatformPulse(platforms, t);
        updateClouds(clouds, dt, t, { speed: P.windSpeed, dirDeg: P.windDir });
        tramSystem.update(dt, runtime?.player?.position);
        const player = runtime?.player;
        if (player) {
          // 先重置，再由大湖写 factor
          player.wadeFactor = 1;
          updateGreatLakeWade(player, greatLake);
        }
      },
      debug: { playZone, camp, farSide },
    };
  },
};
