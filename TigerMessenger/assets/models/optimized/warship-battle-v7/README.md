# v7 跳板候选：保留，不接运行时

由实际 v6 GLB 在 Blender 后台导入、删除 4 根高扶手柱与 2 条高绳，保留简洁原木板、板梁和全部 26 位桨手。保存真实 blend、GLB 和相配 assembly。没有覆盖 v6，没有改 Web/Godot 入口。

已解决：平放帧 180 跳板附件对船壳交叉由有变无；189–195 帧高绳扫桨手腿及手的问题消失。52 握点 × 301 帧回读误差最大 2.15e-7；26 桨手完整。展开段 180–211 的源速度为零，保留停桨后展开合同。

**仍未通过：**原旧插值展开路径让板面/板梁扫过船壳、艏部甲板和船桨。复测仍有 386 个帧×部件×障碍交叉记录（含可能允许的结构连接），不能作为可用部署版。代表圆柱通道只有离散采样零命中，不等于全 25 人登船验收。

下一步应在艏部建立经扫掠检查的板面收纳和部署轨迹，或改为分节/伸缩板，让板体在舷外伸出后落到岸面；不允许隐藏桨手。该机械变化超出这次只移除错误高扶手的短批次。

复现：后台 Blender 运行 `tools/pipeline/build_warship_v7_boarding.py`。审查：设置 `TIGER_WARSHIP_AUDIT_VERSION=v7` 后运行 `tools/pipeline/audit_warship_v6_boarding.py`。真实回读证据在 `artifacts/pipeline/warship-v7-boarding-audit/report.json`。

候选 GLB SHA256：`0799b8c42bb3e0ba24227a2d221ec2b04af4718c3f2ebdfc943e67f7a9756ee7`。
