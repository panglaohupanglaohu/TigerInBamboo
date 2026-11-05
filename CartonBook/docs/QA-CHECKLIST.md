# CartonBook QA 清单（自测记录）

> 时区：Asia/Shanghai（UTC+8）  
> 本轮执行时间：2026-11-04 09:17:39 Asia/Shanghai  
> 静态服：`python3 -m http.server 8787 --bind 127.0.0.1`（CartonBook 根）  
> 证明方式：`curl` HTTP 状态码；**未**凭肉眼声称图片可用

图例：`PASS` = 通过 · `FAIL` = 失败 · `SKIP` = 本轮不做 · `WARN` = 已知限制

---

## A. 文档与契约

| # | 检查项 | 结果 | 说明 |
|---|---|---|---|
| A1 | `docs/DESIGN.md` 存在且可 HTTP 打开 | PASS | `200 http://127.0.0.1:8787/docs/DESIGN.md` |
| A2 | `docs/PLAN.md` 指向 DESIGN | PASS | PLAN 文首增加 DESIGN 链接 |
| A3 | README 指向 DESIGN / PLAN / QA | PASS | 已更新 |
| A4 | 硬约束写明：无 T2I/I2V；HUD-off 正式拍摄；fixtures 仅排版 | PASS | DESIGN §1.2 / §7 |

## B. export 路径改写

| # | 检查项 | 结果 | 说明 |
|---|---|---|---|
| B1 | `exportBook` 将 `(?:\.\./)+shots/` 改写为 `shots/` | PASS | `src/exportBook.mjs` |
| B2 | 写盘前断言无残留 `../shots/` | PASS | 抛错保护已加 |
| B3 | 重新 `node src/cli.mjs export --recipe recipes/bookshop-letter.sample.json` | PASS | 退出码 0 |
| B4 | 生成的 `book.html` 含 `../shots/` 次数 | PASS | **0** |
| B5 | 全部 `img src` 为 `shots/*.png` | PASS | cover + s01…s10 共 11 张 |

## C. HTTP 200 证明（curl）

| # | URL | 结果 |
|---|---|---|
| C1 | `http://127.0.0.1:8787/` | PASS 200 |
| C2 | `http://127.0.0.1:8787/web/` | PASS 200 |
| C3 | `http://127.0.0.1:8787/viewer/` | PASS 200 |
| C4 | `http://127.0.0.1:8787/chapters/bookshop-letter/book.html` | PASS 200 |
| C5 | `http://127.0.0.1:8787/layouts/edena.css` | PASS 200 |
| C6 | `http://127.0.0.1:8787/chapters/bookshop-letter/shots/cover.png` | PASS 200 |
| C7 | `…/shots/s01.png` … `s10.png`（10 张） | PASS 各 200 |
| C8 | 从 served `book.html` 抽出的每个 `src="shots/…"` 再 curl | PASS 全 200 |
| C9 | served `book.html` 不含 `../shots/` | PASS |

**汇总：本轮列出的全部 URL = HTTP 200（`ALL_LISTED_URLS_HTTP_200`）。**

## D. Viewer / Web 首页

| # | 检查项 | 结果 | 说明 |
|---|---|---|---|
| D1 | `web/` 与 `viewer/` 导出时同步更新 | PASS | export 已写 |
| D2 | 章节卡片显示 fixtures 徽章（非真截屏冒充） | PASS | manifest `realCapture=false` →「样章/fixtures（仅排版）」 |
| D3 | 根 `index.html` 跳转 `web/` | PASS | meta refresh |

## E. 捕获 / HUD（正式画面）

> 截屏无菜单说明见 [`CAPTURE-CLEAN.md`](./CAPTURE-CLEAN.md)：正式画面必须 `setCaptureMode`；fixtures 仅排版自测。

| # | 检查项 | 结果 | 说明 |
|---|---|---|---|
| E1 | 样章 `manifest.realCapture` | WARN | `false`（fixtures；仅排版样章） |
| E2 | fixtures 来源为本游戏验收图 | PASS | `chapters/_fixtures/` + manifest `source: fixture` |
| E3 | 正式拍摄前隐藏 HUD | PASS | 策略 1：`__tm.setCaptureMode` + `?cartonCapture=1`（见 [`CAPTURE-CLEAN.md`](./CAPTURE-CLEAN.md)）；策略 2：screenshot clip 到 canvas |
| E4 | 本轮真截屏重跑 | SKIP | 样章阶段允许 fixtures；下一里程碑 M3 |

## F. 回归命令备忘

```bash
export PATH="/Users/panglaohu/.workbuddy/binaries/node/versions/22.22.2-6/bin:$PATH"
cd /Users/panglaohu/Downloads/TigerInBamboo/CartonBook
node src/cli.mjs export --recipe recipes/bookshop-letter.sample.json
python3 -m http.server 8787 --bind 127.0.0.1
# 另开终端：
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/chapters/bookshop-letter/book.html
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8787/chapters/bookshop-letter/shots/cover.png
```

---

## 剩余缺口（诚实列表）

1. **真截屏尚未稳定交付**：当前样章为 fixtures（`realCapture=false`）。  
2. **正式分镜仍需真截屏重跑**：capture-clean 已接线（见 CAPTURE-CLEAN.md）；bookshop 样章仍为 fixtures，待 live 重拍。  
3. **Web 控制台未做**：仅有静态首页 + CLI（DESIGN M4）。  
4. **浏览器视觉回归未自动化**：本轮以 curl 200 为准，未截浏览器合成图。

---

*QA 记录结束 · 无 curl 200 不得宣称图片可用*
