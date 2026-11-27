# r256 · 8769 服务自愈（serve.py backlog + serve-guard）

不是视频条目，是**门禁环境**条目：r238 / r254 / r256 三次踩同一个坑 —— 浏览器拉 ES module 拿到
`net::ERR_CONNECTION_RESET`，curl 单连接却仍是 200，于是 `waitForFunction` 超时，看起来像「代码坏了 / 测试红」。

## 现场（r256 09:03–09:05）
- `curl /index.html` → 200，`ps` 显示 serve.py（pid 10147）已跑 1h11m。
- 真起浏览器：`pageerror` 无，但 `requestfailed http://127.0.0.1:8769/src/core/deformation-guard.js net::ERR_CONNECTION_RESET`，
  `window.rea` 根本不存在 → 门禁 30s 超时。
- `kill 10147` + 重启后同一页面 `{rea:true, running:true}`，门禁立刻转绿 → 证明是服务而不是代码。

## 判定
- 根因（可解释但未逐项证明）：`socketserver` 默认 `request_queue_size = 5`，一个页面并行拉几十个 module 时
  listen backlog 一溢出内核直接 reset 新连接；进程活得越久 fd/TIME_WAIT 越积越多，越容易撞。**未做「backlog=5 必现」的对照实验**，
  所以只能写「归因 + 处置」，不写成「已证明」。
- 处置两步：
  1. `tools/serve.py` 换 `ThreadingHTTPServer` 子类：`request_queue_size=256`、`daemon_threads=True`、`allow_reuse_address=True`；
  2. 新增 `tools/serve-guard.mjs`：子进程退出即重启、每 30s 探活连续 2 次失败即重启、跑满 6h 主动重启（fd 累积）。
     每起一次打 `SERVE-PID <pid>`，便于排障与测试。

## 验证
- `node tests/serve-guard.mjs` → PASS：
  - 并行 40 条 module（index/three/battle-navigation/world/grid 混合）全部 200，失败 0，合计 10,695,496 字节；
  - 杀掉子进程（SIGKILL）→ 454ms 内换新 pid 并恢复 200；
  - `--max-age-ms 1200` 满龄 → 1258ms 内换 pid（pids 25614→25619），服务仍 200。
- 本轮此后重跑 `tests/path-samples-browser.cjs` 全绿（此前同一命令超时），作为「服务恢复后门禁才可信」的旁证。

## 仍缺
- runbook §1 已改成用守护起服务 + 记「> 6h 就重启」；但如果两条自动化同时整点触发，仍是同一个 8769 —— 并发本身没解决。
- macOS 上 backlog 溢出的必然性没有对照数据（需要另一台/另一参数复现），因此本条只按「环境可观测改善」记账，不宣称根因已证。
