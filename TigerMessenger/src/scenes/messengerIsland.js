// =====================================================================
//  场景：信使主岛（可玩关卡）
//  - 球面平台 / 土坡 / 云环
//  - 游玩区 + 远侧自然点缀
//  - 月亮湖 + 背侧大湖
//  不包含西芳寺景观（见 saihojiGarden.js）
// =====================================================================
import { PLANET_RADIUS } from "../world/planet.js";
import { buildWorld, updatePlatformPulse } from "../world/platforms.js";
import { buildHills } from "../world/hills.js";
import { decorateFarSide, decoratePlayZone, createCloudRing } from "../world/nature.js";
import {
  createMoonLake,
  updateLakeWade,
  updateLakeFx,
  createGreatLake,
  updateGreatLakeWade,
} from "../world/lake.js";
import { updateClouds } from "../assets/lowPoly.js";

/** @type {import("./sceneApi.js").SceneModule} */
export const messengerIslandScene = {
  id: "messenger",
  name: "信使主岛",
  description: "送信玩法关卡：平台、土坡、月亮湖、植被与云环",

  load(ctx) {
    const scene = ctx.scene;
    const R = ctx.planetRadius ?? PLANET_RADIUS;

    const platforms = buildWorld(scene);
    const hills = buildHills(scene, R);
    const clouds = createCloudRing(scene, R);
    const playZone = decoratePlayZone(scene, R);
    const farSide = decorateFarSide(scene, R);
    const lake = createMoonLake(scene, R);
    const greatLake = createGreatLake(scene, R);

    const colliders = [
      ...playZone.colliders,
      ...farSide.colliders,
      lake.deepCollider,
    ];

    return {
      id: "messenger",
      platforms,
      hills,
      clouds,
      lake,
      greatLake,
      colliders,
      landmarks: {
        playZone,
        farSide,
      },
      update(dt, t, runtime) {
        updatePlatformPulse(platforms, t);
        updateClouds(clouds, dt, t);
        const player = runtime?.player;
        if (player) {
          // 先重置，再由各大湖/月亮湖写 factor
          player.wadeFactor = 1;
          updateGreatLakeWade(player, greatLake);
          updateLakeWade(player, lake);
          updateLakeFx(lake, player, t, dt);
        }
      },
      debug: { playZone, farSide },
    };
  },
};
