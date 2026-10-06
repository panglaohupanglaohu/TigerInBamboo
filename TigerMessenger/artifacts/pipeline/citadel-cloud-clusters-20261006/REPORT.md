# 后肩分层云群可选候选

API不变，新增 `clusteredComposition:true`；默认 false 完整保留云13。建议传 `maxBanks:9`，必须提供真实 `sampleSea`。主线程负责入口cache与启用，本轮没有改candidate/main/runtime。

每组按三个形态成员分配，不是同一云复制排队：宽前层、短而厚的后层、居中的中宽远层；X错位[-8,+5,-2]m，Z相对[0,-12,-23]m，高差[0,+3,+1]m，长度比例[.78,.54,.65]。团内横向投影重叠、深度分开，保持共同后肩位置与不同高低。实际相机遮挡/投影未验证，GPU必须检查是否仍成豆荚列。

新城后组中心改为[47,-48]（仅云），避免更东后位置超出实际球面海域导致整组只剩一朵；仍按真实最终山海最高面重新扫掠检查。未移动山或建筑。

实际fixture结果见fixture.json；每组三成员最多各一次，最终各组至少2朵。每朵51截面×20环点，预算<=20000tri、<=9draw。城市禁区、世界保护盒、铁路净空、2m扫掠网格+命中面最高点、离地2m保持。测试包含原云13回归、分组前后深度、真实海面缺失拒绝、地形不变、十秒位移、全周期扫掠包络、dispose回退。未GPU，不称视觉完成。

这仍是本项目实体云壳，并非Oskar后期impostor私有实现。回退关掉clusteredComposition；source-before/cloud13.js另保留原源码。

## 13:57 正常首页真实GPU
root已将clusteredComposition:true/maxBanks9接入正常candidate，实际生成8朵；live-front.png/json同.49光照，GL0/gpuFailures[]/consoleerrors[]，rock6跟有效主光。圆润云有前后重叠成3组，但远景总覆盖仍小，未给新分数，不沿用13:33的61分。观察后已恢复daySpeed=.4与玩家镜头，信使未移动。
