# 八方向纹饰与悬挑地形 · 2026-11-04

先按精确ID读README：1061221291137605633（line179）说单纹理八方向、中心镜像可适应尺寸；1671808851895627776（line54）说支持overhang的地形生成器值得展示。原文没有D4映射次序、折叠公式、体素算法或侵蚀有效性保证。

## 两段682帧

- 纹饰379帧0–378，0–22.919秒；sheet-00至03全部逐格核验，原尺寸230。方形细线纹样切换构图，76附近开始拖动边框为横矩形，138后变化Orientation，208后拉成窄高面板，267后再次换纹样/拉宽。Orientation滑条清晰，原作图案远比本地曲线复杂；不由视频猜测精确layout公式。
- 悬挑303帧0–302，0–9.81秒；sheet-00至03全部逐格核验，原尺寸190。开头短暂黑轮廓，随后浅岩柱、黄绿地、房屋；镜头环绕，柱间空洞、岩檐阴面和下层地面可见，223后转到较低侧面。不是单一高度图能表达的全部表面，但不能据此认定原作内部一定是本地体素格式。
- 每帧编号/实际时间/阶段观察/原尺寸标记在各ID/review-observations.json。本批新增2段，已学习的247帧天然岩拱不重复记账；另一段软坡视频1447488323845509121尚未学完。

## 单纹理D4接入

复用core/ornament-field.js与ui/ornament.js已有128²距离场、独立border/center cutoff与展开。新增core/mirror-uv.js的fold/orientUV/mirrorUV及同构GLSL；四次旋转×镜像得到八方向，CPU与GPU均实测。ui/ornament新增orientation/metric/tileSize uniform，原默认模式保持旧行为。mirror.html使用同一createOrnament模块，没有另建一套shader。

固定像素尺度的中心三角折叠会重复纹样，是本地重建方案；原视频的尺寸重排不能简单等同它。未复制原作装饰资产，也没有逐一兼容原版makeMotif/paintRect/seamError的Canvas接口。新增映射标增强，具体差距保留，不宣称完整原作视觉匹配。

## 共享悬挑与诊断

静态对照发现现有World已存多段岩石，features写空中rock，terrainmesh已有悬挑侧壁、岩檐底面、空隙下方地面。保留这些已有改进，不从头重写成独立高度图。新增core/rock-topology.js读取同一World：列出各列rock区间、空隙列、暴露底面/面数，并对岩石邻接做level1根的BFS，诊断未连地岩石。只诊断、不删岩石、不改World；建筑支撑不在本轮岩石连通定义内。

overhang.html在实际World/View内构造岩檐，可断开支撑、俯视/低机位、恢复原World。最初两格小fixture经既有平滑形变严重收缩，改用更宽支撑/基座并保留可选平滑；薄檐仍会收缩，所以默认诊断格状几何。该页不等于原作美术验收。原版heightField的soft/sharp完整生成、侵蚀无局部极小保证与measure接口仍未完整迁移，映射列部分覆盖。

## 验收与边界

- tests/mirror-rock.mjs：8种不同D4坐标，中心镜像与负坐标折叠；实际混合/四边World的rock区间、空洞底面、断开支撑、无World修改、预算拒绝通过。
- tests/mirror-overhang-browser.cjs：真实GPU的8种纹饰hash均不同，水平中心镜像最大alpha误差0；多种长宽只更新uniform，纹理对象不变。原ornament-browser.cjs在320×160、640×320、960×480的单纹理、独立cutoff、展开/停止回归通过，mirrorError≤1、leaks=0。
- 真实World岩檐：混合30、四边28个rock，均全部连level1；各有1空隙列/1暴露底面，实际合并几何有6个朝下顶点位于y=2；断开支撑各诊断1个未连岩石，gap内level3为空，View使用当前WorldMesh几何，无pageerror/console error。
- 已查看mirror-eight.png、overhang-mixed-low.png、overhang-quad-top.png及修改后的截图。数据/底面存在可核验；低机位仍受视角遮挡，薄檐形变和图案复杂度不通过原作视觉等价。没有因测试通过就抹掉差距。

累计74/285，剩211；136模块25增强/73静态/38部分/0未覆盖。两个新模块已有映射，0未覆盖不代表全部能力验收。下一批两段新素材为软坡/硬崖连续地形与蘑菇崖观察；继续薄檐形变和完整生成器补差。

收口回归：mirror-overhang-pages.cjs确认index/pipeline显示74/285、小镇/北境/地形shader及既有fields增量编辑仍通过；素材/README均285、历史笔记243，管线缺0段，diff空白检查通过。将低机位进一步降至岩檐底部以下后，最新截图能看到外伸岩块的深色底面；仍不代表原作完整柱间石拱或平滑薄檐视觉等价。
