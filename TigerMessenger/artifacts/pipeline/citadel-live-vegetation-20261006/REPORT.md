# 切崖与实际植被联动预览（17:07—17:10）

普通首页后台 tab11，从现有生产 Mesh 严格 epoch 匹配生成 final remesh；16 株移栽、3 株明确退役、1798 片真实失撑草片裁除共同 apply 后真实 GPU 保存 `combined-cliff` 和 `combined-front`。两图 GL0、gpuFailures[]、浏览器 error[]。完整调查写入截图同名 JSON 的 eastCliffVegetationSurvey。没有更改默认生产轨道、桥廊、导航、碰撞索引，故不是交通联合安装或玩法验收。

实际297树，278保持、16移栽（受影响树使用0.8紧凑尺度）、3退役，剩294；308原隐藏零尺度实例槽保持。fixture402树与实际场景数不同，不套用fixture成功数量。退役原因是当前有界联合分配无解，并非证明任何种植位置都不存在。树冠和树干配对压紧，保留 old→new index 映射；canopyStudy placements 与同源 mountainStudy.canopy 元数据事务同步。外部 companion anchors、导航/云/碰撞缓存仍须完整安装方消费。

`combined-before`与`combined-cliff`为相同临轨机位、timeOfDay=.49。全景仍明显可见深长板状褶皱、山廊间距、稀疏街群及过大背坡；移栽清掉受影响悬树不等于山形与目标相似。没有新评分。`combined-reverted`确认preview=null、applied=false/restored=true、GL0。随后UI恢复daySpeed=.4、玩家镜头、关闭菜单，信使仍在书店，未移动用户页。

源文件：src/world/citadel/surveyEastCliffLiveVegetation.js（按需真实几何调查/prepare）及src/ui/targetCityPresentation.js（显式调查与可回退外观按钮）。默认生产不启用。植被工厂9项事务测试由顾问完成，覆盖退役压紧、隐藏槽、元数据与回退。

另一个真实阻碍：全球接驳候选的局部631载货姿态通过，但完整两线10379姿态发现保留回程支线与新桥80碰；实际机器人三角与新轨管也相交，不能把它视为保守包络误报。new_city_main正在独立候选做源侧前延50m立交，初筛最小半径25.943m/最大坡3.943%，但尚待完整结构/全球/城廊联合复验，未安装。
