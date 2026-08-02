# 球面玩家（立方体 + 球心引力）· PLAN（2026-08-02 00:59 起）

> 负责人标注：**Kimi** 实现并验收；**Grok** 请跳过已完成项，勿重复动工。
> 范围说明：做成独立实验页 `planet.html`，**不改动**现有信使平台跳跃玩法
> （两套物理模型不同：平面重力 vs 球心引力）。

## 需求（主人 2026-08-02 00:59 提出）

1. 监听键盘 WASD；
2. 玩家"向下引力方向"永远指向球心；
3. 玩家本地 Up 轴始终垂直于球面；
4. 按 WASD 时沿球面平滑滑行，不脱离、不陷进球体。

## 核心伪代码（每帧）

```
up       ← normalize(player.position)          # (3) 本地 Up = 球面法线
camF     ← camera.forward 去掉 up 分量 → 归一化  # 相机朝向投影到切平面
camR     ← cross(camF, up)                      # 切平面右向
wish     ← WASD 输入 × (camF, camR) → 归一化     # (1) 期望滑行方向
velocity ← lerp(velocity, wish × SPEED, 平滑)    # (4) 切向速度平滑趋近
velocity ← velocity − up × G × dt               # (2) 引力永远指向球心
position ← position + velocity × dt
position ← normalize(position) × (R + half)     # (4) 半径锁定：不脱离不陷入
velocity ← velocity − up × dot(up, velocity)    # 触面：消去径向速度
quat     ← Basis(right = up × forward, up, forward)
mesh.quaternion ← slerp(quat)                    # (3) 朝向贴合球面
camera.up ← up                                   # 相机 up 同步球面法线
```

要点：引力只负责"压住"，半径锁定负责"不穿不飞"——两者配合，
任意 dt、任意按键组合下玩家都贴在球面上。

## 落地记录

| 项 | 实现 | 负责 | 时间 |
|---|------|------|------|
| 球面玩家核心 | `src/planet/sphericalPlayer.js`：`createSphericalPlayer` + `updateSphericalPlayer` | Kimi | 01:00 |
| 实验页装配 | `src/planet/main.js`：星球（复用 `world/planet.js`）+ 环境光/太阳平行光（带阴影）+ 球面跟随相机 | Kimi | 01:01 |
| 入口页 | `planet.html`：importmap（CDN three@0.172）+ 操作提示 | Kimi | 01:01 |
| 验证 | 无头 Chrome：加载 → 按 W 滑行 3s → 双截图，控制台零 error/warning | Kimi | 01:02 |

## Todos

- [x] WASD 监听（Kimi，2026-08-02 01:00）
- [x] 球心引力：`-up × G × dt`（Kimi，2026-08-02 01:00）
- [x] Up 轴对齐球面法线：位置归一化 + makeBasis 朝向（Kimi，2026-08-02 01:00）
- [x] 球面滑行 + 半径锁定（不脱离/不陷入）（Kimi，2026-08-02 01:00）
- [x] 无头验证截图 ×2（`tools/e2e/e2e-planet-idle.png` / `e2e-planet-move.png`）（Kimi，2026-08-02 01:02）
- [x] 球面跳跃（沿 +up 冲量，落回球面）（**Grok**，2026-08-02）
- [x] 相机滚轮缩放 / 中键环绕（复用 `core/input.js`）（**Grok**，2026-08-02）
- [x] 球面世界化：平台/NPC/信件贴球面排布（**Grok**，2026-08-02，主人批准）
  - `sphereMath.js` 平面设计坐标 → 北极附近球面
  - 主游戏：球面重力/跳跃、贴地平台碰撞、NPC 贴台、球面相机与罗盘

## 已知事项

- 实验页相机在球外，淡青星球从外部可见（与主游戏"球内不可见"互补）。
- 实验页用静态 importmap 直连 CDN，未接 vendor 兜底（lab 性质；正式化时再补）。
- 北极点相机方向投影会退化（`lengthSq < 1e-6` 时回退用玩家朝向），已处理。

---

# 阶段二 · 程序化 Low-Poly 资产生成（2026-08-02 01:06 起）

> 负责人标注：**Kimi** 实现并验收；**Grok** 请跳过已完成项。

## 需求（主人 2026-08-02 01:06 提出）

纯代码实时拼接免下载 3D 树木和房子：`createLowPolyTree()` / `createLowPolyHouse()`，
只用圆锥/圆柱/立方体等基础几何体；MeshToonMaterial + flatShading 棱角；
返回 `THREE.Group`，底部中心对齐局部 `(0, 0, 0)` 以便贴球面。

## 落地记录

| 项 | 实现 | 负责 | 时间 |
|---|------|------|------|
| 资产函数 | `src/assets/lowPoly.js`：树 = 圆柱树干 + 三层圆锥树冠（高 ~2.7）；房子 = 立方体墙身 + 四棱锥屋顶（ConeGeometry 4 段旋转 45°）+ 门 + 窗 + 烟囱（高 ~1.9）；均返回 Group、底部中心在原点 | Kimi | 01:07 |
| 贴球面工具 | 同文件 `placeOnSphere(obj, latDeg, lonDeg, R)`：纬度/经度 → 球面位置 + 局部 +Y 对齐法线 | Kimi | 01:07 |
| 演示摆放 | `src/planet/main.js`：出生点附近 5 树 + 2 房贴球面 | Kimi | 01:08 |
| 验证 | 无头 Chrome 双截图（`e2e-planet-assets*.png`），控制台零 error/warning | Kimi | 01:09 |

## 与需求的偏差（实测证据）

- 要求「MeshToonMaterial 必须设 `flatShading: true`」：**r172 的 MeshToonMaterial
  不支持该属性**，构造时控制台告警（无头验证实测 8 条 warning）。
  等效落地：几何体经 `facet()`（`toNonIndexed()` + `computeVertexNormals()`）
  转平直法线，低多边棱角效果相同，材质仍为 MeshToonMaterial。

## Todos

- [x] `createLowPolyTree()`（Kimi，2026-08-02 01:07）
- [x] `createLowPolyHouse()`（Kimi，2026-08-02 01:07）
- [x] 底部中心对齐局部原点（树干/墙身底部在 y=0）（Kimi，2026-08-02 01:07）
- [x] flatShading 等效：`facet()` 平直法线（Kimi，2026-08-02 01:09）
- [x] `placeOnSphere()` 贴球面 + 实验页演示摆放（Kimi，2026-08-02 01:08）
- [x] 无头验证双截图（Kimi，2026-08-02 01:09）
- [x] 更多资产：石头 / 花草 / 栅栏 / 桥（**Grok**，2026-08-02，`lowPoly.js`）
- [x] 随机散布系统：`scatterOnSphere` 按纬度带撒资产（**Grok**，2026-08-02）
- [x] 资产碰撞体：切向推开玩家（**Grok**，2026-08-02）

---

## 阶段二扩展 · 验收记录（Kimi 2026-08-02 07:12）

> 本轮由 **Grok** 实时实现（球面跳跃 / Shift 疾跑 / 相机缩放环绕 /
> 石·花·栅栏·桥资产 / `scatterOnSphere` 散布 / 切向碰撞 / planet.html vendor 兜底），
> **Kimi** 负责验收与评审，未重复动工。

### 验收（无头 Chrome，planet.html）

- 路径：加载 → 前进+疾跑 1.2s → Space 跳跃（空中截图）→ 落地续行
- 截图：`tools/e2e/e2e-planet-scatter.png`（散布全景）/
  `e2e-planet-jump.png`（立方体明显离地，影子分离）/`e2e-planet-after.png`
- 控制台：零 error / 零 warning ✅

### Code review 纪要

- `lowPoly.js` 新资产与既有约定一致（facet 平直化 / toon / 底部原点 / `userData.collideRadius`）✅
- `scatterOnSphere`：LCG 可复现种子；花草（0.15）被 `cr >= 0.25` 过滤不进碰撞，合理 ✅
- 两个已知小瑕疵（不阻塞，后续可优化）：
  1. 纬度均匀采样导致高纬度资产偏密（面积元未按 cos(lat) 加权）
  2. 无最小间距检查，资产可能相互穿插
- `sphericalPlayer.js`：`resolveSphericalColliders` 内有一段空 if 死代码（82–86 行）；
  碰撞推开后只防下陷、径向微浮由引力自然回落，行为正确 ✅

### Todos

- [x] 17b 验收：无头截图 ×3 + 移动/疾跑/跳跃路径（Kimi，2026-08-02 07:12）
- [x] 散布密度按 cos(lat) 加权 + 最小间距检查（**Grok**，2026-08-02）
  - `sin(lat)` 均匀采样 ⇒ pdf∝cos(lat)；`minSpacing` 弦长 + 重试
- [x] 清理 `resolveSphericalColliders` 死代码段（**Grok**，2026-08-02）
  - 切向推开后 `setLength(rKeep)` 保持径向

---

## 第三人称球面相机 · 平滑 Up 翻转（2026-08-02 07:14 起）

> 负责人标注：跟随框架（lerp 斜后方 + lookAt + up 对齐法线）为 **Grok** 既有实现；
> 本轮 **Kimi** 补齐「Up 平滑翻转」并做球底实测。

### 需求（主人 2026-08-02 07:14 提出）

1. Vector3.lerp 平滑保持在玩家斜后方低空；2. lookAt 永远聚焦玩家；
3. 玩家到球体侧面/底部时相机 Up 轴**平滑**翻转，屏幕上玩家永远"头顶朝上"。

### 现状盘点与改动

- 既有（Grok）：`planet/main.js` `updateFollowCamera` 已满足 1、2，
  且 `camera.up` 对齐球面法线——但为**每帧硬拷贝**，跨半球瞬间姿态跳变。
- 本轮（Kimi）：新增 `_upSmooth` 向量，每帧
  `_upSmooth.lerp(球面法线, 1-exp(-4dt))` 后归一化作为 `camera.up` 与 lookAt 偏移基准；
  过对跖点（lerp 中间向量近零长）有兜底。`camera.position.lerp` 维持不变。

### 核心伪代码（每帧）

```
upTarget ← normalize(player.position)          # 球面法线
upSmooth ← normalize(lerp(upSmooth, upTarget, 1-e^(-4dt)))   # Up 平滑翻转
back     ← -player.forward 投影到切平面，按 orbit 角绕 up 旋转
desired  ← player.pos + upTarget×height + back×camDist        # 斜后方低空
camera.position ← lerp(camera.position, desired, 1-e^(-6dt))  # 平滑跟随
camera.up ← upSmooth
camera.lookAt(player.pos + upSmooth×0.6)                      # 聚焦玩家
```

### 验收（无头 Chrome，2026-08-02 07:15）

- 疾跑直冲 9s → 球体侧面截图 `e2e-cam-side.png`：玩家直立、地面在屏幕下方 ✅
- 继续至 18s → 球体背面/底部截图 `e2e-cam-bottom.png`：玩家仍"头顶朝上"，
  无瞬间倒转（背面光照变暗为向阳角度所致，正常）✅
- 控制台零 error / 零 warning ✅

### Todos

- [x] Up 平滑翻转：`_upSmooth` lerp + 归一化 + 对跖点兜底（Kimi，2026-08-02 07:14）
- [x] 球体侧面/底部实测截图 ×2（Kimi，2026-08-02 07:15）
- [x] 可选：把相机封装为 `src/planet/followCamera.js` 独立模块（**Grok**，2026-08-02）

---

## 球面 NPC 系统（2026-08-02 07:21 起）

> 负责人标注：**Kimi** 实现并验收；**Grok** 请跳过已完成项。

### 需求（主人 2026-08-02 07:21 提出）

1. 球面固定位置生成 3 个不同颜色的方块 NPC；
2. 主循环实时计算玩家与每个 NPC 的三维距离；
3. 距离 < 5 时屏幕中央 HTML 层显示「按 E 键与 NPC 对话」。

### 落地记录

| 项 | 实现 | 负责 | 时间 |
|---|------|------|------|
| NPC 模块 | `src/planet/npcs.js`：`NPC_DEFS`（红/绿/蓝三方块，固定经纬度）、`createNpcs`（`placeOnSphere` 贴球面、底部对齐）、`findNearbyNpc`（`distanceTo` 三维距离，返回 5 内最近者） | Kimi | 07:22 |
| 提示层 | `planet.html`：`#npc-hint` 屏幕中央，`.show` 控制显隐（opacity 过渡） | Kimi | 07:22 |
| 主循环接线 | `src/planet/main.js`：每帧 `findNearbyNpc` → `classList.toggle("show", …)` | Kimi | 07:23 |

### 验收（无头 Chrome，2026-08-02 07:23）

- 出生点（红方在正前方约 7 单位）：提示隐藏（DOM 断言 `show=false`）✅
- 按 W 前进 1s 进入 5 单位圈：提示出现（DOM 断言 `show=true`）✅
- 截图 `e2e-npc-far.png` / `e2e-npc-near.png`；控制台零 error/warning ✅

### Todos

- [x] 3 色方块 NPC 固定位置生成（Kimi，2026-08-02 07:22）
- [x] 主循环三维距离检测（Kimi，2026-08-02 07:23）
- [x] 距离 < 5 中央提示显隐（Kimi，2026-08-02 07:23）
- [x] 无头验证 DOM 断言 + 截图（Kimi，2026-08-02 07:23）
- [x] E 键按下后的对话行为（对话框）（**Kimi** 落地 + **Grok** 文案/链化增强，2026-08-02）

---

## 对话框 UI + 送信任务状态机（2026-08-02 07:26 起）

> 负责人标注：**Kimi** 实现并验收；**Grok** 请跳过已完成项。

### 需求（主人 2026-08-02 07:26 提出）

纯 HTML/CSS/JS 极简对话框盖在 3D 场景之上；任务状态机：
NPC A 处按 E → 显示「请把这封信送给 NPC B」、状态变「携信中」；
NPC B 处按 E → 显示「谢谢你！任务完成」、状态清除、加一分。

### 落地记录

| 项 | 实现 | 负责 | 时间 |
|---|------|------|------|
| 状态机 | `src/planet/letterQuest.js`：`idle → carry → idle`；A=红方（发信）、B=绿方（收信）、蓝方不参与；`tryTalk()` 按 E 时依据最近 NPC + 当前状态推进，文案常量 `QUEST_TEXT` | Kimi | 07:26 |
| 对话框 UI | `planet.html`：`#dialog` 底部居中极简面板（opacity 过渡）；`#score-badge` 右上计分 | Kimi | 07:27 |
| 接线 | `src/planet/main.js`：keydown `KeyE`（去 `repeat`）→ `tryTalk()` → 显示对话 3.2s 自动隐藏；`onScore` 更新计分；`window.__lab` 调试句柄（无头验收用） | Kimi | 07:27 |

### 验收（无头 Chrome，2026-08-02 07:28，DOM 断言）

- 走到 A 按 E：`show=true, text="请把这封信送给 NPC B", state="carry", score=0` ✅
- 到 B 按 E：`show=true, text="谢谢你！任务完成", state="idle", score=1` ✅
- 截图 `e2e-quest-accept.png` / `e2e-quest-done.png`；控制台零 error/warning ✅

### Todos

- [x] 任务状态机 `letterQuest.js`（Kimi，2026-08-02 07:26）
- [x] 对话框 + 计分 UI（Kimi，2026-08-02 07:27）
- [x] E 键接线 + 对话自动隐藏（Kimi，2026-08-02 07:27）
- [x] 无头全链路断言（Kimi，2026-08-02 07:28）
- [x] 携信中的视觉表现（玩家头顶信件图标/光环）（**Grok**，2026-08-02）
- [x] 任务链化：送达后随机指派下一对 NPC（**Grok**，2026-08-02）

---

## 全套规格（10 步）对照检查 + 缺口修复（2026-08-02 07:32 起）

> 负责人标注：**Kimi** 主导检查与修复；期间 **Grok** 并行完成了任务链化、
> 相机模块化（followCamera.js）、散布 cos(lat) 加权与最小间距，已保留合并。

### 原版调研（补第 1 步欠账）

- [游侠网](https://www.ali213.net/news/html/2025-10/971123.html)、[游民星空](https://www.gamersky.com/news/202510/2032184.shtml)、
  [cosine.ren FE Bits](https://news.cosine.ren/p/vol-15)：Abeto《Messenger》= 小星球邮递员、
  Low-fi 卡通、约 5 个送信任务、自由探索（坠落绕球到另一侧）、多人 emoji 轻社交、
  Awwwards SOTD。我们的复刻方向（球面世界 + 低多边 + 送信任务链）与之对齐 ✅

### 十步合规表

| # | 规格 | 状态 | 说明 |
|---|------|------|------|
| 1 | 单文件 index.html + CDN Three.js + 场景/相机/渲染器/循环 | ✅（演进） | 已从单文件演进为模块化 `index.html` + `src/`； vendor 兜底 |
| 2 | 星球 r=40 淡青 + 弱环境光 + 太阳平行光阴影 + shadowMap | ✅ | `world/planet.js` + 实验页光源组 |
| 3 | 球面玩家：WASD / 引力向球心 / Up⊥球面 / 滑行不脱离 | ✅ | `planet/sphericalPlayer.js` |
| 4 | createLowPolyTree/House，Group 底部对齐原点 | ✅（有偏差记录） | r172 MeshToonMaterial 不支持 flatShading → `facet()` 平直法线等效 |
| 5 | createLowPolyRock（顶点扰动）+ createLowPolyCloud | ✅ 本轮修复 | 岩石改为二十面体顶点扰动（坐标哈希共享扰动防裂缝）；新增 4 球云朵 |
| 6 | populatePlanet：50 树/10 房/30 岩 + 经纬度四元数贴合 + 云高 5 | ✅ 本轮对齐 | `scatterOnSphere`（即 populate 实现）数量改 50/10/30，clouds:10 高度 +5；花/栅栏/桥为规格外点缀 |
| 7 | 相机 lerp 斜后方 + lookAt + Up 平滑翻转 | ✅ | `followCamera.js`（`_upSmooth`） |
| 8 | 右键拖拽 yaw/pitch 环视 + 松手平滑回弹 | ✅ 本轮实现 | 原为中键仅 yaw 无回弹；现右键 yaw+pitch，松手指数回弹（实测 yaw -1.0 → -0.03） |
| 9 | 3 个不同颜色独特几何体 NPC + 距离<5 中央提示「[E] 与居民交谈」 | ✅ 本轮修复 | 原为三方块+旧文案；现 红=立方体/绿=圆锥/蓝=球体，文案对齐 |
| 10 | 对话 UI + 状态机：A 接信「你能帮我把这封信送给岛对面的小蓝吗？」→ 携信中；B（小蓝）送达「哇，谢谢你的信！」→ 投递成功 +1 | ✅ 本轮对齐 | 首局固定 红方→蓝方 且用规格原文；后续保留 Grok 随机任务链 |

### 新增：隐藏开发者菜单（主人 07:32 要求）

- `src/planet/params.js`：可调参数对象 `P`（移动/疾跑/引力/跳跃/相机三率/对话距离），运行时每帧读取
- `src/planet/devPanel.js`：右上角 🤖 图标呼出面板；分组滑杆（玩家/相机/交互/光照）+
  FPS 读数 + 重置全部；光照直调 `sun/ambient.intensity`
- `planet.html` 面板样式；`main.js` 接线（`onCamDist` 回调、`devPanel.tick(dt)`）

### 验收（无头 Chrome 13 项全过，2026-08-02 07:51）

云朵 10 朵高度 ✓ / NPC 三种几何体 ✓ / 提示文案 ✓ / A 接信文案+携信中 ✓ /
B 送达文案+状态清除+投递成功 1 ✓ / 右键环视生效+回弹 ✓ / 面板呼出+调参+FPS ✓ /
控制台零 error/warning ✓。截图：`e2e-spec-quest.png`、`e2e-spec-devpanel.png`。

### Todos

- [x] 原版调研（Kimi，07:33）
- [x] Rock 顶点扰动 + Cloud（Kimi，07:37）
- [x] 散布 50/10/30 + 云高 5（Kimi，07:44）
- [x] 右键 yaw/pitch + 回弹（Kimi，07:46）
- [x] NPC 独特几何体 + 文案对齐（Kimi，07:44）
- [x] 开发者菜单（Kimi，07:41–07:48）
- [x] 13 项综合验收（Kimi，07:51）
- [x] 云朵漂移动画（**Grok**，2026-08-02）：绕轴公转 + 径向起伏 `updateClouds`
- [x] 开发者面板持久化（**Grok**，2026-08-02）：`tm.planet.devParams.v1` 读写

---

## 实验页并入主游戏（2026-08-02 08:28 起，主人定夺：合并）

> 负责人标注：双线并行——**Kimi**：`core/params.js`、`player/controller.js` 参数化、
> `core/camera.js` 右键环视+回弹、`core/input.js` 右键钩子、`world/nature.js`（云环+远侧资产）、
> 消重（input.js 钩子统一，去掉 main.js 本地右键块防 2x yaw）、合并验收。
> **Grok**（并行）：`core/devPanel.js`、`questSystem` talkRange 参数化、
> `environment.js` 返回灯光引用、`index.html` 面板样式、main.js 面板接线。

### 背景

主人指出 `/TigerMessenger/`（夜色成熟版）与 `/planet.html`（白天教学版）场景差距过大。
成因：教程式需求全部长在隔离沙盒（怕冲坏主游戏），同期 Grok 把主游戏也球面化，
两条线各自演进。主人选择：**实验页并入主游戏，home 入口即完整版**。

### 移植清单（实验页 → 主游戏）

| 项 | 落地 | 负责 |
|---|------|------|
| 开发者菜单 | `core/params.js`（P + `tm.devParams.v1` 持久化）+ `core/devPanel.js` + index.html 样式；controller/camera/questSystem 参数化 | Kimi + Grok |
| 右键环视 yaw/pitch + 松手回弹 | `core/camera.js`（camOrbit/camPitch + SPRING_BACK）+ `core/input.js` 右键钩子 | Kimi |
| 云朵 | `world/nature.js` `createCloudRing`（10 朵、距球面 8、`updateClouds` 漂移） | Kimi |
| toon 资产点缀 | `world/nature.js` `decorateFarSide`（远侧 lat -20°..45°：24 树/10 岩/16 花/3 房，纯装饰无碰撞，避让游玩区北纬 55°+） | Kimi |
| 提示文案 | hint 栏加「右键拖拽 环视」 | Kimi |

### 验收（2026-08-02 08:40）

- 主游戏三件套：语法 ✓ / 截图 ✓ / 控制台零告警 ✓
- 自定义断言 6 项全过：云环 10 朵全漂移 ✓ / 远侧 Toon 网格 209 个 ✓ /
  右键环视 yaw=-1.00 pitch=0.44 ✓ / 松手回弹 yaw=-0.03 ✓ / 面板呼出+调参 ✓
- 截图：`tools/e2e/e2e-merge-main.png`
- 实验页 `planet.html` 保留为教学沙盒（页内已有「← 主游戏」回链）

### Todos

- [x] 主游戏参数化 + devPanel 移植（Kimi + Grok，08:30–08:34）
- [x] 右键环视 + 回弹（Kimi，08:32；消重 08:36）
- [x] 云环 + 远侧资产（Kimi，08:37）
- [x] 合并验收（Kimi，08:40）
- [x] 主游戏部署更新（push 最新合并版到 Pages）（**Grok**，2026-08-02，`94ea31c`）

---

## 配色明亮化 + 游玩区植被（主人 2026-08-02 08:45 反馈）

> 负责人标注：**Kimi** 实现并验收。

### 主人反馈

1. 实验页配色没调到游戏页；2. 游戏页看不到植物和房屋。

### 根因与修复

| 问题 | 根因 | 修复 |
|------|------|------|
| 画面暗黑 | 夜色系光照/天空/雾；且站立面是深藏青平台（0x1a2740 系），不是淡青星球 | `environment.js` 暖阳 0xfff2d8 + 足量环境光/半球光；`stage.js` 亮雾低密度；`platforms.js` 全部改青色系（主岛 0x9adfd6）；`params.js` 默认 sun 1.4 / ambient 0.5 |
| 看不到植被 | 首版「避让游玩区」撒球另一面；次版「避平台足迹」按主岛外接圆 ~27 单位排斥，全部被拒 | `nature.js` `decoratePlayZone` 重写：直接按平面设计坐标撒在**主岛台面**（半径 3.5–16），只避 NPC 收发点（3.2）与出生点（4）；高台再放 3 棵 |

### 验收（2026-08-02 08:59）

- 三件套通过（语法/截图/控制台零告警）
- 出生点截图即见：淡青主岛、红顶房 ×2、绿树、花草、岩石、白云
  （`tools/e2e/e2e-messenger-gameplay.png`）

### Todos

- [x] 配色明亮化（Kimi，08:52）
- [x] 主岛植被房屋可见化（Kimi，08:56）
- [x] 验收截图（Kimi，08:59）

---

## 画风纠偏：日系动漫四硬伤（2026-08-02 09:20 起，主人四条纠偏提示词）

> 负责人标注：**Kimi** 实现全部四项并验收。**Grok** 期间并行把阶梯平台改为
> 暖灰岩石材质（保留，与草地形成对比）。文末附 Grok 可选项。

### 硬伤一：背景与色彩基调

- `stage.js`：`scene.background = #79D2C4`（薄荷青），同色系薄雾 0.006，杜绝死黑
- `environment.js`：环境光 0xf2fffb × 1.0（极浅青白）；半球光 天 0xd6fff2 / 地 0x3d9a5f；
  天空球改薄荷渐变（0x6ac7b9 → 0x8fe0d2）
- 大地青绿：`planet.js` 星球 #3D9A5F；主岛平台 #4AA76C（阶梯平台保留 Grok 暖灰岩）
- `params.js` 默认 sun 1.6 / ambient 1.0

### 硬伤二：硬边卡通光影（Cel-shading）

- 新建 `assets/toon.js`：`getToonGradient()` —— 代码实时生成 2 阶梯灰度
  `DataTexture`（[110, 255]，Nearest 采样）作 `gradientMap`，明暗交界彻底硬化
- `toonMat()` 统一卡通材质：平台 / 星球 / 信使 / NPC / 全部低多边资产接入
- `stage.js`：`BasicShadowMap`（硬边投影，弃软阴影）；平行光 0xfff6e0 从侧上方
  (20, 28, 16) 斜射球心；玩家/建筑/树木 castShadow、星球 receiveShadow

### 硬伤三：手绘黑边描边（Inverse Hull）

- `assets/toon.js` `addOutline(mesh, thickness)`：同几何体子网格 + 不受光
  MeshBasicMaterial（0x14202c）+ BackSide，顶点着色器沿法线外扩（材质按厚度缓存复用）
- 已应用：信使（身/头/耳/四肢）、任务 NPC（身/头）、树（干+三层冠）、
  房（身+顶）、岩石

### 硬伤四：日系极简 UI

- `index.html` 尾部追加主题覆盖块（不改旧规则、可回退）：
  乳白半透明 `rgba(255,255,255,0.85)` 面板、文字深藏青 #1a2638（杜绝纯黑）、
  圆角 8px、柔和扩散阴影 `0 8px 24px rgba(26,38,56,0.14)`、现代无衬线字体栈
- 覆盖：任务面板/信件清单/计分/信袋/罗盘/提示条/Toast/气泡/NPC 提示/开场卡/开发者面板
- 文案去夜色残留：「夜色信使」→「小星球信使」

### 验收（2026-08-02 09:53）

- 三件套通过（语法/截图/控制台零告警）×3 轮迭代
- 截图确认切变：薄荷天空 + 青绿草地 + 生硬黑投影 + 全场景黑描边 + 乳白 UI
  （`e2e-messenger-gameplay.png` / `e2e-messenger-accept.png`）

### Todos

- [x] 硬伤一 天空与色彩基调（Kimi，09:30）
- [x] 硬伤二 硬边卡通光影 + 2 阶梯 gradientMap（Kimi，09:35）
- [x] 硬伤三 Inverse Hull 黑边描边（Kimi，09:45）
- [x] 硬伤四 日系极简 UI（Kimi，09:50）
- [x] 三轮截图迭代核验 + 回归（Kimi，09:53）
- [x] 单独部件画风修正：木路标替换电线杆；软云；清除月亮星点夜景光点（**Grok**，2026-08-02）
- [x] 描边厚度按资产类型微调 `OUTLINE` 常量（角色/树冠/远景）（**Grok**，2026-08-02）

---

## 世界观重构：东方古典水墨手绘风（2026-08-02 11:12 起，主人命题）

> 负责人标注：**Kimi** 实现并验收。参考：雪舟《四季花鸟图屏风》美术质感。

### 画布与背景

- `stage.js`：`scene.background = #DFD5C3`（宣纸米色）+ `FogExp2(#DFD5C3, 0.015)` 留白雾霭
- `environment.js`：天空球改米色渐变（0xe6dcca → 0xcfc4ae）；半球光换暖调
- 地面压饱和：星球 0x3f7a58、主岛 0x55875f（沉绿，与绢本米色相称）

### 光照与水墨色块

- 环境光 `#FFFDF6 × 0.9`（微暖浅黄），`params.js` 默认同步
- 硬边投影沿用 `BasicShadowMap`；`facet()` 平直法线 = flatShading 几何等效（r172 Toon 无此属性），无塑料反光

### 新资产（`assets/ancient.js`）

- `createAncientPineTree()`：3 节低分段圆柱逐节随机弯折成扭曲老干（焦黑 #2A2621），
  3~5 片扁平多面体云片松冠（墨绿 #1C3024），加粗描边 0.032
- `createCraneNPC()`：S 曲两段长颈、乳白身体、墨黑尾羽/喙/腿、丹红头顶，
  全基础几何体实时拼接
- `createBlackRock()` + `createCraneOnRock()`：焦墨黑岩（顶点扰动）+ 仙鹤立岩组合
- 布局：游玩区树全部换古松；仙鹤立黑岩 ×2 落主岛（避 NPC/出生点）；高台树同步换古松

### 描边

- `addOutline` 毛笔版（提按 + 飞白）厚度上调：古风资产 0.032（原 0.01~0.02）

### 验收（2026-08-02 11:18）

- 三件套两轮通过（第一轮草地过艳，压饱和后复验）
- 截图：宣纸天 + 雾霭 + 沉绿地 + 古松扭曲焦干 + 硬墨影（`e2e-messenger-gameplay.png`）

### Todos

- [x] 宣纸底色 + 雾霭 + 暖白光照（Kimi，11:13）
- [x] 古松 / 仙鹤 / 黑岩资产（Kimi，11:15）
- [x] 布局接入 + 地面压饱和（Kimi，11:17）
- [x] 房屋/街道资产水墨化（墙改宣纸白、瓦改黛青/墨灰）（**Grok**，2026-08-02）
- [x] 远侧资产同步水墨化（沉绿树/焦墨岩/低饱和花）（**Grok**，2026-08-02）

---

## 月亮湖（水域）（2026-08-02 11:25 起，主人命题）

> 负责人标注：**Kimi** 实现并验收。

### 设计

- 选址 `(4, -1)`（主岛低洼处）：小虎→阿竹、驿站→远方两条主线动线在此交汇，逼出绕湖小径
- 月牙形湖面：外圆 - 偏心内圆缺口（`THREE.Shape` + hole），浅水墨青 0x4a7a8a 半透明
- 深水：墨青暗色圆 0x2e5568（视觉标识阻挡区），圆心偏移避开月牙缺口
- 环湖小径：沙色环带（内 3.8 / 外 4.7），引导绕湖动线

### 物理

- 浅水：切向进入湖缘（r<3.5）且贴台面 → `player.wadeFactor = 0.55`，controller 速度乘算
- 深水：作为碰撞体并入 `resolveAssetColliders`（切向阻挡，与资产同套）
- `nature.js` 散布净空：湖及小径范围不撒资产

### 验收（2026-08-02 11:31）

- 浅水 `wadeFactor=0.55` ✓；深水圆心被推至边界（1.98/1.95）✓；湖缘外不减速 ✓
- 三件套通过；截图 `e2e-lake.png`（月牙水面 + 环湖沙径 + 古松环绕）

### Todos

- [x] 月牙湖视觉 + 环湖小径（Kimi，11:27）
- [x] 浅水减速 / 深水阻挡（Kimi，11:28）
- [x] 无头验证 + 绕湖截图（Kimi，11:31）
- [x] 涟漪动画 / 涉水水花粒子（**Grok**，2026-08-02）
- [x] 湖面倒影（廉价版：水下暗色月牙剪影 + 微呼吸）（**Grok**，2026-08-02）
