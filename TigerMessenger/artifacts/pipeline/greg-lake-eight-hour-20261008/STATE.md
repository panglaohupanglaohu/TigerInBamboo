# Greg 湖沼与信使八小时实施

起点：2026-10-08 09:13 北京时间；截止：17:13（09:13 UTC）。自动续作 id：greg，20分钟唤醒，常规保持安静。旧五小时任务已经结束，不能混淆。

用户授权：依据 ../greg-lake-current-target-20261008/target-v2.png 让生物活动、船真实划行、鲸鱼游动、虎巡视、猴维修；老树、斑驳湖壁、繁茂植被；整体与信使对目标各超过90分。信使使用 Aholo Lux3D 插件，主线程核实入口中。插件目录search_plugins与已安装文件名搜索暂无匹配，已向用户请求准确名称或链接，不假称使用。

## 当前分工
- greg_reference_a：swampFlowerActivities.js 及 moebiusSwamp.js 花船茎refs/鲸update/维修lifting/install参数局部；先做划桨推进、鲸定向摆尾、真实拉绳维修。不可覆盖静态环境/虎/信使。
- greg_reference_c：树干、树皮、自然崖壁、understory对应静态模块；苍老形体与裂纹、斑驳苔岩、非均匀繁茂簇；保护通路与桥。
- root：正式系统集成、虎巡视回归、信使指定插件核实、GPU与评分。
- oskar_plaza_height_fix：继续此前独立圣城候选，尚未正式接入；保城抬广场与贴轨降城存在需求冲突，等待用户高度取舍，不默认降城。

## 起点事实与待验
- 当前信使苇岸行者v7、虎round40已在生产工厂，虎40造型6CPU；姿态/GPU最新统一验收待续。
- 湖生产坐标已(.30,.45)，完整CPU轨道中心距54.49world、柱冠保守间隙5.60；最近卫星塔与正式GPU仍待验。
- A确认花船原仅上下浮动、无XZ推进；主鲸有椭圆位移但朝向与尾段待修；维修猴原摆臂未实际连绳工具。
- 黑娃四肢游泳与7.2秒换气已接生产；检查页feedWhale已自动播放，不重复重造。
- 鸟浅绿且头内粉光、蜥原绿体内粉紫光、四腿荧色蝾螈、辣椒猴名称必须保持。
- 上轮完整系统约6–14FPS，不能以CPU或局部截图声称性能通过。

## 验收评分（尚未打分）
整体100：目标构图与色形20、动作与互动25、环境层次20、空间承托/净空15、稳定性能20。
信使100：比例剪影25、头发面部15、服饰层次25、叶荚邮袋15、动作/穿插20。
须附当前真实截图/多时点动作证据。超过90是目标，不是已经达到；严重穿模、活动不动、正式未接入不得通过。缺项如实保留。

每轮保留源件、精确测试结果与GPU边界；不得Git提交/发布/对外发送。截止删除greg自动任务并交付结果。

## 首轮已执行
2026-10-08 09:18左右：正式虎现有foot-lock / gait-transition / water-return测试5/5通过（tiger-baseline-tests.txt），仅CPU不是新GPU。系统shell无node，使用app bundled node后完成。A正实施活动，C正实施静态环境，主线程继续插件入口核实与整合。

## 首轮GPU与第二轮分派（2026-10-08 上午）
A活动v3正式工厂12/12CPU，180秒路径/间距/手绳/茎端验证；短巡游span3.547inner约1.77world，不能叫完整跨湖航线。报告activities-first-round-report.json。
C环境首轮trunk3/natural7/outer2已接；首次GPU失败crackPhase重定义，修weathering局部变量cw前缀后reload实际shaderErrors[]。overview-first-t0.jpg、overview-activities-t12.jpg/t30.jpg同机位已实际看，花船/鲸/虎位置与朝向改变，真实状态JSON t12/t30保存。局部1198draw约112万tri，不代表完整球面性能。
真实画面仍明显未达目标：外圈粉土大宽平环、树干长直裸与稀冠、灰壁斑驳不明显、群落矮，已反馈C开始站立弯垂扇叶和稀疏主裂隙。C第二轮understory7/natural8已保存，正式全场验证正在跑，未声称新GPU通过。
码头t0/t8实际已看并保存dock-first-t0/t8.jpg，桅构件有变化但镜头远/前景绳遮挡，不能据此宣称猴手工具视觉通过；新repairMonkey近景页构建中。
A第二轮：修长船出航退出抬高缩船导致桨离水、sail/fade朝向切向、速度驱动桨频；授权湖沼专用V6 pose后处理保证回桨抬水/握持，不能改全场战船。花船仅复用帧临时对象不改已测路线。
主review.js新增只读精简activities状态（船position/heading/cycle、鲸position/heading），没有序列化Object3D，恢复件review-before-activities-state.js。浏览器detailBrowser4，eightReviewTab新页repairMonkey；结束前markHandoff，重负载正式页尚未打开。本轮未处理信使插件缺失，仍等链接；不要重复催用户。

C round2已冻待GPU：27/27局部、正式168396叶顶点环带穿越0/越界0，原壁8阶6水根hash保持，4植被批63092tri；environment-round2-report.json。root维修近景repair-monkey-first-t0.jpg已看，原猴/工位可见，shaderErrors[]，尚无近景多时点对照。下轮先环境round2同镜头GPU，再A长船结果与正式全场，不重复已完成总览t0/12/30。

## 11点续作实际检查
- 环境round2 overview已实际GPU看并存environment-round2-overview.jpg：natural8/trunk3、shaderErrors[]；50fan/98fern/354pendant、局部4批52320tri（与正式seed数量不同）。高叶改善但粉土平环/裸杆/稀冠仍明显不达目标；C第三轮审计通路与虎扫掠后补非均匀群落、既有冠枝端2–3错高扇叶，不改树锚。
- A活动round2正式接入：长船湖专用V6posePostProcess，52人保留，推水/回桨/切向/退出贴水修正，5CPU过；报告activities-round2-report.json。尚未本轮GPU通过。
- 正式完整游戏已实际新启动（约30秒boot），湖外移(.30,.45) rim入口可站，formal-outboard-rim.jpg已看；无旧轨道柱穿湖，但不是完整所有空间证明。完整局部约11–15FPS、6000–8000calls/470–558万tri，性能仍不达标。
- 正式middle视角被厚灰岸壁遮满，formal-outboard-middle.jpg已看；不是合格视觉。新增团队greg_camera_clearance负责真正生产第三人称防遮挡，先报告所有权，禁止只改fixture或隐藏地形。
- 朝湖心合成W1.083秒位移3.5764world/onGround=false/minFootMinusGround -21.13/endinner[10.531,28.747,-14.755]，可能从岸边走入水，未称行走通过。结果formal-middle-input.json，已恢复原内存位置并关闭正式页，存档无改。
- 主fixture加出航长船链接/actor跟随镜头，当前eightReviewTab view=departingShip待构建，多时点长船GPU为下一个动作。detailBrowser4，旧审核页27句柄eightReviewTab；没有新增viewport。
- Oskar仍仅候选等待用户高度方向，不抢主湖任务；信使指定插件仍无入口，未擅用别的工具冒充。

长船round2 GPU：departing-ship-t8-2/t8-8.jpg已看，真实桨与手crew可读、回桨有变化且shaderErrors[]。P0 t19跟随镜头被外壁遮挡，船鼻/桨在入口粉柱/灰板下（departing-ship-t19.jpg），可能路线穿岸而非仅相机；A正在专项全船壳/桨/帆三角扫掠、原白岸路与花船路径交叉，不得称长船出航完整通过。新出航镜头仅诊断不改变生产相机。相机代理所有权core/camera.js+swampCameraOcclusion.js专测，A/C/root勿触。

## 13:20续作检查点
活动P0已由A真实三角确证77/102接触，修为v4真实水域选址与湖内巡回（不再穿阶出湖），2016船岸检测/720姿态扩容扫掠0，11CPU；activities-solid-route-report.json。GPU新v4待root，不复用v3通过结论。
相机core近壁2m硬下限/平滑后穿墙已由camera代理修，7CPU、372正式中心射线0穿墙；完整视锥/近距人物与GPU待验。
C中央冠v6已经扩大真实包围，21枚大曲叶/总753片10draw，8CPU，轨道净距40.23world。待总览新GPU。
root性能census1181可见sourcebatch（不含相机裁剪），glowflower224、giant95、树118，完整GPU性能仍不合格。新增swampFlowerRenderBatch.js+V2Art末端调用，五大花每花7瓣合1，原attrs逐字节/材质/节点/整花动画保持，节省30draw，1CPU通过。恢复flower-batch-before/V2Art，尚未GPU；manifest需新增helper。
浏览器原eightReviewTab被用户切到monkey，抓图已正确改名monkey-current-user-view.jpg，不能当苔斑close。现独立eightVerifyTab新overview构建中，使用它作验收避免继续干扰用户旧tab。

新同场GPU overview-canopy6-activities4-batch1.jpg已实际看：activities4/canopy6/calls1179/shaderErrors[]，大花五朵可见、批次未丢瓣；中央冠覆盖增大但三叶重叠读成大折板遮视野，C已再派分群曲叶/透光缺口下一轮。A v4只有新总览，不等于完整t19运动通过。root flowerBatch1CPU+GPU基本成立（未做同光逐像素断言）。八小时任务继续，17:13未到不删greg。

## 14:10 北京时间（06:10Z）正式复验与新增性能优化
- 重读本文件与handoff：较新的授权段确认目标/cutoff；本状态继续作为最新操作清单。实现未commit/publish。
- A完成flower glow batch仅新`swampGlowFlowerRenderBatch.js`+专测，在V2Art材质处理末端由root接入，另在review fixture增只读compact status。16花由224瓣/描边draw减至96（-128），原mesh几何/法线/位置哈希/toon外扩/整体动画保留；不减triangles。第一次专测因生产入口已自动批处理而baseline误读失败1项，修测试先dispose生产batch取真实before，当前Focused tests含camera+shore+glow共12/12通过，log保存在对话tool输出；代码测试本身2/2。相同root另有5花批次节省30draw；实际GPU两个report皆在，画面瓣未丢、shaderErrors[]。不把局部场景draw减少说成整体FPS通过。
- C对原understory v9仅改既有rim扇叶高度目标，锚点/足迹/数量不变，变形每片先验路线、虎扫、码头、入口、桥净空并回退不合格点。专项10/10，93岸株6株>7.5单位直立层，69低蕨，36石支撑。实际GPU截图overview-canopy9-batches2可见高度层次改善，仍留巨大光滑珊瑚色平环、灰峭壁面、远处/大冠遮挡，没达目标。
- 正式局部活动v4实拍 t8.2/t8.8/t19，三个时点shaderErrors[]；长船保持全尺寸巡湖，桨/帆/船体时序可见，旧v3的t19灰墙/阶梯穿透未重现。局部scale0.5，不等于完整球面验证。
- 黑娃喂鲸同局部实际实拍游水与cycle0.31呼吸时相（runtime breath=1, mouth target25.19, nose25.216）；scale0.5细节很小/局部遮挡，动作对相机不够清楚，不能称高级别视觉证明。
- Camera agent指出正式CPU provider此前漏掉邻塔V7 quay。增加实际湖腔裁切helper/shore provider，并保留桥/轨道/湖路；clipping和camera suite共10/10（见专测）。camera notes原说“仅camera.js改”已过期，需final更正。恢复camera-only原件`camera-before/camera.js`; runtime旧件`camera-before/crystalV7Runtime.js`; 新helper可删除回退；但新`swampCameraOcclusion.js`历史before快照缺失，仅Git HEAD可恢复。
- 首次正式GPU仍灰屏。真实中心射线识别quay距0.95后重载裁切版；中岸`formal-middle-after-quay-cut.jpg`依旧整屏灰紫板，不能通过。新数据相机向内位置[17.217,33.049,-17.741],遮挡回拉至.15，中心线hit courier body .053，之后弯曲海洋7.80、世界树11.98、球面13.14、湖墙22.26；完整视锥仍未识别。玩家已通过夹具restore回原内存位置并关闭页。Camera agent继续解决完整frustum+角色镜头/剪裁，不可由此称解决。
- Full game actual resource diagnostic约10–12FPS、6100–6800 calls、4.8–5.2M triangles，性能不达标。详情及图片清单见`gpu-round-20261008T06-20Z.txt`。下一步：优先正式中岸新camera GPU full-frustum; C v9 height current reload; tiger/courierpose need actual close GPU; complete manifest/recovery/provenance; Aholo Lux3D依旧无链接，不能宣称使用。

## 14:30 北京时间持续验收增量
- Activity v4 local t8.2/t8.8/t19截图已归档，t19旧船撞岸实况不再复现；5大花船、大小鲸在游水页定位可动，零shader errors。父镜头尺度 .5；黑娃呼吸只在runtime cycle与抬头几何能证明，远景可读性差。
- 老虎真实局部GPU从静态/巡视到forceDrink : t0 grounded real-ground；t2s mode descend；t6s mode drink，4脚ground samples和高度见`gpu-round...txt`; `tiger-descent-t4.jpg`可见饮水姿势，路线还在实际台阶上。CPU现有虎5/5。没有声称不同完整系统显示。
- 正式信使苇岸行者本轮实际GPU待机+walk/run/letter/ride/jump 6pose截图，各runtime phase递增、shaderErrors[]；比例局部看仍较窄高，Aholo Lux3D不在任何已安装工具/入口，不能声称用过。Plugin链接等待用户，不重复催。
- 更新相机进一步绕障后，正式camera中心ray不再hit quay或角色，但实看仍整屏灰紫：camera仍在.15m occlusion、yaw/pitch 0，cameraInner约[17.22,33.10,-17.74]。证据`formal-middle-camera-escape.jpg`已交camera owner继续；root已还原真实玩家位置。中心射线只说明单线通畅，整frustum失败是当前P0。
- 最新12 focused tests 12/12 pass见node session和项目report；后续需相机最终测试、fresh GPU。Root状态不要写成当前任务已完成/打分超过90。


## 17:00 北京时间收尾复验（截至09:00Z；17:13仍ACTIVE）
- 收取花船桨清晰度修正：桨杆加粗、深棕，桨叶放大加深并外伸，power低/return高；两手抓握绑定保留。代理自测4/4，root最终合并重跑 `swampFlowerBoys.test.mjs` + `swampCameraOcclusion.test.mjs` 共13/13，日志`final-focused-tests.txt`。实际GPU局部t2截图核看：五花船运行时每艘桨数仍为2且shaderErrors=[]，棕色桨已比之前更可见，但在这台景观遮挡关系下仍难作为完整船桨剪影辨读；t2状态部分处于return/power，不当作高质量双桨验收。代理原备份仅在`/tmp/swampFlowerActivities.js.paddle-readability.bak`。
- camera全方位寻找逃逸路线与跨帧保留的修复已接入，相关CPU 9/9。完整球面重新启动并按正式`中岸`定位后实际GPU新截图：中岸环境未被之前整幅紫灰墙遮住，但信使角色背部极大且居中，约占视口3/4，当前镜头构图依旧不可交付；不算camera GPU通过。此截图只在本轮视觉核看，未写入证据目录。恢复份`camera-recovery/camera-before-final-visual-fix.js`。角色内存位置后续应点“返回本次观察前位置”；未改用户存档。代理已继续做最后一次小修。
- 当前完整游戏计数仍表明10 FPS左右、约7.7k calls/5.77M tris且帧迟滞波动；小场景花船批次和活动局部测试不是整局性能通过。
- Aholo Lux3D入口仍无已确认工具/插件连接，用户没有提供具体链接；信使实景v7不声称使用。最终评分目标90未达：当前lake54/courier72为人工临时保守分，不是外部基准。
- 到17:13再做一次状态、错误的恢复目录与最终测试输出核对，更新handoff并删本8小时greg automation；不得提前删、不得提交/发布。


## 17:12 北京时间截止前最终回归
- camera最终尝试将应急视角扩大到24水平角×5仰角并存yaw/pitch，单独9/9 CPU通过；重新加载正式游戏并在中岸实际GPU截图核验，结果仍是信使背部占据大部分视口，不能验收。该临时视点已按页面按钮返回原本内存位置；存档不变。截图本轮在UI检查、没有导出进证据目录。
- 正式全场fresh启动本轮读数约8.5 FPS、5822 calls、4.72M tris，继续标为性能未通过。
- flowerboat paddle readability patch roots combined 13/13 tests. Actual局部GPU证明源码加载、错误为空，棕桨增强但不能可靠读成两支清楚桨；不宣称完全解决。
- 本检查点和RESULTS重新核对仅引用实际存在的恢复件，不存在的`environment-round5-freeze/`及`understory-v9-before/`已移除。17:13:26已停止本次八小时持续任务，并由automation工具确认删除`greg`自动唤醒。
