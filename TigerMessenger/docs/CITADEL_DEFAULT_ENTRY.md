# 圣城当前布局进入默认入口

2026-09-13。默认装配、引用、通行与木马生命周期复查已通过。整体圣城目标与完整战斗仍未完成。

## 用户入口

http://localhost:8931/TigerMessenger/

原游戏页面直接加载当前圣城共同基准、旧港水位与自身球面朝向、旧港沿坡台阶、防御门、Blender 岩体支撑、柏树、两层滨水建筑和分区灯光。不跳转到 Godot；Web 仍使用原 Three.js 游戏。Godot 同工程同步场景和演练，两种运行时没有被混称为同一个引擎。

## 合入内容

- commonSurfaceFrameEnabled、oldHarborGradeEnabled 改为缺省启用，仍在角色、碰撞与交通引用建立前进行构建期定位，不在活动战斗中突然搬动城市。
- 显式诊断回退：Web 使用 ?citadelCommonFrame=0&citadelOldHarbor=0。旧候选链接参数 1 仍兼容。
- Godot citadel_surface_variant.gd 默认选择当前共同基准资产；--legacy-surface 保留旧基准诊断，--legacy-old-harbor 可单独查看原旧港。旧 --common-frame / --old-harbor-grade 参数继续兼容，但正常启动不再必需。
- 原生全局检视 original_world 与圣城 citadel_world 共用海面、海床、浅海、西山、旧港和窗光装配，移除子场景的重复绑定。镜像实验小岛和测试大厅保留。
- 全局检视的 WFC 显示开关同时隐藏/显示新旧港替换组，避免关闭城堡后遗留一套新岸坡。

## 验证范围

- test_citadel_default_entry.mjs 打开不带参数的原始 URL，并与显式候选、显式旧版分开比较。默认与显式候选的四组新增几何、世界变换完全一致；旧版无这些组。木马实际绑定到原 nightInfiltration.root，八名角色及原船实例引用正确，剧情地标键保留。不是只比较页面标题或状态标记。
- Godot 不带任何布局参数分别加载 original_world.tscn 和 citadel_world.tscn。两端均只见一份四组新部件，港口替换成立，1014 个窗材质/昼夜行状态一致，关闭再开启 WFC 显示检查通过。
- 旧 baseline 导出工具 test_west_city.cjs 的无 --common-frame 模式明确加旧版 URL 参数，避免默认切换后误覆盖保留的旧 Godot 数据。共同基准专用诊断显式关闭旧港变体，以保持其原测试范围。

- 默认 Web 木马在出兵1秒、35秒、180秒后触发黎明返回，分别检查部分出兵、接近城池及巡逻后回归，三轮均回收8名士兵，最大每帧位置变化0.08米；仅证明既有控制器连续性及复位，不代表完整战斗碰撞。
- 默认 Godot：旧港90段、前港202段、两建筑侧路40/30段实兵通过；测试均没有 common-frame 或 old-harbor-grade 参数。默认原生全景昼夜截图已保存。

## 尚未完成

全局山势与建筑体量、主堡细节仍需继续向认可目标靠近。不能把本次默认合入、地标引用检查或单兵通行称作完整攻城、自动港口物流或全通关。后续每批以默认入口为基线，继续同步 Godot，不再依赖候选参数才能看见已完成改进。
