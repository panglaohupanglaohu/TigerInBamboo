// =====================================================================
//  场景：西芳寺（苔寺）景观
//  - 六座沿球面展开的苔海石庭
//  - 入口苔径 / 主石 / 枯瀑 / 岛群 / 空庭 / 回望
//  构建逻辑在 world/saihoji.js，本文件只做场景模块外壳。
// =====================================================================
import { PLANET_RADIUS } from "../world/planet.js";
import { buildSaihojiPlanet } from "../world/saihoji.js";

/** @type {import("./sceneApi.js").SceneModule} */
export const saihojiGardenScene = {
  id: "saihoji",
  name: "西芳寺 · 苔寺",
  description: "西芳寺苔海六景：石组如岛，沿球面参道逐景展开",

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

    return {
      id: "saihoji",
      group: built.group,
      colliders: built.colliders || [],
      landmarks: built.landmarks,
      debug: {
        mossCount: built.mossCount,
        placed: built.placed?.length ?? 0,
      },
      // 景观静态为主；预留 update 钩子
      update() {},
      dispose() {
        if (built.group?.parent) built.group.parent.remove(built.group);
        built.group?.traverse((o) => {
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
