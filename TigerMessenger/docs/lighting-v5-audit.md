# V5 K0 · 全仓 Light 创建点审计表

> 2026-08-22 Kimi。范围：`TigerMessenger/src/**`（排除 vendor 与 shot-harness 实验页）。
> 结论先行：全局灯集中在 `environment.js`（4 个），V5 由 `lightingDirector.js` 接管；
> 局部点光散在资产/玩法文件中，K4 统一迁入 `LocalLightRegistry`。

## 全局灯（V5 接管对象）

| 位置 | 类型 | 参数 | 用途 | 生命周期 | V5 处置 |
|---|---|---|---|---|---|
| `src/world/environment.js:10` | AmbientLight | 白 ×1.4（P.ambientIntensity） | 全局环境底光 | 常驻 | 隐藏，由 `osk-v5-ambient-floor` 替代 |
| `src/world/environment.js:13` | HemisphereLight | 白/米 ×0.72 | 天空/地面填充 | 常驻 | 隐藏，由 `osk-v5-sky-ground-fill` 替代 |
| `src/world/environment.js:16` | DirectionalLight | 白 ×1.6，castShadow，shadow camera 固定 ±25/near1/far90/map2048 | 主太阳 | 常驻 | 隐藏，由 `osk-v5-key-sun`（focusBounds 拟合 + texel snapping）替代 |
| `src/world/environment.js:29` | DirectionalLight | 薄荷 0x75cfc3 ×0.28 | 冷色补光 | 常驻 | 隐藏，不再设第二方向光 |
| `src/world/odysseyCitadel.js:1775` | AmbientLight | 白 ×0.62，**layer 1** | 圣城 Svarbova 独立光照层 | 常驻 | 保留为例外（layer 隔离），须在 registry/调试面板可见（K4 登记） |
| `src/world/odysseyCitadel.js:1785` | DirectionalLight | 0xfff4e6 ×0.95，**layer 1**，无阴影 | 圣城独立太阳 | 常驻 | 同上 |

## 局部点光（K4 迁移对象）

| 位置 | 类型 | 参数 | 用途 | 生命周期 |
|---|---|---|---|---|
| `src/world/environment.js:92` | PointLight | 0xffe8b0 ×0.35/100 | 日轮光晕 | 常驻 |
| `src/world/weather.js:154` | PointLight | 0xcfe0ff 初值0/260 | 闪电闪光 | 短时（雷击瞬间） |
| `src/scenes/saihojiGarden.js:269` | SpotLight | 0x9fffe8 初值0/280 | 苔庭鲸升空光束 | 事件触发 |
| `src/player/player.js:40` | PointLight | 青 ×0/4 | 玩家持信光环 | 携信时 |
| `src/world/moebiusTiger.js:197` | PointLight | ×0.9/5 | 虎眼发光 | 常驻 |
| `src/assets/harbor.js:~2011` | PointLight | 0xff8a32 ×0.75/3.2 | 士兵火炬 | 每火炬一个（V5 中改 emissive/halo 兜底） |
| `src/assets/ancient.js:377` | PointLight | — | 古榕树区 | 常驻 |
| `src/world/moebiusTower.js:209` | PointLight | — | 莫比斯晶塔 | 常驻 |
| `src/world/moebiusAircraft.js` 5 处 | PointLight | — | 驾驶舱/霓虹/推进器 | 随飞行器 |
| `src/world/bubblePod.js:302` | PointLight | — | 气泡艇 | 常驻 |
| `src/planet/letterQuest.js:120` | PointLight | — | 实验页任务提示 | 实验页 |
| `src/world/townscaperBuilding.js:339` | AmbientLight | — | 独立 demo 页内 | 独立页 |

## 其他光照相关写入点

- `src/core/stage.js:22-27`：renderer（shadowMap=Basic）；**未显式设置** outputColorSpace/toneMapping/exposure（吃 r172 默认）→ K1 已显式化。
- `src/world/dayNight.js`：9 关键帧 LUT，每帧直写 sun/ambient/hemi/fill/天空/雾 → V5 下 publishOnly。
- `src/world/weather.js`：雨/雪粒子 + 闪电 PointLight；K4 改 override 生命周期。
- `src/main.js` updateMoebiusBarrier：莫比斯结界直接改 skyMat/sun/ambient → V5 下作为 override 因子传导演。
- `src/world/environment.js:80`：天空球 `rotation.y = Math.PI/2` —— **主人裁决，冻结不动**（回退验收项）。
- `src/core/devPanel.js`：光照滑杆原直写 light.intensity → V5 下改写 LightingState trim；ambient 滑块上限 1→3（与默认 1.4 对齐，已修）。
