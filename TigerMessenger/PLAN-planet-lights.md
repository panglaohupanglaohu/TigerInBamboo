# 星球与光源补充 · PLAN（2026-08-02 00:47 起）

> 负责人标注：**Kimi**（本项由 Kimi 实现并验收；Grok 请跳过，勿重复动工）。
> 验收：`node tools/e2e/accept_tiger_messenger.mjs` 三件套通过（2026-08-02 00:50）。

## 需求（主人 2026-08-02 00:47 提出）

1. 场景中心创建半径 40 的球体（游戏星球），淡青色材质。
2. 游戏必备光源：弱环境光（AmbientLight）+ 开启阴影的平行光（DirectionalLight，模拟太阳光），
   配置基础阴影参数，renderer 开启 shadowMap。

## 落地记录

| 项 | 实现 | 负责 | 时间 |
|---|------|------|------|
| 星球球体 | `src/world/planet.js`：`createPlanet(scene)`，半径 40、淡青 `#a8e6e3`、flatShading、`receiveShadow` | Kimi | 00:48 |
| 装配接线 | `src/main.js`：`buildWorld` 后调用 `createPlanet(scene)` | Kimi | 00:49 |
| 弱环境光 | `src/world/environment.js`：`AmbientLight(0x8899bb, 0.22)` | Kimi | 00:49 |
| 太阳平行光 | 复用既有 `DirectionalLight(0xc8d8ff, 1.15)`（`castShadow` + 2048 阴影贴图 + 正交阴影相机 ±25 + bias），未重复添加第二盏 | Kimi（既有代码标注为太阳光） | 00:49 |
| renderer shadowMap | 既有 `core/stage.js` 已开启 `PCFSoftShadowMap`，无需改动 | — | — |

## Todos

- [x] 新建 `src/world/planet.js`（Kimi，2026-08-02 00:48）
- [x] `main.js` 装配 `createPlanet`（Kimi，2026-08-02 00:49）
- [x] `environment.js` 添加弱 AmbientLight（Kimi，2026-08-02 00:49）
- [x] 确认太阳平行光阴影参数 + shadowMap（既有，Kimi 标注，2026-08-02 00:49）
- [x] 验收三件套通过（Kimi，2026-08-02 00:50）

## 已知事项（待主人定夺）

- 玩法世界（±20 范围）在半径 40 球体**内部**，默认 FrontSide 材质从球内看会被背面剔除，
  因此游玩视角中星球不可见（在场景图中真实存在）。
  若希望「站在星球表面」的可见效果，可将球心下移至 `(0, -42, 0)` 让球面成为大地；
  或改 `side: THREE.BackSide` / 线框材质使其从内部可见（会遮住天空球，需权衡）。
