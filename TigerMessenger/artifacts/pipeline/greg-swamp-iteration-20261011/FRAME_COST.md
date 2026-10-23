# 正式场景成本定位 · 2026-10-11 05:20

没有默认启用机器人候选，也没有改变地表绘制顺序。本轮从提交次数继续追到真实耗时，避免把 draw 数当作瓶颈结论。

## 实际 GPU 计时

`planet-depth-probe.html` 加载正式入口，在同一模拟相位、同一 rim 相机同步手工绘制八次 ABBA；仅暂改 planet-surface.renderOrder，finally 恢复。保持原 Toon 材质、深度写入、湖沼坑洞 discard、演员与全部几何。`EXT_disjoint_timer_query_webgl2` 实际可用，八次均没有 disjoint，见 planet-depth-rim.json。首次含冷渲染成本，之后原序 GPU 4.45–10.04ms、提前地表 4.34–7.87ms，CPU 手工 render 约23–26ms；样本太少且存在漂移，不能证明稳定收益。对照图 planet-depth-rim.jpg 没有明显近景缺件，但不是全球地标验收。本实验不作为整帧FPS，也不作生产改序依据。

## 60 个真实游戏帧 CPU

main.js 加入明确 opt-in `frameCpuProfile=1` 分段墙钟记录，正常游戏不读这些计时器、不保存记录。上限60帧，`__tm.frameCpuProfile.read()` 只读；原main见 source-before/frame-cpu-profile。

frame-cpu-rim.json：真实60帧10.6FPS/94ms；sceneUpdates均值53.68ms，render31.27ms，机器人与守卫5.90ms，物理与乘坐2.16ms，其余单段小于.2ms。scene-cpu-rim.json进一步只在本地证据页包装 SceneHandle.update，采样后恢复：messenger 56.55ms、saihoji .015ms，60帧10.2FPS/97.7ms。

CPU墙钟包含同步驱动等待等因素，不是每个shader的GPU计时；8次手工GPU计时与真实60帧发生于不同窗口，不做精确相减。当前最值得继续定位的是主岛 messenger 的逐帧更新，而非继续盲目缩小湖沼模型或隐藏远处角色。


## 05:33 定位到真正热点

island-cpu-rim.json、swamp-actors-cpu-rim.json 实测：主岛55ms，其中湖沼43.75ms、老虎41.59ms；花船孩子活动仅.29ms。重复包装的 moebiusSwamp.userData 与 placement.story 是同一个包含范围，不能相加。

tiger-ray-cpu-rim.json 实际全局射线包装27302次/63主岛帧，均值每次.0978ms，约433次/帧、42.37ms/帧；不能说全局每条都是老虎，但老虎足底17点重复多阶段与腹底采样是源码确认的主要重复调用。九个老虎支撑面已都有boundingBox，8×84三角台阶 + 1540三角的整圈岩面；仅补boundingBox不会解决。当前最合适的下一批是保留全部17点/所有姿态的真实几何支撑，用空间索引加速射线候选，而不是减少脚底采样或停虎动作。必须逐点对比原Raycaster，兼容表面变形/编辑/材质side/旋转湖沼，回退未知情况。

鼻部单矩阵候选（924点，GPU实测与原链矩阵最大误差7.37e-14）没有明显帧率收益；与长CPU测试并行的60帧9.6–10.3FPS不能作性能因果。其候选源已归档tigerTargetV1-nose-candidate.js，**正式文件已恢复本轮原件**。tiger-nose-cpu-tests.txt 7/9通过，两项原支撑测试失败（patrol报告残留旧阶采样/巡逻角覆盖不足）；正在对完全原始targetV1重跑同一support文件核实基线，不能称新代码全通过或认定是既有缺陷。测试Node没有three/addons/GLTFLoader，走classic外皮回退；CPU验证不覆盖V3皮肤，实际GPU确认skinV3=true。主入口CPU分段开关保留，仅显式frameCpuProfile=1启用，语法检查通过。

本轮临时GPU标签全部关闭，控制台仍有MutationObserver.observe Node参数异常。地表顺序没有生产改变；鼻部候选没有生产启用，旧Greg环境默认改进仍保留。


05:47补证：完全原始targetV1 baseline同样两个support失败，已确认而非待运行。精确地面索引已通过三项差分专项并正式默认启用；60真实帧18.6FPS，虎3.14ms；详见TIGER_GROUND_INDEX.md。鼻部矩阵实验仍已恢复。
