## 传统战船 v6 实际接入（2026-09-10，本次更新）
接入后的真实 Web 回归：新游戏/旧 chapter2 共21项通过（artifacts/pipeline/saihoji-campaign-voyage/2026-09-09T22-57-29.150Z/report.json），正常两船50蓝盔进入隐蔽；v6 实际去返程10项通过（artifacts/pipeline/warship-web-navigation/2026-09-09T22-59-27.155Z/report.json），源版本稳定、无页面错误。航向通过不包含地形/泊位碰撞验收。


两轮船头修订 v5/v6 之后，v6 已接入 Web 公共 createFisherBoat 以及 Godot 苔庭战斗 _launch_ship，源 GLB SHA256 为 c18dfbd2d37dff6501fa799d99dd7e698aa1623d1c9c74939240562836a9a397。原模型保留为 createOriginalFisherBoat。Web 将保存的模型几何合批为 39 次绘制，保留 26 桨手/26 桨、蓝红缨、麻醉、清空桨手、夜灯接口；13 项独立真实工厂检查通过，握点误差 <1e-6。Godot 原战斗出航截图和301帧握点测试见 docs/WARSHIP_V6_GODOT.md；Web 证据 artifacts/pipeline/warship-v6-web/report.json。总对照 artifacts/pipeline/warship-prow-review/index.html。

不能把模型接入算登船完成：v6 展开绳扫桨手，v7 独立候选去掉高柱/绳解决收纳及绳扫人，但板体旧展开路径仍撞壳/桨，v7 未接运行时。见 artifacts/pipeline/warship-v6-boarding-audit/README.md 和 assets/models/optimized/warship-battle-v7/README.md。

水路候选仅 ?warshipWaterRoutes=1 开启，默认仍原主线路线以免阻断出兵。实际海深约0.5米，而船桨动态吃水可达1.30米；需真实加深航道并重做接岸，不能删除海底碰撞假称通过。原约4米终点泊位重摆尚未解决。下一步先完成跳板真实扫掠及岸面承托，再调整海底/泊位、替换候选路线并跑完整登陆。

# 传统战船两轮船头迭代（2026-09-10）

用户要求：更强前突、劈浪船头；移除航行时竖立的门板观感；货物放船尾；校验是否倒着开。

## 统一轴与两轮修改

Three 坐标 +X 为船头、眼睛、撞角和前进方向；-X 为卷尾与货物；+Y 为甲板上方。目标图主透视和侧视的眼睛端存在矛盾，旧 v4 把眼睛移到卷尾但仍以撞角导航，造成视觉冲突。本轮明确统一。

- v5：在原 v4 的独立副本上拉长木质船头，合并多叉撞角为单一楔形；眼睛移至 +X；船尾四件货物缩小收拢；登船跳板改为甲板下平放。
- v6：根据第一轮实际 GLB 回读图，前甲板进一步收尖、船头继续前伸并抬高；眼睛按实际船壳和色带表面重新贴合，避免悬空或被遮挡；收纳位置进一步下沉。
- 原 v4 文件不覆盖，26 名桨手、26 根桨及原 301 帧人员/桨动作保留。改变的是船头几何和跳板姿态，不声称原碰撞证据适用于新船。

路径：`assets/models/optimized/warship-battle-v5/`、`warship-battle-v6/`；每轮独立 Blend、GLB、assembly、脚本快照（实际重建入口为 tools/pipeline/build_warship_prow_revisions.py，传 --version 5 或 6）。图片在 `artifacts/pipeline/warship-battle-v5/`、`warship-battle-v6/`。对照入口 `artifacts/pipeline/warship-prow-review/index.html`。

Blender MCP 本轮读取无响应（No data received），两轮实际使用本机 Blender 后台完成建模、保存、导出和 GLB 回读渲染；没有覆盖前台未保存工程。

## 接入与验证边界

两轮是候选资产，Web 与 Godot 尚未替换为 v6。Web 航向错误另修：船用右手坐标系应为 forward × up = side，避免反射矩阵产生错误四元数；航路切向与增援侧移也需一致。真实去程、返程验证单独记录。

保存文件验证包括原桨手/桨数量、前后端、平放跳板、301帧动作保留和坐标有效性；这不是全身碰撞、上下船路线或完整美术复刻验收。下一步需用新甲板重验登船、跳板展开及船桨净空，再接入模型。

## 本轮结果

- 两轮保存 GLB 共20项检查通过，最终 GLB 哈希核对一致。
- 网页航向10项通过、零页面错误、源码稳定；真实去程3754/返程3756船帧均船头朝前。60,060数学样本补充覆盖各航路形式。报告 `artifacts/pipeline/warship-web-navigation/2026-09-09T22-02-39.227Z/report.json`，可视页同父目录 `index.html`。
- 航向测试采用原航程更新，返程使用原whaleReturned通知；不称自然完整战役。最终泊位重摆约4米及原航路贴入地形/建筑遮挡仍有问题，未计为连续航路验收；后续地形/泊船优化需要处理。
