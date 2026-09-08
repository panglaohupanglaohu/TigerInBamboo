# Godot 湖沼之虎：原作待机尾动画

当前原世界适配器在启用候选时自动播放尾部待机；只有尾根 n27 与八个关节 n28/n31/n34/n37/n40/n43/n46/n49 动起来。其他节点、头腿与原世界位置不变。动画没有新增巡游、饮水、对话或救援逻辑。

动画使用候选 GLB 实际 rest（尾根约 −150°），没有恢复旧 extras 中的 −45°。原 Web 待机分支：gait=t×3、moveAmt=0.25、wind=0.55，根部与关节的 X/Z 正余弦及尾端相位延迟保持。候选关闭时停止并恢复九处完整 Transform3D，再开启重新播放。128 段循环关键帧在每圈 2π/3 秒内插值。

验证入口：

```sh
rtk proxy python3 tools/pipeline/test_tiger_idle_godot.py --output artifacts/pipeline/godot-tiger-idle/NEW_RUN_NAME
```

输出路径必须是新的项目 artifacts 目录。入口复用已有 Godot 快照机制，只在新建临时工程导入。独立 Three.js 矩阵样本固定在 expected-web-tail.json，候选 GLB hash 不同即拒绝复用样本。

本次正式结果在 final-01/report.json；详细37姿态矩阵和六次开关证据在 final-01/validation.json；既有原世界静态回归在 final-01/static.json。全部通过。验证含真实 SceneTree 帧自动推进、80个独立候选源ID、16个嵌入原世界节点的保留、父子关系、非尾部rest、世界transform、循环衔接与开关恢复。独立 Three.js 最大矩阵差约6.33e-5。

motion-before-after.png 与 motion-measured.gif 来自实际 Godot 测得的关节位置，用 matplotlib 绘制；它们是动作证据图，不是引擎模型截图，更不代表美术验收。绘图脚本为 plot_motion.py（本次绘图依赖独立装在 /tmp/tiger-idle-plot-deps，不影响游戏）。

没有导入活跃编辑器工程或修改其缓存，没有修改 Web 源码、registry 或总文档。历史失败日志保留，正式结论以 final-01 为准。
