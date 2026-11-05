# 1579483114178768898 · 显式跨格房屋第一批

先读素材README.md第76行："Obviously, it's all tile-based ... combine an irregular grid ... with multi-cell tiles ... one of the house tiles even cover both a square tile AND a triangular tile"。再解码并查看全部177帧，0–7.665秒；原尺寸图、逐帧时间戳及sheet-00/01保存在同ID目录，无抽帧遗漏。

画面：镜头围绕带网格线的台地、洞口和黄色屋顶小房屋转动。0–1.56秒看正面崖与房屋；1.59–3.9秒向侧面/上方转；3.93–6.66秒俯视更清楚看出房屋跨底部格线；6.69–7.665秒回到最初机位。原文明确多格tile；影片不能确定其完整模板库、socket编码、回溯策略或精确网格形变函数。

原版src/fusion.js用一份land Town和另一份town Town并抬高房屋网格，只有四边形；现有重构已统一World、支持多边形墙和区域屋顶，这是保留的已有成果。原学习记录把“相邻格不画内墙”直接记成完整多格tile，论证过强。本轮补显式footprint和原子占用，但仍标记完整预制约束系统部分覆盖。

新增src/build/multicell.js：在同一World图上枚举相邻quad+triangle（四边形模式quad+quad），记录内部半边和外轮廓半边；检查同高岩石支撑、河道、占用、最高层和重叠。整批先验后写，失败不写任何格，成功仅发布一次version。所有体量写入已有solid/color，不建立第二份格子或可编辑体素场。确定性贪心选候选并保留一格间距；不是最大装填或WFC回溯求解器。

真正接入world/scenes.js的generateFusion，先放教堂，再放最多6个显式模板，排屋避让模板及周围一格；现有建筑/屋顶、光照和水岸仍读同一World。fusionTileReport只是一份带World version的生成诊断回执，不是权威占用，编辑/撤销后应当视为失效。

逻辑测试tests/multicell.mjs通过：混合124候选、方格388候选，各确定性放8个；外轮廓5/6边、重复占用整批回滚、断连拒绝、河流拒绝、层高变化拒绝、重复提交拒绝、岩石不变、snapshot/restore和空批次。WFC、局部修复及几何邻接原测试通过。

实际页面tests/multicell-browser.cjs通过：默认混合/四边形融合场景各6个模板；混合每个确为3+4边格组合，全部体素为建筑，两个格属于同一且恰好两格的屋顶区域，回执version有效；无未捕获异常。截图multicell-fusion-{mixed,quad}.png、multicell-regression-{town,terrain}.png已目视检查，房屋、地形与海岸正常。

剩余差距：当前是程序化双格房屋模板，由现有mesher生成外观；完整预制面轮廓socket、旋转模板、跨多于两格的约束、与通用WFC/局部修复的联合回溯尚未完成。不能用本批替代完整多格tile系统验收。下一批先从footprint整体实例与原子移除/替换及撤销保存做起，再补几何接口与联合求解。
