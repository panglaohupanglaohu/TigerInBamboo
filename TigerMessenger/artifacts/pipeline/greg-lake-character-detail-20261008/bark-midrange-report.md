# 湖沼树干中景细线（midrange-ink-1）

只改 `src/world/swampCoralTrunkDetail.js` 的材质 shader、shader cache key 和 lineRevision元数据。`swampCoralTrunkBatch.js` 不需要改动：它先调用源材质onBeforeCompile，然后仅将 `coralBarkP=position` 替换为 `coralBarkP=barkLocal`，因此新fragment对源/合批完全一致。

本轮没有变更顶点、法线、索引、包围盒、节点、矩阵、树形、树冠、栖木、通路、桥柱、水下根；没有消费新增随机数。色板仍采用批准的藕粉树干和梅灰#514b64。

## 具体调整

旧线条因smoothstep(18,40,distance)在40world完全消失。现保持9条稀疏纵纹、原不均匀断续，加入很少的短岔裂；主线0.32、短裂0.12混色，总opacity上限0.38，裂线均有fwidth抗锯齿。无横向砖格/黑色网格，也没有加mesh描边。

LOD权重分为0.58×18–58world、0.32×55–110world、0.10×95–165world渐隐，权重之和1：30world约0.875、60约0.413、90约0.196、120约0.071，165以外0。这里是着色器公式的权重，不是保证GPU画面上实际对比度，需实景验看。

## CPU验证

`node --test tests/world/swampCoralBarkLine.test.mjs tests/world/swampCoralTrunkDetail.test.mjs tests/world/swampCoralTrunkBatch.test.mjs`：10/10通过，日志 `bark-midrange-tests.txt`。

- 与本轮before真实安装结果逐数组比较 position/normal/index、boundingBox、matrix完全一致。
- 源mesh与batch生成的fragment shader逐字相同，batch原barkLocal保留；distance仍用变换后实际modelView position。
- 实际湖沼285源mesh→11batch，49,232 triangles不增加；world位置误差<1e-5、法线误差<1e-6，barkLocal逐顶点精确等于源坐标。
- 保持211个原嵌入枝基、实际栖木射线、端环、水下根与38–68桥/通行保护带；dispose/rebuild接口通过。
- node --check通过。

GPU总览/近景由主代理执行；本报告不声称GPU通过。源文件现冻结。

## 回退

原件 `bark-midrange-before/src/world/swampCoralTrunkDetail.js`。只恢复本文件，不能恢复全目录覆盖其他代理；批处理模块未变。shader cache key为`greg-coral-bark-organic-2-midrange-ink-1`，确认浏览器加载此版再比较。


## GPU反馈后的最后对比度修订：midrange-ink-2

根代理实际GPU v1 shaderErrors为空，但近/中景细线仍过淡。本代理实际查看 `trunk-close-ink-v1.jpg`，可见粉色大面只有极弱长纹，因此只将主线混合0.32→0.50、最大混合0.38→0.52；短裂纹0.12、梅灰颜色、LOD、宽度、频率均未变。无新增顶点/材质/draw。cacheKey和lineRevision已改为midrange-ink-2。

修改前v1备份 `bark-ink-v2-before/src/world/swampCoralTrunkDetail.js`。专测加入主线/上限新值断言，相关10/10通过，日志 `bark-ink-v2-tests.txt`，node --check通过。源文件冻结，v2 GPU待根代理复核。

Parent GPU checked v1 close/middle and v2 close in the real factory, with shaderErrors empty. Screenshots: trunk-close-ink-v1.jpg, trunk-middle-ink-v1.jpg, trunk-close-ink-v2.jpg. Lines remain subtle; this is not a claim of matching the detailed accepted target. Geometry/render batching unchanged.
