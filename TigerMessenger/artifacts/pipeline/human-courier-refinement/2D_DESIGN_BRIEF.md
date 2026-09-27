# 信使：二维动作与面部修正设计

## 本轮方向

第六轮三维脸型被用户指出不符合原认可图。本轮回到原图，先出二维设计，不将上轮三维模型当作新标准。

原身份参考：`assets/models/optimized/human-courier-v1/approved-target.png`。

面部要求：颧骨为眼眶外下侧向太阳穴连接的骨性平面，不是两侧圆鼓包；颊下转折克制。下颌自然向短而有体积的下巴收拢，避免过长倒三角。眼睛、嘴唇、眉弓、鼻梁和短胡茬均以原图为准。

动作要求：以《波斯王子》的敏捷移动为参考，重新设计信使的奔跑与跑跳衔接。原角色的青绿衣服、酒红披风、信使包和简化靴子保留。

## 动作图的检查重点

1. 奔跑：触地、承重压缩、蹬地、腾空换腿、对侧触地、回收，不能仅重复摆臂。
2. 跳跃：蓄力、伸展蹬地、上升收腿、越过最高点、落地、屈膝接跑。
3. 身体：髋肩反向协调，头部稳定，脚底接触清楚。
4. 衣物：披风与挎包滞后跟随，长衣下摆为跨步让位。
5. 图上的时间是本项目的建议值，并非育碧动画实测数据。

## 资料范围

查阅 Ubisoft 的《Prince of Persia: The Lost Crown》官方介绍，作为敏捷、连贯、杂技式穿越的方向参考。本轮没有逐帧采样或复制育碧动画。

https://www.ubisoft.com/en-us/studio/montpellier/news/4wSH6aL9s7phgM62Mniwg2/prince-of-persia-the-lost-crown-reinventing-prince-of-persia

https://news.ubisoft.com/en-au/article/e1SD5gR3TWqk5GPAjWHSz/prince-of-persia-the-lost-crown-will-put-your-combat-platforming-and-puzzlesolving-skills-to-the-test

生成方式：内置 image_gen，使用原认可图片作为角色参考。二维设计图不等于已完成三维动作或已回接游戏。

## 实际交付

动作图已生成，采用八姿势精简版：奔跑四个关键姿势、跳跃四个关键姿势。完整奔跑循环仍需对侧半周期与中间帧，不能直接把这八张作为已完成动画。面部结构图包含正面、四分之三和侧面。两张图均保存于本目录；最终生成提示词见 motion-image-prompt.txt 与 face-image-prompt.txt。
