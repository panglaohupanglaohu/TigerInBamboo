# Greg 四株新增伴松 · 资产施工 r1

## 范围与来源

仅修改 `src/assets/moonLakePineCompanions.js`；生产月湖工厂、原古松、森林、月牙均未编辑。多人共享仓库，布局/根位/正式检查由主代理与布局代理负责。

已阅读 TEAM.md、VISUAL_RULES.md、MOEBIUS_GAME_ART_STUDY.md；实际看过旧 normal-four-r3-overview.png 与用户批准 greg-moon-target-v2.png。借鉴公开研究记录中的“大色块、明确轮廓、稀疏结构线”属于本项目推断。本轮未新观看 GDC 音画，也不声称复刻作者着色器。

## 实施

- lean / spread / windswept / arching 四个独立曲干控制点，几何高度分别约6.57 / 4.93 / 4.46 / 6.27米。
- 基部半径分别0.75 / 0.59 / 0.73 / 0.75米；横枝与干相接，针叶分枝从横枝末端出发，根部辐射入原地面。
- 叶冠由自制不规则宽扁浅实体组成，无球体、二十面体冠。顶面黄绿、侧缘中绿、底面深绿，有0.014米细反向壳。没有逐叶噪点。
- 少量顺着曲干的结构线；不绘密集树皮纹。静态合并后每树4个材质网格。
- rootRadius分别1.55 / 1.25 / 1.55 / 1.55米；该值用于根部碰撞，不代表整个冠幅。报告localBounds供布局核验。
- 接口保持 createMoonLakeCompanionPine 返回 group/report/dispose；材质实例归该树所有、共享toon渐变纹理不释放；重复dispose稳定。

## 已验证与缺项

`pine-probe.mjs`实际调用4个生产工厂，`pine-probe.json`记录有限顶点、正反冠面法线、独立控制点、材质网格数及几何/材质各释放一次；通过。语法与diff空白检查通过。三角数11120 / 9408 / 9408 / 9408（含细壳），属于CPU几何统计，不是FPS。

已实际调用 JEV：`pine-jev-r1.json`，模型jev-1.14.0，cache_hit=false，864输入/91输出。下一步navigation；正常游戏视觉及玩家路径净空仍为null硬门槛。JEV仅收紧凑文字，没有图像、聊天或密钥，不能替代看图。

未单独做资产GPU截图，也未声称正式游戏已达到目标。需主代理完成固定机位观察、月牙留白、原树林遮挡、2米高/0.35米半径角色环路净空核验。任何角度构图均未保证。

## 回退

资产改前快照在 `source-before/moonLakePineCompanions.js`。回退只恢复该资产文件，勿撤销布局代理和主代理其他源修改。
