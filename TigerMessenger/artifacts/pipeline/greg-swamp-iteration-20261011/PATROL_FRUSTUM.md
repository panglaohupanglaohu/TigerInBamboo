# 巡逻裁剪接续 · 2026-10-11 04:34

生产入口 `src/assets/harborLogistics.js` 的巡逻生成链现调用 `harborPatrolFrustum.js`。Three r172 支持 Mesh 独立 boundingSphere；40 个刚性网格（20 描边）恢复视锥裁剪，球覆盖当前顶点及实际 shader 最大法线外扩，原共享 geometry/material/raycast/节点/动作/碰撞引用不改。未知 shader、蒙皮、morph、实例保留旧强制绘制。`?harborPatrolFrustum=0` 回退。原入口备份 source-before/patrol-frustum/harborLogistics.js。

研究与执行代理在02:13收到工作区额度耗尽错误，未完成交接；主代理04:34接续检查实际已写源件并补齐验证，不称这一时段团队持续完成工作。CPU专项4/4通过（patrol-cpu-tests.txt），包括实际工厂40网格、共享资源不变、祖先变换包围球、未知变形回退。

## 当前实景没有收益证据

正式 index 通过 patrol-trace.html，在 rim 自然剧情采样60真实帧：patrolRoots=0、soldiers=0、callbacks=0；10.5FPS/95.25ms/6027calls，原文 patrol-legacy-rim.json。没有触发巡逻或改写剧情。所以本项在该场景没有可节省的巡逻 draw，不能声称608次或帧率改善。默认生产加载后采样正在补证；活跃巡逻近景、主/阴影边缘与A/B/A仍待验证。

## 绘制来源排除

forced-draw-trace.html 单次正式 scene 手动渲染：7112calls，66个有效强制绘制节点、56个frustum外，66个实际onBeforeRender回调，见 forced-draw-rim.json。包含虎/须、鸟涡、云/汽、瀑流等动态包围。该数字是一个固定机位手工渲染，不是完整帧FPS；shader动态包围不等于实际无像素贡献，不能据此自动隐藏。强制节点数量只占该帧提交的一小部分，尚未定位全场景低帧率主因。地平线剔除审查代理因额度错误未产出结论，未实施。

默认正式补证：patrol-default-rim.json仍0巡逻、0callback，60帧10.5FPS/95.66ms/6844calls。与原版采样相隔两小时且动画/资源不同，不能作因果对比。patrol-default-rim.jpg已实看，人物与通路可见，左侧厚植被仍遮湖；日志仍有来源未确认MutationObserver.observe错误。
