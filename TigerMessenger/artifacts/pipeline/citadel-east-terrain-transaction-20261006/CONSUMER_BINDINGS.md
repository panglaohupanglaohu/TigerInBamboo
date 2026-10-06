## 2026-10-06 17:30 实际消费者事务接口已补，未统一调用或新GPU

root新增真实 `targetCityPlayerSupport.prepareRefresh` 与 `targetCityPlayerNavigation.prepareTerrainRefresh`。提交时公共面/墙体缓存和径向落地缓存一起刷新；回退直接恢复旧cache引用，不能在source几何尚未回退时重建读到新山。中途失败、后续显式refresh导致过期均有拒绝/回退；4专项和13既有测试通过。

candidate/runtime新增 `prepareCloudRefresh({surfaceIndex,rail,protectedBoxes})`：实际factory重新采final索引，必须给真实轨样本，重建云完整扫掠报告，提交后动画与report使用新云，回退恢复旧云对象与动画引用，复制原light layers，不只替换可见几何。2专项覆盖动画owner转移和资源生命周期，已有6candidate测试过。`prepareSurfaceSamplingRefresh()`重建后续编辑仍会使用的山面/承托索引并清采样缓存，`getSurfaceSamplers()`返回稳定回调；1专项验证actual两索引查询改变/回退。runtime10与terrainTransaction5回归过。所有方法默认没有调用，不是主游戏联合安装/功能验收。

主 terrain transaction 提交顺序已改为 foundations→clouds→vegetation→navigation：先最终结构与采样，再云净空，再树/伴生，最后导航快照；回退反序。需要在commit阶段依赖前项新对象的consumer只在其commit中生成对应handle，不能在统一prepare阶段偷用旧结构/旧云。严禁用空handle满足门槛。

advisor已交 `targetEastCliffCompanionRefresh.js`（6tests）：树apply后基于实际压紧实例和final sampler重建伴生，但保原group/3InstancedMesh/材质/geometry身份；交换实例buffer、count、report，原隐藏0槽不复活，rollback先companion后tree。尚未实际GPU，数量不能用fixture代替；最新实际图仍17:07combined-front/cliff且已经撤回。

new_city_main仍独占50m立交candidate/scripts/tests，不动main/tram。最新有限global10395载货对新支撑0，桥有23.44m连续梁跨空绕开2根冲突柱；原80失败WORLD姿态三类实际车辆对新桥/轨管0。城市1534载货/14388ground/14346body0，中央52.891m和旧岸145.061m及两既有阶不变，新岸入口chartY抬5.078m。1144断面双线距3.9489–4.2978m/径向差.2288m，9错位SAT0，中线偏双轨中点最多.5305m需保留；18专项过。正在同final artifact做新线山面/实心检查，尚未交最终通过，未安装。其源u/作用域须用最新报告，不沿用旧154m。

advisor下一项仅只读诊断17:07实图深长直板崖与target-v11短崖草台差距，输出最小方案，不改remesh/路线。root负责后续统一绑定，不抢代理文件。

AGENTS所指旧 threejs-game-director 路径不存在，已检索本地 .agents/.codex技能未找到；未声称应用该包。本轮使用现有Oskar规范与实际代码/测试，不因该可选技能阻塞已授权施工。

