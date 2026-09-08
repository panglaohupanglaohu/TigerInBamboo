# 红蓝短剑兵 Web 战斗回接

已接入真实 `createSaihojiPhalanxBattle` 的短剑兵生成、动作收尾、移除与重置。Web 浏览器独立场景验证 **34 项通过**；原 `test_phalanx.mjs` **6 组、15 项通过**。没有运行完整巨大世界，没有改 main、地形、Godot、总文档或 registry。

## 资产与原作保留

- 直接只读抽取认可的 `roman-armor-v3-direction.glb`（696 三角）和 `roman-shield-handle-v1.glb`（52 三角），共 6 网格。没有重建模型或启动/覆盖前台 Blender。
- 盔甲 GLB SHA-256：`22652d070ba2277e26bf3b100f381ab51f37f8ad4424563d716530b86a08fdd3`。
- 盾把 GLB SHA-256：`3c558adf9be55ece0f80bbe536eee48d79fbec2bed4778e6a7c37141a27bde18`。
- 保留原 actor、uid、武器、所有原节点/父级、原几何/材质引用和红蓝盔缨身份；盔甲挂在原 body 下，盾把挂在原盾下。仅隐藏旧盔/裙，没有删除它们。
- v3 盔甲已烘焙正确 +X 朝向，不再旋转盔甲网格。原 3 片 crest 仍在同一 body 下，只在启用时从原始矩阵计算 +90°Y 与 -.018Y；连续 720 帧确认局部矩阵稳定，没有累积旋转或平移。
- `createGladiusSoldier()` 原工厂完全未改，仍匹配原始快照。`citadelCombatV3` 的原有长枪选择保持原行为；只适配实际有 gladius 的 actor。
- 候选材料按现有 Web 的 MeshToonMaterial 渲染，采用 GLB 的线性色值；这不是自动迁移 Blender 着色器。候选数据 JS 为 148,964 字节。

## 动作与生命周期

- 每次真实战斗更新（包括 early return）之后应用表现层步态、原近战冷却触发的挥击、攀爬和精确握持。敌人选择、伤害、原 actor 转向和剧情规则不变。
- 原瞄准在 actor 尚未转身时可能让剑横穿左盾。实际姿势审查发现该问题后，只对启用适配的剑限制右手前方挥击弧，再进行位置握持校正。
- 攀爬时采用原战斗“盾在背后”的语义，左臂可抬起；剑仍跟右手。倒地/阵亡保留当前姿势及握持。可见性归原损盾、死亡和池化逻辑所有，适配不会让它们重新出现。
- Actor 回退：`actor.userData.setRomanEquipment(false)`；战斗整体回退：`battle.root.userData.setRomanEquipment(false)`；构造时可传 `romanEquipment:false`。重新启用复用自有节点。
- 从战斗树移除 actor 后，下一次战斗更新释放其适配；battle reset 立即释放所有适配。共享候选几何在最后一个适配释放时销毁，原资源不销毁。测试覆盖重复关闭、重绑、共享资源所有权、下一轮战斗创建和损盾不复活。

## 实测范围与残留

- 720 帧、每步 .05s，共 36 秒真实 battle 模块运行；独立场景只提供简单球面、城堡标记，不是完整游戏世界。
- 角色帧动作记录：guard 7600、walk 2487、strike 222、climb 606、downed 3386、dead 4979、pooled 3208。
- 另有 252 个旋转与非均匀缩放姿势测试。真实战斗中剑握持最大误差 `7.1344e-14`，盾 `6.6538e-14`；所有矩阵有限。
- 对 569 个真实非攀爬、非倒地姿势，以实际可见顶点的支持平面验证盾面与身体/双腿、盾面与剑的分离；包括原可见描边，排除有意接触的手臂和盾把。最小盾/身分离 `0.1289365`，盾/剑分离 `0.0516041`，单位为 actor 根空间。
- **裙甲仍是认可版本的 10 片静态分离裙板，随 body 整体运动，没有裙板关节或布料模拟。** 测试证明几何与挂接在运动中稳定；尚未验证裙板与运动腿的自碰撞。
- **攀爬已验证真实状态运行、有限姿态、原 crest 连续性、右手握剑并留下截图；未验证攀爬背盾/举臂与全身的几何自碰撞。** 攀爬时左手不握盾，不纳入左手握盾误差和盾身分离统计。
- 因而本报告不宣称“全身所有动作无穿插”。没有重建腿甲或扩大为全角色动画系统。

## 文件与复验

运行时代码：

1. `src/assets/romanEquipmentData.js` — 已认可 GLB 的静态提取数据。
2. `src/assets/romanSoldierEquipment.js` — 可逆盔甲/盔缨/盾把装配与握持、资源所有权。
3. `src/world/romanSoldierCombatPose.js` — 跟随实际战斗状态的表现层。
4. `src/world/saihojiPhalanx.js` — 生成、更新收尾、重置的窄接口挂接。

独立工具：

- `tools/pipeline/export_roman_equipment_web.py`
- `tools/pipeline/test_roman_equipment_web.mjs`

在 TigerMessenger 目录执行：

```sh
rtk proxy python3 tools/pipeline/export_roman_equipment_web.py
rtk proxy node tools/pipeline/test_roman_equipment_web.mjs
rtk proxy node ../tools/test_phalanx.mjs
```

浏览器测试默认访问 `http://127.0.0.1:8877/TigerMessenger`，可用 `ROMAN_TEST_BASE_URL` 指定服务地址。测试使用已存在的 Playwright 和 headless Chrome，不操作用户前台 UI。

证据：`report.json` 保存全部断言、运行时哈希和实际帧截图 actor uid/阵营/阶段；`comparison-guard/walk/strike/rear.png` 是原工厂与新装配同相机/同光照对比；`battle-walk/strike/climb/downed.png` 来自真实战斗实例及状态，只隔离其他 actor 便于观察。

实际采用技能：threejs-game-director、threejs-gameplay-systems；浏览器证据沿用此前已读取的 threejs-qa-release 独立测试流程。
