# 嵌套协程 · 2026-11-02 02:07批次

先按ID读README：863019585162932224，"TIL how to do nested/recursive coroutines. Makes writing multi-frame algorithms simpler and much more elegant." 后完整解码查看566帧，见同ID目录全帧与sheet-00…05。

画面0–1.7秒为完整小岛；约1.8秒切到带浅色网格的生成视图，少量模块逐步出现，约7.9秒快速组装至完整岛。后续出现几轮相似切换与展开，末段旋转完整岛。画面证明有分阶段生成展示，但不能证明内部预算、递归栈或线程机制；技术方向取自作者原文，具体调度器设计属于本仓库工程选择。

对比原版coroutine.js：已有显式子迭代器栈与工作量预算，但零成本嵌套下降/返回可在一次step中耗时很长；复用时统计没有完整重置，缺少明确取消/错误传播，逐帧trace无限增长。重构core/coroutine.js增加转换次数预算、重置、同步finally取消、子异常传回父级、有限历史与run帧数上限。保留普通yield*兼容，但真正深递归应yield子迭代器，避免原生yield*委托耗尽JS调用栈。

调度为合作式：单次next无法被抢占，单个生成器步骤本身仍需保持短小；取消要求finally为同步清理，不支持在finally中继续yield异步清理。单个工作块成本可能超过剩余预算，因此这不是严格的毫秒上限。

新增scheduler.html：直接在共享World上做分帧嵌套连通性分析，支持两种网格、预算、重开与取消。tests/coroutine.mjs验证60000层显式递归、返回值、预算、异常、取消finally、统计重置与有限历史。

浏览器验证：混合网格204/204格用26帧完成，四边形322/322格用41帧完成，取消通过；小镇/地形/融合截图回归通过，未捕获异常0。结果 scheduler-browser.json 与 scheduler-*.png。
