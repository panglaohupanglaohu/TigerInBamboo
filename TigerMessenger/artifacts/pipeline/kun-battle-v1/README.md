# 鲲战斗候选 v1

原 leviathanIsland 副本制作；独立后台 Blender。主任务已审阅加厚下颌和喉囊造型，当前交付为可继续战场接入的候选。没有修改 Web/Godot 运行时，也没有把概念图园景固化进背岛。

- 完整角色：`assets/models/optimized/kun-battle-v1/kun-battle-v1.blend`，121 帧、30 FPS，closed → open → engulf → recover → closed。
- 静态导出：同目录 `kun-battle-v1.glb`，闭嘴姿态，保留口部 morph targets，无动画 clip。
- 精确节点、父级、矩阵和每帧 morph：同目录 `kun-battle-v1.assembly.json`。
- 原295个节点/父级/局部变换保留。仅原 n1 头部壳面切成固定上颌与新增下颌；其余原几何未改。原描边及隐藏雨滴在 GLB 中以明确 archivedHiddenMeshIndex 归档，不实例化显示。
- 8个新增节点：下颌枢纽、外壳、上腭、下内壁、厚颌缘、上口线、下唇、后喉膜。没有牙齿。

## 检查结果与几何量

保存文件独立回读通过121帧检查，GLB 原节点局部矩阵误差0，喉膜后缘随下颌接点最大误差0.00000274。上下口内壁为非发光暗灰两档。

以下均为原actor局部单位，原根缩放0.5后数值减半：

- 闭嘴原壳+切分下颌顶点到原表面最大距离0.00000320；三角面总面积相对误差5.69e-9。
- 新增闭嘴唇缘最大向外顶点偏移0.1833（根缩放后0.0917），不能称整嘴轮廓零改动。
- 实际上腭沿前向纵深19.0；下内壁中央低于内颌缘平均高度2.85；完全张口时下唇低于后上腭8.965。
- 73个背岛节点 n102–n174 的父级、矩阵、顶点、面索引直读原/候选 .blend 哈希完全相同：8173be608b152a6a6238b543805a4bee3206541e4a08f482574f5f7387259aa8。

距离检查覆盖顶点和合并面积，非连续Hausdorff证明；未认证任意全身接触，也未认证实战语义。

## 六庭挂接

背岛仍 n102，原局部板面Y=6.08，原根scale=.5，原六庭gardenScale=.43。真实六庭应继续由世界场景挂到此接口；候选不包含这些运行时场景。请勿将整个独立候选直接替换六庭世界而丢失原子树，也勿二次应用根缩放。

## 证据

`before-three-quarter.png` 与 `closed/open/engulf-three-quarter.png` 使用同工作室灯光。口部 `*-mouth-detail.png`、`*-mouth-side-below.png` 展示内壁、厚度和囊面。上一轮获审厚颌渲染保存在 `revision-02-thick-jaw/`。`validation-report.json` 记录当前候选精确哈希。

GLB实际回读已渲染 `closed-glb-roundtrip.png`、`open-glb-roundtrip.png`，按assembly直接应用矩阵/morph。原23个材质线性颜色/透明度逐项与源快照相符；修复glTF导出对原ObjectInfo乘色链的漏读，眼、背岛植被及吻部结节原色保持。当前精确文件列表和SHA见`manifest.json`。
