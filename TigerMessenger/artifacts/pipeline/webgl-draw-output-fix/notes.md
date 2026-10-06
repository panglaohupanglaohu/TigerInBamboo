# WebGL draw-output / lighting dependency repair

2026-10-05，北京时间。用户报告 glDrawElements 的 active draw buffers missing fragment shader outputs，以及 releasedLighting 读取 supports 异常。

根因复现：`crystalLakeV10` 把仅用作 onBeforeRender 回调驱动器的网格替换成 `void main(){discard;}`，却继续提交两个索引三角面。Three r172 / 当前内置浏览器的独立实际 WebGL 测试返回 1282 (INVALID_OPERATION)。修复保留该回调、drawRange=0，并使用带合法输出且关闭颜色/深度写入的后备材质。海面 regional style 和时间 uniform 仍实际更新。

另一独立问题：冻结地形候选与当前山体不兼容时，旧城 parcel candidate 不存在。灯光不应直接读取 candidate.supports。现在保留现有旧城灯锚点，并继续独立的新城灯光对齐。不存在 candidate 与存在 candidate 两条分支已分别验证。

验证：`check.html` 是真实浏览器 WebGL 回归页。旧 all-discard 材质复现1282；修复后6次独立渲染无GL错误，回调6次，海面样式安装及uniform更新通过。完整默认游戏 `?local=1&autostart=1` 日间/夜间各120次 scene.onAfterRender 的gl.getError采样均无错误；见day.json/night.json。console捕获在canvas出现后安装，不能保证记录到更早的启动日志。

旧 front-strata / old-city-slope / master-terrain 冻结资产的失配保护仍保留，没有强行把过时顶点补丁应用到新地形，也没有隐藏其告警。主岛加载85秒的问题尚未在本修复内解决。当前已加载页面须刷新才能载入新模块。
