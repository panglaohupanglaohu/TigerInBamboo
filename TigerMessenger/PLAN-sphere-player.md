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
- [ ] 球面世界化：平台/NPC/信件贴球面排布（**Grok**，需主人批准后再动主游戏）

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
