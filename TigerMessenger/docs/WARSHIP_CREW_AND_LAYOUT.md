## 传统战船 v11：同队士兵与甲板布局（2026-09-10，当前版本）

当前运行源由 `assets/models/optimized/warship-runtime.json` 统一管理，Web 与 Godot 均加载 v11，SHA256 `7c9273f5f39e7b8e87b70d76b51216e8e8b488e3f941840899fc134a719bc8ff`。下面 v6/v8 条目保留为历史，不代表当前版本。最新检视 `artifacts/pipeline/warship-top-side/index.html`。

已完成：认可的罗马士兵几何替换 26 个坐姿，保留 25 个战斗身份及 1 人留守；两侧坐席与桨整体外移、人体不拉伸，中部按主人保存 45 件武器/盾牌，尾部货箱及原货台避开最后两排。船壳接连续弯艏柱；目标图侧视眼睛与主透视同端。Web/Godot 使用同一批人员身份控制坐姿、步行表示与存放武器显隐，伤亡者不会自动复活为桨手。

验证：Web 公共工厂 15 项通过（70 次模型绘制），Godot 301 帧、52 握点与人员归属检查通过；v10 全301帧布局/兵器穿插审计保留，v11不改人员及姿态。船头独立面的相邻顶点焊接后统一外向法线，网页回读确认弯木缺面已修正。证据见检视页及 `docs/WARSHIP_CREW_AND_LAYOUT.md`。

下一步仍需真实取械、绕桅步行、跳板扫掠、靠岸和水深验证；当前身份显隐不是完整登岸动画。旧路线贴地/终点重摆尚未解决，不启用未通过的水路候选。Web 地面士兵既有装备覆盖与船上保存几何仍需逐项统一，不能宣称全游戏模型已一致。

### 证据与接续方法

- `assets/concepts/warship-target-v2-eye-consistent.png`：内置生图编辑后的目标图；原图另端金属尖角的语义矛盾仍记录在参考说明中，不据此倒转航向。
- `docs/WARSHIP_LAYOUT_REFERENCES.md`：已核实资料与本项目取舍，未将未观看的视频作为证据。
- `artifacts/pipeline/warship-roman-crew/v10-layout-audit.json`：两侧保守净宽各约0.314，不能替代带装备的人体通行验证。
- `artifacts/pipeline/warship-roman-crew/v10-weapon-clearance.json`：301 帧武器/人/货台采样。
- `artifacts/pipeline/warship-roman-crew/web/report.json`：最新 v11 公共工厂 15 项。
- `artifacts/pipeline/warship-top-side/godot-runtime-report.json`：最新 v11 301 帧与同队人员表示。
- `artifacts/pipeline/warship-crew-continuity/`：实际主线航程中两船50个身份与武器去返检查；返航使用真实回落回调，未宣称完整自然战斗。

修改源后执行 `tools/pipeline/install_warship_runtime.py --version 11` 统一安装并导出，禁止只换检视图。兼容文件名 warshipV6 不等于实际运行版本，应读运行清单及哈希。Blender 本轮使用后台程序构建与渲染，不声称通过前台 MCP 完成。

最新 v11 实际航程复核：`artifacts/pipeline/warship-crew-continuity/2026-09-10T00-57-31.729Z/report.json`，10 项通过、无页面错误，源哈希与当前清单一致。

登船接续：交互阶段页 `artifacts/pipeline/warship-boarding-v11/index.html`；实际航程新增携行检查12项通过，证据 `artifacts/pipeline/warship-crew-continuity/2026-09-10T01-26-37.569Z/report.json`。自然走路、起身取械、板缝抬脚及岸面仍未完成；详细接续见PLAN顶部。
