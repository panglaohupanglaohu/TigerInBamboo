# 有来源封边重铺候选：交付与拒绝扩大结论

本轮实际看过普通主页 `runtime-1791280678024.png`。新增模块默认关闭，未修改生产、既有 remesh/artifact、路线、城台或铺装。**不建议把本候选作为“长直崖已改善”的发布内容：它是安全重铺和来源诊断，仍保留原来的长竖折。**

## 来源可靠性

既有 final artifact 只有整体 raw→refined provenance，没有逐面 new-cliff 身份。因此离线脚本加载原 `targetEastCliffRemeshPatch.js` 文本，仅插入：piece 的 cut 标记、wall() 前后面区间记录。只记录高低两侧 cut 标记不同的内部封边，排除样块外封口。插桩前后 position/index 校验相同，原文件不改；原 builder SHA256 见 audit.json。不能用本报告给其他 bbox 内的山面授予可修改身份。

真实样区 castle X83..85、Z79..84：53个确认来源的封边面，其中52个形成3个可溶解共面簇。重铺52→26，连同1个不变面，样区53→27。完整独立 raw patch 11478→11452三角。5740个 position 与 normal 均保持；保留每个外边界顶点及分段，Earcut省略的共线点会重新插回。保留真实非共面的竖折，不放宽平面容差消掉它们。默认不接 final production refinement。

## CPU检查

- 专项4测试通过：默认关闭/缺 provenance拒绝；面减少且顶点、法线和边界不变；非共面折壁不擅压平；过期epoch拒绝。
- 重铺后完整 raw patch 所有边恰两面，方向冲突0；有向体积9706.357887936183（该独立patch的值，不是整山体积）。
- 同一实际 fixture 的2949个既有公共承托点中，608个落patch内，旧/新patch射线高度差0；其余2341点在完全不改的范围。没有声称这是新的live整体承托检查。
- 使用已保存最终candidateInput重放实际`.22m`平顺海移的两条线（没有改变它），局部每0.5m取载货扩张OBB：148个包围盒涉及样区，旧/新封边均0交叉，结果差0。不是全局车辆、桥身、演员或波浪认证。

## 实际透视证据

`wall-perspective.png` 是读取真实三角面、相同相机与物理比例的CPU透视线框图；我已看图。左53面，右27面，能看见内部冗余扇面减少，但长高墙与真正竖折几乎完全一致。因此没有视觉达标结论，没有评分，也不建议仅为这26个面减少去重建整个生产场景。

## 接口与后续边界

`src/world/citadel/targetEastCliffWallSimplification.js`:

```js
simplifyEastCliffWalls({enabled:true, geometry:rawIndexedGeometry,
  provenance:{kind:'recorded-builder-new-cliff-faces',
    builderSourceHash, geometryEpoch:cliffWallGeometryEpoch(geometry), faces},
  faceFilter, planeTolerance:1e-5}) // {geometry,report}
```

输出为同一raw-local坐标，完整属性clone，材料不处理；多材质groups输入目前拒绝。证据artifact的origin仍为原patch origin。`built`不等于accepted。回退只需丢弃输出geometry。

重现实验：`tools/pipeline/audit_east_cliff_wall_simplification.mjs`；绘制和raw边验证：`plot_east_cliff_wall_simplification.py`。仅写本批目录；原大批报告保留。

要真正减少纵褶，下一步必须允许已确认封边的**中部几何位置**离开现有挤出轮廓，形成更少的宽断面，同时保留原顶底边与铺装承托实体；仅保持所有位置不动的重铺已证明无明显艺术收益。其可挪空间须按每个高度层和真实载货扫掠检查。35–40m总高差依旧，不能将中部重塑或法线处理冒称短崖分台；本轮不擅扩该操作。
