"""世界古典美术拟生平台 · 后端服务

- 托管 frontend/ 静态页面（3D 场景与系统配置页）
- /api/config：场景与生态配置的读写（持久化到 backend/config.json）
"""
from __future__ import annotations

import copy
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, Body, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from backend.runtime_config import get_runtime, set_runtime

# Metrics helper lives under tools/; allow import when running as uvicorn backend.main:app
_TOOLS = Path(__file__).resolve().parent.parent / "tools"
if str(_TOOLS) not in sys.path:
    sys.path.insert(0, str(_TOOLS))
from metrics import metrics  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
TIGER_MESSENGER = ROOT / "TigerMessenger"
CONFIG_PATH = Path(__file__).resolve().parent / "config.json"
SPECIES_PATH = Path(__file__).resolve().parent / "species.json"
OBJECT_REFERENCE_PATH = Path(__file__).resolve().parent / "object_reference.json"


def _load_local_env() -> None:
    """开发机直启 uvicorn 时也加载被 git 忽略的 .env.local；不覆盖显式进程环境。"""
    path = ROOT / ".env.local"
    if not path.exists():
        return
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[7:].strip()
            key, value = line.split("=", 1)
            key = key.strip()
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                os.environ.setdefault(key, value.strip().strip("'\""))
    except OSError:
        pass


_load_local_env()

_PROXY_TIMEOUT = httpx.Timeout(connect=5.0, read=900.0, write=30.0, pool=5.0)
_proxy_client: httpx.AsyncClient | None = None


def get_proxy_client() -> httpx.AsyncClient:
    global _proxy_client
    if _proxy_client is None:
        _proxy_client = httpx.AsyncClient(timeout=_PROXY_TIMEOUT)
    return _proxy_client


def _load_object_reference_store() -> dict[str, Any]:
    if not OBJECT_REFERENCE_PATH.exists():
        return {"archetypes": {}, "morphologyPlans": {}, "subjectKeys": {}, "biologyKeys": {}}
    try:
        data = json.loads(OBJECT_REFERENCE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {"archetypes": {}, "morphologyPlans": {}, "subjectKeys": {}, "biologyKeys": {}}
    except (OSError, json.JSONDecodeError):
        return {"archetypes": {}, "morphologyPlans": {}, "subjectKeys": {}, "biologyKeys": {}}


_OBJECT_REF_STORE = _load_object_reference_store()
OBJECT_REFERENCE_CATALOG: dict[str, dict[str, Any]] = dict(_OBJECT_REF_STORE.get("archetypes") or {})

# 与 frontend/js/config.js 中的 DEFAULT_CONFIG 保持一致
DEFAULT_CONFIG: dict[str, Any] = {
    "scene": {
        "bambooCount": 90,        # 竹林密度
        "mist": 0.6,              # 雾气浓度 0~1
        "goldBackground": True,   # 金笺纸底色（屏风质感）
    },
    "weather": {
        "temperature": -5.0,      # 温度（℃）：> 0 下雨，<= 0 下雪
        "snowfall": 1.0,          # 降水强度 0~2
        "wind": 0.3,              # 风力（竹子摆动、雨雪漂移）
        "windDirection": 0.0,     # 风向（度）：0=北(+Z) 90=东(+X)
    },
    "tiger": {
        "speed": 1.0,             # 巡游速度倍率
        "patrolRadius": 1.0,      # 巡游范围倍率
        "stripeContrast": 1.0,    # 斑纹对比度
        "tailCurl": True,         # 经过竹竿时尾巴缠绕
        "furLength": 1.0,         # 皮毛长度倍率（壳层纹理）
        "furLayers": 12,          # 皮毛壳层数（2~24）
        "pauseInterval": 16.0,    # 驻足平均间隔（秒）
        "pauseDuration": 2.4,     # 驻足时长（秒）
        "tailCurlDistance": 1.75, # 缠竹触发距离（米）
    },
    "bamboo": {
        "stiffness": 3.0,         # 回正刚度（角速度增益）
        "sway": 1.0,              # 风摆幅度倍率
    },
    "pheasant": {
        "enabled": True,
        "count": 5,             # 锦鸡数量（0~6）
        "fleeDistance": 6.0,    # 警戒距离：虎进入即惊飞
        "returnDistance": 14.0, # 虎远离至此距离后飞回
        "drinkInterval": 25.0,  # 饮水间隔（秒）
        "perchTime": 4.0,       # 惊飞后最少停留（秒）
        "alertDistance": 10.0,  # 警觉距离（>fleeDistance 时冻结观察）
        "runDuration": 1.2,     # 拍翅奔逃时长（秒），之后惊飞
        "respawnDelay": 20.0,   # 被获后重生延时（秒）
    },
    "hunt": {                   # 虎捕食（仅当背景音乐为触发曲目时开启）
        "enabled": True,
        "musicTrigger": "duange_xing.mp3",  # 触发曲目（子串匹配）
        "stalkDistance": 40.0,  # 发现猎物距离（开始潜行）
        "stalkSpeed": 0.45,     # 潜行速度倍率
        "sprintDistance": 20.0, # 爆发距离（20m 起冲刺）
        "sprintSpeed": 3.0,     # 冲刺速度倍率
        "pounceDistance": 10.0, # 飞扑距离（10m 起跳，落点即猎物）
        "feedDuration": 6.0,    # 进食时长（秒）
        "cooldown": 15.0,       # 捕食间隔（秒）
        "sfxVolume": 0.8,       # 虎啸音效音量（0~1）
    },
    "agentLlm": {               # 所有生物智能体共用；密钥由后端进程环境持有
        "enabled": True,
        "endpoint": "/api/llm/chat",
        "model": "glm-5.1",
    },
    "dialog": {                 # 母女对话（虎为女、兔为母）：由智能体意图触发
        "enabled": True,
        "interval": 26,         # 触发间隔（秒）
        "daughter": {           # 虎（女儿）
            "voiceName": "auto",    # 嗓音：auto 自动选中文女声
            "voiceRate": 1.0,       # 语速
            "voicePitch": 1.05,     # 音高（略低嫩）
            "voiceVolume": 0.9,     # 音量 0~1
            "llmEndpoint": "/api/llm/chat",  # 走同源后端，浏览器不接触密钥
            "llmApiKey": "",
            "llmModel": "glm-5.1",
        },
        "mother": {             # 兔（母亲）
            "voiceName": "auto",
            "voiceRate": 1.0,
            "voicePitch": 1.2,      # 音高（偏高柔）
            "voiceVolume": 0.9,
            "llmEndpoint": "/api/llm/chat",
            "llmApiKey": "",
            "llmModel": "glm-5.1",
        },
    },
    "sceneEdit": {
        "llmEndpoint": "/api/llm/chat",
        "llmApiKey": "",
        "llmModel": "glm-5.1",
    },
    # 物种关系矩阵：参考 Tu & Terzopoulos《Artificial Fishes》的
    # predator-prey / 内驱力（fear, hunger）模型
    "ecology": {
        # 逻辑接口预留：目前只标记，不强行改变捕食状态机。
        "agentMarks": {
            "tiger": {"displayName": "斑阑", "foodChainLevel": "apex", "tags": ["food-chain-apex"]},
            "rabbit": {"displayName": "母亲", "foodChainLevel": "apex", "tags": ["food-chain-apex"]},
        },
        "relations": [
            {"a": "tiger", "b": "pheasant", "type": "predator-prey", "drive": "fear",
             "strength": 0.7, "note": "锦鸡对虎保持警戒，进入警戒距离即惊飞"},
            {"a": "tiger", "b": "bamboo", "type": "physical", "drive": "none",
             "strength": 1.0, "note": "虎身挤开竹竿，尾巴缠绕竹竿"},
            {"a": "pheasant", "b": "stream", "type": "resource", "drive": "thirst",
             "strength": 0.5, "note": "锦鸡定时到涧水边饮水"},
        ]
    },
    "style": {
        "inkOutline": False,      # 水墨勾线（预留）
        "cameraPreset": "panorama",
    },
    "plum": {                     # 《寒梅归雁图》场景（独立配置页 plum-config.html）
        "blossomDensity": 1.0,    # 梅花花量倍率
        "petalCount": 220,        # 落花瓣数量
        "reedClusters": 12,       # 塘岸芦苇丛数
        "restGeese": 3,           # 塘边休息大雁数量
        "flockGeese": 5,          # 空中归飞雁群数量（含领头雁）
        "gooseScale": 2.5,        # 大雁体型倍率
        "circuitTime": 38,        # 归飞盘旋时长（秒）
        "circuitAlt": 13,         # 盘旋高度（米）
        "groundedTime": 42,       # 游水/岸栖时长（秒）
        "mist": 0.55,             # 雾气浓度 0~1
        "snowfall": 0.35,         # 薄雪强度 0~2（0=无雪）
        "wind": 0.25,             # 风力（梅枝轻颤、雪飘）
        "windDirection": 0,       # 风向（度）：0=北(+Z) 90=东(+X)
        "cameraPreset": "panorama",  # 初始机位：panorama/plum/pond/flight/mountains
        "rocks": {                  # 梅树附近山石（独立石 A/B/C + 护根盘石挪开位）
            "solo0": {"x": -3.5, "z": 14.1, "sink": 0.0, "tilt": 0.0},
            "solo1": {"x": -14.0, "z": 19.3, "sink": 0.33, "tilt": 30.0},  # 画面最左侧
            "solo2": {"x": -2.8, "z": 18.5, "sink": 0.33, "tilt": 30.0},   # 梅右前方
            "root": {"x": -18.0, "z": 10.0, "sink": 0.0, "tilt": 0.0},  # 护根盘石（近根者）挪开落点
        },
        "bamboo": {                 # 梅下小竹
            "count": 5,             # 每丛竹数
            "lean": 12,             # 最大倾斜角（度，各竿随机不超过此值）
            "clumps": [             # 丛位（X/Z，可增减丛数）
                {"x": -14.0, "z": 11.5},
                {"x": -4.0, "z": 12.5},
                {"x": -10.0, "z": 13.0},
            ],
        },
    },
    # sculpt | pointcloud | mesh | auto — 环境物象 3D 主路径（img2threejs 集成：默认 sculpt）
    "environmentModel": "sculpt",
    # sculpt | procedural | mesh — 生物物象 3D 主路径
    "biologyModel": "sculpt",
    "bgm": {
        "volume": 0.5,            # 背景音乐音量 0~1
        "playlist": [             # 歌单（顺序循环）
            "assets/audio/bgm.mp3",
            "assets/audio/duange_xing.mp3",
        ],
    },
}


def _merge(base: dict, override: dict) -> dict:
    """递归合并：override 覆盖 base，未知键丢弃。"""
    out = copy.deepcopy(base)
    for k, v in (override or {}).items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _merge(out[k], v)
        elif k in out:
            out[k] = v
    return out


def _with_agent_llm_defaults(config: dict[str, Any]) -> dict[str, Any]:
    """让旧存档中的空 LLM 字段继承统一智能体代理，且不把服务端密钥下发给浏览器。"""
    shared = config.get("agentLlm") or {}
    endpoint = str(shared.get("endpoint") or "/api/llm/chat")
    model = str(shared.get("model") or os.environ.get("LLM_MODEL") or "glm-5.1")
    dialog = config.get("dialog") or {}
    for role in ("daughter", "mother"):
        role_config = dialog.get(role)
        if isinstance(role_config, dict):
            role_config["llmEndpoint"] = role_config.get("llmEndpoint") or endpoint
            role_config["llmModel"] = role_config.get("llmModel") or model
            role_config["llmApiKey"] = ""
    scene_edit = config.get("sceneEdit")
    if isinstance(scene_edit, dict):
        scene_edit["llmEndpoint"] = scene_edit.get("llmEndpoint") or endpoint
        scene_edit["llmModel"] = scene_edit.get("llmModel") or model
        scene_edit["llmApiKey"] = ""
    return config


def load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            saved = json.loads(CONFIG_PATH.read_text("utf-8"))
            # 迁移：旧版 scene.snowfall / scene.wind 并入 weather 栏目
            scene = saved.get("scene") or {}
            if "weather" not in saved and ("snowfall" in scene or "wind" in scene):
                saved["weather"] = {
                    k: v for k, v in
                    (("snowfall", scene.get("snowfall")), ("wind", scene.get("wind")))
                    if v is not None
                }
            # 迁移：旧版 dialog 平铺语音/大模型键 → 母女各自分组
            # （语音键原为共用，并入双方；llm 键原仅母亲应答用，并入母亲）
            dlg = saved.get("dialog") or {}
            if "daughter" not in dlg and "mother" not in dlg:
                voice_keys = ("voiceName", "voiceRate", "voicePitch", "voiceVolume")
                llm_keys = ("llmEndpoint", "llmApiKey", "llmModel")
                if any(k in dlg for k in voice_keys + llm_keys):
                    voice = {k: dlg[k] for k in voice_keys if k in dlg}
                    dlg["daughter"] = dict(voice)
                    dlg["mother"] = {**voice, **{k: dlg[k] for k in llm_keys if k in dlg}}
                    for k in voice_keys + llm_keys:
                        dlg.pop(k, None)
                saved["dialog"] = dlg
            return _with_agent_llm_defaults(_merge(DEFAULT_CONFIG, saved))
        except (json.JSONDecodeError, OSError):
            pass
    return _with_agent_llm_defaults(copy.deepcopy(DEFAULT_CONFIG))


app = FastAPI(title="世界古典美术拟生平台", version="0.1.0")

@app.on_event("shutdown")
async def _close_proxy_client() -> None:
    global _proxy_client
    if _proxy_client is not None:
        await _proxy_client.aclose()
        _proxy_client = None


@app.get("/api/object-reference/catalog")
def object_reference_catalog() -> JSONResponse:
    """Single source of truth for archetypes + morphology plans + sculpt templates."""
    store = _load_object_reference_store()
    return JSONResponse(
        {
            "version": store.get("version", 1),
            "archetypes": store.get("archetypes") or {},
            "morphologyPlans": store.get("morphologyPlans") or {},
            "sculptTemplates": store.get("sculptTemplates") or {},
            "subjectKeys": store.get("subjectKeys") or OBJECT_REFERENCE_SUBJECT_KEYS,
            "biologyKeys": store.get("biologyKeys") or OBJECT_REFERENCE_BIOLOGY_KEYS,
        }
    )


@app.get("/api/metrics")
def api_metrics() -> dict:
    snap = metrics.snapshot()
    snap["workers"] = {
        "trellis2": _trellis2_server_url() or None,
        "sceneLift": _scene_lift_server_url() or None,
        "sculpt": _sculpt_server_url() or None,
    }
    return snap


@app.post("/api/metrics/count")
def api_metrics_count(payload: dict = Body(...)) -> dict:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    n = int(payload.get("n") or 1)
    metrics.count(name, n)
    return {"ok": True, "name": name, "n": n}



@app.middleware("http")
async def no_cache_static(request, call_next):
    """开发期：HTML/JS 不缓存，刷新即最新（模型文件保留缓存）。"""
    resp = await call_next(request)
    if request.url.path.endswith((".html", ".js")) or request.url.path == "/":
        resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/api/config")
def get_config() -> JSONResponse:
    return JSONResponse(load_config())


@app.put("/api/config")
def put_config(payload: dict = Body(...)) -> JSONResponse:
    merged = _with_agent_llm_defaults(_merge(DEFAULT_CONFIG, payload))
    CONFIG_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), "utf-8")
    return JSONResponse({"ok": True, "config": merged})


@app.post("/api/config/reset")
def reset_config() -> JSONResponse:
    if CONFIG_PATH.exists():
        CONFIG_PATH.unlink()
    return JSONResponse({"ok": True, "config": copy.deepcopy(DEFAULT_CONFIG)})


@app.get("/api/species")
def get_species() -> JSONResponse:
    """读物种实验室的自定义物种记录；无存档返回 {"species": null}。"""
    if SPECIES_PATH.exists():
        try:
            return JSONResponse({"species": json.loads(SPECIES_PATH.read_text("utf-8"))})
        except (json.JSONDecodeError, OSError):
            pass
    return JSONResponse({"species": None})


@app.put("/api/species")
def put_species(payload: dict = Body(...)) -> JSONResponse:
    """整体覆写物种记录（schema 由 frontend/js/species.js 前端兜底，不做 DEFAULT 合并）。"""
    SPECIES_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), "utf-8")
    return JSONResponse({"ok": True})


@app.get("/api/models")
def list_models() -> dict:
    models_dir = FRONTEND / "assets" / "models"
    names = sorted(p.name for p in models_dir.glob("*.glb")) if models_dir.exists() else []
    return {"models": names}


@app.get("/api/audio")
def list_audio() -> dict:
    """曲库清单：frontend/assets/audio/ 下的可入歌单音频（mp3/ogg）。"""
    audio_dir = FRONTEND / "assets" / "audio"
    files = []
    if audio_dir.exists():
        files = sorted(
            "assets/audio/" + p.name
            for p in audio_dir.iterdir()
            if p.suffix.lower() in (".mp3", ".ogg")
        )
    return {"files": files}


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/llm/status")
def llm_status() -> dict:
    """统一智能体 LLM 状态；永不返回 API Key。"""
    return {
        "available": bool(str(get_runtime("LLM_API_KEY", "") or "").strip()),
        "provider": _llm_base_url(),
        "model": str(get_runtime("LLM_MODEL", "glm-5.1") or "glm-5.1"),
        "proxy": "/api/llm/chat",
    }


@app.post("/api/llm/chat")
async def llm_chat(payload: dict = Body(...)) -> JSONResponse:
    """同源 OpenAI 兼容代理：所有智能体共用，浏览器端不保存供应商密钥。"""
    api_key = str(get_runtime("LLM_API_KEY", "") or "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="统一智能体 LLM 未配置：服务端缺少 LLM_API_KEY")
    raw_messages = payload.get("messages")
    if not isinstance(raw_messages, list) or not raw_messages:
        raise HTTPException(status_code=400, detail="messages 必须是非空数组")
    messages: list[dict[str, str]] = []
    for item in raw_messages[:24]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "user")
        content = item.get("content")
        if role not in {"system", "user", "assistant"} or not isinstance(content, str):
            continue
        messages.append({"role": role, "content": content[:12000]})
    if not messages:
        raise HTTPException(status_code=400, detail="messages 中没有可用消息")

    model = str(get_runtime("LLM_MODEL", "glm-5.1") or "glm-5.1")
    max_tokens = max(32, min(int(payload.get("max_tokens") or 400), 1600))
    temperature = max(0.0, min(float(payload.get("temperature") or 0.75), 1.5))
    upstream_body = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    try:
        upstream = await get_proxy_client().post(
            _llm_chat_url(),
            json=upstream_body,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            timeout=httpx.Timeout(connect=8.0, read=90.0, write=20.0, pool=5.0),
        )
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail="智能体 LLM 服务不可达") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="智能体 LLM 响应超时") from exc
    if upstream.status_code >= 400:
        detail = upstream.text[:600]
        raise HTTPException(status_code=upstream.status_code, detail=detail or "智能体 LLM 请求失败")
    try:
        data = upstream.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="智能体 LLM 返回的不是 JSON") from exc
    choices = data.get("choices") if isinstance(data, dict) else None
    if not isinstance(choices, list):
        raise HTTPException(status_code=502, detail="智能体 LLM 返回缺少 choices")
    return JSONResponse(
        {
            "id": data.get("id"),
            "model": data.get("model") or model,
            "choices": choices,
            "usage": data.get("usage"),
            "agent": payload.get("agent"),
        }
    )


SCENES_DIR = FRONTEND / "scenes"


@app.post("/api/scene/share")
def scene_share_create(payload: dict = Body(...)) -> dict:
    """保存拟生配置（含原作图），返回短 id 分享链接。跨浏览器可打开。"""
    import hashlib

    config = payload.get("config")
    if not isinstance(config, dict) or not config.get("layers"):
        raise HTTPException(status_code=400, detail="config 必须包含 layers")
    raw = json.dumps(config, ensure_ascii=False).encode("utf-8")
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="配置超过 12 MB")
    scene_id = hashlib.sha1(raw + str(time.time()).encode()).hexdigest()[:10]
    SCENES_DIR.mkdir(parents=True, exist_ok=True)
    (SCENES_DIR / f"{scene_id}.json").write_bytes(raw)
    return {"id": scene_id, "url": f"scene.html?id={scene_id}"}


@app.get("/api/scene/share/{scene_id}")
def scene_share_read(scene_id: str) -> Response:
    if not re.fullmatch(r"[0-9a-f]{6,16}", scene_id or ""):
        raise HTTPException(status_code=400, detail="无效的场景 id")
    path = SCENES_DIR / f"{scene_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="场景不存在或已过期")
    return Response(content=path.read_bytes(), media_type="application/json")


def _probe_local_worker(port: int, timeout: float = 0.6) -> bool:
    """探测本机 worker 健康端点；程序自动连接，无需用户在页面配置服务地址。"""
    try:
        req = urllib.request.Request(f"http://127.0.0.1:{port}/health", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            info = json.loads(resp.read().decode("utf-8"))
        return resp.status == 200 and info.get("status") == "ok"
    except Exception:
        return False


def _auto_connect(env_var: str, default_port: int) -> str:
    # Priority: explicit env > runtime.json > localhost probe
    url = str(get_runtime(env_var, "") or "").strip().rstrip("/")
    if url:
        return url
    candidate = f"http://127.0.0.1:{default_port}"
    if _probe_local_worker(default_port):
        # Cache discovery in-process only; do not pollute runtime.json
        os.environ[env_var] = candidate
        return candidate
    return ""


def _trellis2_server_url() -> str:
    """Optional GPU worker; kept server-side so browsers never receive infrastructure URLs."""
    return _auto_connect("TRELLIS2_SERVER_URL", 7862)


def _scene_lift_server_url() -> str:
    """Geometry/segmentation worker that preserves the artwork's pixel coordinates."""
    return _auto_connect("SCENE_LIFT_SERVER_URL", 7863)


def _sculpt_server_url() -> str:
    """SculptSpec worker (static-builder plan for procedural Three.js)."""
    return _auto_connect("SCULPT_SERVER_URL", 7864)


def _object_reference_server_url() -> str:
    """Optional LLM/RAG lookup that describes the real-world object before 2D→3D generation."""
    return str(get_runtime("LLM_OBJECT_REFERENCE_URL", "") or "").strip().rstrip("/")


def _llm_base_url() -> str:
    """OpenAI-compatible provider base URL; credentials remain server-side."""
    return str(get_runtime("LLM_BASE_URL", "https://models.sjtu.edu.cn/api/v1") or "").strip().rstrip("/")


def _llm_chat_url() -> str:
    base = _llm_base_url()
    return base if base.endswith("/chat/completions") else f"{base}/chat/completions"


async def _proxy_request(
    method: str,
    base_url: str,
    path: str,
    *,
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: httpx.Timeout | None = None,
) -> httpx.Response:
    client = get_proxy_client()
    url = f"{base_url.rstrip('/')}{path}"
    try:
        return await client.request(
            method,
            url,
            content=body,
            headers=headers or {},
            timeout=timeout or _PROXY_TIMEOUT,
        )
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail=f"worker unreachable: {base_url}") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail=f"worker timeout: {base_url}") from exc


OBJECT_REFERENCE_SUBJECT_KEYS = {
    "mountain": "terrain",
    "rock": "terrain",
    "earth": "terrain",
    "slope": "terrain",
    "brook-bank": "terrain",
    "ravine": "terrain",
    "peak": "terrain",
    "range": "terrain",
    "pine": "pine",
    "bamboo": "bamboo",
    "plum": "plum",
    "orchid": "flower",
    "chrysanthemum": "flower",
    "calamus": "reed",
    "reed": "reed",
    "shore-herb": "flower",
    "ting-orchid": "flower",
    "wisteria": "vine",
    "lotus-bloom": "lotus",
    "lotus": "lotus",
    "camellia": "flower",
    "azalea": "flower",
    "daylily": "flower",
    "hibiscus": "flower",
    "brook": "water",
    "ripples": "water",
    "river": "water",
    "lake": "water",
    "waves": "water",
    "cascade": "water",
}


OBJECT_REFERENCE_BIOLOGY_KEYS = {
    "digitigrade": "quadruped",
    "unguligrade": "ungulate",
    "saltatorial": "rabbit",
    "avian": "bird",
    "fish": "fish",
    "insect": "insect",
}

# Prefer single-source JSON when present
if _OBJECT_REF_STORE.get("subjectKeys"):
    OBJECT_REFERENCE_SUBJECT_KEYS = dict(_OBJECT_REF_STORE["subjectKeys"])
if _OBJECT_REF_STORE.get("biologyKeys"):
    OBJECT_REFERENCE_BIOLOGY_KEYS = dict(_OBJECT_REF_STORE["biologyKeys"])



def _object_reference_key(subject: dict[str, Any], profile: dict[str, Any] | None = None) -> str:
    subject_id = str(subject.get("id") or subject.get("subject") or "").lower()
    subject_kind = str(subject.get("kind") or "").lower()
    subject_domain = str(subject.get("domain") or "").lower()
    prompt = str(subject.get("prompt") or "").lower()
    profile_kind = str((profile or {}).get("kind") or "").lower()

    if subject_kind in OBJECT_REFERENCE_BIOLOGY_KEYS:
        return OBJECT_REFERENCE_BIOLOGY_KEYS[subject_kind]
    if subject_id in OBJECT_REFERENCE_SUBJECT_KEYS:
        return OBJECT_REFERENCE_SUBJECT_KEYS[subject_id]
    if "biology" in subject_domain or subject_id.startswith("biology-"):
        for marker, key in (
            ("goose", "bird"),
            ("crane", "bird"),
            ("bird", "bird"),
            ("fish", "fish"),
            ("butterfly", "insect"),
            ("tiger", "quadruped"),
            ("rabbit", "rabbit"),
            ("deer", "ungulate"),
            ("horse", "ungulate"),
        ):
            if marker in prompt or marker in subject_id:
                return key
        return "quadruped"
    if subject_domain == "water" or profile_kind == "water-surface":
        return "water"
    if subject_domain == "terrain" or profile_kind == "terrain-mass":
        return "terrain"
    if profile_kind in ("vertical-stem", "reed-bank"):
        return "bamboo" if "bamboo" in prompt or "竹" in str(subject.get("label") or "") else "reed"
    if profile_kind == "branch-vine":
        return "vine" if "wisteria" in prompt else "plum"
    return "flower" if subject_domain == "plants" else "terrain"


def _local_object_reference(subject: dict[str, Any], profile: dict[str, Any] | None = None) -> dict[str, Any]:
    key = _object_reference_key(subject, profile)
    base = copy.deepcopy(OBJECT_REFERENCE_CATALOG.get(key) or OBJECT_REFERENCE_CATALOG["terrain"])
    base.update(
        {
            "key": key,
            "source": "local-catalog",
            "llmUsed": False,
            "subjectId": subject.get("id"),
            "subjectLabel": subject.get("label"),
            "profileKind": (profile or {}).get("kind"),
            "morphologyPlan": _morphology_plan_for_key(key, subject, profile),
        }
    )
    template = (_OBJECT_REF_STORE.get("sculptTemplates") or {}).get(key)
    if template:
        base["sculptTemplate"] = copy.deepcopy(template)
    return base


def _morphology_plan_for_key(key: str, subject: dict[str, Any], profile: dict[str, Any] | None = None) -> dict[str, Any]:
    """Translate real-world morphology into a Three.js component plan.

    Plans live in backend/object_reference.json (single source of truth).
    An external LLM/RAG response may still override the plan at lookup time.
    """
    base = {
        "version": 1,
        "planner": "llm-physical-morphology",
        "renderer": "threejs-procedural",
        "policy": "componentized-volumetric-model-not-cutout",
        "subjectId": subject.get("id"),
        "profileKind": (profile or {}).get("kind"),
        "fit": {"preserveArtworkAnchor": True, "useMaskAsScaleOnly": True},
    }
    plans: dict[str, dict[str, Any]] = _OBJECT_REF_STORE.get("morphologyPlans") or {}
    selected = plans.get(key)
    if selected is None and key == "plum":
        selected = plans.get("flower")
    if selected is None:
        selected = {
            "archetype": f"{key} object with separate physical parts",
            "components": [
                {"type": "bodyVolume", "role": "main-volume", "count": 1, "radius": 0.25, "height": 0.38},
                {"type": "supportDetail", "role": "secondary-parts", "count": 4, "radius": 0.035, "length": 0.22},
            ],
            "constraints": ["build separate connected components, never a flat mask board"],
        }
    return {**base, **copy.deepcopy(selected)}


def _merge_reference(base: dict[str, Any], override: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(override, dict):
        return base
    out = copy.deepcopy(base)
    for key, value in override.items():
        if value in (None, "", [], {}):
            continue
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key].update(value)
        else:
            out[key] = value
    out["source"] = "llm+local-catalog"
    out["llmUsed"] = True
    return out


def _external_object_reference_lookup(payload: dict[str, Any]) -> tuple[dict[str, Any] | None, list[str]]:
    server = _object_reference_server_url()
    if not server:
        return None, []
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    api_key = os.environ.get("LLM_OBJECT_REFERENCE_API_KEY", "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(server, data=body, method="POST", headers=headers)
    timeout = float(os.environ.get("LLM_OBJECT_REFERENCE_TIMEOUT", "20"))
    try:
        with urllib.request.urlopen(request, timeout=timeout) as upstream:
            raw = upstream.read()
        result = json.loads(raw.decode("utf-8"))
        if isinstance(result, dict):
            return result, []
        return None, ["LLM 物象检索服务返回的不是 JSON 对象，已使用本地物象库"]
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        return None, [f"LLM 物象检索失败 HTTP {exc.code}: {detail or exc.reason}；已使用本地物象库"]
    except (OSError, ValueError, urllib.error.URLError) as exc:
        return None, [f"LLM 物象检索未就绪：{exc}；已使用本地物象库"]


def _external_reference_for_layer(external: dict[str, Any] | None, layer_id: str) -> dict[str, Any] | None:
    if not isinstance(external, dict):
        return None
    references = external.get("references")
    if isinstance(references, dict) and isinstance(references.get(layer_id), dict):
        return references[layer_id]
    items = external.get("items")
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and str(item.get("layerId") or item.get("id")) == layer_id:
                return item.get("reference") if isinstance(item.get("reference"), dict) else item
    reference = external.get("reference")
    return reference if isinstance(reference, dict) else None


@app.get("/api/object-reference/status")
def object_reference_status() -> dict:
    server = _object_reference_server_url()
    return {
        "available": True,
        "engine": "llm+local-catalog" if server else "local-catalog",
        "model": os.environ.get("LLM_OBJECT_REFERENCE_MODEL", "external-llm-rag" if server else "built-in physical archetype catalog"),
        "llmConfigured": bool(server),
        "reason": None if server else "未设置 LLM_OBJECT_REFERENCE_URL；使用内置物象常识库约束 2D→3D",
    }


@app.post("/api/object-reference/lookup")
def object_reference_lookup(payload: dict = Body(...)) -> JSONResponse:
    subject = payload.get("subject")
    layers = payload.get("layers")
    if not isinstance(subject, dict):
        raise HTTPException(status_code=400, detail="subject 必须包含当前识别对象")
    if not isinstance(layers, list):
        raise HTTPException(status_code=400, detail="layers 必须是候选对象列表")

    references: dict[str, dict[str, Any]] = {}
    slim_layers: list[dict[str, Any]] = []
    for index, layer in enumerate(layers):
        if not isinstance(layer, dict):
            continue
        layer_id = str(layer.get("id") or f"layer-{index}")
        profile = layer.get("reconstructionProfile") if isinstance(layer.get("reconstructionProfile"), dict) else None
        references[layer_id] = _local_object_reference(subject, profile)
        slim_layers.append(
            {
                "id": layer_id,
                "label": layer.get("label"),
                "bbox": layer.get("bbox"),
                "coverage": layer.get("coverage"),
                "reconstructionProfile": profile,
            }
        )

    external, warnings = _external_object_reference_lookup(
        {
            "task": "real-world-object-reference-for-image-to-3d",
            "scope": payload.get("scope"),
            "artwork": payload.get("artwork"),
            "subject": subject,
            "layers": slim_layers,
            "instructions": (
                "Return concise morphology, parts, physical traits, geometry hints, fit hints, and negative hints. "
                "Do not change pixel positions; masks and anchors are user-reviewed."
            ),
        }
    )
    for layer_id, base in list(references.items()):
        references[layer_id] = _merge_reference(base, _external_reference_for_layer(external, layer_id))

    return JSONResponse(
        {
            "available": True,
            "engine": "llm+local-catalog" if _object_reference_server_url() and external else "local-catalog",
            "references": references,
            "warnings": warnings,
        }
    )


@app.get("/api/scene-lift/status")
def scene_lift_status() -> dict:
    server = _scene_lift_server_url()
    if not server:
        return {
            "available": False,
            "geometry": "facebook/map-anything-apache",
            "segmentation": "Grounding DINO + SAM 2.1",
            "segmentationTier": None,
            "groundingModel": None,
            "capabilities": {"depth": False, "camera": False, "segmentation": False},
            "reason": "未设置 SCENE_LIFT_SERVER_URL；浏览器将使用不虚构物体的原画像素锁定浮雕",
        }
    try:
        req = urllib.request.Request(f"{server}/health", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=4) as upstream:
            info = json.loads(upstream.read().decode("utf-8"))
        available = info.get("status") == "ok" and bool(info.get("capabilities", {}).get("depth"))
        return {
            "available": available,
            "geometry": info.get("geometry", "facebook/map-anything-apache"),
            "segmentation": info.get("segmentation", "Grounding DINO + SAM 2.1"),
            "segmentationTier": info.get("segmentationTier"),
            "groundingModel": info.get("groundingModel"),
            "capabilities": info.get("capabilities", {}),
            "reason": info.get("reason") if not available else None,
        }
    except (OSError, ValueError, urllib.error.URLError) as exc:
        return {
            "available": False,
            "geometry": "facebook/map-anything-apache",
            "segmentation": "Grounding DINO + SAM 2.1",
            "segmentationTier": None,
            "groundingModel": None,
            "capabilities": {"depth": False, "camera": False, "segmentation": False},
            "reason": f"场景转换服务未就绪：{exc}",
        }


@app.post("/api/scene-lift/config")
async def scene_lift_config(request: Request):
    data = await request.json()
    url = (data.get("url") or "").strip().rstrip("/")
    if url:
        set_runtime("SCENE_LIFT_SERVER_URL", url)
        os.environ["SCENE_LIFT_SERVER_URL"] = url
    return scene_lift_status()


@app.post("/api/trellis2/config")
async def trellis2_config(request: Request):
    data = await request.json()
    url = (data.get("url") or "").strip().rstrip("/")
    if url:
        set_runtime("TRELLIS2_SERVER_URL", url)
        os.environ["TRELLIS2_SERVER_URL"] = url
    return trellis2_status()


@app.post("/api/scene-lift/analyze")
async def scene_lift_analyze(payload: dict = Body(...)) -> JSONResponse:
    server = _scene_lift_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="场景转换服务未连接；请设置 SCENE_LIFT_SERVER_URL")
    image = payload.get("image")
    if not isinstance(image, str) or not image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="image 必须是 data:image/... 格式的 home 画框原作")
    subject = payload.get("subject")
    if not isinstance(subject, dict) or not isinstance(subject.get("id"), str):
        raise HTTPException(status_code=400, detail="subject 必须包含环境要素 id")
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    if len(body) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="画作数据超过 12 MB")
    t0 = time.perf_counter()
    try:
        upstream = await _proxy_request(
            "POST",
            server,
            "/analyze",
            body=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
    except HTTPException:
        raise
    raw = upstream.content
    if upstream.status_code >= 400:
        detail = raw.decode("utf-8", errors="replace")[:1200]
        raise HTTPException(status_code=upstream.status_code, detail=detail or "场景转换失败")
    if len(raw) > 18 * 1024 * 1024:
        raise HTTPException(status_code=502, detail="场景转换结果超过 18 MB，请降低 gridMaxSide")
    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="场景转换服务返回了无效 JSON") from exc
    depth = result.get("depth") if isinstance(result, dict) else None
    if not isinstance(depth, dict) or not isinstance(depth.get("values"), list):
        raise HTTPException(status_code=502, detail="场景转换服务未返回逐像素深度图")
    metrics.observe("proxy.scene_lift.analyze", time.perf_counter() - t0)
    metrics.count("proxy.scene_lift.analyze")
    return JSONResponse(result)


@app.get("/api/trellis2/status")
def trellis2_status() -> dict:
    server = _trellis2_server_url()
    if not server:
        return {
            "available": False,
            "model": "microsoft/TRELLIS.2-4B",
            "engine": "none",
            "reason": "未设置 TRELLIS2_SERVER_URL；图生 3D 服务未连接",
        }
    try:
        req = urllib.request.Request(f"{server}/health", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as upstream:
            info = json.loads(upstream.read().decode("utf-8"))
        available = info.get("status") == "ok" and bool(info.get("available", info.get("cuda", True)))
        return {
            "available": available,
            "model": info.get("model", "microsoft/TRELLIS.2-4B"),
            "engine": info.get("engine", "trellis2"),
            "reason": None if available else info.get("reason") or "图生 3D worker 未就绪",
        }
    except (OSError, ValueError, urllib.error.URLError) as exc:
        return {"available": False, "model": "microsoft/TRELLIS.2-4B", "engine": "none", "reason": f"生成服务未就绪：{exc}"}


@app.post("/api/trellis2/generate")
async def trellis2_generate(request: Request) -> Response:
    server = _trellis2_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="图生 3D 服务未连接；请设置 TRELLIS2_SERVER_URL")
    body = await request.body()
    if len(body) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="画作数据超过 12 MB")
    # Light validation without fully parsing large payloads twice when possible
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="请求体必须是 JSON") from exc
    image = payload.get("image")
    if not isinstance(image, str) or not image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="image 必须是 data:image/... 格式的画作")
    t0 = time.perf_counter()
    try:
        upstream = await _proxy_request(
            "POST",
            server,
            "/generate",
            body=body,
            headers={"Content-Type": "application/json", "Accept": "application/json, model/gltf-binary"},
        )
    except HTTPException:
        raise
    if upstream.status_code >= 400:
        detail = upstream.content.decode("utf-8", errors="replace")[:800]
        raise HTTPException(status_code=upstream.status_code, detail=detail or "图生 3D 生成失败")
    content_type = upstream.headers.get("content-type") or "model/gltf-binary"
    # Task-mode (TODO-4): JSON with task_id — pass through
    if "application/json" in content_type:
        metrics.observe("proxy.trellis2.generate", time.perf_counter() - t0)
        metrics.count("proxy.trellis2.generate.task")
        return Response(content=upstream.content, media_type="application/json", status_code=upstream.status_code)
    model = upstream.content
    if len(model) < 20:
        raise HTTPException(status_code=502, detail="图生 3D 服务返回了空模型")
    metrics.observe("proxy.trellis2.generate", time.perf_counter() - t0)
    metrics.count("proxy.trellis2.generate")
    headers = {}
    for key in ("X-Image-To-3D-Engine", "X-Object-Reference"):
        if key.lower() in upstream.headers:
            headers[key] = upstream.headers[key.lower()]
        elif key in upstream.headers:
            headers[key] = upstream.headers[key]
    return Response(content=model, media_type=content_type, headers=headers)


@app.get("/api/trellis2/generate/stream/{task_id}")
async def trellis2_generate_stream(task_id: str):
    server = _trellis2_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="图生 3D 服务未连接")
    client = get_proxy_client()
    url = f"{server.rstrip('/')}/generate/stream/{task_id}"

    async def events():
        try:
            async with client.stream("GET", url, timeout=httpx.Timeout(connect=5.0, read=900.0, write=30.0, pool=5.0)) as resp:
                async for chunk in resp.aiter_bytes():
                    yield chunk
        except httpx.ConnectError as exc:
            yield f"data: {json.dumps({'error': f'worker unreachable: {exc}'})}\n\n".encode()
        except httpx.TimeoutException as exc:
            yield f"data: {json.dumps({'error': f'worker timeout: {exc}'})}\n\n".encode()

    return StreamingResponse(events(), media_type="text/event-stream")


@app.get("/api/trellis2/generate/result/{task_id}")
async def trellis2_generate_result(task_id: str) -> Response:
    server = _trellis2_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="图生 3D 服务未连接")
    try:
        upstream = await _proxy_request("GET", server, f"/generate/result/{task_id}")
    except HTTPException:
        raise
    if upstream.status_code >= 400:
        detail = upstream.content.decode("utf-8", errors="replace")[:800]
        raise HTTPException(status_code=upstream.status_code, detail=detail or "result unavailable")
    headers = {}
    for key in ("X-Image-To-3D-Engine", "X-Object-Reference"):
        lk = key.lower()
        if lk in upstream.headers:
            headers[key] = upstream.headers[lk]
    return Response(
        content=upstream.content,
        media_type=upstream.headers.get("content-type") or "model/gltf-binary",
        headers=headers,
    )


@app.post("/api/trellis2/generate/cancel/{task_id}")
async def trellis2_generate_cancel(task_id: str) -> JSONResponse:
    server = _trellis2_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="图生 3D 服务未连接")
    try:
        upstream = await _proxy_request("POST", server, f"/generate/cancel/{task_id}")
    except HTTPException:
        raise
    return JSONResponse(content=json.loads(upstream.content.decode("utf-8") or "{}"), status_code=upstream.status_code)


@app.post("/api/scene-lift/embed")
async def scene_lift_embed(payload: dict = Body(...)) -> JSONResponse:
    server = _scene_lift_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="场景转换服务未连接；无法提取视觉特征")
    image = payload.get("image")
    if not isinstance(image, str) or not image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="image 必须是 data:image/... 格式的裁剪")
    body = json.dumps({"image": image}, ensure_ascii=False).encode("utf-8")
    try:
        upstream = await _proxy_request(
            "POST",
            server,
            "/embed",
            body=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=httpx.Timeout(connect=5.0, read=60.0, write=30.0, pool=5.0),
        )
    except HTTPException:
        raise
    if upstream.status_code >= 400:
        detail = upstream.content.decode("utf-8", errors="replace")[:600]
        raise HTTPException(status_code=upstream.status_code, detail=detail or "视觉特征提取失败")
    return JSONResponse(json.loads(upstream.content.decode("utf-8")))


@app.get("/api/sculpt/status")
def sculpt_status() -> dict:
    server = _sculpt_server_url()
    if not server:
        return {
            "available": False,
            "engine": "tib-sculpt",
            "reason": "未设置 SCULPT_SERVER_URL；塑形服务未连接",
        }
    try:
        req = urllib.request.Request(f"{server}/health", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=3) as upstream:
            info = json.loads(upstream.read().decode("utf-8"))
        available = info.get("status") == "ok"
        return {
            "available": available,
            "engine": info.get("engine", "tib-sculpt"),
            "specVersion": info.get("specVersion"),
            "reason": None if available else info.get("reason") or "塑形 worker 未就绪",
        }
    except (OSError, ValueError, urllib.error.URLError) as exc:
        return {"available": False, "engine": "tib-sculpt", "reason": f"塑形服务未就绪：{exc}"}


@app.post("/api/sculpt/from-crop")
async def sculpt_from_crop_proxy(request: Request) -> Response:
    server = _sculpt_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="塑形服务未连接；请设置 SCULPT_SERVER_URL 或启动 sculpt_worker")
    body = await request.body()
    if len(body) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="请求超过 12 MB")
    t0 = time.perf_counter()
    try:
        upstream = await _proxy_request(
            "POST",
            server,
            "/sculpt/from-crop",
            body=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=httpx.Timeout(connect=5.0, read=60.0, write=30.0, pool=5.0),
        )
    except HTTPException:
        raise
    if upstream.status_code >= 400:
        detail = upstream.content.decode("utf-8", errors="replace")[:800]
        raise HTTPException(status_code=upstream.status_code, detail=detail or "塑形失败")
    metrics.observe("proxy.sculpt.from_crop", time.perf_counter() - t0)
    metrics.count("proxy.sculpt.from_crop")
    return Response(content=upstream.content, media_type="application/json")


@app.post("/api/sculpt/gate")
async def sculpt_gate_proxy(request: Request) -> Response:
    server = _sculpt_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="塑形服务未连接")
    body = await request.body()
    try:
        upstream = await _proxy_request(
            "POST",
            server,
            "/sculpt/gate",
            body=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
        )
    except HTTPException:
        raise
    if upstream.status_code >= 400:
        detail = upstream.content.decode("utf-8", errors="replace")[:600]
        raise HTTPException(status_code=upstream.status_code, detail=detail or "gate failed")
    return Response(content=upstream.content, media_type="application/json")


@app.get("/")
def home_page() -> FileResponse:
    """平台导航页（展厅）：两幅画卡入口。"""
    return FileResponse(FRONTEND / "home.html")


@app.get("/config.html")
def config_page() -> FileResponse:
    return FileResponse(FRONTEND / "config.html")


# 二次元子项目：仓库根 TigerMessenger/（须在 frontend 的 "/" 挂载之前）
if TIGER_MESSENGER.is_dir():
    app.mount(
        "/TigerMessenger",
        StaticFiles(directory=TIGER_MESSENGER, html=True),
        name="tiger_messenger",
    )


# 静态托管放在最后，API 路由优先匹配
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
