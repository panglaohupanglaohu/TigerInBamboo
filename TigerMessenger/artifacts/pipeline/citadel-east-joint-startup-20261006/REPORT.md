# 东岸联合启动实景 — 2026-10-06 18:26

后台正常主程序通过 `citadelEastCrossing=1` 的默认关闭开关启动；无参数主页仍保留 user-marked 生产版本。此开关是内部核验，不作为交付入口。首次把 exact final 山面、新全球立交路线、城市廊桥、全球接驳、首次植被/云/采样/导航以及轨车站联锁放到同一次真实启动中。不是先前只换山面显示的预览。未宣布生产替换或验收。

## 实际接入

旧 bootstrap 曲线构建原山并 refine → 严格来源 hash 2638422502 匹配 → 安装原 exact final artifact → 初次构建地表索引、植被/云/采样 → 新曲线的城市廊桥 → 实际山/planet/hills/skirt/ocean 径向采样生成全球接驳 → 支撑事务 commit/finalize 后轨道可见、车辆解暂停 → animate。全局 cloud runtime 增加 deferred 初始化，避免在旧山上提前生成实例；普通启动路径仍即时初始化。城市云也获得实际两条新全局曲线做完整扫掠保护。

`targetEastCrossingStartupSupport` 实景状态 finalized/installed，ground 3915、sea 5926，缺失0。实际末跨三角探针通过，最大误差3.916e−6m。临时索引/波面资源释放。report中的 accepted/gpuVerified 仍false：该工程对象不自己宣告画面或玩法通过。严格来源hash和最终安装后 positionHash 1944908823 是不同几何阶段，未删校验。

## 真实证据

- `live-front.png/json`：18:25:51，全景，timeOfDay=.49/daySpeed=0。
- `live-cliff.png/json`：18:26:26，临轨崖壁，同光照。
- 两帧 GL0/gpuFailures[]，浏览器 error 日志空，主线程实际查看两图。
- `initial-front/initial-cliff` 为更早一次联合启动，城市云尚未补实际曲线参数；不拿它代替最终云绑定版本。
- `live-motion-pair.json`：18:25:35 和18:27:20实际按钮读数，红/蓝车辆位置与进度都变化，curveShared=true/centreError0。这仅证明新曲线绑定及实际运动，不是全路载客/扫掠验收。
- 当前云8；启动重新生成植被，不能套此前外观预览297→294的数量。
- 18:28已通过UI恢复daySpeed=.4、玩家镜头、关闭菜单，信使书店未移动；用户页面未操作。后台tab11保留。

## 检查及限制

启动支撑适配器7CPU、全局云延迟2CPU、城市云实际曲线1专项通过；这些不能替代连续人物/车/船/编辑检查。新增UI cloudRailSampleCount诊断尚未重载，不声称截图已有该字段。

画面仍严重偏离目标：新岸约35–40m深长纸褶崖、大片背坡、街区密度低，上层廊与广场未形成目标中的紧凑城市边界。旧高山门占据左侧但为真实既有地标，不隐藏；v3古文明新门仅概念。顾问本可见全景独立58/100，详见VISIBLE_PANORAMA_REVIEW.md；完整分仍null，不套13:33历史61或称90。

额外.3m水储备仍未满足，现有有限波包络条件另列；T接头不称全网watertight。未验证新路线下全部动态演员/船、连续人物通行和编辑恢复。当前不提升为默认生产。

## 回退与下一步

候选仍仅正常主程序的显式开关启用；不带开关加载原生产，原 artifact/source/release均保留。重载会从完整启动序列重新建立缓存，不在已运行世界只换显示。

顾问已交默认关闭局部墙 reshape：3.6m宽墙片最大内收.598m，4tests、2949承托/148局部载货有限过；整体39m高差没改且需重新join/refine final artifact，暂不安装。下一轮优先审阅其本次实际全景报告，选择足以改变整体画面的几何调整，而非继续无视觉收益的小片细分。
