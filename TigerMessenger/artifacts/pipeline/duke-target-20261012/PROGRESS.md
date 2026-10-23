# DUKE 构造目标迭代（2026-10-12）
目标：用户提供的 Duke 构造概念图。模型 `src/assets/dukeFreighter.js`，港口接入在 `src/world/bookshopJakubHarbor.js`。
- r1：新建 58×10 m 船体（放样）、三层奶油色上层建筑、白红黑烟囱、两根桅杆和索具、前甲板吊车、舱口、货箱、两排舷窗、杜/Duke 船名、舵和螺旋桨。
- r2：上层建筑加栏杆和木饰条，屋顶改浅色，加艏楼和艉楼，烟囱加高到 11 m 并加两个铜汽包，吊车加大，船名放大。
- r3：船壳加分段接缝线和铜色护舷带，加船尾旗杆和旗，再加四个通风筒。
- r4：红色船底分界线压低；港口改用新模型，配跳板、缆绳和烟囱蒸汽。
- r5：游戏里吃水深度从 1.2 m 改为 0.45 m，水线以上只露一窄条红色。
JEV：每轮的文字证据都存为 rN-evidence.json。evaluate.py 要读用户 Mac 上 ~/.config 里的密钥，这个会话读不到，而且网络也连不上 jevtypesafeai.com，所以没有真实调用，决策都标为 review。用户在本机运行 `python3 TigerMessenger/tools/jev/evaluate.py artifacts/pipeline/duke-target-20261012/r5-evidence.json --output .../r5-decision.json` 即可补做。
- r6（用户指出没按俯视图做后重建）：按侧视图和俯视图实测比例重排，深色窄甲板室偏后，三根桅杆、前后舱口按甲板平面图定位。
- r7：船体压低（甲板 3.0 m，龙骨 -2.6 m，红色在 -0.5 m 以下）；甲板室 6.8×2.5×20 m；烟囱周围铜汽包群。
- r8：加船尾船员舱、前甲板货箱堆、格构吊车（吊臂朝后）。
- r8b–r8e：船名牌移到船壳外侧并放大，"杜 Duke"在 3/4 船首视角清楚可读。
- r9：游戏内发现船首船尾因星球曲率翘出水面约 2.6 m，红色船底全露。新增 bendDukeToPlanet，把船体沿海面曲率弯曲，水线定在 y=-0.3（吃水 .13）；船名改成一行“杜 Duke”放在水线以上。测试 bookshopJakubPass 1/1、bookshopJakubRaised 2/2 通过（修了测试画布没有 strokeText 的问题）。
