# 湖沼信使下阶：真实支撑与通路（2026-10-11）

实际查看用户 73e9bdaf 截图：信使/虎在入口上阶，用户希望能顺实际石阶走下去。本批只拥有 swampPlayerSupport.js、swampWalkwaySteer.js、swampEdgeGuard.js 的湖沼分支和新增专项，main.js由root接入；不改虎、船、码头位置、玩家存档或美术。

## 实际调用链和问题
main samplePlayerLocalGround → resolveCollisions 每物理子步 → swampEdgeGuard.end。原 authored sampler 从脚上100world径向求最高面，再以脚距丢弃太高面；上方岸台被拒绝后，下面真实踏面没有机会返回。原顺序还有 bridge/rim 在真实 stair 前，V7随后fallback。
护栏旧候选再取脚附近最高网面检验落点，三层入口桥可能遮住已选择的低阶；safeR保持初始上阶又把连续合法下降当成跌落救回。不是需要传送人物到下层。

## 源码改进
- `sampleSwampStairGround`：只取真实 tigerWalkSurfaces，脚上.35world以内的向上踏面；合法下降候选最多7.5world，保留重力落到实际踏面，不设置位置。动态读取当前梯几何、变换和数组。
- authored：从脚附近取向上承托，保留3.5world近脚窗；dynamic注册包括三岸、原阶、rim、桥、旧dock、新harborScene.pier.walkMeshes，避免安装后新增的quay被旧缓存遗漏。
- 正常 main 顺序（root已接）：独立城市覆盖后 → stair → authored → bridge/walkAid → rim → V7/其余fallback。actual stair优先，旧上层不会隔断下阶。
- steer：确实踩在入口踏面时释放环形纠偏，斜向走下也不会被投回rim切线。
- guard：湖沼只接向上的真实踏面，排除桥底/台阶底；按物理选定落点高度核验网络，允许合法持续下降，待落真实网络时不触发旧safeR救回。仍拒绝无支撑崖边、保留跳跃和重力。
- 通用 `getNetworkMeshes` 港口guard保留旧面方向、stepUp、参考drop及rescue分支；此次不改变其他城区。

## CPU与GPU分别记账
`navigation-final-scoped-cpu.txt` **22/22通过**：新实际旋转湖沼模型（scale .5、球R160）生产controller KeyW方向/120Hz gravity/guard/steer联合从入口r37下到r<28，脚高下降>3world，无block、无rescue，每帧位移<.2world；原全部环路、三岸连通、V7下层、悬顶下承托和晚注册码头专项通过。
中间失败日志保留，曾发现底面误计和护栏最高网面盖住低阶，已修，不以早期部分通过替代最终。
CPU fixture使用真实原始梯 geometry，Node不证明完整GPU人物蒙皮贴地与正式碰撞资产都无阻挡。新截图/真实键盘下阶交root验证；本代理不冒称GPU通过。

## 回退
source-before/navigation保存本批三原文件；只恢复这三份不会回退其他代理。main入口新增stair引用如要完全回退需root同步撤除；单独关swampSteer或swampEdgeGuard只关闭旧既有模块，不是几何改动。


## 上端真实入口追加修复
原正式 GPU 从 r42 只绕 rim，后相机修复从 r37 曾浮在旧球面平台（refR142.857）；本代理实读 courier-descent-camera-fixed-gpu.json，不能用旧 r37 理想朝向 CPU 代替这个失败。root负责修正式相机/挖空柱 legacy platform 过滤。

本批三源追加：入口 .5 角整个上端通道释放切线 steer；入口桥顶面原 winding 朝下，改向上兼容仅采踏面的 network；桥内缘38.45与真实梯头37.8之间存在.65inner无承托缝，内缘延到37.7（.375world窄连接），只微叠顶阶，stair-first可正常选择实际下阶。

最新 navigation-outer-rim-cpu.txt **22/22通过**：从实际桥面 r40.5 起，固定相机朝向+持续 KeyW（不每帧指向目标），真实控制/重力/guard/steer下到r<28、下降>3world，零block/rescue。位移门限按生产合法 .75world step-up 加一个切向子步设置 <.8world，包含梯头原有小高度差，不是原r37测试的.2world；仍不允许大幅传送。r42超出该入口的实体桥外沿，只有完整正式 walkAid 能覆盖，CPU不冒称这一点已验。正式GPU全平台与镜头等待root验收。


## 正式GPU最终验收（root）
实景发现CPU无完整世界平台/地形时漏掉的两项：入口terrain sideBias令相机相对W转偏；已挖空湖柱仍被旧球面平台或无承托时的默认星球壳填回，信使悬空。main现在在湖柱r<35.5、innerY4..60内优先真实湖阶/步道并排除旧平台；无实体承托返回显式-Infinity，collision不再回退星球壳，护栏拒绝无支撑越界。其他地区null仍保持原语义。相机保留坡地净空抬升，仅入口角.5、朝内时取消侧偏。

正式同厂完整场景GPU连续KeyW12秒，初始一次放置真实入口桥面r40.5，后续正常控制器/重力/镜头，未逐帧设置位置。courier-descent-final-gpu.json与jpg：inner[35.640,40.792,19.470]→[21.160,24.241,11.560]，上桥→梯面→湖边末级，真实踏面返回136.8525，rescues=0。持续W末级之后的无支撑水域被护栏拒绝（648累计blocked，包括上端1次短阻挡），不可写“GPU零block”。脚高度下降约8.3world米。人物没有之前悬空于湖中央的现象。
24/24最终CPU：courier-navigation-verified-cpu.txt，包括显式空腔不吸附旧球壳、真实踏面仍正常承托及原环路/三岸等。camera遮挡专项6pass/3skip，skip是原历史禁用功能，不称9全通过。失败日志和截图保留，未覆盖。回退源source-before/root还包括main/collision/swampCameraProfile。
