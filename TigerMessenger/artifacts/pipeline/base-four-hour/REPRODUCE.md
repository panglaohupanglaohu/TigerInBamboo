# 检视与复验入口

真实场景：http://localhost:8931/TigerMessenger/?autostart=1&baseReview=1&robotOps=1

检视页：http://localhost:8931/TigerMessenger/artifacts/pipeline/base-four-hour/review.html

进入场景后，在军团指挥选择“查看广场环线”或跟随红/蓝货列。工厂各有三套初始原料；收到一船零件会经28秒卸料后三厂各加3套。自然生产每台90秒，三台同型成批后等候列车。演练必须先有卸车部署的整机；拖框选择，点击空地移动、红色机械靶攻击。F上下车、C司机视野。

## 可复现检查

在 /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger 运行。Node使用 /Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node。

- 核心：node --test tests/robotOps/*.test.mjs tests/world/highlandGateWarp.test.mjs
- 广场双列正常绕行：node artifacts/pipeline/base-four-hour/ring-drive.mjs（约75秒）
- 当前乘员同帧跟车：node artifacts/pipeline/base-four-hour/driver-tour.mjs（最多12分钟，正常钟完整世界巡游）
- 六台货物跟车：node artifacts/pipeline/base-four-hour/cargo-sync.mjs（准备加速，实际跟车12秒）
- 实景三厂生产至24台：node artifacts/pipeline/base-four-hour/capacity-e2e.mjs（加速诊断）
- 五机对三靶及返修：node artifacts/pipeline/base-four-hour/mixed-squad.mjs（加速诊断）
- 20分钟正常生产与铁路：node artifacts/pipeline/base-four-hour/soak-v5.mjs（正常钟、不seek、不加速）

脚本使用独立无头Chrome，不操作用户浏览器和前台Blender。脚本会覆盖同名诊断报告，需保留历史时先复制到新批次；不得写入旧归档符号链接。每项都有适用范围，改动后只重跑受影响检查，不把一项通过当整体完成。性能检测需独立运行，避免并行诊断浏览器影响读数。

实际版本、通过项与未完成项见source-manifest.json、final-validation.json、PROGRESS.md。本轮未提交Git，不恢复或清除仓库原有修改。
