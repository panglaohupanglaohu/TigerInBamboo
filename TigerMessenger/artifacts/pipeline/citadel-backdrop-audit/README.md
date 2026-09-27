

## 2026-09-23 截图归属纠正：圣城背景山
用户截图 f0718cc4 的高耸条纹山墙应按高山圣城背景山排查，不因浏览器打开水晶城目标页归为水晶城。已在真实运行场景找到 citadel-new-city-backdrop-range，并从背面重现同类竖直拉伸山墙；代码 src/world/citadel/newCityBackdrop.js，near/mid/far peak参数174/235/310，横深 halfSpan*0.46。运行截图 artifacts/pipeline/citadel-backdrop-audit/runtime-backdrop.png（诊断机位，不是用户原机位）。此前水晶城地势生成请求已发出后收到纠正，其生成图不作为本截图的目标，也不接入任何运行场景。下一步按圣城认可的新旧城关系生成山体目标，优先解决过高过薄山体与球面贴合，再谈绿植。
