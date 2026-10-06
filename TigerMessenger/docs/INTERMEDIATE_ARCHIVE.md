# 中间产物归档与恢复

2026-09-26。用户要求减少项目目录体积，并定期归档、提醒清理。

## 位置与规则

- 项目：`/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger`
- 外部归档：`/Users/panglaohu/Downloads/TigerMessenger-Archive`，在整个 Git 仓库外。
- 保留至少7天未改动的缓冲期；默认仅处理未受 Git 追踪的文件。
- 范围：artifacts 中旧截图、视频、模型中间件、压缩包；assets/models/optimized 中旧 `.blend/.blend1/.blend2` 候选。
- 不处理 assets/concepts、assets/models/originals、运行时 JS/纹理/正式模型、源代码、报告及对照页。文件名含 target 也排除。
- 当前活跃批次固定保护：city-gate-expansion、crystal-twelve-clusters、holy-city-style-v2、tiger-target-v1-ten-rounds、swamp-v2-fifty-rounds。任务结束后人工审阅再调整脚本 PINNED，不自动解除保护。
- Git 已追踪的旧产物只统计，不自动改成链接或删除。大量历史模型和截图属于这一类；因此首批减量有限，不能承诺一次缩掉数GB。

## 实施

在 TigerMessenger 下运行：

```sh
python3 tools/maintenance/archive_intermediates.py
python3 tools/maintenance/archive_intermediates.py --apply
```

默认只显示计划。执行时按 SHA-256 归档并校验，先写 manifest.json，再原子替换原文件为符号链接。相同内容复用归档对象。检测到源文件在处理期间变化就跳过。归档不删除历史记录。

静态服务器 `backend/archive_static.py` 只允许 artifacts 和 optimized 下的显式链接读取固定归档 objects 目录；不开放任意外部目录。归档后应检查原8931图片URL。服务不可用时无法声称网页验证通过；若404，先执行恢复，不能让现有对照页失效。

每周日北京时间10点已有本任务自动跟进，ID `tigermessenger`：归档并检查原链接，报告实际容量，提醒审阅90天以上归档。不会自动永久删除。

## 恢复与迁移

```sh
python3 tools/maintenance/archive_intermediates.py --restore
python3 tools/maintenance/archive_intermediates.py --restore --apply
```

仅恢复仍指向对应归档对象且哈希匹配的链接，不覆盖后来重新生成的文件。恢复会重新占用项目空间，归档副本仍保留。

**复制项目到另一台设备、打包交付前，先恢复，或一同迁移归档并重新建立链接。**当前链接为绝对路径。打包工具若跟随链接，包的体积仍会包含归档内容。

外移减少项目目录常规 `du` 占用，不等于释放整块磁盘空间，也不会缩小既有 Git 历史。不要直接清空外部归档：仍被链接引用的截图会失效。永久清理前需要确认对应证据不再需要，并同步处理链接及引用；本流程只提醒，不自动删除。

## 首批验证

首轮检测到原服务拒绝外链，已全部恢复；加入仅针对固定归档对象目录的读取支持后重新执行。验证覆盖：SHA校验、恢复预览与实际恢复、重复归档候选归零、允许归档/拒绝其他外链/拒绝路径穿越、原URL的HTTP读取。实际数量与字节见外部 `last-run.json`，每次自动跟进更新。


## 2026-10-04 weekly maintenance

Protected target-named parent directories and approved images in addition to target filenames. Added active citadel-living-slopes, old-tower-crown, citadel-vegetation and citadel-landform-rebuild batches to PINNED; no existing protection removed. Archived 1135 files / 562561857 bytes. All 1701 manifest-backed links and original HTTP URL bytes verified. No entries over90 days; tracked assets retained. Evidence: artifacts/maintenance/2026-10-04/report.md.
