# 圣城共同基准候选：接入与合入步骤

2026-09-13。状态：已进入原 Web 构建流程及同一 Godot 工程，仍为候选，默认未启用。

## 使用与复现

- Web：`http://localhost:8931/TigerMessenger/?citadelCommonFrame=1`。不带参数仍为现行布局。
- Godot：运行本工程时加用户参数 `--common-frame`。通过 `citadel_surface_variant.gd` 选择同一批候选资产、海面、海床、灯光和路线；不是第二个项目。
- 导出：`rtk proxy node TigerMessenger/tools/pipeline/test_west_city.cjs --common-frame`。运行目录为 TigerInBamboo。候选 GLB 写到 `godot/assets/art-pilots/citadel-common-frame-candidate.glb`，数据使用 `common-frame-` 前缀，证据在 `artifacts/pipeline/citadel-common-frame/export`，不会覆盖默认数据。
- 导入后在 Godot 执行 `test_west_city_march.gd -- --common-frame` 检查主城；加 `--front-harbor` 检查候选前港模型。
- `test_front_harbor_march.gd -- --common-frame` 在实际 `citadel_world.tscn` 启动携装角色；`test_citadel_current_ocean.gd -- --common-frame` 核对海面和码头。
- `test_citadel_night_terrace.mjs --common-frame` 检查原作八名木马士兵出入。范围不包括完整城内战争。

## 布局为何这样处理

原广场沿用了远处旧基点的切平面，四角离水7.76～27.05米；后移20米仍有18.27米最高角。只摆正广场会形成与主堡的折角；只摆正新城则相对旧城明显倾斜。共同基准候选在城堡局部[-10,55]处，以真实海面定位整片圣城，再构建港口和角色。两城相对位置、旧城+30°/新城-30°朝向和内部楼梯关系不变。

`commonSurfaceFrame.js` 必须在 `loadCitadelBlock` 将城堡加入场景后、创建港口与夜战角色缓存之前运行。禁止在已经运行的战斗里临时旋转根节点。旧港方向应用同一旋转，碰撞点使用完整前后矩阵转换；船再沿自己的局部竖直方向求海面交点。前港在最终海面创建，当前三段各11级（旧版每段37级）。

Godot `CastleWorldAdapter` 绑定时应用同一局部delta并在解绑时恢复；候选GLB仍保留城堡局部坐标。海面与海床仍采用同批实际世界数据，不能只换建筑不换海岸数据。路线与灯光通过同一候选选择器解析。

## 下次合入的顺序

1. 处理旧城临水高差：共同基准下旧港台面仍偏高，需完成海边至旧城的连续上行与沿山建筑关系，不得只把港口往水里压。
2. 对照 Web/Godot 对象与材质来源，修掉海面可见碎面及原场景遗留面片；不能抬全球海水掩盖，也不能根据颜色猜测删除。
3. 对当前共同基准下的山体、建筑层次、角色尺度做目标图对照与必要 Blender 迭代。候选数据通过不等于画面符合目标。
4. 重新运行同批导出及完整场景携装行走，验证原港、前港、旧新城、主门、旋梯和顶层；随后验证木马夜战、原角色/船只引用及重置。
5. 全部通过后才把 Web 和 Godot 默认同时切换。保留旧数据用于回退，记录切换版本及真实截图。不得仅凭当前单角色/单斜坡测试宣布完整战役或整个目标完成。

### 2026-09-13 下一批山体对象已定位

浅海装饰修复已进入默认 Web 和同工程 Godot，详情见 `artifacts/pipeline/camp-ocean-conformance/index.html`。原海水材质未改。Godot 实际相机 UV(0.145,0.41) 的巨大异色三角命中原 `highland-ravine-wall-west`，sourcePath 为 `castleContainer[69]/odyssey-citadel-mountain-valley-assembly[4]/citadel-latest-design-v1[12]/highland-mountain-ravine-walls[2]/highland-ravine-wall-west[0]`；不是新主山 mesh。Web 同位置仍有蓝色巨型尖面，需要结构调整，不能仅改 Godot 颜色就算完成。UV(0.27,0.61) 的黑面命中新导出主山 `citadel-oskar-grid-mountain-surface`，应另查法线/地形着色，不混为同一对象。证据 `citadel-common-water-diagnosis/godot-surface-rays.json`，可重跑 `godot/tests/audit_citadel_native_surface.gd -- --common-frame`。全部诊断与截图进程均已退出。

### 西侧山翼与黑面后续修正

西侧薄墙已完成 Blender r01/r02，默认 Web 和 Godot 同步，详见 `citadel-west-massif/index.html`。上段 CPU 射线对黑面的判断不够：纯色覆盖分别验证主山与其子封口后，黑面明确属于 `citadel-coastal-cliff-seal`。该子网格通过与主山一致的颜色 Shader 转换后，实际 Godot 夜景黑面消除；背面法线/关闭光照测试未合入。后续首要工作仍是旧城与旧港岸线的真实高差和山势，不能继续把此前同一黑面视作未定位而重复试验。
