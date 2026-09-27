## 2026-09-24 水晶城 V7 已接入 8931 默认游戏

用户要求在真实游戏中看到改动：默认入口现在启用 r03（三座原工厂塔的比例、晶面、暖色花厅；原动态湖沼树的比例；Blender r03 导出的317个岸台/植被/侧泊位网格，以及按真实球面重建的连桥）。`?crystalV7=0` 可对照旧布局；普通入口无需美术开关。`?autostart=1&tour=crystal-v7` 直接从原母塔港进入游戏。

母塔原方向、根高度和港口引用保留；湖沼原对象、更新函数、角色/故事引用继续使用。东塔由探索位置(.61,.25)内移至(.45,.25)，修正岸台低于当地海面的情况。新增岸台/桥面接入原玩家地面查询。验证：默认页3塔、港口存在、湖沼更新函数存在、无pageerror；移位后22段连桥支撑采样通过；原港口F键真实登船通过。证据 `artifacts/pipeline/crystal-v7-live/baseline.{png,json}` 和 `artifacts/pipeline/moebius-crystal-city-target/mother-port-live-check.json`，复现 `tools/pipeline/check_crystal_v7_live.mjs`。

这是游戏回接，尚非目标图整体美术验收：原山体/高架仍遮挡部分构图，局部台面与原地形叠压、外圈铁路及完整步行/剧情路线还需持续迭代。支撑射线通过不等于全路线人工通关。没有修改Claude负责的Python环境。以下旧候选记录作为历史保留，以本条状态为准。

# 水晶城 V7 · 三轮 Blender / Godot 候选（2026-09-24）

用户指定 `assets/concepts/moebius-crystal-city/target-v7-swamp-enclosure.png` 为目标，要求推进三轮。已完成三轮**局部美术候选**，不是 V7 全城完成或正式球面世界回接。原全球场景保留；此次主要成果在同一 Godot 工程的独立检视场景。

## 打开

- Godot 测试大厅 → **水晶城 V7 · 三轮美术对照**。
- 场景：`godot/scenes/crystal_v7_review.tscn`。拖动旋转、滚轮缩放，按钮切换三轮；默认第三轮。
- 对照页：`artifacts/pipeline/crystal-v7-three-rounds/index.html`。包含 V7 原目标和三轮实际 Godot 图片。
- Blender：`assets/models/optimized/crystal-v7/crystal-v7-r01.blend`、`r02.blend`、`r03.blend`（后两者同名前缀）。对应 GLB 同目录，Godot 副本在 `godot/assets/art-pilots/`。

## 来源和三轮变化

先从当前 Web 原场景导出三座原花厅塔及完整原湖沼组装件，保存 `round-1-source.glb`。原世界原本只显示两塔，第二子塔被旧轨道避让筛选跳过。探索性 `?crystalV7=1` 参数补全三塔并移动湖沼，保留母塔的实测港口坐标；其铁路/旧山体穿插未通过，**此参数不是最终三轮原生模型，也不作为正式入口**。

随后在 Blender 新副本建立局部三塔围合，不覆盖 `assets/models/originals`，不操作前台未保存文件。四个原资产根及其 5864 个源对象保留，非网格精灵/线条、程序动画与点光逻辑不在静态 GLB 迁移范围内。

| 轮次 | 实际修改 | 看图后的结论 |
|---|---|---|
| 1 | 三塔与原湖沼重新组装，三岛承托和湖沼外岸 | 修正 Blender 导入的重复轴向转换后姿态正确；塔细、树高、岸线过简 |
| 2 | 塔水平加宽 1.8 倍、高度乘 0.82；高树局部竖向乘 0.55；石砌岸台、拱券、阶梯与连接支撑 | 母塔可读性改善，仍缺晶面、明显花厅与足够围合空间 |
| 3 | 三塔展开至 `(3,40)`、`(-42,-29)`、`(43,-29)`，原湖沼中心 `(0,-3)`；重算三条连接；放大错层花厅并恢复半球体量；冰蓝分面材质、暖花厅、塔脚晶簇、柏树/灌木与侧湾码头 | 三塔及花厅可辨识；仍为明显简化版本，岸体和城市建筑密度远未达目标 |

坐标为候选 Blender 地面 XY，非全球球面坐标。湖沼中心到三塔三角边最小距离约 20.98；这是布局测量，不是完整资产包围盒/碰撞验收。保留原湖沼几何与子对象不代表所有原动态状态已在 Godot 重现。

## 验证

- 每轮通过实际 Godot 窗口加载和截图，不用 Blender 渲染冒充引擎实景。
- 固定相机、光照、海面；`godot-r01.png`、`godot-r02.png`、`godot-r03.png`。
- 三轮均有 3 座塔和 1 个湖沼根；分别检查约 57.3、57.8、58.6 万个顶点，无非有限值。
- `asset-checks.json` 检查 GLB 长度、节点变换、访问器/缓冲范围及 Blender 导出与 Godot 副本逐字节一致；目标和源文件记录 SHA256。
- 导出器修复：不写入零顶点网格的空访问器；略过 glTF 核心不支持的 Sprite 节点（原湖沼船只的 4 个 Sprite 还有非有限位移）。没有将这些 Sprite 的缺失声称为完整特效迁移。

## 仍未完成

1. 叹息之门迁至峡谷外围、前后桥直通，以及唯一贯通全球电车线；此次原生候选没有铺设假轨或宣称能乘车。
2. 候选局部布局转换到真实球面并处理原山体/岸线，母塔原港口需要保持或重新验收。正式场景没有采用该局部布局。
3. 花厅仍需更多暖光内部构件、金属窗肋；塔身晶体形状、自然岩岸、连绵地形和建筑密度仍有明显目标差距。
4. 码头仅几何；未绑定船舶、原玩家碰撞、上下船、全局步行或救援剧情。湖沼是静态源状态，不冒充原生完整动态逻辑。
5. 当前 3800 多个网格仍偏多；未做性能验收。不能用本次顶点检查声称性能提升。

下一批应先将第三轮构图约束转成球面选址/地形及交通方案，再回接原对象和碰撞；不能直接用静态候选覆盖正式世界。继续以 V7 对照，保留三轮文件。

## 重现

```sh
# 仓库根；Blender 5.2.2，Godot 4.7.2
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python TigerMessenger/tools/pipeline/build_crystal_v7_round.py -- 3
# 导出的 GLB 复制到 godot/assets/art-pilots 后进行导入
/Applications/Godot.app/Contents/MacOS/Godot --headless --path TigerMessenger/godot --editor --import --quit
/Applications/Godot.app/Contents/MacOS/Godot --path TigerMessenger/godot --script res://tests/capture_crystal_v7.gd
python3 TigerMessenger/tools/pipeline/check_crystal_v7_assets.py
```

本机 threejs-game-director 技能包未找到，没有声称已加载。Jev 配置文件也未随项目复制，未调用外部分类；本批由助手实际查看目标和每轮 Godot 图片。V7 已有，无需重新生图。本批确实使用独立后台 Blender 进行建模和导出。

环境问题已交由用户指定的 Claude 继续；模型工作不再修改 Python 启动环境。
