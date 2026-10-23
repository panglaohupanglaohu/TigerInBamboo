# 港口双树：2026-10-07局部改造

用户证据：codex-clipboard-281c9117-fafe-4ff3-9d7d-1a2e8502e558.png。截图亮绿色扁片冠伸入铁路线，树干和枝条不可读。

实际来源是 citadelRange 的两株 createColossalVernacularTree，经 loadCitadel 挂到旧港并缩放0.38。古风 factory 使用0阶二十面体、Y压薄、黑描边和偏亮叶色。此次仅两株调用改为新 createHarborBroadleafTree；ancient.js 与其它松树保持原样。原版代码在 originals/。

新工厂使用17段连接木枝、21个封闭叶簇、灰绿三色和木色共4个合并mesh，不增加点光。枝冠间保留空隙，从下仰角可看分枝。新的本体约9m，最终尺寸可因轨道净空减小。

港口最终海平面定位之后，以实际 tramSystem.curves.red/blue 为输入，每0.6m构造车辆有向包络，半宽2.32、半长3.49、底-.6、顶5.71，另有.25余量及纵向采样余量。对完整树局部包围体变换到车辆坐标检查，保留原根点逐级缩放。运行时报告 harbor.userData.treeRailClearance；缺少曲线或缩至0.3仍冲突会明确 verified=false，既不隐藏树也不谎称已安全。有限包络检查不等于连续运动证明。

来源区分：本轮沿用 oskar-world-advisor/references/rendering.md 中既有研究。作者2024树帖 https://x.com/OskSta/status/1849427564034498642 明确提及 octagonal impostors；这里没有移植该算法，采用真实3D柔和叶簇是本项目针对近距仰视和轮廓可读性的实现选择。截图观察、现有factory诊断、项目实施不混作作者技术原理。

验证：4项Node测试通过（实体尺寸/有限顶点与4mesh；旋转港口+整冠车辆避让；无冲突保原尺寸/缺曲线不冒充验收；根部占轨时明确失败）。loadCitadel与citadelRange语法通过。未进行GPU实景复核：游戏崩溃页的刷新曾被浏览器策略拒绝，等待用户手动恢复，未绕过该限制。仍需同机位确认树干可见、树冠体积、夜间色彩及实际报告verified=true；不将CPU假设测试称已通过当前场景的列车验收。
