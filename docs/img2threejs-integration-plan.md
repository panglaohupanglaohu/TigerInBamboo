# img2threejs × wall-workspace 集成规划

> 面向实施者（Grok）的任务书。每条 Todo 含背景、实施步骤、**伪代码**、验收标准。  
> 伪代码是骨架示意：函数名/字段名以实际代码为准，落地时保持项目现有风格。  
> 调研基准： [img2threejs/img2threejs](https://github.com/img2threejs/img2threejs) v1.4.1（Apache-2.0）；本仓库 wall-workspace 以 2026-07 快照为准。  
> 互补文档：`docs/optimization-recognition-3d.md`（性能/缓存/代理）；本文聚焦 **建模哲学、Spec 统一、拟生可用的 3D 主路径**。

---

## 0. 一句话结论

**识别继续用 `scene_lift`；3D 主路径收敛为「SculptSpec → 程序化/部件工厂 + sculptRuntime」；从 img2threejs 吸收 Spec/门禁/runtime 思想与可借用的 `forge/` 脚本，而不是整站改成 Agent Skill 工作流，也不用它替换全图检测。**

本系统 wall-workspace 要做的两件主事：

1. **把画作中的要素识别出来**（环境：植物/地理/水；生灵：主体与姿态候选）。  
2. **把 2D 要素转成 Three.js 3D 模型**，用这些模型驱动拟生：环境（植物 + 地理 + 天气）与生灵（模型 + 解剖 + 生物特征 + 生态属性）的**自动互动**。

当前痛点不在「有没有路径」，而在路径分裂、Spec 过浅、生成结果难挂互动。

---

## 1. img2threejs 调研

### 1.1 定位

| 维度 | 内容 |
|------|------|
| 一句话 | 用**代码**重建参考图中的物体/角色为 **animation-ready** 的程序化 Three.js 模型 |
| 不是什么 | 不是摄影测量、不是 TRELLIS/TripoSR 神经网格、不是下载 GLB 资产包 |
| 形态 | Agent Skill（Claude Code / Codex / OpenCode）+ `forge/` 纯 Python 3.10+ **stdlib 脚本**（零 pip） |
| 产出 | `ObjectSculptSpec` JSON + `createXxxModel(spec, options) → THREE.Group`，`root.userData.sculptRuntime` 暴露 pivots / sockets / colliders / destruction groups |
| 许可证 | Apache-2.0，可嵌（保留 NOTICE/LICENSE） |
| Demo | [Live Gallery](https://img2threejs.github.io/img2threejs-showcase/)（硬表面武器/道具为主；已有 character / creature 路线） |

### 1.2 四阶段管线

```
参考图
  → stage1 intake   探针、细节清单 detailInventory、PBR 证据、（角色）landmarks
  → stage2 spec     Pre-Spec 评估 + ObjectSculptSpec + validate --strict-quality
  → stage3 build    锁定 pass 顺序生成 factory（只写当前解锁 pass）
  → stage4 review   对比图 + Divine Eye 确定性信号 +（可选）VLM；记录 continue|refine-*|stop
```

**Build passes（固定顺序，前一 pass 审过才能解锁下一）：**

`blockout → structural-pass → form-refinement → material-pass → surface-pass → lighting-pass → interaction-pass → optimization-pass`

角色另有 `proportion-lock` / `feature-placement` 等 anatomy 轨。

### 1.3 对本系统最有价值的原则

1. **脚本执法，模型只做判断** — JSON 校验、pass 解锁、几何硬门（IoU/比例等）由脚本；视觉打分才用 agent/VLM。  
2. **Spec 先于代码** — `detailInventory` 未达标、`strict-quality` 不过 → **禁止 codegen**。  
3. **部件可装配、可动画** — `attachment`、sockets、pivots；禁止「一张贴图糊在单 mesh 上冒充结构」。  
4. **单图诚实** — 隐藏面写 confidence；允许 `request-input` / `stop`。  
5. **Token 经济** — pass 级增量；机械工作全部脚本化。

### 1.4 明确能力边界（避免误用）

| 能 | 不能 |
|----|------|
| 单物体/角色参考图 → 程序化 Three.js | 整幅国画「多要素检测 + 分割」（无 DINO/SAM） |
| Spec + 门禁 + runtime 层次 | 开箱即用的 HTTP 图生 3D 服务 |
| object / character / hybrid / creature 模板 | 环境多物体场景级重建（路线图 **v1.6**，未交付） |
| 离线 stdlib 脚本 | 默认依赖本机 CUDA |

### 1.5 与神经图生 3D 的对比（选型用）

| | img2threejs 路线 | TRELLIS / TripoSR GLB |
|--|------------------|----------------------|
| 输出 | 可 diff 的 TS + Spec | 二进制网格 |
| 拟生挂点 | sockets / pivots 一等公民 | 通常无解剖/无部件 |
| 本机成本 | CPU 脚本 + 现有 builders | CPU 慢 / 需 CUDA 才像样 |
| 像不像照片 | 风格化/结构正确优先 | 剪影像，内部常糊 |
| 可控修改 | 改 Spec 重生成 | 难局部改 |

**拟生互动优先选程序化 Spec 路线；GLB 仅作 fallback / 预览。**

---

## 2. 本系统现状与问题

### 2.1 架构速览

| 服务 | 端口 | 角色 |
|------|------|------|
| `backend.main:app` | 8931 | 静态页 + config + 代理 + object-reference |
| `tools.trellis2_worker` | 7862 | 图生 3D（TRELLIS.2 / TripoSR） |
| `tools.scene_lift_worker` | 7863 | 深度 + 分割 + embed |

前端：`frontend/wall-workspace.html` + `frontend/js/wall-workspace.js`（巨石）+ `frontend/js/generation.js`（路由/进度）+ `frontend/js/bio/*`（解剖/步态）+ 场景页 `main.js`（猎食/对话/生态）。

### 2.2 当前 wall-workspace 事实管线

```
原作 dataUrl
  → POST /api/scene-lift/analyze
       深度图 + layers[{id, bbox, maskRle, score, ...}]
  → 审稿卡片 confirmReviewLayer
  → resolveGenerationRoute (frontend/js/generation.js)
       environment 默认 → gaussian-splat（伪 4DGS 点云）
       命中 morphology 构建器 → procedural Three.js 部件
       否则 → mesh-generate（/api/trellis2/generate GLB）
  → installGeneratedLayer / installGaussianSplatLayer（回装原画锚点）
```

物象库：`backend/object_reference.json` → `/api/object-reference/lookup` → `morphologyPlan.components[]`（type + 尺寸 + constraints）。  
生物拟生：`BioEntityMesh`、步态、`hunt` 状态机、对话系统 — **依赖可识别的部件/挂点**，与 inert GLB 不兼容。

### 2.3 旧框架问题清单

| # | 问题 | 表现 | 根因 |
|---|------|------|------|
| R1 | 识别不稳定 | 水墨弱召回；GrabCut 糙；同图重跑 | 分割档位/提示词/缓存；无「画作语义契约」 |
| R2 | 建模路径分裂 | 点云 / 硬编码部件 / GLB 三套 | 无统一 Spec；路由默认绕开真正 3D |
| R3 | morphology 过浅 | 仅 type+半径高度，无 attachment/pass | 非 ObjectSculptSpec 级契约 |
| R4 | GLB 拟生难用 | 无骨骼/socket；挂不上 locomotion | 神经网格非部件化 |
| R5 | 无质量闭环 | 生成后不与裁剪对比验收 | 缺 review gate |
| R6 | 前端巨石 | 识别/审稿/生成/安置耦合 | 回归成本高 |

### 2.4 与 img2threejs 的契合点

本系统**已经**走在「物象库 → Three.js 程序化部件」方向上（lotus/bamboo/avian/… builders），哲学与 img2threejs **一致**。缺口是：

- Spec 不够深（无 detailInventory / attachment / qualityContract）  
- 无 pass 门禁与确定性 review  
- 无统一 `sculptRuntime` 对接风/猎/解剖  
- 识别与建模接口未用同一层「确认裁剪 + Spec」契约

**因此：集成 = 升格现有 procedural 路径为 Sculpt 主路径，而不是推倒重来。**

---

## 3. 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│ wall-workspace                                              │
│  识别: scene_lift.analyze → 审稿 layers                     │
│  物象: object_reference.lookup → archetype + templateId     │
│  塑形: /api/sculpt/from-crop → SculptSpec → builders/runtime│
│  安置: installGeneratedLayer + sculptRuntime 适配器         │
└─────────────────────────────────────────────────────────────┘
         │                      │                    │
         ▼                      ▼                    ▼
   scene_lift:7863      sculpt_worker (新)     trellis2:7862
   深度+分割+embed      Spec校验+构建编排       GLB fallback
```

### 3.1 设计原则（实施时不可违反）

1. **识别与塑形解耦**：分割失败不得伪造物体；塑形失败不得静默用纸板。  
2. **Sculpt 为主、GLB/点云为辅**：默认 route=`sculpt`；显式配置才点云/GLB。  
3. **离线可跑**：strict 门纯确定性；VLM/LLM 可选且默认关。  
4. **拟生优先**：每个确认模型必须带 `userData.sculptRuntime`（可为空 stubs，但字段在）。  
5. **不强迫 Agent UI**：用户在浏览器点「确认生成」即完整闭环。

### 3.2 明确不做（本任务书范围）

- 不把 wall-workspace 改成「必须打开 Claude Code」  
- 不删除 scene_lift / trellis 进程  
- 不引入新的 CUDA-only 3D 基座模型作为主路径  
- 不合并实验室 `imageAnalysis.js` 与服务端管线（仅记录双轨并存）  
- 不等待上游 img2threejs v1.6 环境多物体

---

## 4. SculptSpec 最小契约（TODO-1 落地前约定）

与 img2threejs `ObjectSculptSpec` **兼容思想、精简字段**，便于映射现有 `morphologyPlan`：

```json
{
  "version": 1,
  "specVersion": "tib-sculpt-1",
  "name": "lotus-layer-3",
  "primaryDomain": "object",
  "subjectKey": "lotus",
  "qualityContract": {
    "complexity": "moderate",
    "style": "ink-painting-stylized",
    "minComponents": 3,
    "requireAttachments": true
  },
  "reference": {
    "cropHash": "sha1...",
    "bbox": [0.1, 0.2, 0.4, 0.6],
    "maskCoverage": 0.12,
    "hiddenSideConfidence": 0.4
  },
  "components": [
    {
      "id": "petiole-0",
      "type": "petiole",
      "role": "leaf-stem",
      "params": { "radius": 0.018, "height": 0.72, "lean": 0.18 },
      "attachment": {
        "parentId": "root",
        "parentSocket": "waterline",
        "contactType": "embed",
        "embedDepth": 0.02
      }
    }
  ],
  "materials": [
    { "id": "leaf-ink", "roughness": 0.86, "metalness": 0.02, "colorHint": "#4f7a4f" }
  ],
  "sockets": [
    { "id": "waterline", "position": [0, 0, 0], "purpose": "env-water" },
    { "id": "sway-root", "position": [0, 0.1, 0], "purpose": "wind" }
  ],
  "detailInventory": [
    { "id": "leaf-veins", "mapsTo": "lotusLeaf.veins", "identity": true }
  ],
  "runtime": {
    "tick": "sway",
    "ecologyTags": ["plant", "aquatic"],
    "anatomyProfile": null
  },
  "build": {
    "mode": "static-builder",
    "builderKey": "lotus",
    "passesRequired": ["blockout", "form-refinement"]
  }
}
```

**映射规则（现有 → 新）：**

| 现有 | SculptSpec |
|------|------------|
| `morphologyPlan.components[].type` | `components[].type` |
| `morphologyPlan.components[]` 尺寸字段 | `components[].params` |
| `morphologyPlan.constraints` | `qualityContract` + 文本 notes |
| `objectReference.key` | `subjectKey` |
| `subject.domain === biology` | `primaryDomain: character\|hybrid` + `runtime.anatomyProfile` |

---

## 5. TODO 实施清单

### 实施顺序建议

1. TODO-1 → TODO-2 → TODO-3（契约与路由，可并行评审）  
2. TODO-4 → TODO-5 → TODO-6 → TODO-7 → TODO-8（塑形主路径打通）  
3. TODO-15 → TODO-16（缓存与观测，紧随主路径）  
4. TODO-9 → TODO-10（质量门 + 识别增强）  
5. TODO-12 → TODO-13 → TODO-14（拟生绑定）  
6. TODO-11 → TODO-17（可选 VLM + 前端拆分）

---

### TODO-1：定义 `SculptSpec` schema 与校验器

**背景**：`morphologyPlan` 只有 archetype/components/constraints，无法表达 attachment、sockets、质量合同；与 img2threejs 的 ObjectSculptSpec 无法对齐。

**步骤**：

1. 新增 `backend/schemas/sculpt_spec.schema.json`（或 `tools/sculpt/schema.json`）。  
2. 新增 `tools/sculpt/validate_sculpt_spec.py`（stdlib jsonschema 可选；无依赖则手写必填字段检查）。  
3. 实现 `morphology_plan_to_sculpt_spec(plan, subject, layer) -> dict`。  
4. 单测：对 catalog 内全部 `morphologyPlans` 键跑一遍映射 + validate。

**伪代码**：

```python
# tools/sculpt/spec_map.py
REQUIRED = ("version", "subjectKey", "components", "qualityContract")

def morphology_plan_to_sculpt_spec(plan: dict, subject: dict, layer: dict) -> dict:
    components = []
    for i, c in enumerate(plan.get("components") or []):
        params = {k: v for k, v in c.items() if k not in ("type", "role", "count")}
        components.append({
            "id": f"{c.get('type', 'part')}-{i}",
            "type": c.get("type"),
            "role": c.get("role"),
            "count": c.get("count", 1),
            "params": params,
            "attachment": {"parentId": "root", "parentSocket": "origin",
                           "contactType": "join", "embedDepth": 0.0},
        })
    return {
        "version": 1,
        "specVersion": "tib-sculpt-1",
        "name": f"{subject.get('id')}-{layer.get('id')}",
        "primaryDomain": "hybrid" if subject.get("domain") == "biology" else "object",
        "subjectKey": subject.get("id") or plan.get("key") or "object",
        "qualityContract": {
            "complexity": "moderate" if len(components) >= 4 else "simple",
            "style": "ink-painting-stylized",
            "minComponents": max(1, len(components) // 2),
            "requireAttachments": True,
            "constraints": plan.get("constraints") or [],
        },
        "reference": {
            "bbox": layer.get("bbox"),
            "maskCoverage": layer.get("coverage"),
        },
        "components": components,
        "materials": [],
        "sockets": default_sockets_for(subject),
        "detailInventory": [],
        "runtime": {"tick": "sway" if subject.get("domain") == "plants" else None,
                    "ecologyTags": [subject.get("domain") or "object"],
                    "anatomyProfile": subject.get("kind")},
        "build": {"mode": "static-builder", "builderKey": None, "passesRequired": ["blockout"]},
    }

def validate_sculpt_spec(spec: dict, strict: bool = True) -> list[str]:
    errors = []
    for k in REQUIRED:
        if k not in spec:
            errors.append(f"missing {k}")
    if strict and len(spec.get("components") or []) < spec.get("qualityContract", {}).get("minComponents", 1):
        errors.append("too few components for qualityContract")
    if strict and not any(c.get("attachment") for c in spec.get("components") or []):
        errors.append("components lack attachment")
    return errors
```

**验收**：catalog 全键映射 0 异常；故意缺 components 的 spec 在 strict 下失败。

---

### TODO-2：扩展物象库 catalog（sculptTemplates / sockets）

**背景**：`backend/object_reference.json` 已是单一来源；需增加可挂拟生的模板，避免 builders 硬编码 socket 名不一致。

**步骤**：

1. 在 `object_reference.json` 增加顶层 `sculptTemplates: { [subjectKey]: { builderKey, sockets[], defaultMaterials[], ecologyTags[] } }`。  
2. 优先填：`lotus`, `bamboo`, `pine`, `bird`, `quadruped`, `water`, `terrain`。  
3. `/api/object-reference/catalog` 原样返回新字段；lookup 结果合并 `sculptTemplate`。  
4. 前端 `initObjectReference` 缓存后，`createProceduralMorphologyModel` 可读 template。

**伪代码**：

```python
# backend/main.py — _local_object_reference 内
template = (_OBJECT_REF_STORE.get("sculptTemplates") or {}).get(key)
if template:
    base["sculptTemplate"] = copy.deepcopy(template)
    plan = base.get("morphologyPlan") or {}
    # 不破坏旧字段；SculptSpec 构建时优先 template.builderKey
```

```json
// object_reference.json 片段
"sculptTemplates": {
  "lotus": {
    "builderKey": "lotus",
    "sockets": [
      { "id": "waterline", "purpose": "env-water" },
      { "id": "sway-root", "purpose": "wind" }
    ],
    "ecologyTags": ["plant", "aquatic"],
    "runtimeTick": "sway"
  },
  "bird": {
    "builderKey": "avian",
    "sockets": [
      { "id": "root", "purpose": "locomotion" },
      { "id": "beak", "purpose": "interact" },
      { "id": "wing-L", "purpose": "wing" },
      { "id": "wing-R", "purpose": "wing" }
    ],
    "ecologyTags": ["prey", "avian"],
    "anatomyProfile": "avian"
  }
}
```

**验收**：lookup lotus/bird 返回 `sculptTemplate`；旧前端不读该字段仍可用 morphologyPlan。

---

### TODO-3：生成路由增加 `sculpt` 主路径

**背景**：`frontend/js/generation.js` 的 `resolveGenerationRoute` 现为 `gaussian-splat | procedural | mesh-generate`；环境默认点云导致「真 3D」难达。

**步骤**：

1. config 增加：  
   - `environmentModel`: `sculpt | pointcloud | mesh | auto`（默认改为 **`sculpt`**，或先 `auto` 再在文档说明迁移）  
   - `biologyModel`: `sculpt | procedural | mesh`（默认 `sculpt`）  
2. `resolveGenerationRoute` 增加返回值 `"sculpt"`。  
3. 审稿卡片 route select 增加「塑形 Sculpt」选项。  
4. 兼容：旧 `procedural` 视为 `sculpt` 的别名（无 Spec 服务时本地 builders）。

**伪代码**：

```javascript
// frontend/js/generation.js
export function resolveGenerationRoute(layer, ctx) {
  if (layer?.userRouteOverride) return layer.userRouteOverride;

  const envMode = ctx.environmentModel || "sculpt";
  const bioMode = ctx.biologyModel || "sculpt";

  if (ctx.scope === "environment") {
    if (envMode === "pointcloud") return "gaussian-splat";
    if (envMode === "mesh") return "mesh-generate";
    if (envMode === "auto") {
      return ctx.hasProceduralBuilder || ctx.hasSculptTemplate ? "sculpt" : "mesh-generate";
    }
    return "sculpt"; // default
  }
  // biology
  if (bioMode === "mesh") return "mesh-generate";
  if (bioMode === "procedural") return ctx.hasProceduralBuilder ? "sculpt" : "mesh-generate";
  return "sculpt";
}
```

**验收**：默认配置下确认荷/竹走 `sculpt`（metrics `route.sculpt` 增加）；显式 `pointcloud` 仍走点云。

---

### TODO-4：Vendor 策略（img2threejs 脚本子集）

**背景**：整仓 skill 含 agent 文档与 CS2 武器专用路径，不宜全量拷贝；需要可复用的 validate / comparison /（可选）divine_eye。

**步骤**：

1. 使用 `git subtree` 或手动拷贝到 `third_party/img2threejs/`，**仅保留**：  
   - `LICENSE`  
   - `forge/stage2_spec/validate_sculpt_spec.py`（若字段不兼容则包一层适配）  
   - `forge/stage4_review/make_comparison_sheet.py`  
   - `forge/stage4_review/divine_eye.py` + 其 `_shared` 依赖（若引入成本高，TODO-9 自研轻量门）  
2. README 注明版本与上游 URL。  
3. **禁止**在运行时 `exec` 上游生成的任意 TS 而不经审查。

**伪代码**：

```bash
# 一次性（文档记录命令，实施者执行）
mkdir -p third_party
git clone --depth 1 https://github.com/img2threejs/img2threejs.git /tmp/img2threejs
# 精选拷贝 LICENSE + forge 子集 → third_party/img2threejs/
# 写入 third_party/img2threejs/VENDOR.md: version, date, files kept
```

**验收**：仓库可离线 `python3 third_party/img2threejs/forge/... --help`；无强制 pip 依赖。

---

### TODO-5：新增 `sculpt_worker`（确认裁剪 → Spec → 构建计划）

**背景**：缺少统一服务把「裁剪 + subject + objectReference」变成可执行 SculptSpec；现逻辑散落在前端 builders。

**步骤**：

1. 新增 `tools/sculpt_worker.py`（FastAPI，端口建议 **7864**）。  
2. 端点：  
   - `GET /health`  
   - `POST /sculpt/from-crop`  
   - `GET /sculpt/stream/{task_id}`（可选，对齐 trellis 任务化）  
   - `GET /metrics`  
3. `start.sh` 拉起并 health wait。  
4. 首期 `build.mode = static-builder`：不动态 codegen，只返回 **规范化 Spec + builderKey + runtime**；前端用现有 builders 执行。  
5. 二期再可选 `build.mode = codegen`（沙箱）。

**伪代码**：

```python
# tools/sculpt_worker.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sculpt.spec_map import morphology_plan_to_sculpt_spec, validate_sculpt_spec

app = FastAPI(title="TigerInBamboo Sculpt Worker", version="0.1")

class SculptRequest(BaseModel):
    image: str = Field(..., description="data:image/... 确认裁剪")
    subject: dict
    layerId: str | None = None
    bbox: list[float] | None = None
    objectReference: dict | None = None
    morphologyPlan: dict | None = None
    refresh: bool = False

@app.post("/sculpt/from-crop")
def sculpt_from_crop(req: SculptRequest):
    plan = (req.morphologyPlan
            or (req.objectReference or {}).get("morphologyPlan")
            or {})
    layer = {"id": req.layerId or "layer-0", "bbox": req.bbox, "coverage": None}
    spec = morphology_plan_to_sculpt_spec(plan, req.subject, layer)
    # 合并 catalog template
    template = (req.objectReference or {}).get("sculptTemplate") or {}
    if template.get("builderKey"):
        spec["build"]["builderKey"] = template["builderKey"]
    if template.get("sockets"):
        spec["sockets"] = template["sockets"]
    errors = validate_sculpt_spec(spec, strict=True)
    if errors:
        # 降级：strict 失败时 soft 返回 + warnings，或 422
        return {"ok": False, "errors": errors, "spec": spec, "cached": False}
    return {
        "ok": True,
        "spec": spec,
        "builderKey": spec["build"].get("builderKey"),
        "runtime": spec.get("runtime"),
        "warnings": [],
        "cached": False,
    }
```

**验收**：对 `tools/crops/lotus.png`（或任意裁剪 dataUrl）POST 返回 `ok:true` 与合法 spec；strict 失败路径有明确 errors。

---

### TODO-6：桥接现有 builders → 写入 `sculptRuntime`

**背景**：`createProceduralMorphologyModel` / `createLotusMorphologyModel` 等已生成 `THREE.Group`，但 `userData` 未统一 sockets，风摆/猎食无法稳定绑定。

**步骤**：

1. 新增 `frontend/js/sculpt/runtime.js`：`attachSculptRuntime(root, spec)`。  
2. 各 builder 出口调用之；按 `spec.sockets` 放 `Object3D` 空节点。  
3. `installGeneratedLayer` 保留 runtime 到 entity.userData。  
4. 无 builder 的 subject：返回明确错误，触发 mesh fallback（不静默空 Group）。

**伪代码**：

```javascript
// frontend/js/sculpt/runtime.js
export function attachSculptRuntime(root, spec) {
  const nodes = {};
  const sockets = {};
  for (const s of spec.sockets || []) {
    const pivot = new THREE.Object3D();
    pivot.name = `socket:${s.id}`;
    if (s.position) pivot.position.fromArray(s.position);
    root.add(pivot);
    sockets[s.id] = pivot;
  }
  root.userData.sculptRuntime = {
    version: 1,
    subjectKey: spec.subjectKey,
    builderKey: spec.build?.builderKey,
    nodes,
    sockets,
    colliders: [],
    ecologyTags: spec.runtime?.ecologyTags || [],
    anatomyProfile: spec.runtime?.anatomyProfile || null,
    tick: spec.runtime?.tick || null,
    specVersion: spec.specVersion,
  };
  root.userData.generatedBy = "tib-sculpt";
  return root;
}

// createProceduralMorphologyModel 末尾：
// attachSculptRuntime(root, sculptSpec || planAsSpec);
```

**验收**：确认竹/荷后，`entity.userData.sculptRuntime.sockets.sway-root`（或约定名）存在；`generatedBy === "tib-sculpt"`。

---

### TODO-7：后端代理 `/api/sculpt/*`

**背景**：浏览器不得直连 worker 端口；现有 scene-lift/trellis 已用 async httpx 代理。

**步骤**：

1. `backend/main.py` 增加 `_sculpt_server_url()`（env / runtime.json / 探测 7864）。  
2. `POST /api/sculpt/from-crop`、`GET /api/sculpt/status` 透传。  
3. `start.sh` 增加 sculpt_worker 进程与日志 `tools/out/sculpt_worker.log`。

**伪代码**：

```python
def _sculpt_server_url() -> str:
    return _auto_connect("SCULPT_SERVER_URL", 7864)

@app.post("/api/sculpt/from-crop")
async def sculpt_from_crop(request: Request):
    server = _sculpt_server_url()
    if not server:
        raise HTTPException(503, "塑形服务未连接")
    body = await request.body()
    upstream = await _proxy_request("POST", server, "/sculpt/from-crop", body=body,
                                    headers={"Content-Type": "application/json"})
    if upstream.status_code >= 400:
        raise HTTPException(upstream.status_code, upstream.text[:800])
    metrics.count("proxy.sculpt.from_crop")
    return Response(content=upstream.content, media_type="application/json")
```

**验收**：只开 8931 时浏览器可调用 `/api/sculpt/from-crop`；worker 挂掉返回 503。

---

### TODO-8：`confirmReviewLayer` 主路径改走 sculpt

**背景**：`wall-workspace.js` 中 confirm 仍按 gaussian / morphology / trellis 分支；需插入 sculpt 并定义降级链。

**降级链（必须实现）：**

```
sculpt API ok + builder 存在 → attachSculptRuntime → install
  → sculpt API 失败或 strict 失败 → 旧 procedural builders（无 runtime 也要提示）
    → 仍失败且 trellis online → mesh-generate
      → 否则 toast 失败，不装假模型
```

**伪代码**：

```javascript
// confirmReviewLayer 内
const route = resolveGenerationRoute(layer, { ... });
trackRouteHit(route);

if (route === "sculpt") {
  const crop = createLayerCropDataUrl(layer, ref, { reconstruction: true, profile });
  let sculpt;
  try {
    const res = await fetch("/api/sculpt/from-crop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: crop,
        subject: review.subject,
        layerId: layer.id,
        bbox: layer.bbox,
        objectReference: layer.objectReference,
        morphologyPlan: layer.objectReference?.morphologyPlan,
      }),
    });
    sculpt = await res.json();
  } catch (e) {
    sculpt = { ok: false, errors: [String(e)] };
  }

  if (sculpt.ok && sculpt.builderKey) {
    const root = createProceduralMorphologyModel(
      review.subject, layer, profile,
      { ...layer.objectReference, morphologyPlan: sculpt.spec, sculptSpec: sculpt.spec },
    );
    attachSculptRuntime(root, sculpt.spec);
    installGeneratedLayer(root, layer, anchorEntity, profile);
  } else if (shouldUseProceduralMorphologyModel(...)) {
    // 降级旧 procedural
    trackRouteHit("sculpt.fallback.procedural");
    ...
  } else {
    // 降级 GLB
    trackRouteHit("sculpt.fallback.mesh");
    const buffer = await requestGenerateWithProgress(...);
    ...
  }
}
```

**验收**：荷/竹/禽默认 sculpt 成功回装；故意停 sculpt_worker 时自动降级且 metrics 可见 fallback。

---

### TODO-9：确定性质量门（轻量 Divine Eye）

**背景**：img2threejs 用 silhouette IoU / 比例硬门避免「贴图骗过肉眼」；本系统生成后无验收。

**步骤**：

1. 新增 `tools/sculpt/gates.py`（或 worker 内）：  
   - 输入：mask 覆盖率、组件数量 vs qualityContract、builder 是否覆盖 spec.components 类型。  
2. 前端可选：生成后 offscreen 渲染剪影与 mask 比 IoU（二期）。  
3. 门失败 → `refine` 标记，UI 显示「结构未过门」，允许用户强制接受或改 route。

**伪代码**：

```python
def structural_gate(spec: dict, built_types: set[str]) -> dict:
    required = {c["type"] for c in spec.get("components") or []}
    missing = sorted(required - built_types)
    ok = not missing and len(spec.get("components") or []) >= 1
    return {"ok": ok, "missingTypes": missing, "gate": "component-coverage"}
```

```javascript
// builder 返回 { root, builtTypes }
const gate = await fetch("/api/sculpt/gate", { method: "POST", body: JSON.stringify({
  spec, builtTypes: [...builtTypes],
})}).then(r => r.json());
if (!gate.ok) showToast(`塑形结构门未过: 缺 ${gate.missingTypes.join(",")}`);
```

**验收**：故意用 generic builder 建 lotus spec → gate.ok=false；lotus builder → true。

---

### TODO-10：识别增强（服务「画中要素」主目标）

**背景**：img2threejs 不解决全图识别；识别质量仍决定拟生上限。衔接 `optimization-recognition-3d.md` 的 SAM2/缓存，本处补「产品契约」。

**步骤**：

1. 维护 `backend/recognition_prompts.json`（或并入 object_reference）：国画友好英文短语 + 中文 label。  
2. `generateFromSource` 支持 **一次分析多 subject**（或队列并发 2）：环境域常用套装（山+水+竹）一键。  
3. 状态条固定显示 `segmentationTier`（grounded-sam2 / dino+grabcut）。  
4. 本地候选 `localCandidate` 与服务端结果合并策略文档化（谁优先、如何去重 IoU）。

**伪代码**：

```javascript
async function analyzeSubjects(subjects) {
  await runWithConcurrency(subjects, 2, async (subject) => {
    const res = await fetch("/api/scene-lift/analyze", {
      method: "POST",
      body: JSON.stringify({
        image: state.source.dataUrl,
        subject: { id: subject.id, label: subject.label, prompt: subject.prompt },
        gridMaxSide: 320,
      }),
    });
    // merge layers into review panel with subjectId tag
  });
}
```

**验收**：一键「竹 + 水」产生两组候选；UI 显示当前分割档位。

---

### TODO-11：可选 VLM/LLM 审图钩子（默认关）

**背景**：img2threejs 用 agent vision 做 pass 判决；本系统可配置外接多模态 API，但不得成为硬依赖。

**步骤**：

1. config：`sculpt.review.vlmEnabled` / endpoint / model。  
2. `POST /api/sculpt/review`：参考裁剪 + 可选截图 → `{ score, action, notes }`。  
3. 默认 `vlmEnabled=false`；关闭时仅跑 TODO-9 确定性门。

**伪代码**：

```python
@app.post("/sculpt/review")
def sculpt_review(req: ReviewRequest):
    if not vlm_enabled():
        return {"score": None, "action": "skip", "notes": "vlm disabled"}
    # 调用配置的多模态接口；超时 → action=skip
    return {"score": 0.0, "action": "continue|refine-code|stop", "notes": "..."}
```

**验收**：关闭时零外网请求；打开且 endpoint 错误时 skip 不阻塞安装。

---

### TODO-12：环境拟生绑定（风 / 水 / 重力）

**背景**：拟生环境需要植物随风、水有流动感；点云路径难绑，Sculpt sockets 可绑。

**步骤**：

1. 约定 socket purpose：`wind` | `env-water` | `ground`。  
2. `updateEnvironmentMotion`（或 wall-workspace 动画循环）读取所有 `sculptRuntime.tick === "sway"` 的实体，绕 `sway-root` 施加与 `state.wind` 相关的旋转。  
3. 水面 builder 保持薄片 + shader；socket `waterline` 供邻接植物对齐。

**伪代码**：

```javascript
function tickSculptEntities(dt, wind) {
  for (const entity of allInstalledEntities()) {
    const rt = entity.userData.sculptRuntime;
    if (!rt || rt.tick !== "sway") continue;
    const pivot = rt.sockets["sway-root"] || entity;
    const phase = entity.userData.swayPhase || 0;
    pivot.rotation.z = Math.sin(performance.now() * 0.001 + phase) * 0.12 * wind;
  }
}
```

**验收**：确认竹后调大风力，竹体可见摆动；无 runtime 的旧模型不报错。

---

### TODO-13：生物拟生绑定（解剖 / 生态 / 自动互动）

**背景**：`frontend/js/bio/*` 与 `tiger.js` hunt 需要可识别身体部件；SculptSpec.anatomyProfile 应对齐 `avian|digitigrade|...`。

**步骤**：

1. `sculptTemplates` 为 bird/quadruped/fish 填 `anatomyProfile` 与 sockets（root/head/wing/leg）。  
2. 确认生灵后：若 `anatomyProfile` 有值，尝试 `BioEntityMesh` 包装或注册为 hunt prey/predator 列表。  
3. ecologyTags：`prey` / `predator` / `neutral` 写入场景生态表（可先 console + metrics，再接 main 场景发布）。

**伪代码**：

```javascript
function registerLivingEntity(entity, spec) {
  const rt = entity.userData.sculptRuntime;
  const profile = rt?.anatomyProfile;
  if (!profile) return;
  entity.userData.living = {
    anatomyProfile: profile,
    ecologyTags: rt.ecologyTags || [],
    sockets: rt.sockets,
  };
  if ((rt.ecologyTags || []).includes("prey")) {
    state.preyEntities.push(entity);
  }
  // 发布到 scene 后，tiger hunt 可选取 preyEntities
}
```

**验收**：确认「禽」候选后 entity.userData.living.anatomyProfile === "avian"；prey 列表非空。

---

### TODO-14：场景发布携带 sculptRuntime 元数据

**背景**：`/api/scene/share` 与 `frontend/scenes/*.json` 若只存网格/贴图，scene-view 丢失互动语义。

**步骤**：

1. 发布 payload 每层增加：`sculpt: { subjectKey, builderKey, sockets, ecologyTags, anatomyProfile, specVersion }`（不强制存完整 components 以控体积）。  
2. scene-view 加载时 `rehydrateSculptRuntime`。  
3. 文档说明体积上限与剥离策略。

**伪代码**：

```javascript
function serializeInstalledLayer(entity, layer) {
  const rt = entity.userData.sculptRuntime;
  return {
    layerId: layer.id,
    transform: { position: entity.position.toArray(), ... },
    sculpt: rt ? {
      subjectKey: rt.subjectKey,
      builderKey: rt.builderKey,
      ecologyTags: rt.ecologyTags,
      anatomyProfile: rt.anatomyProfile,
      socketIds: Object.keys(rt.sockets || {}),
      specVersion: rt.specVersion,
    } : null,
  };
}
```

**验收**：发布 → 新标签打开 scene-view → living/ecology 元数据仍在（允许重建 Group）。

---

### TODO-15：塑形结果缓存

**背景**：同裁剪重复确认不应重复构 Spec；对齐 `tools/cache_utils.py`。

**伪代码**：

```python
key = cache_key(crop_bytes, subject_id, template_id, "tib-sculpt-1")
if not refresh:
    if hit := cache_get("sculpt", key):
        return {**hit, "cached": True}
result = build_sculpt(...)
cache_put("sculpt", key, result, elapsed)
```

**验收**：同裁剪二次 POST `< 100ms` 且 `cached:true`。

---

### TODO-16：Metrics

**步骤**：复用 `tools/metrics.py`。

计数：`route.sculpt`、`sculpt.ok`、`sculpt.strict_fail`、`sculpt.fallback.procedural`、`sculpt.fallback.mesh`、`gate.component_coverage.fail`  
耗时：`sculpt.from_crop` p50/p95  

前端状态条展示 route 计数（已有 metricsSnapshot 可扩）。

**验收**：完整确认 1 次荷 + 1 次强制 GLB fallback 后，`/api/metrics` 能区分两条路径。

---

### TODO-17：wall-workspace 再拆分（识别 / 塑形 / 安置）

**背景**：巨石导致路由与 builder 改动高风险；`generation.js` 已抽出，需继续。

**步骤**（每步保持可运行）：

1. `frontend/js/sculpt/confirm.js` — confirmReviewLayer sculpt 分支  
2. `frontend/js/recognition/analyze.js` — generateFromSource  
3. `frontend/js/placement/install.js` — installGeneratedLayer  
4. wall-workspace.js 只做编排与状态

**验收**：主文件行数显著下降（目标 < 4000，理想 < 2000）；手工回归：识别 → 确认竹/禽 → 安置。

---

## 6. 与 `optimization-recognition-3d.md` 的关系

| 文档 | 焦点 |
|------|------|
| optimization-recognition-3d | 代理异步、缓存、并发、SAM2、TripoSR 质量、metrics、死代码 |
| **本文** | 建模主路径哲学、SculptSpec、img2threejs 对齐、拟生 runtime |

实施时：**性能类 TODO 与本文 P0–P1 不冲突**；建议先保证 optimization 中缓存/代理已落地，再上 sculpt_worker，避免慢请求堵死 UI。

---

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| img2threejs 字段与 tib-sculpt-1 不完全兼容 | 自有 schema + 可选适配层；不强制 100% 上游 JSON |
| 国画 ≠ 硬表面 demo | qualityContract.style=`ink-painting-stylized`；门禁放宽外观、收紧结构 |
| 动态 codegen 安全 | 默认 static-builder；codegen 仅开发开关 |
| 默认改 sculpt 破坏旧习惯 | config 可切回 pointcloud；变更写 README |
| 上游 v1.6 未到 | 多物体布局仍由 wall-workspace 层负责 |

---

## 8. 验收总表（给 Grok 的 Definition of Done）

- [x] SculptSpec schema + 映射 + 校验（TODO-1）— `backend/schemas/sculpt_spec.schema.json` + `tools/sculpt/`  
- [x] catalog 含 sculptTemplates（TODO-2）— `object_reference.json` + catalog API  
- [x] 默认路由为 sculpt，可配置回点云/GLB（TODO-3）— `environmentModel`/`biologyModel` + `generation.js`  
- [x] sculpt_worker + 后端代理 + start.sh（TODO-5/7）— `:7864` + `/api/sculpt/*`  
- [x] builders 写 sculptRuntime（TODO-6）— `frontend/js/sculpt/runtime.js`  
- [x] confirm 主路径 + 降级链（TODO-8）— wall-workspace + generation 路由  
- [x] 至少竹/荷/禽三条 subject 端到端：识别 → 确认 → 回装 → runtime 可见  
  - 自动化：`python3 tools/sculpt/e2e_subjects.py`（2026-08-02）  
    bamboo/lotus/bird → `/api/sculpt/from-crop` 出 SculptSpec + builderKey + components，  
    gate ok；前端 `createBamboo/Lotus/AvianMorphologyModel` + `attachSculptRuntime` 在位  
  - 全图「识别」仍依赖 scene_lift + 画作素材的人工 UI 点验；塑形主路径三 subject 已机测通过
- [x] metrics 可区分 sculpt / fallback — `api_metrics` workers.sculpt  
- [x] 文档与代码中的「明确不做」未被违反（按当前集成边界）

---

## 9. 参考链接

- 上游仓库：https://github.com/img2threejs/img2threejs  
- Skill 说明：仓库内 `SKILL.md`  
- 路线图：仓库内 `ROADMAP.md`（v1.6 Environment / v1.8 Animation）  
- Live demo：https://img2threejs.github.io/img2threejs-showcase/  
- 本仓库性能任务书：`docs/optimization-recognition-3d.md`  
- 物象库：`backend/object_reference.json`  
- 生成路由：`frontend/js/generation.js`  
- 审稿确认：`frontend/js/wall-workspace.js` → `confirmReviewLayer` / `generateFromSource`
