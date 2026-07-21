// 布景：图转 3D 的装饰性模型（画中提取的竹丛、山石、梅花树）
// 与可交互的程序化竹林互补——这些静置在巡游路径之外，承担画面纵深
import * as THREE from "../assets/vendor/three/three.module.js";
import { groundHeight } from "./environment.js";
import { loadGLB, normalizeModel, hasModel } from "./assets.js";

// 布景：图转 3D 的装饰性模型清单
// 注意：抠图剩下的屏风碎片一律不进 3D 场景（画片残块悬浮出戏）。
// 梅树/山石 GLB 已撤（山石改程序化岩体 + 画中纹理）；竹丛 GLB 同为屏风残片，撤。
const PLACEMENTS = [];

export class Scenery {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._place();
  }

  async _place() {
    for (const p of PLACEMENTS) {
      if (!(await hasModel(p.url))) continue; // 尚未生成，安静跳过
      try {
        const raw = await loadGLB(p.url);
        const model = normalizeModel(raw, { targetHeight: p.targetHeight, yaw: p.yaw });
        model.position.set(p.at[0], groundHeight(p.at[0], p.at[1]) - 0.05, p.at[1]);
        this.group.add(model);
      } catch (err) {
        console.warn("布景模型缺失：", p.url, err);
      }
    }
  }
}
