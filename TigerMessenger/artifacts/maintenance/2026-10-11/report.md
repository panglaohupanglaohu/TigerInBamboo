# 2026-10-11 每周中间产物归档

按既定7天保留、Git追踪/目标命名及目标目录/approved/原始模型/固定活跃批次保护执行。未改Git追踪资产、运行时源码或保护规则，没有永久删除。

- 实际外移 524 文件，482,209,058 bytes（459.9 MiB）；原位置保留固定外部归档符号链接。
- 逐一验证全部 2225 个当前manifest支持的项目链接、本地SHA-256、原localhost:8931 URL完整响应字节数与SHA-256，失败0；无需恢复。
- 再次计划剩余候选 0 个。
- du -sk（不跟随链接）的实际占用：项目 9.28 GiB，外部归档 1.23 GiB。含当前其他工作的产物增长，不能用上周项目大小相减代替本次外移量。
- 按archived_at，90天以上可审阅归档0个，本周没有90天归档清理候选。
- 项目内仍保留 2163 个超过7天的受Git追踪旧媒体/模型，共 2.30 GiB；包含受保护资产，统计不表示可安全删除。见tracked-old.json完整清单。

较大受追踪旧产物（全部仍保留，是否清理由用户决定）：

- 69.2 MiB：`assets/models/optimized/batch-candidates-v1/equatorialClouds.blend`
- 69.2 MiB：`assets/models/optimized/batch-candidates-v2/equatorialClouds.blend`
- 62.2 MiB：`artifacts/world-migration/import-repair/original-world-v1.before.glb`
- 50.1 MiB：`assets/models/optimized/batch-candidates-v1/saihoji.blend`
- 49.4 MiB：`assets/models/optimized/batch-candidates-v2/saihoji.blend`
- 20.5 MiB：`assets/models/optimized/citadel-mountain-forest/mountain-forest-layout-r02.blend`
- 20.5 MiB：`assets/models/optimized/citadel-mountain-forest/mountain-forest-layout-r03.blend`
- 20.3 MiB：`artifacts/pipeline/citadel-compact-ascent/before-common-frame.glb`
- 18.2 MiB：`assets/models/optimized/batch-candidates-v1/moebiusSwamp.blend`
- 18.1 MiB：`assets/models/optimized/batch-candidates-v2/moebiusSwamp.blend`

外移减少项目目录占用，不等于释放总磁盘空间或缩小Git历史。删除外部归档对象会破坏仍依赖它们的链接；禁止自动删除，永久清理须另行审阅引用并由用户决定。外部归档固定 /Users/panglaohu/Downloads/TigerMessenger-Archive。

证据：plan.json、applied.json、verification.json、summary.json、archive-over90-days.json、tracked-old.json、plan-after.json。
