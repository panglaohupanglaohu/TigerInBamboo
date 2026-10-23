# 新城驻军正式支撑迁移（CPU，非实景验收）

根因：`saihojiPhalanx` 在正式 target city 安装前缓存 `highland-west-city` 的 24 近战与 4 弓手坐标；每帧 `ensureRedGarrison` 保留了这些旧坐标。正式新城移动、崖壁收坡后，旧哨位落在崖内/空中。旧进攻路径同样缓存了旧坐标。

实施：`refreshNewCitySupport({root: targetCityRuntime.root})` 在正式支撑提交后调用。只从实际新城公共广场、楼门平台、公共踏面和步行连接器的网格建图；中心和脚掌四边射线均须命中上向三角面；墙体身体净空、完整步进路径逐段验证；不接受岩石、轨道和无地板的空间。28 原驻军重定位保留 UUID、职业、血量及伤亡状态，按实际相连公共路径更新攻城路由。新 runtime 根替换时也自动刷新。没有正式支撑时拒绝创建新驻军，只有完全未安装正式新城的历史模式保留旧回退。

旧红方援军 gangway 的验证签名在迁移后失效，明确等待新路线验证，不把其旧坐标套在新城。战斗、兵种与援军入口仍在；未伪称旧 gangway 已支持正式城市。

验证：`tests/world/newCityPublicSupport.test.mjs` 4 项 + `tests/world/newCityGarrisonMigration.test.mjs` 2 项通过。覆盖 28 人、4 弓手、UUID/受伤计数保留、旋转城堡坐标、实际踏面、公共缺口、狭窄边缘、墙体、移除地板、缺支撑拒绝旧回退和帧末步进拒绝。完整生产场景 CPU 由主代理单独运行后追加，不与其并发重建。浏览器安全拒绝仍在，本轮未 GPU/实景验收。

## 候选实际公共表面补充验证

使用 2026-10-06 实际导出的 castleMatrix/terrain 与当前正式 production options 构造 targetCityDetailCandidate（不是整世界）。104 公共网格，3769 节点，3357 节点主连通区，569 楼梯节点，28 哨位；157 点路线爬升 16.45m。每 0.1m 细采样共 1273 次，支撑失败 0；起终网格 target-plaza-paving-surface → entrance-landing-surveyed-joint。公共+身体 BVH 建图约2.02秒。纳入 runtime.root 外的木马铺地及真实步行桥。9项CPU回归通过，包括活动攻城队列和不完整迁移的安全待命。确无任何公共实物支撑会报告 unsupportedActorIds，绝不伪报完成。完整生产/最新山体/GPU仍由主代理验收。

精确终点复核：此次候选主连通分量的 main-hall-floor 节点为 0，实际可达终点是入口 joint 平台，不能宣称已进入主厅。`mainHallReachable=false` / `routeDestination=new-city-supported-entrance` 明确区分；广场至入口的 16.45m 上升和 28 哨位全部实际支撑。主厅连通仍需生产完整场景复查，未人为跨空隙强连。
