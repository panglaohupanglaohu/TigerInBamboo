# 原作遗漏资产补充档案

后续检查点：19/19 已实际完成后台 Blender 导入与 GLB 导出，详见 `artifacts/supplemental-import/README.md`。下方描述保留捕获阶段语境；Godot 实際实例化和原世界接入由主代理接续。

本目录独立于旧 72 项目录。19 个检视条目按 6 个家族归档，涂装、武器、伴飞配置不计为新设计；bubblePod 已在旧目录，未重复捕获。木马在 citadelRange 父场景已有嵌套，本次补独立入口。

已读取实际工厂参数和调用者，保持几何、材质、纹理、隐藏装备、节点层级、动态 nodeRef 和函数原文。第二轮在全新页面模块缓存下以固定种子重新构建，与不可覆盖快照的语义 SHA 一致（仅忽略随机 UUID）。全部 nodeRef 可解析；木马腹门和Socco尾门原回调有探针。证据见 capture-report.json。

当前仅原作捕获完成，未宣称美术改善、Blender 导入、Godot 回接或动画移植。GLB 不能直接执行原 JavaScript 回调；节点引用与 runtimeSource 用于后续移植。侦察机灯、透明座舱、船上喷雾、刀光、墨线需要实景材质适配。罗马兵使用默认页面功能开关，红蓝羽冠与枪/剑/弓均单列。

仓库根目录复现（Web 服务运行在8767，或设置 TIGER_CAPTURE_BASE_URL）：

```sh
rtk proxy node TigerMessenger/tools/originals/capture_supplemental.mjs
```

可在参数追加一个或多个 catalog.json 内 ID。旧快照不覆盖；源码或语义结果变化时报错，需新建版本。选择部分条目会保留其他条目的报告。

供后续后台 Blender 导入的入口（此步骤本批尚未执行）：

```sh
rtk proxy /Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python TigerMessenger/tools/originals/import_supplemental_blender.py -- scoutAircraft
```

复用现有导入器，仅调整独立归档路径，输出本目录 blender-r3/。不操作前台会话，不改旧72资产。后续负责人执行实际 Blender/Godot 后再更新独立阶段证据；请勿覆盖捕获报告中历史阶段含义。
