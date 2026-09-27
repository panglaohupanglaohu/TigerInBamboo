

## 2026-09-28 连续反馈修正：空货列、贴地、射击、驾驶与标牌

本批实际修改 Web 主场景，汇总 `artifacts/pipeline/september-28-fixes/review.html`。保留各批 source-before，未清理用户存档、未触碰 Godot 或旧导出。

1. **空货列确有开局/恢复漏洞**：旧开局红蓝从 progress=0 空车在世界线路运行，新开局改为分别停首厂等真实生产。旧近站存档（距平台中心0.01米）等待生产状态未恢复，正常时钟12秒检查会离站；新代码重新建立平台等货锁，同样检查保持停车。之后红蓝均实际装齐三种各3台。没有假造9台初始货物；厂内空编组等待/回厂仍可见，旧存档在世界线上的空车仍需先返厂。证据 freight-empty-start-fix/{before-check,check}.json。
2. **重甲兵腿部埋地**：旧先锋兵 gh 仅采样苔庭/星球，不包含基地地面。新增 bookshopGroundSampler，径向采样真实圆形铺装、厂院与通道，结合已登记卸货台；只有基地内接管，区域外返回原采样。排除房顶/吊车，缓存静态地面。六个实际优化模型位置检查脚底约0.024米离地，15个厂院采样成功，区域外null。vanguard-base-ground-fix/grounded.png 是隔离位置验证，不是完整登陆流程录像。
3. **移动与运输射击**：原 combat.js 仅甲壳虫移动命令分支会射击，现三种均能沿行进方向移动并独立瞄准。robotArticulation 新增独立fire/pitch参数，保留下肢行走或运输蹲姿，叠加上身/炮塔瞄准；火炮、步枪、双管的原武器效果保留。baseDefense 允许 transit，车载不移动货位；地面防御增加贴地接近、墙体探测与机器人间距检查。生产/预留/吊装中不参与防御；隐藏、未落地士兵不作为目标；瞄准角、墙体和友方遮挡会阻止开火。远离基地的货车可对附近真实舰队自卫。
4. **C视角仍遮挡**：前批眼位调整不够。现在驾驶时隐藏当前机车组，切C回乘客或F下车恢复原visible；红蓝均测3个轨道位置。只影响本机车，不隐藏世界建筑或轨道。证据 freight-driver-clear。
5. **蝗虫更绿**：单独材质映射为主甲#4d703e、副甲#789361，甲壳虫sage#879881不改；clearcoat=.8仍在。共享工厂入口覆盖展示/生产/运输/战斗实例，不改旧GLB。locust-green-paint同光照对照。
6. **牌面语言和字体**：所有本轮书店镇场景牌改英文；按用户最后指示，蚂蚁例外为“螞蟻書店”“螞蟻・蒸汽動力廠”。英文店招Georgia/Palatino，工业Trebuchet MS/Arial，繁体Songti TC/Noto Serif TC；Canvas按牌面宽高、字距和measureText适配，不用fillText最大宽度挤扁。Hard to Find保留。

验证：37项robotOps测试通过（新增三种移动射击）；受控靶标实景测试三机均发生位移及射击，车载三机在行驶中开火且货位偏移0；浏览器无pageerror。robot-mobile-fire/transport-fire.png 的红球是隔离测试靶，未加入生产代码；测试时隐藏真实敌人避免干扰生产。不是完整莫比斯/苔庭战役验收。地面防御仍为局部避障接近，不等于完整基地导航网；战役弹药/性能整体验收尚待完成。

动作来源：用户Ashley Wood图片；查证书名 World War Robot，未取得能核实的书中步态原文，不宣称读过完整书或照搬文字动作规格。工程分层参考 Epic 官方 Aim Offset 文档：https://dev.epicgames.com/documentation/unreal-engine/aim-offset?application_version=4.27 。出版信息检索：https://www.indiegogo.com/en/projects/idwpublishing/ashley-wood-s-world-war-robot-hardcover-book 。Jev只做文字证据分类，不代替看图/验收。
