# 三场半影与太阳控制 · 2026-11-04

## 原文与逐帧

先读素材README精确ID：1305951750638231552（line113）说明阴影画三次：正常、稍向内收、大体素，演示故意加深；1313840428685447170（line110）说明增加阳光/阴影及控制gizmo。未把原文当成已获得源码。

- 半影片：521帧0–520，0–20.79秒，sheet-00至05全部逐格看完。前250帧塔楼/码头房屋编辑，长影随结构改变；250起绕视角；409起纹理检查器RGB/各通道切换。原尺寸回看70/409/445/454；通道形态不同，但没有仅凭RGB自行认定三场的对应顺序。保留frames.json实际时间戳，后半段不是恒定帧时距。
- 太阳片：501帧0–500，0–15.03秒，sheet-00至05全部逐格看完。二维控制盘/滑条改变亮面，210后明显转暗再亮再暗，后半夜间窗户点亮，457附近恢复白天。原尺寸回看210/310/457。
- 全帧观察、帧号/实际时间和回看标记见各ID/review-observations.json，保留所有原帧与联系表。本批新增2段1022帧。

## 原版对照与实现

原版src/penumbra.js主体为独立合成高度场的2D诊断，注释说3×3 max-pool但coarsen实际求均值；粗格castShadow没有把水平距离扩大到k倍后同步高度坡率。这里保留已有PCF及gizmo，不照抄这一尺度问题。

新增core/penumbra.js以世界米为高度与射线距离单位；3×3粗格保最高遮挡，投影保持res×k，正常/抬高遮挡门槛内收/粗格单格模糊后合成。pure单元检查世界整体放大10倍结果不变。采用本地权重，不宣称原作具体合成系数。

light/penumbra.js从实际共享World/index读每柱最高层，派生临时高度采样，不创建第二个World。world/penumbra-layer.js把三场/合成四通道数据纹理接实际View水面；陆地遮掉，开启时关闭原水面shadowCatcher避免叠两份，建筑/屋顶PCF保留。纹理按World版本/太阳方向变化重建；关闭释放资源并恢复原投影。核心有10万场样本/3000万射线步预算。

View新增setSunPosition(方位,高度)与setPenumbra，太阳盘、渲染灯光、水面三场一起变；太阳盘保持已有World，已有日夜/窗口功能保留。penumbra.html可拖二维太阳盘、滑方位/高度、查看三场或切回原投影。

## 验收

- tests/penumbra.mjs：内收遮挡是正常子集、组合0..1、陆地剔除、整体世界尺度放大不变、粗格保最高、空场/竖直光及非法参数通过；合成半影带183测试格。
- tests/penumbra-browser.cjs：混合/四边真实View；初始场65×73/58×60，水面有阴影920/796格，半影745/658格。转太阳改变1006/681格，World未改动，旧纹理释放1次。
- 实际setSolid添加顶层再移除，World各增2版本，阴影跟随版本重建；不是另造模型演示。
- 三场模式均接实际材质。关闭时纹理/geometry/material共3项释放、mesh移出、原水面投影恢复；pageerror为空。保存penumbra-{mixed,quad}-{combined,pcf}.png。

## 视觉与剩余差距

合成截图已看：实际海面能见长影与外缘，但粗格半影偏宽；未通过原片视觉匹配。当前只用顶面高度投影到水平水面，会填掉洞/悬挑；不含形变后屋檐/坡面、精确洞内透光或原作完整三维接收面算法。原版distToMask/draw指标及等名API未迁移，映射仍为部分覆盖。所有局部运行通过与全帧完成分别记账。

兼容性：沿用全局shadows开关控制新层，防止旧catcher叠加；日夜时三场强度随太阳强度缩放。原版三场半影注释/实现与本地改进区分记录，不更改原版文件。

回归：两网格岸浪时间/周期/暂停和线框控制仍通过；首页/pipeline及小镇显示60/285、剩225、134模块。视频清单/本地/README匹配均285，历史笔记243，管线缺0段，diff空白检查通过。

## 本轮补残差（洞/悬挑/形变表面 + 半影宽度口径）· 队列条目重验收

### 裁判可量化参数（REACode/src/penumbra.js composite，只读）

- 三遍：hard(bias=0) / pulled(bias=+0.7 体素高度，是 normal 的子集) / big(3×3 均值降采样→同场投影→3×3 均值模糊，r=1 圆判据 i²+j²≤r²+1 恰取满 9 格=盒式)。
- 合成：alpha=1−(1−.8·hard)(1−.34·pulled)(1−.44·bigUp)。半影带 .10<alpha<.50，带宽=到最近硬阴影格的 chamfer 距离均值（封顶 12 格）。composite 默认 tanE=.52。
- 尺度差：裁判在粗格上跑 castShadow 但 tanE 留粗格单位 → 世界空间有效坡率 ÷coarse，第三遍影足迹约 ×4（本例 az=1.1 时 963 vs 36 格 big>0.5），带宽 4.5–5.7 格 vs 正确坡率 1.5–2.0。仍判为裁判 2D 诊断的尺度差，不照抄；threeShadow 加 `bigSlopeScale` 参数化，传 1/coarse 可复现。

### 实现

- core/penumbra.js：`PENUMBRA_THRICE` 导出裁判常数；threeShadow 默认权重/pull/coarse 改裁判值；新增 `bigSlopeScale`；penumbraStats 补 pulled/big 格数（与裁判 hardN/pulledN/bigN 同口径）。
- light/penumbra.js：bakeWaterPenumbra pull 默认 L*0.7（原 L*0.35）、可覆盖；bakeVoxelPenumbra 权重默认裁判值、pull 默认 L*0.7（0.7 体素层）。
- world/penumbra-terrain.js：补 dispose()——还原材质 onBeforeCompile/customProgramCacheKey、销毁打包纹理、还原 receiveShadow 与自己打开的水面层，幂等。
- penumbra.html：新「地形·洞/悬挑三场（体素接收面）」开关 → postExtras.set('penumbra3d')；文案更新。

### 验收

- tests/penumbra-referee.mjs（新，裁判对照）：buildWorld(7) 四方位下 normal/pulled 与裁判 hard/pulled **逐格一致**；stats.hard/pulled 计数相等；bigSlopeScale=1/3 时带宽 ±8%、带格数 ±10%、alpha 平均差 <1%；默认坡率下 big 足迹 <裁判 1/3（刻意的尺度差）；确定性逐字节一致；pull 单调；权重全零→全透；非法 bigSlopeScale 拒绝。
- tests/penumbra-terrain.mjs：追加 dispose 断言（纹理销毁、材质链还原后不再注入 penumbraTone、cacheKey 还原、幂等）。
- tests/penumbra.mjs / penumbra-voxel.mjs / penumbra-terrain.mjs：回归 PASS（scaled pull 随新默认改 7）。
- tests/penumbra-browser.cjs：回归 PASS（水面带 484/403 格，权重变化预期内；编辑/转太阳/释放仍过）。
- tests/penumbra3d-browser.cjs（新）：penumbra.html 真场景 mixed/quad 各一遍——体素接收者 6876/5050、多接收者柱 12/10（真悬挑）、开替代 PCF 接收+水面层、转太阳重烘、关还原、dispose 纹理+材质补丁通过；pageerror 空；截图 penumbra-3d-{mixed,quad}.png。

### 如实剩余差距

- 侧墙（nW.y<.55）不吃半影，仍由 N·L 明暗负责；形变表面按最近体素层采样（±L/2 近似），不是逐三角形投影。
- 裁判的 ×3 长影是其实现尺度差：默认不照抄，带宽绝对值因此不与裁判一致（机制与参数口径已对齐，宽度旋钮 bigSlopeScale 可复现）。
- 原片演示"故意加深"，无源资产可做逐像素宽度对照；只能做到机制+参数口径对齐。
- TigerMessenger 消费者：游戏实际跑 src/vendor/townscaper-rea-refactoring 旧副本（2026-10-31 vendored），无 penumbra 模块、view.js 仍是 PCFSoftShadowMap+ShadowMaterial 水面——本批改动要再 vendored 同步才会进游戏，本轮未同步。
