# 识别 + 3D 管线优化规划

> 面向实施者（Grok）的任务书。每条 Todo 含背景（带文件:行号）、实施步骤、**伪代码**、验收标准。
> 伪代码是骨架示意：函数名/字段名以实际代码为准，落地时保持项目现有风格。
> 行号基于 2026-07-27 的代码快照，实施前请以实际代码为准。

## 0. 现状一句话

当前事实上的管线是：**Grounding DINO(+GrabCut) 识别 → 本地物象库形态方案 → 环境走伪 4DGS 点云 / 生物走 Three.js 程序化部件**。真正的神经网络图生 3D（TRELLIS.2 / TripoSR GLB）被旁路到几乎不可达。服务端无缓存、同步阻塞代理、7.4k 行前端巨石是最值得先动的三处。

架构速览（三进程，由 `start.sh` 拉起，全部 `HF_HUB_OFFLINE=1`）：

| 服务 | 端口 | 角色 |
|---|---|---|
| `backend.main:app` | 8931 | 静态托管 + 配置 + **反向代理**（同步 urllib，900s 超时） |
| `tools.trellis2_worker:app` | 7862 | 图生 3D（TRELLIS.2 需 CUDA；本机恒落 TripoSR CPU） |
| `tools.scene_lift_worker:app` | 7863 | 深度（MapAnything / DA-V2-Small）+ 分割（Grounded SAM 2 / DINO+GrabCut）+ embed |

前端核心：`frontend/wall-workspace.html` + `frontend/js/wall-workspace.js`（7387 行单文件）。

---

## P0 — 性能与可用性（先做，收益最大）

### TODO-1：后端代理异步化

**背景**：`backend/main.py` 所有代理端点是同步 `def` + `urllib`，900s 超时（`backend/main.py:997`、`:1060`）。图生 3D 期间整个后端线程池被占，静态资源都会被拖慢。

**步骤**：
1. `backend/requirements.txt` 增加 `httpx`。
2. 把 `/api/scene-lift/*`、`/api/trellis2/*` 代理端点改为 `async def` + 模块级复用的 `httpx.AsyncClient`（勿每请求新建）。
3. connect/read 超时分开（connect 5s，read 900s）。
4. 顺带修复 `backend/main.py:960` 未导入的 `Request`。

**伪代码**：

```python
# backend/main.py
import httpx
from fastapi import Request   # 补 TODO-1.4 的缺失导入

_PROXY_TIMEOUT = httpx.Timeout(connect=5.0, read=900.0, write=30.0, pool=5.0)
_proxy_client: httpx.AsyncClient | None = None

def get_proxy_client() -> httpx.AsyncClient:
    global _proxy_client
    if _proxy_client is None:
        _proxy_client = httpx.AsyncClient(timeout=_PROXY_TIMEOUT)
    return _proxy_client

@app.on_event("shutdown")
async def close_proxy_client():
    global _proxy_client
    if _proxy_client is not None:
        await _proxy_client.aclose()
        _proxy_client = None

async def proxy_json(method: str, base_url: str, path: str,
                     body: bytes, headers: dict) -> Response:
    client = get_proxy_client()
    try:
        resp = await client.request(method, base_url + path,
                                    content=body, headers=headers)
    except httpx.ConnectError:
        raise HTTPException(503, f"worker unreachable: {base_url}")
    return Response(status_code=resp.status_code,
                    content=resp.content,
                    media_type=resp.headers.get("content-type"))

@app.post("/api/trellis2/generate")
async def trellis2_generate(request: Request):
    body = await request.body()
    return await proxy_json("POST", TRELLIS2_URL, "/generate", body,
                            {"content-type": "application/json"})
```

**验收**：生成期间并发请求 `/api/config` 与静态页面，响应 < 500ms；两个并发 generate 不再排队于后端。

### TODO-2：服务端识别结果缓存

**背景**：同一幅画换 subject 就重跑完整深度推理（`tools/scene_lift_worker.py:1011`）；同一裁剪重复确认就重新图生 3D。前端只有内存级 `state.sceneLiftCache`（`wall-workspace.js:857`），刷新即丢。

**步骤**：
1. `/analyze`：以 `sha1(image_bytes) + subject + 模型版本` 为 key 磁盘缓存到 `~/.cache/tigerinbamboo/scene_lift/`。
2. `/generate`：以 `sha1(crop_bytes) + 引擎 + 参数` 为 key 缓存 GLB 路径。
3. 缓存条目记录耗时与命中计数（供 TODO-13 metrics 用）。
4. 支持 `refresh=1` 强制绕缓存。

**伪代码**：

```python
# tools/cache_utils.py（新建，两个 worker 共用）
import hashlib, json, os, time

CACHE_ROOT = os.path.expanduser("~/.cache/tigerinbamboo")

def cache_key(*parts: object) -> str:
    h = hashlib.sha1()
    for p in parts:
        h.update(p if isinstance(p, bytes) else str(p).encode())
        h.update(b"\x00")
    return h.hexdigest()

def cache_get(namespace: str, key: str):
    path = f"{CACHE_ROOT}/{namespace}/{key}.json"
    if not os.path.exists(path):
        return None
    with open(path) as f:
        entry = json.load(f)
    entry["meta"]["hits"] += 1
    _atomic_write(path, entry)
    return entry["payload"]

def cache_put(namespace: str, key: str, payload: dict, elapsed: float):
    path = f"{CACHE_ROOT}/{namespace}/{key}.json"
    entry = {"meta": {"elapsed": elapsed, "hits": 0,
                      "created": time.time()},
             "payload": payload}
    _atomic_write(path, entry)
```

```python
# tools/scene_lift_worker.py — analyze 端点内
@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    key = cache_key(b64decode(req.image), req.subject, MODEL_VERSION)
    if not req.refresh:
        if hit := cache_get("scene_lift", key):
            return {**hit, "cached": True}
    t0 = time.time()
    result = run_analyze_pipeline(req)        # 现有逻辑原样搬入
    cache_put("scene_lift", key, result, time.time() - t0)
    return {**result, "cached": False}
```

```python
# tools/trellis2_worker.py — generate 端点内（GLB 落盘，缓存存路径）
key = cache_key(crop_bytes, engine, mc_res, decimation)
if not req.refresh and (hit := cache_get("trellis2", key)):
    if os.path.exists(hit["glb_path"]):
        return FileResponse(hit["glb_path"])
```

**验收**：同图二次 analyze 响应 < 1s；重复 generate 直接返回已有 GLB；重启服务后缓存仍有效。

### TODO-3：生成并发与去重

**背景**：worker 侧 `_pipeline_lock` 全程持有（`tools/trellis2_worker.py:171`），所有生成全局串行；前端 `completeLayerModels` 最多 4 层且**顺序 await**（`wall-workspace.js:5437`）。

**步骤**：
1. 锁只保护模型推理段，预处理/后处理/落盘移出锁。
2. worker 内 in-flight 去重：相同 key 并发请求挂同一 future。
3. 前端顺序 await 改有限并发（2），每张卡片独立 进行中/失败/重试 状态。

**伪代码**：

```python
# tools/trellis2_worker.py
import threading

_inflight: dict[str, threading.Event] = {}
_inflight_result: dict[str, str] = {}   # key -> glb_path 或 exception
_inflight_mu = threading.Lock()

def generate_dedup(key: str, req) -> str:
    with _inflight_mu:
        if key in _inflight:
            done = _inflight[key]       # 已有同 key 任务在跑：等它
            owner = False
        else:
            done = threading.Event()
            _inflight[key] = done
            owner = True
    if owner:
        try:
            glb_path = run_generate(req)          # 见下方锁粒度
            _inflight_result[key] = glb_path
        except Exception as e:
            _inflight_result[key] = e
        finally:
            done.set()
    else:
        done.wait()
    result = _inflight_result.pop(key, None) if owner else _inflight_result[key]
    if isinstance(result, Exception):
        raise result
    return result

def run_generate(req) -> str:
    image = preprocess(req.crop)            # 去背景等：锁外
    with _pipeline_lock:                    # 锁只包住推理
        tsr_output = triposr_infer(image)
    mesh = postprocess(tsr_output, req.mc_res)  # marching cubes + 简化：锁外
    return export_glb(mesh)
```

```javascript
// frontend/js/wall-workspace.js — 有限并发
async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try { await worker(item); }
      catch (e) { markCardFailed(item, e); }   // 单卡失败不拖垮整批
    }
  });
  await Promise.all(runners);
}

// 替换 completeLayerModels 里的顺序 for+await：
await runWithConcurrency(pendingLayers, 2, async (layer) => {
  markCardRunning(layer);
  const glb = await requestGenerate(layer.crop);   // 现有请求逻辑
  installGeneratedLayer(layer, glb);
});
```

**验收**：4 层全生成总耗时显著低于 4 × 单层；同一裁剪并发确认只触发一次推理（日志/metrics 可见）。

### TODO-4：长任务进度推送

**背景**：900s 盲等，用户无任何反馈。依赖 TODO-3 的任务化改造。

**步骤**：
1. generate 改任务制：POST 返回 `task_id`，SSE 推阶段进度，支持取消。
2. 后端代理透传 SSE（`StreamingResponse`）。
3. 前端卡片显示阶段与进度条、取消按钮。

**伪代码**：

```python
# tools/trellis2_worker.py
import asyncio, uuid

_tasks: dict[str, dict] = {}   # task_id -> {stage, pct, done, glb_path, error, cancel}

@app.post("/generate")
async def generate(req: GenerateRequest):
    task_id = uuid.uuid4().hex[:12]
    _tasks[task_id] = {"stage": "queued", "pct": 0, "done": False,
                       "glb_path": None, "error": None, "cancel": False}
    asyncio.get_running_loop().run_in_executor(None, _run_task, task_id, req)
    return {"task_id": task_id}

def _progress(task_id, stage, pct):
    _tasks[task_id].update(stage=stage, pct=pct)

def _run_task(task_id, req):
    try:
        _progress(task_id, "remove-bg", 10)
        image = preprocess(req.crop)
        _progress(task_id, "inference", 30)
        with _pipeline_lock:
            out = triposr_infer(image)
        _progress(task_id, "mesh", 70)
        mesh = postprocess(out, req.mc_res)
        _progress(task_id, "export", 90)
        _tasks[task_id].update(glb_path=export_glb(mesh), pct=100, done=True)
    except Exception as e:
        _tasks[task_id].update(error=str(e), done=True)

@app.get("/generate/stream/{task_id}")
async def stream(task_id: str):
    async def events():
        while True:
            t = _tasks.get(task_id)
            if t is None:
                yield f"data: {json.dumps({'error': 'unknown task'})}\n\n"
                return
            yield f"data: {json.dumps(t)}\n\n"
            if t["done"]:
                return
            await asyncio.sleep(1.0)
    return StreamingResponse(events(), media_type="text/event-stream")
```

```javascript
// frontend/js — EventSource 消费
function requestGenerateWithProgress(crop, onStage) {
  return fetch('/api/trellis2/generate', { method: 'POST', body: JSON.stringify({ crop }) })
    .then(r => r.json())
    .then(({ task_id }) => new Promise((resolve, reject) => {
      const es = new EventSource(`/api/trellis2/generate/stream/${task_id}`);
      es.onmessage = (ev) => {
        const t = JSON.parse(ev.data);
        onStage(t.stage, t.pct);
        if (t.done) {
          es.close();
          t.error ? reject(new Error(t.error))
                  : fetch(`/api/trellis2/generate/result/${task_id}`).then(r => r.blob()).then(resolve);
        }
      };
    }));
}
```

**验收**：生成中前端可见 ≥4 个阶段推进；取消后 worker 释放资源。

---

## P1 — 管线接通与生成质量

### TODO-5：启用 Grounded SAM 2 全量分割

**背景**：Grounded SAM 2 已 pip 安装，但 `start.sh` 没设 `GROUNDED_SAM2_ROOT` / `SAM2_CHECKPOINT`，实际跑的是 DINO+GrabCut 档；`start.sh:59` 还把 grounding 模型降级为 tiny。

**步骤**：
1. `start.sh` 补齐 env，checkpoint 缺失时明确警告而非静默降级。
2. grounding 模型恢复 base。
3. `/api/scene-lift/status` 返回实际生效档位，前端审稿界面显示。

**伪代码**：

```bash
# start.sh（片段）
export GROUNDED_SAM2_ROOT="${GROUNDED_SAM2_ROOT:-$HOME/.cache/tigerinbamboo/Grounded-SAM-2}"
export SAM2_CHECKPOINT="${SAM2_CHECKPOINT:-$GROUNDED_SAM2_ROOT/checkpoints/sam2.1_hiera_large.pt}"
export GROUNDING_MODEL="${GROUNDING_MODEL:-IDEA-Research/grounding-dino-base}"

if [ ! -f "$SAM2_CHECKPOINT" ]; then
  echo "[warn] SAM2 checkpoint 缺失：$SAM2_CHECKPOINT"
  echo "[warn] 分割将降级为 grounding-dino + GrabCut"
fi
```

```python
# tools/scene_lift_worker.py — status 端点
@app.get("/status")
def status():
    return {
        "geometry": "map-anything" if _mapanything_ready() else "depth-anything-v2-small",
        "segmentation": _active_segmenter_name(),   # "grounded-sam2" / "dino+grabcut"
        "grounding_model": os.environ.get("GROUNDING_MODEL"),
    }
```

**验收**：status 显示 `grounded-sam2` 生效；同一测试画掩码质量明显优于 GrabCut 档（留对比截图）。

### TODO-6：TripoSR 生成质量提升

**背景**：TripoSR CPU 兜底 marching-cubes 分辨率 96、chunk 4096（`tools/trellis2_worker.py:43`、`:165-191`），网格粗糙。

**步骤**：
1. mc 分辨率 → 192（env `TRIPOSR_MC_RES` 可配），实测本机内存/耗时上限。
2. 输入先过 rembg 去背景。
3. 验证 MPS 可用性，可用优先于 CPU。
4. 导出前 trimesh 简化 + 法线修复。

**伪代码**：

```python
# tools/trellis2_worker.py
MC_RES = int(os.environ.get("TRIPOSR_MC_RES", "192"))
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"   # 实测推理兼容后启用

_rembg_session = None
def remove_background(image: PIL.Image) -> PIL.Image:
    global _rembg_session
    if _rembg_session is None:
        from rembg import new_session
        _rembg_session = new_session("u2net")
    from rembg import remove
    return remove(image, session=_rembg_session)

def run_generate(req) -> str:
    image = remove_background(load_image(req.crop))
    with _pipeline_lock:
        with torch.no_grad():
            scene_codes = triposr_model(image, device=DEVICE)
    mesh = extract_mesh(scene_codes, mc_res=MC_RES, chunk=4096)   # 现有抽取逻辑
    mesh = trimesh_repair_and_simplify(mesh, target_faces=200_000)
    return export_glb(mesh)

def trimesh_repair_and_simplify(mesh, target_faces):
    import trimesh
    mesh.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(mesh)
    if len(mesh.faces) > target_faces:
        mesh = mesh.simplify_quadric_decimation(target_faces)
    return mesh
```

**验收**：同一裁剪新旧参数各生成一次，网格细节与 GLB 大小有量化对比；耗时增幅 < 2×。

### TODO-7：让图生 3D 路径真正可达

**背景**：环境域 `useGaussianSplat` 无条件为 true（`wall-workspace.js:5200`），环境对象**永远不走**图生 3D；生物域 13 种形态构建器覆盖绝大多数 subject，GLB 路径近乎不可达。

**步骤**：
1. `config.json` 加 `environmentModel: "pointcloud" | "mesh" | "auto"`（默认 `pointcloud` 保持现状）。
2. `auto`：形态构建器未覆盖的 subject 走 `/api/trellis2/generate`。
3. 审稿卡片上允许手动切换生成方式；埋点统计各路径触发数。

**伪代码**：

```javascript
// frontend/js/wall-workspace.js — confirmReviewLayer 分流处（:5189 附近）
function resolveGenerationRoute(layer) {
  // 用户手动指定优先
  if (layer.userRouteOverride) return layer.userRouteOverride;

  const builderKey = resolveProceduralBuilderKey(layer.subject);
  if (builderKey) return "procedural";                 // 形态构建器覆盖：程序化

  if (layer.domain === "environment") {
    const mode = config.environmentModel ?? "pointcloud";
    if (mode === "pointcloud") return "gaussian-splat";
    // "mesh" 与 "auto"（无构建器时）都走图生 3D
    return "mesh-generate";
  }
  return "mesh-generate";                              // 生物域无构建器：图生 3D
}

async function confirmReviewLayer(layer) {
  const route = resolveGenerationRoute(layer);
  trackRouteHit(route);                                // 埋点，供 TODO-13
  switch (route) {
    case "gaussian-splat": return installGaussianSplatLayer(layer);
    case "procedural":     return createProceduralMorphologyModel(layer);
    case "mesh-generate":  return requestGenerateWithProgress(layer.crop)
                              .then(glb => installGeneratedLayer(layer, glb));
  }
}
```

**验收**：配置切 `mesh` 后环境对象产出 GLB 并可安置；metrics 能查到三条路径各自计数。

### TODO-8：morphologyPlan / 物象库单一来源

**背景**：双份维护：`backend/main.py:608-777` 与前端 `buildFallbackMorphologyPlan`（`wall-workspace.js:1534-1567`）必然漂移；catalog 是硬编码数据混在路由文件里。

**步骤**：
1. catalog + morphologyPlan 抽成 `backend/object_reference.json`（或独立 py 模块）。
2. 后端新增只读接口 `/api/object-reference/catalog`。
3. 前端删掉 fallback 重复数据，启动时拉取并缓存；后端不可用时禁用形态构建器并提示。

**伪代码**：

```python
# backend/main.py
import json, pathlib
_CATALOG_PATH = pathlib.Path(__file__).parent / "object_reference.json"

def load_catalog() -> dict:
    return json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))

@app.get("/api/object-reference/catalog")
def object_reference_catalog():
    return load_catalog()          # { archetypes: {...}, morphologyPlans: {...} }

@app.post("/api/object-reference/lookup")
def object_reference_lookup(req: LookupRequest):
    catalog = load_catalog()
    # 现有匹配逻辑不变，数据源从硬编码 dict 换成 catalog
    ...
```

```javascript
// frontend/js/wall-workspace.js — 启动时拉取，替代本地 fallback 数据
let remoteCatalog = null;

async function initObjectReference() {
  try {
    remoteCatalog = await fetch('/api/object-reference/catalog').then(r => r.json());
  } catch (e) {
    remoteCatalog = null;          // 后端不在：procedural 路线禁用
    console.warn('物象库不可用，形态构建器已禁用');
  }
}

function buildFallbackMorphologyPlan(subject) {
  if (!remoteCatalog) return null; // resolveProceduralBuilderKey 返回 null → 走 mesh-generate
  return remoteCatalog.morphologyPlans[subject] ?? null;
}
```

**验收**：重复数据只剩一份；改后端数据后前端行为随之变化，不改前端代码。

---

## P2 — 架构与可维护性

### TODO-9：拆分 wall-workspace.js 巨石

**背景**：7387 行单文件，环境/生物两条路径几乎逐行重复（`:848` vs `:950`、两个 generate 调用点 `:5231`/`:5446`）。

**步骤**（分小步，每步保持可运行，每抽一个模块跑一次手工回归）：
1. 先合并环境/生物两条近乎重复的路径为同函数 + 域参数。
2. 再按职责抽模块：`recognition.js` / `review.js` / `generation.js` / `placement.js` / `share.js`（ES module 或命名空间，与现有风格一致）。

**伪代码**（第 1 步合并，这是拆分的钥匙）：

```javascript
// 现状：generateEnvironmentFromSource(:848) 与 generateBiologyFromSource(:950) 逐行重复
// 合并后：
const DOMAIN_CONFIG = {
  environment: { endpoint: '/api/scene-lift/analyze', subject: 'environment',
                 cacheSlot: 'envLift', route: resolveGenerationRoute },
  biology:     { endpoint: '/api/scene-lift/analyze', subject: 'biology',
                 cacheSlot: 'bioLift', route: resolveGenerationRoute },
};

async function generateFromSource(domain) {
  const cfg = DOMAIN_CONFIG[domain];
  const image = state.source.dataUrl;
  const key = await hashImage(image, domain);
  if (state.sceneLiftCache[key]) return applyLiftResult(domain, state.sceneLiftCache[key]);

  setCardStatus(domain, 'analyzing');
  const result = await fetch(cfg.endpoint, {
    method: 'POST',
    body: JSON.stringify({ image, subject: cfg.subject }),
  }).then(r => r.json());

  state.sceneLiftCache[key] = result;
  return applyLiftResult(domain, result);
}

// 两个旧入口变成一行代理，调用方不用改：
const generateEnvironmentFromSource = () => generateFromSource('environment');
const generateBiologyFromSource     = () => generateFromSource('biology');
```

**验收**：单文件 < 2000 行；两域共用同一条 analyze→review→generate 路径。

### TODO-10：运行时配置持久化

**背景**：`os.environ` 被当配置存储（`backend/main.py:474`、`:964`、`:973`），重启即失；已知坑：`backend/config.json` 持久化旧值会覆盖前端新默认值。

**步骤**：
1. worker 地址等运行时配置改为读写 `backend/runtime.json`。
2. 明确优先级：前端默认 < config.json < 显式环境变量，写进 README。
3. 生产模式去掉 `--reload` 或加 watch 排除。

**伪代码**：

```python
# backend/runtime_config.py（新建）
import json, os, pathlib

_RUNTIME_PATH = pathlib.Path(__file__).parent / "runtime.json"

def get_runtime(key: str, default=None):
    # 显式环境变量最高优先
    if env := os.environ.get(key):
        return env
    if _RUNTIME_PATH.exists():
        return json.loads(_RUNTIME_PATH.read_text()).get(key, default)
    return default

def set_runtime(key: str, value: str):
    data = json.loads(_RUNTIME_PATH.read_text()) if _RUNTIME_PATH.exists() else {}
    data[key] = value
    _RUNTIME_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))

# backend/main.py — 两个 /config 端点改为：
@app.post("/api/trellis2/config")
def set_trellis2_config(req: ConfigRequest):
    set_runtime("TRELLIS2_URL", req.url)
    return {"ok": True, "url": get_runtime("TRELLIS2_URL")}
```

**验收**：改配置 → 重启 → 配置仍在；`start.sh` 全新启动行为一致。

### TODO-11：embedder 模型路径可配置

**背景**：硬编码 glob `~/.cache/huggingface/hub/models--stabilityai--TripoSR/...`（`tools/scene_lift_worker.py:950-955`），换机即断。

**步骤**：checkpoint 路径改 env `EMBEDDER_CHECKPOINT`，默认走 HF 缓存解析 API；找不到时禁用 embed 而非崩溃。

**伪代码**：

```python
# tools/scene_lift_worker.py
import os
from pathlib import Path

def resolve_embedder_checkpoint() -> Path | None:
    if env := os.environ.get("EMBEDDER_CHECKPOINT"):
        p = Path(env).expanduser()
        return p if p.exists() else None
    try:
        from huggingface_hub import try_to_load_from_cache
        hit = try_to_load_from_cache("stabilityai/TripoSR", "model.ckpt")
        return Path(hit) if hit and hit != "_no_exist" else None
    except Exception:
        return None

_embedder = None
def get_embedder():
    global _embedder
    if _embedder is None:
        ckpt = resolve_embedder_checkpoint()
        if ckpt is None:
            return None                      # 调用方：embed 功能返回 503 + 明确信息
        _embedder = build_dino_from_triposr_ckpt(ckpt)   # 现有剥离逻辑
    return _embedder

@app.post("/embed")
def embed(req: EmbedRequest):
    embedder = get_embedder()
    if embedder is None:
        raise HTTPException(503, "embedder 不可用：请设置 EMBEDDER_CHECKPOINT")
    ...
```

**验收**：删掉硬编码 glob；缓存路径变更后仅改 env 即可恢复。

### TODO-12：死代码与遗留链路清理

**背景**：`tools/img2relief.py` 孤儿；`tools/gen_models.sh` 目标目录只剩 `.blend`，`bird.js:117`/`scenery.js:22` 的 `hasModel/loadGLB` 永远落空；`completeLayerModels`/`buildImageLockedEnvironment` 无调用方；两个 `/config` 接口 UI 已不暴露。

**伪代码**（清理 checklist，逐项执行）：

```bash
# 每项先验证无引用，再删
git grep -n "img2relief" -- . ':!tools/img2relief.py'        # 预期无输出 → rm tools/img2relief.py
git grep -n "completeLayerModels" frontend/js/               # 确认仅定义无调用 → 删函数
git grep -n "buildImageLockedEnvironment" frontend/js/       # 同上
git grep -n "hasModel\|loadGLB" frontend/js/bird.js frontend/js/scenery.js
#   → 决定：补 GLB 资产，或删 loadGLB 分支直接走程序化（推荐后者，符合现状）
git grep -n "scene-lift/config\|trellis2/config" frontend/   # UI 无引用 → 删后端端点
# 运行产物移出版本控制：
echo "tools/out/\ntools/e2e/\nfrontend/scenes/*.json" >> .gitignore
git rm -r --cached tools/e2e tools/out 2>/dev/null
```

**验收**：`git grep` 无残留引用；仓库不再跟踪运行产物。

### TODO-13：观测与统计

**步骤**：worker 与后端各加极简 metrics（内存 dict + `/metrics` 端点）：p50/p95 耗时、缓存命中率、各生成路径触发数、引擎实际生效档位。前端状态区展示。

**伪代码**：

```python
# tools/metrics.py（新建，两 worker + backend 各引一份）
import threading, time
from collections import defaultdict

class Metrics:
    def __init__(self):
        self._mu = threading.Lock()
        self._durations = defaultdict(list)   # name -> [seconds]
        self._counters = defaultdict(int)     # name -> count

    def observe(self, name: str, seconds: float):
        with self._mu:
            self._durations[name].append(seconds)

    def count(self, name: str, n: int = 1):
        with self._mu:
            self._counters[name] += n

    def snapshot(self) -> dict:
        with self._mu:
            def pct(xs, p):
                xs = sorted(xs)
                return xs[min(len(xs) - 1, int(len(xs) * p))] if xs else 0
            return {
                "durations": {k: {"n": len(v), "p50": pct(v, .5), "p95": pct(v, .95)}
                              for k, v in self._durations.items()},
                "counters": dict(self._counters),
            }

metrics = Metrics()

# 使用点：
#   scene_lift_worker: metrics.observe("analyze", elapsed);
#                      metrics.count("cache.hit" / "cache.miss");
#                      metrics.count(f"segmenter.{active_name}")
#   trellis2_worker:   metrics.observe("generate", elapsed);
#                      metrics.count(f"engine.{engine}")   # trellis2 / triposr
#   前端 trackRouteHit(route) → POST /api/metrics/count（backend 代收）
```

**验收**：一次完整流程后，metrics 能回答「识别用了哪档、3D 走了哪条路、各花多久」。

---

## 实施顺序建议

1. TODO-1 → TODO-2 → TODO-3（性能三件套，互不冲突，可并行评审）
2. TODO-5 → TODO-6 → TODO-7（质量与接通，依赖 P0 的缓存与并发）
3. TODO-8 → TODO-9（数据单一来源先行，降低巨石拆分时的漂移面）
4. TODO-4（进度推送，依赖 TODO-3 的任务化改造）
5. TODO-10 → TODO-11 → TODO-12 → TODO-13（收尾，随时可插入）

## 明确不做（本轮）

- 不引入新的 3D 生成模型/服务（TRELLIS.2 需 CUDA，本机不可达，保持 auto 兜底）。
- 不重构语音对话线（GPT-SoVITS 等与本管线无关）。
- 「伪 4DGS 点云」保留为环境默认轻量路径，本轮只变为可选策略（TODO-7），不替换实现。
- 两套「识别」并存问题（`frontend/js/imageAnalysis.js` 实验室离线版 vs 服务端管线）本轮只记录，不合并。
