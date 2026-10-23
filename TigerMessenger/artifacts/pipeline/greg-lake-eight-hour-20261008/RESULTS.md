# Greg 湖沼重构：八小时检查结果

截止：2026-10-08 17:13 北京时间。依据目标 `../greg-lake-current-target-20261008/target-v2.png` 与已接受苇岸行者信使方向。

## 当前可核实的实现

生产场景接入花船/长船活动、鲸摆尾与巡游、喂鲸黑娃四肢游泳及周期换气、老虎按距离走四足步态/下阶饮水/返岸状态、长尾猴拉升桅绳维修；双桨花船、湖外移以避开轨道柱、真实水岸台阶/码头、两米路保护带保留。生物名称及颜色约束保留：浅绿雀头内粉光、绿蜥体内粉紫光、四腿荧色蝾螈、辣椒猴、黑娃岸上和游水身份。

花船与长船 v4 CPU真实固体/扫掠报告在 `activities-solid-route-report.json` 与同目录扫掠报告；船岸2016三角测试及720姿态扩展扫掠无接触。真实局部WebGL `longship-v4-t8-2.jpg` / `t8-8.jpg` / `t19.jpg`确认变化且无shader error。实花船每艘两桨运行时状态计数=2。临近验收将桨叶扩大并加深为红棕色，桨杆也加粗，CPU grip/划水相位测试4/4通过；新GPU截图中桨的深色剪影比旧版明显，但仍与巨大花瓣、花蕊及水面重叠，不能称为清晰通过。

understory v9只提高已有安全扇叶的竖向高度；专测10/10，真实GPU `overview-canopy9-batches2.jpg`能见高低层次变化。树干detail3、自然峭壁8、weathering3均接生产。近景墙GPU `weather-cliff-mottled.jpg`显示矿物斑驳有所增加，但仍以宽大灰色平面为主，远逊于目标中的岩壁层次。中央冠v7保留93.4%原最大水平伸展，7簇射线缺口22.5–25.3%，实际GPU总览仍有部分大叶遮挡。

真实信使生产几何是苇岸行者revision7；局部GPU `courier-idle/walk/run/letter/ride/jump.jpg`和runtime phase变化、shaderErrors=[]已记录。实际全游戏相机中岸仍大面积灰墙遮挡。Aholo Lux3D在本机已安装工具清单/`ALL_TOOLS`中没有入口；准确插件链接/名称仍待用户给，不能声称曾使用该插件。

## 正式系统与质量边界

完整游戏GPU截图显示性能不达标：先前约10–12 FPS、约5,800–6,800 calls/4.7–5.3M triangles；末轮新启动约8.5 FPS、5,822 calls/4.72M triangles。quay裁切后，camera emergency orbit代码仍未令完整中岸GPU画面清晰，camera代理将全方位择路和逃逸朝向保持修复，camera回归9/9；但最新完整游戏GPU中岸复验现在被信使近距离背部占据约四分之三视口，依旧不合格。紧接着增加24方位×5俯仰候选并重新启动GPU实测，仍见信使背部占据大部分中岸视口；第二次视觉验证仍失败。先前formal-middle-camera-escape.jpg是另一阶段的紫灰大面遮蔽；这些失败均说明相机视锥未通过。这项仍是P0。正式页玩家内存位置已恢复，存档未改。

目标评分没有超过90。基于目前可复核证据作临时保守评分：
- 湖沼整体 54/100：构图/色形 11/20；动作和互动 19/25；环境层次 11/20；空间承托与净空 10/15；稳定/性能 3/20。视觉尚有粉色平环、宽灰墙、中央叶冠遮挡和相机灰墙；性能接近11 FPS。
- 信使 72/100：比例剪影 15/25；头发/面部 12/15；服装层次 20/25；叶荚邮袋 12/15；动作/穿插 13/20。完整生产 GPU/角色视角穿插及Aholo Lux3D入口证据不足。

评分是以目标一致性、动作可信、生态互动、环境层次、空间和性能边界作人工证据评分，不是外部评测或基准测试。目标分未达成，不能宣称通过。

## 验证清单

- 本轮focused CPU测试：12/12，见节点运行日志与各专测报告；understory10/10、weathering3/3、最终双桨/相机focused rerun 13/13；相机末轮变更后单独camera suite 9/9、活动和虎既有回归见其轮次日志。
- 真实GPU：局部overview、t8.2/t8.8/t19、黑娃游水/呼吸、虎下阶饮水、信使六姿态、岩壁近景均保存于此目录；所有采样均记录了shaderErrors为空。shader无错不等同于内容视觉或FPS通过。
- 文件恢复：`camera-before/`, `camera-recovery/`, `environment-round4-freeze/swampCoralCanopy.js`, `environment-understory8-freeze/swampCoralUnderstory.js`, `weathering-before/`, `glow-batch-before/`, `review-before/`, `flower-batch-before/`。未发现environment-round5-freeze或understory-v9-before目录，故不再列为可恢复项。花桨变化的本轮代理备份位于`/tmp/swampFlowerActivities.js.paddle-readability.bak`（临时，不是仓库交付备份）。新增clipper helper可移除并还原runtime；新批次按其report.dispose()可恢复源对象。禁止恢复时覆盖不同所有权/轮次的后续修改。
- 未提交Git、未发布网站、未对外传资料。

更多图像名、运行时限制和检查点见 `STATE.md` 与 `gpu-round-20261008T06-20Z.txt`。
