// 物理世界：Cannon.js 驱动 —— 地形 Heightfield、刚体注册、定步长推进
// 系统内所有可交互物体（竹、虎、雨雪、岩石）统一在此世界中解算
import * as CANNON from "cannon-es";
import { groundHeight } from "./environment.js";

export const GROUP = {
  GROUND: 1,
  TIGER: 2,
  BAMBOO: 4,
  ROCK: 8,
};

// 地形采样范围与分辨率（须覆盖竹林与落雪活动区 ±55）
const TERRAIN_HALF = 56;
const TERRAIN_GRID = 64; // 64×64 采样

export class PhysicsWorld {
  constructor(config = {}) {
    const ph = config.physics ?? {};
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, ph.gravity ?? -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = Math.round(ph.solverIterations ?? 8);

    this._bodies = [];
    this._buildGround();
  }

  /** 地形：从 environment.groundHeight 采样生成 Heightfield */
  _buildGround() {
    const n = TERRAIN_GRID;
    const data = [];
    for (let i = 0; i <= n; i++) {
      const row = [];
      for (let j = 0; j <= n; j++) {
        const x = -TERRAIN_HALF + (i / n) * TERRAIN_HALF * 2;
        const z = -TERRAIN_HALF + (j / n) * TERRAIN_HALF * 2;
        row.push(groundHeight(x, z));
      }
      data.push(row);
    }
    this._heightData = data;
    const shape = new CANNON.Heightfield(data, {
      elementSize: (TERRAIN_HALF * 2) / n,
    });
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      collisionFilterGroup: GROUP.GROUND,
      collisionFilterMask: -1,
    });
    body.addShape(shape);
    // cannon Heightfield 的索引沿 +x/+z 展开，原点在其中心
    body.position.set(-TERRAIN_HALF, 0, -TERRAIN_HALF);
    this.world.addBody(body);
    this.ground = body;
  }

  /** 地形高度快速查询（雨雪落点判定用，双线性插值） */
  heightAt(x, z) {
    const n = TERRAIN_GRID;
    const u = ((x + TERRAIN_HALF) / (TERRAIN_HALF * 2)) * n;
    const v = ((z + TERRAIN_HALF) / (TERRAIN_HALF * 2)) * n;
    if (u < 0 || v < 0 || u >= n || v >= n) return 0;
    const i = Math.floor(u), j = Math.floor(v);
    const fu = u - i, fv = v - j;
    const d = this._heightData;
    const h00 = d[i][j], h10 = d[i + 1][j], h01 = d[i][j + 1], h11 = d[i + 1][j + 1];
    return (h00 * (1 - fu) + h10 * fu) * (1 - fv) + (h01 * (1 - fu) + h11 * fu) * fv;
  }

  addBody(body) {
    this.world.addBody(body);
    this._bodies.push(body);
    return body;
  }

  removeBody(body) {
    this.world.removeBody(body);
    const i = this._bodies.indexOf(body);
    if (i >= 0) this._bodies.splice(i, 1);
  }

  /** 定步长推进；renderDt 为渲染帧间隔 */
  step(renderDt) {
    this.world.step(1 / 60, renderDt, 3);
  }
}
