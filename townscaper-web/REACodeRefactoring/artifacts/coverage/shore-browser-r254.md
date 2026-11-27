# 测维护 · tests/shore-browser.cjs 转绿（r254）

## 现场

`next[3]` 记的是「该用例走 `localhost:8769` 等 `window.rea` 30s 超时，把 base URL 统一成 `127.0.0.1`」。本轮实测**不是 URL 问题**：

- `curl localhost:8769` 与 `127.0.0.1:8769` 都返回 200；`/etc/hosts` 里 `localhost` 同时映射 `127.0.0.1` 与 `::1`，`tools/serve.py` 只 bind IPv4（`('127.0.0.1', port)`），理论上 Chrome 走 `::1` 会 reset，但本机实测能通。
- 真正的失败是 `page.evaluate: TypeError: g.dispose is not a function`。

## 根因

r253 给 `buildShore()` 的返回值加了 `rings`（裙带外圈距离账，`{haloField, haloTarget, haloOffsets, halo, haloMarched, haloFallback}`），而用例结尾是 `Object.values(r).forEach(g=>g.dispose())` —— 对 `rings` 调 `.dispose()` 直接抛。**同一轮加字段、忘了改调用方**，与 URL 无关。

## 改动

`tests/shore-browser.cjs`：
`Object.values(r).forEach(g=>g.dispose())` → `Object.values(r).filter(g=>g&&typeof g.dispose==="function").forEach(g=>g.dispose())`

## 验证

- `NODE_PATH=… node tests/shore-browser.cjs` → **PASS**：mixed `shoreVertices 806 / waveVertices 1612`、quad `872 / 1744`；三角形/四边形/凹多边形三种形变岸线的 `maxBoundaryError` 分别 0 / 5.78e-8 / 3.96e-8。

## 附带：8769 服务老化（r238 同款）

本轮 `path-samples-browser.cjs` 第一次重跑在 `waitForFunction` 30s 超时，`pgrep` 显示 `serve.py` 已连续跑 **6h17m**；kill 重启后同一命令立刻 PASS。**6 小时量级的静态服务会开始 reset，门禁超时先查服务，别先怀疑代码。**

## 没动的东西

`src/water/shore.js` 的 `rings` 字段本身保留（它是 r253 的读数来源）；页面/几何零改动。
