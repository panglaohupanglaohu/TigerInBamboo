# 能力库（src/capabilities）

学到的方法在这里变成**可以直接在场景上执行的代码**。场景工坊（TigerMessenger/pipeline.html）扫描时加载
`registry.js`，不再解析声明文本，也不是 agent 的 skill。

## 一个能力 = 三样东西

| 导出 | 作用 | 运行位置 |
|---|---|---|
| `meta` | id、所属场景层（terrain / building / water / effects…）、名字、做什么、**来源视频 ID**、能作用的物件、Router 关键词、参数（含范围） | 任意 |
| `match(world, ctx, params)` | 扫描当前 World，返回能作用的物件 `[{ id, cells, focus, score, reason }]`；`reason` 用一句中文说明为什么匹配 | Worker |
| `run(world, { targets, params, ctx })` | 在**副本**上执行，返回 `{ applied }`；只改 `ctx.allowed` 允许的格子 | Worker |

`kind2: 'geometry'` 改体素；`kind2: 'layer'` 只加显示层（three.js 实现在 `layers.js`，主线程），
`layer3d` 指向 `layers.js` 里的工厂名。改体素的能力也可以带 `layer3d`（例如灯塔加高后自动挂灯室）。

只依赖 World 的位掩码字段（`ops.js`），所以游戏里的 World 副本（src/vendor/…）和库里的 World 都能用。

## 现有能力

| id | 层 | 类型 | 来源视频 |
|---|---|---|---|
| terrain.arch 石拱 / 天桥 | 地形 | 改体素 | 1670794261669769217 · 1584623053061099520 · 1189908238566903808 |
| terrain.overhang 崖顶悬垂 | 地形 | 改体素 | 1671808851895627776 |
| terrain.seastack 海中石柱 | 地形 | 改体素 | 1708815475801505819 |
| terrain.tunnel 穿山隧道 | 地形 | 改体素 | 906425294533394432 · 906416813810049025 |
| build.lighthouse 海边灯塔 | 建筑 | 改体素 + 灯室层 | 1331905048801144836 |
| build.lighthouse-light 灯室与光束 | 建筑 | 显示层 | 1331905048801144836 |
| water.volume 体积浅水 | 水 | 显示层 | 1758251637280268481 |
| effects.smoke 烟囱炊烟 | 烟火 | 显示层 | 1015140880666300416 等四段 |

## 执行与验证

- `registry.js`：`matchAll`（扫描）、`runPlan`（按顺序在同一副本上执行）、`routeGoal`（Router：改造方向关键词 + 场景里确实有可作用物件）。
- `verify.js`：验证 Worker 的五项检查——改动范围、手工建筑保留、结构承托（3D 连通）、通行（导航图可达格）、几何量（外露面）。fail 的候选不能写入。

## 新增一个能力

1. 写模块，导出 `meta / match / run`（显示层再在 `layers.js` 加工厂）。
2. 在 `registry.js` 的 `CAPABILITIES` 里登记。
3. `node tools/test-capabilities.mjs` 通过。
4. 刷新场景工坊：能力出现在左侧对应场景层，扫描能匹配到物件，学习工坊对应视频旁出现「⚙ 能力代码」入口。
