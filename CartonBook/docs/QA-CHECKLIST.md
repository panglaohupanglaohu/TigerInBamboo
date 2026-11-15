# CartonBook QA · 书店镇《四盏灯，一封信》

验收时间：2026-11-07（Asia/Shanghai）  
成品：http://127.0.0.1:8787/chapters/bookshop-letter/book.html  
实景：http://localhost:8931/TigerMessenger/

## A. 故事、物件与页面

| 检查 | 结果 | 证据 |
|---|---|---|
| 舰队明确要求交出藏书 | PASS | 序页第二段与 s05 对白，第三次钟响为时限 |
| 四家书店共同作出选择 | PASS | 《联藏约》四店联署；s06/s07/s08 对应三家工坊，Hard To Find 最后落印 |
| 取信送信推动主冲突 | PASS | s09 取信 → s18 折返 → 三店联署 → s11 到港 → s23 DUKE 离岸 |
| 可拍物件覆盖 | PASS | `BOOKSHOP-OBJECT-INVENTORY.md`；四店、三机器人、港、双货船、飞艇、廊灯、招牌、舰队均入场 |
| 完整故事位于书内序页 | PASS | 第一内跨页左叶，无截断、无溢出 |
| 双页封面 | PASS | 一张连续实景横跨两个 `.cover-leaf`，中央折缝可见 |
| 每个书叶独立布局 | PASS | 序页 + 7 个故事叶；establish / vertical / reply / detail / assault / harbor / coda |
| 全镜头进入正式书 | PASS | cover + s01–s23 共 24 张，无漏用、无重复占格 |

## B. 实拍真实性与无 HUD

| 检查 | 结果 | 证据 |
|---|---|---|
| 正式图只来自 8931 | PASS | manifest `port=8931`、`via=direct`、每镜 `source=canvas-todataurl` |
| 真实战斗触发 | PASS | 拍摄日志含 `batianFleet.start('bookshop')`、真实 ground assault 与 retreat |
| 无菜单/任务栏/小地图/FPS/提示/遥控 | PASS | 每镜 `hudCheck.ok=true`、`visibleBanned=[]`；联系表和合成页肉眼复核 |
| 无黑帧、空天空、主体缺失 | PASS | 24 张联系表逐张验收；s19/s23 初版不合格，已用补拍替换 |
| 机器人肩后旗舰 | PASS | s19 使用 robot-b：维护长枪前景、旗舰中景、书店后景 |
| DUKE 交付地点可读 | PASS | s23 使用 duke-b：船体、跳板、港灯清晰 |
| 视觉验收签署 | PASS | `manifest.visualReview.status=approved`，`approvedShotIds` 覆盖 24 镜 |

联系表：`artifacts/bookshop-review/contact-final.png`  
补拍对照：`artifacts/bookshop-review/pickup-probes/contact.png`

## C. 流水线安全回归

| 检查 | 结果 | 说明 |
|---|---|---|
| Playwright 缺失不得回退 fixtures | PASS | 正式 capture 直接失败 |
| 失败不得覆盖上一版正式图 | PASS | live 先写暂存区，全部通过后才提交；首轮采样误报时正式图保持不变 |
| 黑帧检测采样时机 | PASS | 主动 render 后在 `toDataURL` 前采样；单镜 probe mean=159.62、deviation=49.34 |
| `capture` 重新读取 recipe | PASS | 不再复用陈旧 plan |
| `layout-only` 不覆盖正式章 | PASS | 实际写入 `artifacts/layout-only/bookshop-letter-preview/` |
| 正式导出拦截未肉眼验收 | PASS | selfTest 断言 pending 状态抛错 |
| 旧页面不得混入新书 | PASS | export 只按本次 plan 页面清单读取 |
| 图片路径 | PASS | `book.html` 无 `../shots/`，24 个 `shots/*.png` 均存在且浏览器加载成功 |
| 导航去重 | PASS | 上一跨页、下一跨页各 1 个按钮 |
| 镜头族默认值 | PASS | macro dist=4.5；airshipPilot FOV=82 |

## D. 浏览器与命令结果

- `npm test`：PASS。24 镜、9 个书叶、5 个翻页 section，覆盖双页封面、视觉门禁、路径与导航。
- `artifacts/bookshop-review/check-pipeline.mjs`：PASS。
- `artifacts/bookshop-review/verify-book.mjs`：PASS。双页封面 + 4 个内跨页，24 张独立实拍全部加载，无 JS 错误。
- 8931 游戏与 8787 成品：HTTP 200。
- 最终合成页 `page-0.png` 至 `page-4.png` 已逐张查看：未见文字溢出、菜单残留或主体被排版裁掉。

## E. 边界与诚实说明

1. 《联藏约》、四店签署和船长对白是漫画叙事；游戏提供信使持信视觉、场景与真实舰队战斗，不声称新增了这些任务日志。
2. 当前交付为 HTML 翻页书与打印 CSS，没有单独声称生成 PDF。
3. 审查日志、补拍候选和独立 fixtures 预览保留在 `artifacts/`，不属于正式画面来源。
