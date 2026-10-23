# 湖沼构图与配色：两小时九项批次

负责人：Greg team 视觉规则研究代理。不是 Greg、Dekerle 或 Roll7 本人。源模块所有权：swampCoralCanopy.js、swampCoralUnderstory.js、swampGregVisuals.js、swampCoralWeathering.js。未改相机、控制、玩家位置、存档、动物身份或动画。

## 已读范围与推断

- 作者陈述：Dekerle 2022 问答正文已实际读取，讨论有限主色、平色、恒定宽度轮廓与远处简化。这里仅借用颜色和可读性约束，不宣称本项目用了 Rollerdrome/Sable 的未公开 shader。来源：https://www.gamedeveloper.com/art/deep-dive-rollerdrome-art-direction-q-a
- 作者陈述：Roll7 AMA 实际读取开场和 Paul Rabbitte 的视觉参考回答（页面185–188行），是适量细节服务高速可读性的陈述。查找 camera 无匹配；不据此编造具体镜头算法。来源：https://www.reddit.com/r/Games/comments/x8zxpb/were_roll7_developers_behind_rollerdrome_ask_us/
- 画面观察：实际查看 target-v3-current-courier.png 与 latest-default-middle-t1.jpg。目标有青绿湖水、灰紫岩壁、鼠尾草叶片、暖珊瑚花和岸缘；现中层叶色偏亮绿、光滑粉色树干与明亮步道较抢眼。
- 本项目推断：用户最新要求把巨大叶片抬到正常镜头上方，因此修改叶片高度，不改变 WSAD 或镜头方位。作者材料不提供本项目数值。
- 未加载：AGENTS 指定 threejs-game-director/SKILL.md 路径不存在；没有假称使用。

## 正式默认实现

1. `installSwampCoralCanopy` 在真实 V2 原冠/枝端上先保留横向大小和浅弧曲面，再按实际顶点测量每组冠最低 inner Y。低于64时整组向 inner 上方抬升。源树、原枝、其他故事节点位置均保留；细弯曲叶柄从原枝端连接到新叶根。
2. 未依靠缩小/裁孔实现本次抬高。此前 v8 的浅弧几何继续使用。查询 `gregCanopyClearance=0` 可对照旧高度；`gregLakeCanopy=0` 关闭整个冠替换。
3. normal default version9，在 CPU 实际 seed7711、scale .5 工厂中最低顶点63.999997，岸顶40，净空约12世界米；16组冠抬升，最大5.895 inner（2.95世界米），5批叶柄draw。正常湖沼camera profile跟拍距离4.5–5米，抬高约3.8米；12米冠下净空高于正常镜头，极端滚轮高俯仰/载具高度不纳入这个保证。
4. 配色覆盖湖沼环境语义材质及巨花瓣（v2-cupped-petal），不会识别/重染鸟、蜥蜴、蝾螈、虎、鲸或信使。树干增加稀疏纵向裂隙、断续横疤和较大片老皮色差，无新纹理/每帧循环。

## HEX语义色板与画面面积建议

| 角色 | 主色 / 阴面 | 建议面积 |
|---|---|---|
| 水面 / 深水 | #80B9BB / #597F85 | 35–40% |
| 植被 / 阴叶 / 亮叶 | #548D80 / #356E68 / #97B69D | 25–30% |
| 岩壁 / 阴壁 | #7C7F91 / #62697E | 15–20% |
| 老树皮 | #B493A2 | 8–12% |
| 暖岸岩 / 阴岩 / 花 | #C99588 / #A87D82 / #E5A093 | 5–8% |
| 步道 / 交互暖物 | #E7DCC4 | 5–8% |
| 描线 | #514B64，叶纹#626478 | 稀疏结构线 |

这些面积是构图建议，不是像素实测。叶背从#a6c6a4改为#96b29d，主植被从#3fa874改为#548d80，亮叶从#8fcf6a改为#97b69d；水从#9ec8cc改为#80b9bb；壁从#777388改为#7c7f91。阴色不通过新增灯光制造，仍使用明确局部色面。

## 描线与LOD

- 外轮廓：已有0.85 CSS像素壳保留，10米后细化，20米后不画。
- 结构：叶片5条径向脉按fwidth控制远处细节；树皮纹、老疤按12–34米淡出。
- 稀疏细节：岩壁矿斑、渗痕偏灰紫；裂纹和少量赭色层边继续使用导数LOD。未增加全屏描边或网格。

## CPU / GPU 分账

CPU：`composition-cpu.txt`，五文件36/36通过。新增真实工厂抬冠顶点测量、原树/虎/码头位置保持、球面放置矩阵与叶柄可恢复检查。旧颜色预期已根据新语义色板更新。CPU shader字符串检查不是实际GPU编译。

GPU：由root负责正式游戏同机位前后截图、坑缘行走、台阶移动可读性；本代理尚未做GPU验收，不给90分。

回退：source-before/composition保存本次四原模块和受改测试；优先查询旗标对照，回退时仅恢复此范围，不覆盖团队船/虎/码头等并行改动。材质共享/叶柄dispose已处理。主要待验证：球面实际camera近叶是否完全不遮挡，提升后冠与周边林层关系，花色能否与暖岩有区分，正常真实移动中的老皮细节可读性。
