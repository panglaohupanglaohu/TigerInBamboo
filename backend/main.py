"""世界古典美术拟生平台 · 后端服务

- 托管 frontend/ 静态页面（3D 场景与系统配置页）
- /api/config：场景与生态配置的读写（持久化到 backend/config.json）
"""
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Body
from fastapi.responses import FileResponse, JSONResponse
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
            "/assets/audio/bgm.mp3",
            "/assets/audio/duange_xing.mp3",
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
            "/assets/audio/" + p.name
            for p in audio_dir.iterdir()
            if p.suffix.lower() in (".mp3", ".ogg")
        )
    return {"files": files}


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/")
def home_page() -> FileResponse:
    """平台导航页（展厅）：两幅画卡入口。"""
    return FileResponse(FRONTEND / "home.html")


@app.get("/config.html")
def config_page() -> FileResponse:
    return FileResponse(FRONTEND / "config.html")


# 静态托管放在最后，API 路由优先匹配
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
