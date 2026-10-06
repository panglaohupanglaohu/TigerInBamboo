# Final wet-mask 4

2026-10-06 14:45 普通首页同全景、时刻.49实际截图 live-final-wet-mask.png/json。GL0、gpuFailures[]、console errors[]，ambient白、太阳fff6df。

原始全局水域shader会先按旧WFC水mask discard，再应用当前湾区配色；本次从最终地形与实际海面采样构建额外湿区许可，并以实际海面高度限制到同一球面片。R水深/G岸距/B海面高度/A有效，未知样本不恢复水。保留原波纹时钟、其它海域原discard，工厂默认false，candidate显式true。3测试通过，包括不兼容源shader拒绝且不动源材质。

实机确认版本4加载、无GL错误，水面保持细波带；本次画面未证明视觉分数或显著岸线改善，前景世界边界仍存在，不宣称已解决。海面高度8bit量化范围142.7m，有限栅格1.7m，不足证明细岸线所有情形。回退candidate finalWetMask:false并重建；wavebands.js为版本3留档。
