# 罗马短剑兵握持只读审查

日期：2026-09-09。对象：`romanSoldier_gladius_blue`。**只读结论；尚未实施修复。** 本次未操作用户前台，未修改检视脚本、原模型、GLB 或 Blender 原件。

## 结论

剑悬离手的根因已存在于原模型工厂：武器放在独立装备组，以固定坐标摆放，没有挂到右臂握点。原快照、Blender 存档和 GLB 都保留了这个关系，未发现相关节点的导出平移/旋转错误。

GLB 没有动画，属于另外的适配缺口；但把现有 Web 瞄准动画原样迁移也不会自动修复此间隙，因为原近战武器更新仅转向目标，不把剑柄移动到手上。

## 代码证据

- `src/assets/harbor.js:1050`：fig 整体缩放为 2。
- `src/assets/harbor.js:864`：手臂几何长度 0.15，局部中心 y=-0.075，肩枢轴位于原点。
- `src/assets/harbor.js:1097`：右臂作为 fig 子节点，肩位置 `(0, 0.305, -0.018)`。
- `src/assets/harbor.js:1643`：`createGladiusSoldier()`，隐藏原长枪，创建短剑。
- `src/assets/harbor.js:1654`：握柄长度 0.08，握柄 mesh 的局部中心为 `(0, 0.04, 0)`。
- `src/assets/harbor.js:1659`：剑组位置 `(0.2, 0.29, 0.1)`、Euler `(0.15, 0, -0.9)`；加入 `infiltration-equipment`，右臂转角另设为 0.85。
- `src/assets/harbor.js:2034`：工厂注释明确装备单独挂在 fig 上，以保留已有动画尺寸契约。
- `src/world/saihojiPhalanx.js:1989`：`aimCombatToolAt` 在装备父坐标中计算方向，只更新武器 quaternion；未计算右手位置或握柄平移。
- `tools/originals/supplemental_catalog.js:28`：短剑红／蓝变体直接由 `createGladiusSoldier` 加 `paintSoldierHelm` 生成。羽冠换色未改变握持结构。

## 归档与导出证据

检查文件：

- `assets/models/originals/supplemental/romanSoldier_gladius_blue.source.json`
- `assets/models/originals/supplemental/blender-r3/romanSoldier_gladius_blue.blend`
- `godot/assets/supplemental/romanSoldier_gladius_blue.glb`

| 节点引用 | 含义 | 原快照父节点 | GLB 父节点关系 | GLB 局部矩阵相对快照最大元素误差 |
|---|---|---|---|---:|
| n1 | fig，缩放 2 | n0 | 保留 | 0 |
| n20 | 右臂肩枢轴 | n1 | 保留 | 9.354e-8 |
| n21 | 右臂网格 | n20 | 保留 | 0 |
| n31 | infiltration-equipment | n1 | 保留 | 0 |
| n50 | right-hand-gladius | n31 | 保留 | 6.409e-8 |
| n51 | 握柄网格 | n50 | 保留 | 4.620e-9 |

误差由解析 GLB JSON 中 TRS、重建局部矩阵并与原快照比较得到，不包含整资产几何检查。节点引用来自原快照 id 和 GLB extras.three_node_id，未依赖显示名称猜测。

Blender 5.2.1 LTS 后台只读打开存档，打印上述节点 parent、matrix_local 和 matrix_world，未调用保存。Blender 使用换轴后的 Z-up：右臂肩 `(0, 0.01800002, 0.30500001)`，剑位置 `(0.2, -0.09999998, 0.28999999)`；对应原 Y-up `(x,y,z) → (x,-z,y)`。父节点与缩放保持一致；这两处位置与转换后的原值相符。后台进程已退出，未占用前台。

GLB JSON 没有 animations 字段，动画条目为 0。此结论只针对该文件，不能延伸到其他导出资产。

## 间距量化

以 fig 局部坐标计算，右臂末端采用真实臂长 0.15；剑柄取圆柱中心，不把刀刃中心误认为握点。

| 点 | fig 局部坐标 |
|---|---|
| 右臂末端：armR × `(0,-0.15,0)` | `(0.11269206, 0.20600253, -0.01800000)` |
| 剑柄中心：sword × `(0,0.04,0)` | `(0.23133308, 0.31458520, 0.10371569)` |
| 把握柄移到末端所需差值 | `(-0.11864102, -0.10858267, -0.12171569)` |

中心间距为 **0.20169431 fig 单位**，考虑 fig 的 2 倍缩放后为 **0.40338863 模型根坐标单位**。这是手臂末端到握柄中心距离，不是两表面之间最短间隙；并非游戏世界米制测量。

## 下一批最小可回退适配

1. 新建独立握持适配层和开关，保存原武器局部 transform。保留原 GLB、snapshot、Blender 源以及士兵外形。
2. 根据根 userData 的 `parts.armR`、`equipment.gladius` 引用及导出 extras 绑定右臂和剑，避免依赖子节点数组顺序。红／蓝短剑兵共用这项适配。
3. 每次姿态与武器朝向更新**之后**，计算右手目标点。可先复用同文件弓箭握持的 `BOW_HAND_LEN=0.138`（`harbor.js:1687` 附近）使握柄中心稍嵌在前臂末端；0.15 为本次测量端点，最终需目视检查握合位置。
4. 保留装备父节点，使用父坐标求平移：

   `sword.position = equipment.to_local(armR.to_global(hand_local)) - sword.basis * grip_local`

   其中 `hand_local=(0,-0.138,0)` 为候选，`grip_local=(0,0.04,0)`；Godot 使用其 Node3D 坐标接口。这样保留原武器朝向控制，避免重挂父节点破坏原瞄准逻辑。禁用时恢复缓存 transform。
5. 验证站立、摆臂、朝不同目标瞄准三种姿态，检查握柄距离、剑与盾/身体穿插及红蓝变体一致性。展示开关前后对照，不能以改一帧截图宣称全部士兵动画完成。

本批仅定位与记录。**下一实际动作是可回退握持候选，而不是重新生成士兵或覆盖用户正在查看的资产。**
