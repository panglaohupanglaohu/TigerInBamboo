# 圣城广场高程诊断与可逆候选（2026-10-08）

本人是 Oskar 方法研究顾问，非作者本人。读取个人安装 Skill 及 project/research/implementation-recipes/colour-and-modelling；以下为当前项目测量与工程推断，不是作者引擎算法陈述。

用户观察成立：广场旧 castle-chart 水平与主城 radial frame 不一致；主城现平面延伸至广场左侧会高出旧广场约23.5米，长阶梯和细高基台是布局不一致的结果。仅抬某些建筑或再加柱不解决。

真实生产构建测量使用 final remesh + buildChristchurchTramSystem + createTargetCityProductionOptions 同一铁路来源，非全球半径猜测。nearest 点按广场径向 up 平面内的切向距离选取，剔除反半球。

- 保城方案：主城锚点 [74,12,33] 保留，广场中心 castle Y3→6；同up，一段宽6.2米、坡度11.90%的直坡，高差4.133米；近侧 red 铁路仍低17.080米。18018有限列车包络点出现5个侵入，因此不可正式启用。
- 贴轨方案：广场 [64,-12.3602375873,78]、主城 [74,-6.3602375873,33]；主城与广场等量下降，近侧 red 切平面高差0.00160米，blue -0.565米；直坡坡度11.09%、高差3.852米。18018有限列车包络点未发现侵入；不是连续扫掠认证。

两个方案的宏观真实几何、原新城工厂与种子20261005可在 preview.html 切换。候选提供整块山体承托与一段直坡，未创建额外高瘦柱。**候选未接正式系统**，生产源文件未改变。不能把下拉配置或候选图称为已完成重构。

4项 CPU 测试验证共同径向面水平残差、实几何有限值、单段宽坡、原frame/曲线不变及可逆rail-fit参数；validation.txt。尚需原主城/侧楼基础与山体三角形重排、剧情原雕像/木马径向迁移、原巡逻/攻城/导航provider刷新、植被根部重采样、正式GPU和持续列车检查。大幅下降方案会改变海拔，root已向用户说明矛盾并等待选择，未擅自反向下降。

完整量值：candidate-production-measure.json；复跑脚本 production-measure.mjs。源模块 src/world/citadel/levelPlazaCandidate.js；原有两个定位/崖壁文件备份在 before/（实际未修改）。
