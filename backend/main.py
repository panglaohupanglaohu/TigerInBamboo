"""世界古典美术拟生平台 · 后端服务

- 托管 frontend/ 静态页面（3D 场景与系统配置页）
- /api/config：场景与生态配置的读写（持久化到 backend/config.json）
"""
from __future__ import annotations

import copy
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Body, HTTPException
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
CONFIG_PATH = Path(__file__).resolve().parent / "config.json"
SPECIES_PATH = Path(__file__).resolve().parent / "species.json"

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
    "dialog": {                 # 母女对话（虎为女、兔为母）：语音与大模型接口各自独立
        "enabled": True,
        "interval": 26,         # 触发间隔（秒）
        "daughter": {           # 虎（女儿）
            "voiceName": "auto",    # 嗓音：auto 自动选中文女声
            "voiceRate": 1.0,       # 语速
            "voicePitch": 1.05,     # 音高（略低嫩）
            "voiceVolume": 0.9,     # 音量 0~1
            "llmEndpoint": "",      # 大模型接口：留空用内置问安脚本
            "llmApiKey": "",        # 大模型 API Key
            "llmModel": "",         # 大模型模型名
        },
        "mother": {             # 兔（母亲）
            "voiceName": "auto",
            "voiceRate": 1.0,
            "voicePitch": 1.2,      # 音高（偏高柔）
            "voiceVolume": 0.9,
            "llmEndpoint": "",      # 留空用内置应答脚本
            "llmApiKey": "",
            "llmModel": "",
        },
    },
    # 物种关系矩阵：参考 Tu & Terzopoulos《Artificial Fishes》的
    # predator-prey / 内驱力（fear, hunger）模型
    "ecology": {
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
            return _merge(DEFAULT_CONFIG, saved)
        except (json.JSONDecodeError, OSError):
            pass
    return copy.deepcopy(DEFAULT_CONFIG)


app = FastAPI(title="世界古典美术拟生平台", version="0.1.0")


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
    merged = _merge(DEFAULT_CONFIG, payload)
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


def _trellis2_server_url() -> str:
    """Optional GPU worker; kept server-side so browsers never receive infrastructure URLs."""
    return os.environ.get("TRELLIS2_SERVER_URL", "").strip().rstrip("/")


def _scene_lift_server_url() -> str:
    """Geometry/segmentation worker that preserves the artwork's pixel coordinates."""
    return os.environ.get("SCENE_LIFT_SERVER_URL", "").strip().rstrip("/")


@app.get("/api/scene-lift/status")
def scene_lift_status() -> dict:
    server = _scene_lift_server_url()
    if not server:
        return {
            "available": False,
            "geometry": "facebook/map-anything-apache",
            "segmentation": "Grounding DINO + SAM 2.1",
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
            "capabilities": info.get("capabilities", {}),
            "reason": info.get("reason") if not available else None,
        }
    except (OSError, ValueError, urllib.error.URLError) as exc:
        return {
            "available": False,
            "geometry": "facebook/map-anything-apache",
            "segmentation": "Grounding DINO + SAM 2.1",
            "capabilities": {"depth": False, "camera": False, "segmentation": False},
            "reason": f"场景转换服务未就绪：{exc}",
        }


@app.post("/api/scene-lift/analyze")
def scene_lift_analyze(payload: dict = Body(...)) -> JSONResponse:
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
    request = urllib.request.Request(
        f"{server}/analyze",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    timeout = float(os.environ.get("SCENE_LIFT_TIMEOUT", "900"))
    try:
        with urllib.request.urlopen(request, timeout=timeout) as upstream:
            raw = upstream.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:1200]
        raise HTTPException(status_code=exc.code, detail=detail or "场景转换失败") from exc
    except (OSError, urllib.error.URLError) as exc:
        raise HTTPException(status_code=502, detail=f"无法访问场景转换服务：{exc}") from exc
    if len(raw) > 18 * 1024 * 1024:
        raise HTTPException(status_code=502, detail="场景转换结果超过 18 MB，请降低 gridMaxSide")
    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="场景转换服务返回了无效 JSON") from exc
    depth = result.get("depth") if isinstance(result, dict) else None
    if not isinstance(depth, dict) or not isinstance(depth.get("values"), list):
        raise HTTPException(status_code=502, detail="场景转换服务未返回逐像素深度图")
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
def trellis2_generate(payload: dict = Body(...)) -> Response:
    server = _trellis2_server_url()
    if not server:
        raise HTTPException(status_code=503, detail="图生 3D 服务未连接；请设置 TRELLIS2_SERVER_URL")
    image = payload.get("image")
    if not isinstance(image, str) or not image.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="image 必须是 data:image/... 格式的画作")
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    if len(body) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="画作数据超过 12 MB")
    request = urllib.request.Request(
        f"{server}/generate",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "model/gltf-binary"},
    )
    timeout = float(os.environ.get("TRELLIS2_TIMEOUT", "900"))
    try:
        with urllib.request.urlopen(request, timeout=timeout) as upstream:
            model = upstream.read()
            content_type = upstream.headers.get_content_type()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:800]
        raise HTTPException(status_code=exc.code, detail=detail or "图生 3D 生成失败") from exc
    except (OSError, urllib.error.URLError) as exc:
        raise HTTPException(status_code=502, detail=f"无法访问图生 3D 生成服务：{exc}") from exc
    if len(model) < 20:
        raise HTTPException(status_code=502, detail="图生 3D 服务返回了空模型")
    return Response(content=model, media_type=content_type or "model/gltf-binary")


@app.get("/")
def home_page() -> FileResponse:
    """平台导航页（展厅）：两幅画卡入口。"""
    return FileResponse(FRONTEND / "home.html")


@app.get("/config.html")
def config_page() -> FileResponse:
    return FileResponse(FRONTEND / "config.html")


# 静态托管放在最后，API 路由优先匹配
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
