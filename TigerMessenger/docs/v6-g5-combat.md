# V6-G5 · 港口登陆交战样片

日期：2026-08-22  
负责人：Grok  
级别：**TESTED**（不是 DEFAULT_ON）  
命令：`node tools/test_v6_g5_combat.mjs`  
seed：`7`

## 做了什么

V3 agent 绑纸兵姿态（腿/臂/枪/盾/火炬）。移动逐帧投射 surface；跨层只走 stairs/bridge/ladder/waterfall-climb。  
`?citadelCombatV3=1` 时 **不** 再开 phalanx（禁止双模拟）。默认关，生产仍是方阵攻城。

公平性：登陆路线 ≥2、守方撤退点 ≥1、空中段 0。木马规则未改。

## 数字

| 项 | 值 |
|---|---|
| 登陆路线 | 4 |
| 守方撤退 | 1 |
| 60s / 10min | off=0 teleport=0 stuck=0 |
| replay | `701569ed` |
| 默认 | `citadelCombatV3=false` |

## 回滚

默认不改 load 战斗。开 V3 才换样片。完整攻城/木马夜袭等确认后再扩。
