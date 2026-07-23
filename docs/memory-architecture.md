# 画中生物记忆模块 · 设计定稿

> 世界古典美术拟生平台 —— 画中生物（虎 / 兔 / 锦鸡 / 大雁 / 自定义物种）皆为自主智能体。
> 本文档是"画中生物记忆模块 + 记忆绑定页面"的设计定稿，描述四层"记忆遗体"模型与三阶段生命周期。
> v1 范围：**留存全层 + 遗存封存快照 + 传递仅定义协议 schema（不实现迁移）**。

---

## 一、四层"记忆遗体"模型

记忆不是一张表，而是一具分层的"遗体"。四层各自独立存储、独立回放，但**共享同一条时间轴**：
给定任意时刻 `t`，通过 `MemoryCore.at(t)` 可以取出四层在该时刻的切片并集 —— 回放任一层，都能拉到另外三层。

浏览器端存储命名空间：`tib.memory.<creatureId>.<layer>`（localStorage，JSON 序列化；storage 不可用时退化为内存 Map）。

### 1. 运行日志（episodic）· `js/memory/log.js`

- **定义**：生物"做过什么"的追加式事件流，append-only，不改写历史。
- **存储格式**：

```json
{
  "id": "ev_lx3abc_9f2k1",
  "t": 1735603200000,
  "subject": "tiger",
  "action": "捕猎",
  "detail": "在溪涧边扑向锦鸡，落空",
  "place": "溪涧",
  "importance": 8,
  "tags": ["捕猎", "锦鸡"],
  "lastAccessAt": 1735603200000
}
```

- **回放接口**：`replay(tStart, tEnd)` 返回时间窗内事件（按时间升序）；`recall(query, k)` 为三因子检索（见 §三.1）。

### 2. 感知流（perceptual）· `js/memory/perception.js`

- **定义**：原始感官刺激的高速环形缓冲，是"还没来得及变成记忆"的东西。
- **存储格式**：环形缓冲（容量 500），元素为 `{ "t": 毫秒时间戳, "modality": "vision|audition|touch|weather|...", "payload": 任意 JSON }`。
- **回放接口**：`perceiveAt(t, windowMs)` 返回 `t` 前后窗口内的感知切片；`compress()` 把缓冲聚合为摘要事件写入运行日志（"这段时间看到 X 次……、fear 均值 ……"），并清空已压缩部分 —— 感知流是易逝的，只有被压缩固化者才进入长期记忆。

### 3. 未发送队列（prospective memory）· `js/memory/intentions.js`

- **定义**："打算做但还没做"的事 —— 对他人的承诺、对自己的叮嘱、被触发条件悬置的意图。 prospective memory 是**第一等公民**：它携带创建者、触发条件、倒计时、超时策略与死亡交接规则。
- **存储格式**：

```json
{
  "id": "in_lx3def_a1b2c3",
  "tCreated": 1735603200000,
  "creator": "主人",
  "instruction": "开春时提醒兔去梅树下觅食",
  "trigger": "立春",
  "dueAt": 1738368000000,
  "countdown": null,
  "status": "pending",
  "timeoutPolicy": "drop",
  "provenance": { "saidAt": 1735603200000, "context": "雪夜对话", "confidence": "normal" },
  "handover": null
}
```

- `status` ∈ `pending | confirmed | dropped`；`provenance.confidence` ∈ `normal | unclear`（置信度只标注，不阻断）。
- `handover` 为死亡交接规则预留字段（v1 不实现逻辑）。
- **回放接口**：`pending()` 按 `dueAt` 升序返回，并附"还有 N 天 / 已逾期 N 天"；`confirm(id)` / `drop(id)` 改写状态（状态迁移是唯一的"改写"，原条目保留）。

### 4. 情绪残留（affective）· `js/memory/affect.js`

- **定义**：事件消散后留下的情绪余烬。**它只影响"语气"（tone hint 文本），不参与事实检索**。
- **存储格式**：

```json
{
  "valence": -0.2,
  "arousal": 0.4,
  "labels": { "牵挂": 0.62, "惊惧": 0.11 },
  "updatedAt": 1735603200000
}
```

- **回放接口**：`residue()` 返回施加衰减后的当前残留；`toneHint()` 生成一句中文语气提示（如"语气里带着一点未散的牵挂"），供对话 prompt 注入。
- 再激活强化有界：同一标签被再次 `feel` 时最多 +20%；衰减遵循艾宾浩斯式 `S = S₀ · exp(-Δt / η)`，`η = 72h`。

### 共享时间轴

四层都以毫秒时间戳 `t` 为公共键。`MemoryCore.at(t)` 返回：

```js
{ t, log: [...], perception: [...], intentions: [...], affect: {...} }
```

这是凭吊模式"拖动时间轴回放"的基础：拖动滑块到任意时刻，四层切片同时呈现。

---

## 二、核心主张

1. **记忆是遗体，不是数据库**。四层模型对应"一个人留下的东西"：做过的事（日志）、看过的世界（感知）、没说出口的话（未发送队列）、没散完的情绪（残留）。
2. **共享同一条时间轴**。回放任一层可拉到另外三层 —— 时间是唯一的索引。
3. **封存是仪式，不是删除**。快照只读化，原件保留凭吊。
4. **回放不是对话**。凭吊接口是回放 —— 页面必须披露"这是回放，不是本人"。

---

## 三、生命周期三阶段

### 阶段一：留存（v1 全量实现）

- **写入**：运行日志 append-only；感知流环形缓冲；未发送队列与情绪残留接受外部注入。
- **三因子检索**（借 Generative Agents）：`score = recency + importance + relevance`
  - `recency = 0.995 ^ hoursSince(lastAccessAt ?? t)` —— 衰减因子 0.995/小时；
  - `importance = importance / 10`（1–10 归一）；
  - `relevance` = 对 `detail / action / subject / place / tags` 的词面匹配得分（无分词库：整串子串命中 + 字级 bigram 重叠率 + 标签精确命中加成）。
  - 检索命中后刷新该条 `lastAccessAt`（用进废退）。
- **反思固化**：`perception.compress()` 把易逝感知聚合为摘要事件写入运行日志。
- **遗忘与强化**：检索的 recency 因子与情绪的 `exp(-Δt/η)` 衰减共同构成"遗忘"；命中刷新与再激活强化构成"复习"。

### 阶段二：遗存（v1 实现封存快照）

- **封存 = 仪式性快照只读化**：用户在记忆绑定页面手动触发"封存"（本项目里"死亡/离开"没有自动判定，封存即死亡仪式）。`seal(creatureId)` 生成全量快照 `{ sealedAt, log, perceptionSummary, intentions, affectSnapshot }` 存入 `tib.legacy.<creatureId>`，模块层面深冻结，`isSealed()` 全局可查。
- **凭吊接口 = 回放而非对话**：封存后页面进入凭吊模式 —— 四层只读、时间轴可拖动回放，顶部横幅常驻披露："**这是回放，不是本人**"。
- 凭吊模式仅本地（v1 不做分享/公开策略）。

### 阶段三：传递（v1 仅定义协议，不实现）

- **传递 = 复制，原件保留凭吊**。记忆核心与机体解耦：记忆可以脱离原机体，被另一只生物继承。
- **遗嘱协议**：封存者可留下一份遗嘱（will），声明继承者、偏好迁移清单、未发送意图的交接策略、是否保留凭吊。
- **偏好迁移确认清单**：`migrate_preferences` 逐条列出待迁移偏好，继承时逐条确认（v1 不实现）。
- **意图交接**：`handover_intentions` ∈ `ask_new_owner | auto | drop` —— 未发送队列里的悬置意图，由新主人逐条确认 / 自动承接 / 全部放弃（v1 不实现）。

---

## 四、设计原则五条

1. **终止指令缺省 ≠ 永续**：没有"永远运行"的默认。任何持续性指令都需多源确认（创建者 + provenance 置信度 + 超时策略），缺省采取保守默认（到期 `drop`）。
2. **全量记住，但标注 provenance 置信度**：不替生物"决定什么该忘"而拒写；一切可写，但每条携带来源 `{saidAt, context, confidence}`，置信度是元数据而非门槛。
3. **未发送队列是第一等公民**：意图必须具备创建者 / 触发条件 / 倒计时 / 超时策略 / 死亡交接规则五个字段位，与"已发生的事实"平权存储。
4. **情绪残留可衰减、可再激活，但不参与事实检索**：情绪只通过 `toneHint()` 影响语气；`recall()` 的 relevance 与 affect 完全隔离。
5. **记忆核心与机体解耦**：记忆按 `creatureId` 独立命名空间存储，可整只导出 / 导入（`exportAll()` / `importAll()`），机体消亡不销毁记忆核心。

---

## 五、学术借鉴

| 来源 | 借鉴点 | 本模块落点 |
| --- | --- | --- |
| Generative Agents (Park et al., 2023) | 记忆流（memory stream）+ recency × importance × relevance 三因子检索；recency 衰减因子 0.995/小时 | `log.js recall()` |
| MemoryBank (Zhong et al., 2023) | 艾宾浩斯遗忘曲线 `S = S₀ · exp(-t / η)` | `affect.js` 情绪衰减（η = 72h）与检索 recency 的指数形态 |
| CoALA (Sumers et al., 2023) | 认知架构分层记忆（episodic / semantic / procedural / working） | 四层"记忆遗体"划分：运行日志 / 感知流 / 未发送队列 / 情绪残留 |
| MemGPT (Packer et al., 2023) | 分层记忆与"核心记忆 vs 归档记忆"的管理理念 | 记忆核心与机体解耦；封存快照 vs 活体记忆的两层存储 |

---

## 六、传递协议 JSON Schema（define-only）

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://tigerinbamboo.local/schemas/will.schema.json",
  "title": "画中生物记忆遗嘱协议",
  "type": "object",
  "required": ["will"],
  "properties": {
    "will": {
      "type": "object",
      "required": ["beneficiary", "migrate_preferences", "handover_intentions", "keep_memorial"],
      "properties": {
        "beneficiary": { "type": "string", "description": "继承者的 creatureId" },
        "migrate_preferences": {
          "type": "array",
          "items": { "type": "string" },
          "description": "偏好迁移确认清单：逐条列出、逐条确认"
        },
        "handover_intentions": {
          "enum": ["ask_new_owner", "auto", "drop"],
          "description": "未发送意图的交接策略：问新主人 / 自动承接 / 全部放弃"
        },
        "keep_memorial": {
          "type": "boolean",
          "default": true,
          "description": "传递后原件是否保留凭吊（传递 = 复制，原件保留）"
        }
      },
      "additionalProperties": false
    }
  }
}
```

代码侧由 `js/memory/legacy.js` 导出 `WILL_SCHEMA` 常量与 `draftWill(creatureId)` 草稿生成器。**协议已定，迁移未实现。**

---

## 七、v1 范围与后续路线

**v1（本次实现）**

- 留存四层全量：log / perception / intentions / affect 的写入、检索、回放、衰减、固化。
- 遗存：手动封存（仪式性快照只读化）+ 本地凭吊模式（只读 + 时间轴回放 + "这是回放，不是本人"披露）。
- 传递：仅 `WILL_SCHEMA` 与遗嘱草稿生成，不实现迁移。
- 存储：浏览器 localStorage，整只生物 JSON 导出 / 导入；不碰后端。

**后续路线**

1. 与画中活体事件总线接线：场景页行为（捕猎、饮水、对话）自动写入运行日志与感知流。
2. embedding 检索可选插件：`recall()` 的 relevance 可替换为向量相似度（保持三因子接口不变）。
3. 凭吊模式开放策略：从"仅本地"扩展到只读分享链接 / 展厅凭吊角。
4. 传递协议落地：遗嘱执行器 —— 偏好迁移确认 UI、意图交接确认流、继承者的记忆核心初始化。
