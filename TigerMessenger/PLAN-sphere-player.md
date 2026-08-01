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
