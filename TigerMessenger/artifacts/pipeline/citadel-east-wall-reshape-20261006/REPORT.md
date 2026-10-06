# 墙身真实内收小样（默认关闭）

本轮在可靠 new-cliff 来源上执行实际几何位移，未改既有 artifact、release、main 或严格 source hash。实际看过 `runtime-1791280678024.png`，并看过本批真实三角生成的 `wall-perspective.png`。这是局部几何候选，未安装/未做GPU风格验收。

## 实际改变

从原构造插桩确认的墙中选择最大连续共面片：castle-local X=83.45，Z约79.65..83.25，总高度39.05685m。顶部、底部、左右边界全部钉死；只把墙中部向岩内（−X）回收，最大0.597774m，203个新采样点确实改变位置。采用3个不等高窄岩肩，位于全高约13%、40%、68%处，连接4段较宽岩面；窄岩肩的过渡约0.195m高，深度受侧缘收束，不是绕山整圈台阶。不抬海、不朝列车方向外鼓，不在此处铺草。

原片36面→新448面，相邻10面插入一致边点。完整独立raw patch为11934面，较原11478增加456面；不是无收益细分，原直面中部有可测0.598m位移和三道立体横向断面。旧patch有向体积9706.35789，新9682.96146，减少约23.39643m³。

## CPU证据

- 插桩前后原构造 position/index epoch 完全一致，来源SHA及面区间保留在 `audit.json`；不是按bbox猜新面身份。
- 新raw patch所有边恰两面，绕序冲突0。专项4测试通过：默认关闭/缺来源拒绝，实际内收与边界固定，确定性/过期拒绝，相邻原面自动插边后闭合。
- 现有2949个公共承托样点中608在patch内，原/新射线高度最大差7.61e−8m；其余2341在未改区域。这是有限承托采样，未完成公共承托实体结构力学校核。
- 精确重放已保存`.22m`海侧微移候选双线，局部0.5m采样148个载货扩张OBB，原/新封边交叉均0。没有把它扩称全球列车/立交/演员已通过。
- 顶底全高不变，三道窄岩肩在同相机、同物理比例透视图中可见，确与只换三角拓扑不同；不过片宽仅约3.6m，整体仍明显高长。**不声称39m绝壁已缩成目标短崖，也不声称整岸已消褶。**

## 使用与回退

新增 `src/world/citadel/targetEastCliffWallReshape.js`：

```js
reshapeEastCliffWall({enabled:true,geometry:rawPatchGeometry,
  provenance,cluster,maxInset:.6,horizontalStep:.7})
// {geometry, report, moves}
```

`provenance`沿用已验证的 `recorded-builder-new-cliff-faces` 与原raw epoch；cluster是已溶解共面的明确sourceFaces/boundaryVertices。输出完整raw patch，保持原local框架，artifact原点 `[85,0,82.5]`。输出position/normal；原岩色/属性必须按既有生产refinement流程再生成，不应直接塞给已验证final hash入口。`accepted`恒false，默认off。丢弃输出即可回退，不持有任何生产资源。

重放脚本 `tools/pipeline/audit_east_cliff_wall_reshape.mjs`；透视/完整raw边检查脚本 `plot_east_cliff_wall_reshape.py`。证据 `audit.json` 内含输出raw几何和moves（不是正式整山final artifact）。若要GPU，需先将该raw小样按既有join→refine工艺生成新的独立final artifact，再做final裂缝/承托/载货/植被检查；严禁修改旧hash强套。

## 下一步界限

此小样验证“可靠新面中部可以真实内收，同时保住有限承托与车界”。可将相同方法用于邻近有明确来源的宽片，但不能直接复制成整段等高水平沟，更不能绕过未标记的外围粗格长褶。扩大之前应把分台高度随沿岸缓变，并用实际可用岩内体积约束，每段保留不等长宽岩面；未检验的公共实体内侧不得掏空。此报告不授权改轨、城台或地标。
