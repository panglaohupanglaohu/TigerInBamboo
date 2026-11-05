# 纯网格对照 / 多岛成果 · 2026-11-05

1670790425232175108：先读README第56行。作者为演讲让生成器输出pure triangle/hex和square以说明mixed选择，不是美化教程。610帧0–609，PTS0–28.200秒；sheet00–06全部逐格看，原尺寸30、242、440、570。开头正交方格底图/低台与房屋，几次清空、黑剪影、着色和格边显示；约180起换三角底图，低平地表有圆滑/近六边形图块，随后带孔地块与高崖群、再转镜。不能把表面图块边数直接当底层cells边数，也不能凭视频确定原生成器的数据结构。所有帧号/真实PTS/观察保存在ID目录。

1669315384619540487：先读README第60行，仅“generator consistently spits out pretty cool islands now”。649帧0–648，PTS0–30.570秒；sheet00–06全部逐格看，原尺寸80、245、375、540。多次切换岛例：高崖/小屋与坡路、平坦低岛、圆柱式台地群、复杂凹口/桥状轮廓、双高塔。多次清空、岸线/黑剪影和临时强烈着色过渡；不能把过渡帧自动认定为当前系统bug，更不能从成果片反推WFC/噪声参数。完整软坡、模块联合生成、原黄绿笔触与不同岛型的组合质量，现有体素生成未全部覆盖，本片本批只计学习与差距审核。

## 现有代码与修正

原版src/gridmodes.js有squareLattice/hexLattice/triLattice及统计。重构已有buildMixedGrid、buildQuadGrid和网格实验页，保留。发现grids.html的“纯方格”其实buildMixedGrid({mergeRate:1})，随机配对仍残留三角，而且合并四边形不保证直角，不能冒充pure square。

新增core/grid.js的buildSquareGrid({radius,cellSize})：真正正交方格，复用finishGrid完成共享顶点、互反半边、顶点邻接与cell契约；有限非负整数半径、正尺寸校验。原“纯方格”改用它，旧算法单独保留为“合并菱形（含三角）”。纯三角、混合、Townscaper及全部主场景默认不变，六边仍只是对偶诊断，未记独立六边World完成。

## 验收

tests/square-grid.mjs：12组半径/格长，四边相等、相邻直角、正面绕序、共用同一顶点、互反半边和边界计数；大图实际generateTerrain/shapeTerrain通过，坏参数拒绝；旧mergeRate=1确实有三角。

tests/grid-kinds-browser.cjs：真实Canvas按钮切换，纯三角/纯方格/合并菱形/混合统计与生成对象一致；另外用buildSquareGrid→World→generateTerrain→WorldMesh实际GPU渲染，几何有限、像素覆盖非零。测试页临时补Three importmap仅用于加载原本纯2D页不使用的WorldMesh，产品页不因此增加渲染依赖。截图grid-kinds-{square,rhombi,tri,mixed}.png与grid-square-world.png。

本批新增1259帧，累计136/285，剩149；局部纯方格能力验收1段，完整多岛模块/美术组合待补1段。加上本次前一批笼形变两段，本次用户请求共新增4段1985帧；不重复计算既有132段。原版只读，未同步游戏副本。

收口：实际按钮统计纯方格361格/0三角，旧合并菱形269格/52三角，纯三角486格，混合331格/176三角。真正正交方格经共享WorldMesh生成8970顶点，一次GPU提交、45665个非背景像素，截图已目视。三原有主场景回归通过，1985条观察与PTS连续一致，285素材/README匹配、管线缺0、空白检查通过。首页/pipeline读取136/285、剩149且有格型/笼实验入口，代码局部验收与完整生成缺口分开记录。映射144模块33增强/50静态/61部分。下一批1677242779162877952通用三角图重写、1458921394855718917半边结构尚未逐帧，不计入累计。
