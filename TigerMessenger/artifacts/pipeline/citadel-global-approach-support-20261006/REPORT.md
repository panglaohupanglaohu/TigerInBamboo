# 全球接驳：50 米源侧 collar + 局部立交候选

2026-10-06。全部离线 CPU，默认关闭、未安装、`accepted:false`。只新增本批候选、测试和调查脚本，没有修改 main、tramSystem、正式 release、山体或共享城市结构。生产继续原 release。本报告替代初期“未建支撑”的状态描述；原始海面拒绝保存在 `WATER_PREFLIGHT_HISTORY.md`，失败几何和各轮搜索 JSON 全保留。

## 结果与边界

已生成真正支撑几何，并解决本批发现的保留全球回程列车交叉：50 米提前源接头、仅东段径向重排；中央桥、旧岸及两条接城阶保持原几何。新接驳支撑 8 mesh / 1 material / 5148 triangles，26 个逐脚径向海床承托站；跨回程支线处为 23.437 米开放孔，两个冲突柱/横梁改为两侧真实连续纵梁，并有两端承座，不是隐藏柱子制造假通过。

已完成的有限检查：

| 检查 | 本轮独立结果 |
| --- | --- |
| 全全球红蓝载货 vs 新接驳支撑 | 10395 姿态，187527 次三角/OBB窄检，0 接触 |
| 全全球红蓝载货 vs 重建城市廊桥 | 10395 姿态，895676 次三角/OBB窄检，0 接触 |
| 新 replacement 载货 vs 当前城市模块/新廊结构 | 1534 姿态，0 接触 |
| 新 replacement vs 最终 remesh + planet + 新曲线 carve 的 hills | 红1138/蓝1162姿态，步距<0.5m，50952次窄检，0表面接触 |
| 闭合 remesh / planet 实心判定 | 每姿态27点，共62100点，有向交点分组，0埋入 |
| 原80个交叉失败WORLD姿态的实际3种货物工厂 | 各80姿态；新支撑/实际生产Catmull+Tube轨管均0三角接触 |
| 双轨真实最近断面 | 1144站、9种纵向错位，实际载货OBB SAT 0车体接触 |
| 城市上步道/中央桥/旧岸/两条接城阶 | ground14388 / body14346查询，0失败；步道0.5m、接城阶0.1m有限步进 |
| 本批专项测试 | 20项通过 |

没有宣布完整导航、工程承载、GPU或整体上线验收。既有全球桥墩/道路/地标/活动演员与完整新消费链仍未联合核验。源侧接头的通用桥末跨截面按生产实际采样公式复现，尚需安装事务核实原桥该末跨确实存在；不能把缺失末跨也标承托成功。城市相邻步道、海床支撑、载货和海面检查有明确范围，没有用 `unknown` 代替通过。

## 80碰的根因

保留回程支线原 source u 范围：red `0.9422158771–0.9499461946`，blue `0.9433508638–0.9505264210`。它们不在替换区间，应保留。

旧接驳中心站138.785m，castle `[128.3677,-70.0918,54.0911]`；附近保留蓝线 source `u=.9448640483`，castle `[122.3251,-68.6246,50.7202]`。按下线实际车架上法向投影，轨面高差只有4.03574m；两法向dot=.998131。真实蝗虫货车42个姿态、蚂蚁12个姿态碰到新轨管本身，不能靠削薄桥板或挖桥面孔解决。底盘/车轮均按生产工厂测量，没有豁免碰撞部件。

新候选相邻区有限最小正法向高差7.03139m、径向差7.13735m、法向dot=.997503，位于center新站190.616m与blue原source `.9452416918`。轨道抬开后尚有38处新支墩/横梁碰撞，明确去除两处支撑站并做两侧上置连续梁才归零。

40m collar仍有29个粗筛接触；60/70m会碰另一条原source约`.314–.319`支线。50m是本轮实算可行者，不是任意抬高后只测一个截面。

## 源参数变化、保留世界轨和城端影响

`startU/endU` 下表属于**原 source 曲线参数**。完整最终 global u 必须由 `startup.splice.lanes[lane]` 映射，不能沿用旧最终 u。替换之外位置和切线精确委托原曲线，闭合接缝不重采样。

| 线 | 原候选 source start | 新候选 source start | end保持 | 完整全球净增长 |
| --- | ---: | ---: | ---: | ---: |
| center | .5924110319368087 | .5733088104954024 | .799 | 3.743140m |
| red | .5900000000000000 | .5706734626725924 | .798 | 3.800804m |
| blue | .5925844302347414 | .5736982280057619 | .800 | 4.027451m |

每线沿各自原曲线提前50m。replacement长度增加约53.7–54.0m，但原来已存在的50m同时从source借入，因此**不是全球铁路额外增加50m**。原source `[0,newStart]`、`[end,1]` 世界几何精确不变，包含发生交叉的`.94`回程支线。

中心旧源点 world `[-113.241803,-10.703914,114.153566]`；新源点 `[-130.472919,-44.087060,83.680768]`，castle `[127.342586,-244.681087,50.541192]`。这是星球背侧全球接线，不能用castle +Y造城市柱。支撑逐脚用世界径向实际表面查询。

新城市廊入口仍取下降穿越castle x120的实际断面。中心旧入口 `[120,-57.654670,57.370953]`，新入口 `[120,-52.576323,58.288659]`，chart Y +5.078347m。它包括重排后的截面位置变化，不能当同一XZ点单纯抬高5.078m。全球接驳长度由154.135259→210.935257m；城市新岸廊由165.370010→162.313152m。城市步道继续在对应新轨上6.9m，重新建模而非留着旧上板。

中央52.891021m、旧岸145.061444m使用原curve对象；原中央上桥的两条接城阶以原实际端口重建，起终点与walkPath做逐项相同校验。额外55/65广场链接保持关闭。新城市结构较现生产保留方案增加6mesh/1348tri（164mesh/58884tri），不是相对上一个未安装east预览的差值。

三线最大坡分别约3.942%，最小半径center27.136/red25.943/blue27.250m。独立径向曲线必须独立复核三线对应：最近实几何断面距3.948885–4.297837m；红蓝最大径向差0.228763m；中心与两线中点最大三维距离0.530511m。没有把等fraction当同一断面，也不把中线当严格等距轨心。结构和载货按实际两线验证；未将旧`centerCorrespondence`报告继承成新结果。

## 水位、真车与承托

生产车体轨坐标包含+.12m平移及旋转，32轮/连杆相位、4种车体+3种货物工厂。全部实体最低轮缘 `-.036000003m`、顶5.351213m、halfWidth1.741875、halfLength3.490000；不包括仅烟雾/瞬态视觉。额外外扩侧.6、底.1、顶.35、纵.1后检查。真实非轮底盘更高，不能用旧bottom=-.5整块盒把正常桥面误判为碰车。

接驳桥起点deckTop=-.49，30m平滑至-.75，厚.55；源侧槽下承接原通用桥最后一跨底面(-.24)，其约.405m间隙有真实连接板，不改变原行车顶面。宽8.8m，末18m过渡11.6m，与城市下板共享实际端截面。轨管/枕木保持原生产几何基准；桥顶低于实际枕底，真实车轮也有余量。

3811实际顶面采样最小波上界净距.194971m，另按官方连续径向海高+.067最小.091457m，要求.05m。桥顶湿点0。桥身189点位于海内是允许的浸水基础，不能混同行车顶面湿。海面不隐藏不降高。

26个站每站4个实际径向first-hit脚点，星球48×32 canyon壳、按新完整三线carve的hills、最终remesh共同取最外层。超12m盲长柱/未知海床会拒绝。跨空两承座s187.498006、210.935257，span23.437251，二侧梁宽.32、高.5放在deck顶边缘；承重能力未做工程分析。

## 回退与待安装的硬边界

1. `createTargetEastGlobalCrossingCandidate({enabled:true,...})`只返回新release/startup数据，默认off。不要单独把曲线塞进现 `opts.citadelRailSplice` 就发布：现生产该路径 `installedTransit=null`，通用桥结构不会按新覆盖排除。
2. 一次事务由同一个startup.curves重建轨管、枕木、车辆、站点、联锁、方向和global长度；保留原release可回退。原source保留点用`mapOriginalProgress`，replacement内部旧点不存在保位置映射，不能照搬旧最终fraction。
3. 城市结构只消费新`segments.newShore/central/oldShore`。独立接驳支撑只消费`segments.globalApproach`，world几何不再乘castle矩阵。释放各factory owned资源一次。两者都建成和联合复验后，调用方才能把其已建覆盖用于通用桥排除。
4. `terrainDependency`仍要求先建原保留release地形、确认source epoch、原样挂最终remesh、刷新全部terrain缓存。**不能用新曲线先生成artifact的旧source，再假装hash仍适配。** 本轮未修改artifact，公共铺装没有再切掉；城市实际obstacle/ground/body已用它复测。更广公共2949点保护账本不在本轮重建范围，不把旧统计伪称新统计。
5. 缺失正式global既有桥/道路/演员联合验收、源末跨存在性、正式站点和联锁事务、动态波/货物动作、连续行走/车辆、GPU与视觉。release仍保留`GLOBAL_APPROACH_SUPPORT_UNBUILT`，因为离线support group尚未原子挂入实际scene。不能根据本报告直接去掉硬标志。

## 证据和重放

- `crossing-50-underpass-support-audit.json` / `crossing-50-underpass-support-candidate-geometry.json`：实际新支撑及完整全球载货检查。
- `crossing-50-city-structure.json`：实际城市结构、真实接城端口、载货、全部上步道和全局车辆。
- `crossing-50-final-terrain.json`：新线重测最终山体/星球/hills，未继承旧路线0碰。
- `crossing-50-actual-vehicle-diagnosis.json`：三种真实货物对生产轨管/新支撑。
- `crossing-50-correspondence.json`：真实断面、源u/世界点/局部点、净全局长度变化。
- `retained-crossing-diagnosis.json` / `crossing-route-trials-independent.json`：根因及40/50/60/70m取舍。
- `water-preflight.json`、`support-audit.json`与`support-candidate-geometry.json`保留为**历史失败/不足范围**。最后者是只查自身approach时生成的旧模型，后来全global失败，不能当新方案。

运行：`node --test tests/world/targetGlobalRailApproachSurvey.test.mjs tests/world/targetGlobalRailApproachSupport.test.mjs tests/world/targetEastGlobalCrossingCandidate.test.mjs tests/world/targetEastGlobalCrossingRelease.test.mjs`。
实际联合：`CROSSING_50=1 CROSSING_UNDERPASS=1 node tools/pipeline/audit_target_global_approach_support.mjs`；再运行`audit_target_global_crossing_structure.mjs`、`audit_global_crossing_50_terrain.mjs`、`audit_global_crossing_correspondence.mjs`、`diagnose_global_crossing_50_vehicles.mjs`。完整路径均在`tools/pipeline/`。
