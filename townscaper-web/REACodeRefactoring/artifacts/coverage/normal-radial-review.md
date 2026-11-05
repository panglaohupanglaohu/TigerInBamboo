# 径向大小排序的UV差距 / 法线反差细线 / 2026-11-05

## 文本与全帧

1478114309263839244：先读README第85行，作者说径向大小排序使中间有大块连贯部分。346帧0–345、PTS 0–29.940秒，sheet-00至03全看；原尺寸0、19、35、77、129、200、269、320。原片上部是不规则三角图块排布，下部是对应的岛形模型/棋盘格表面，中间多轮彩色三角线框调试。由棋盘模型和展平图判断与UV组织有关是画面推断，不足恢复具体分片、参数化或装箱算法。旧textures.html圆盘螺旋与engine/spritepack.js矩形radialPack不是这个流程的复现；本片仅学习/审核完成，UV能力未实现验收。

1482011744843223042：先读README第82行，作者明确从程序化法线map反差生成像素细线，并提到将来转专用contrast texture。384帧0–383、PTS 0–17.280秒，sheet-00至03全看；原尺寸2、125、229、310。绿色地面/灰岩岛转镜显示表面细线，229–230切换另一岛的灰色/线框调试后继续。不能与1482346496460828674后来的三角迭代混记。

730条逐帧观察/PTS/nativeRevisit在各ID目录，保留全部帧/联系表，旧122视频不重复计数。部分灰底线网的关键原尺寸帧已回看，画面看不出的算法不编造。

## 保留原版与实现范围

原版只读。engine/spritepack.js的radialPack是矩形中心优先近似；engine/outline.js实际是深度/几何法线后处理，不等同原片程序化法线贴图。保留现有圆块、矩形Atlas、外壳描边和反差迭代，并在textures入口与学习记录明确区别。

新增src/core/normal-contrast.js：解析Voronoi分区赋单位法线，以相邻分区法线差筛选边；沿该边方向用屏幕导数估计一个物理像素的场长度，ncCoverage控制亚像素覆盖。View共享主地形材质在最终光照颜色上叠加细线，默认关闭，normalcontrast开关/setNormalContrast参数控制；只影响带地形aField标记的主体，不复制World或生成几何。参数非法时先拒绝再变更。

这是局部法线场/细线机制近似，未给光照法线本身增加扰动；不是原手绘笔触normal atlas、UV接缝处理、原图块算法或完整法线/深度Sobel后处理。世界轴主投影有接缝，最近两点Voronoi与远处缩小仍近似，不能把理想直线覆盖测试推广为所有实景纹样都精确一像素。原UV排序本批仍仅学习，不能因视频已学就记代码已验。

## 验收

tests/normal-contrast-browser.cjs直接渲染共享World几何/主材质：关闭和高阈值2时像素一致，开阈值0出现线，增宽后总像素变化增大；四种非法参数不改变uniform，World版本/几何保持。同模块ncCoverage在240/480两分辨率、1/2物理像素宽与3个子像素相位GPU读回，积分覆盖误差<0.02。混合/四边形、开关与截图通过，normal-contrast-browser.json及normal-contrast-{mixed,quad}.png。三主场与图集继续由atlas-browser回归。

收口：法线反差双网格及三个主场截图已目视，GPU测试与回归通过；textures旧圆盘/反差迭代入口已明确区别（radial-approx-gap.png），运行页无pageerror。index/pipeline实际读取124/285、剩161及normal-contrast入口（normal-radial-pages.json）。730条观察连续、PTS一致；285素材/README匹配、管线缺0、空白检查通过。映射142模块33增强/54静态/55部分；本批代码局部通过1段、待实现1段，实测速率2.53段/小时与4段/小时目标分列。下一批Texture test/Mountain textures未计学习；原版及游戏副本未改。
