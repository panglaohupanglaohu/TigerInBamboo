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
    },
    "pheasant": {
        "enabled": True,
        "fleeDistance": 6.0,      # 警戒距离：虎进入即惊飞
        "returnDistance": 14.0,   # 虎远离至此距离后飞回
        "drinkInterval": 25.0,    # 饮水间隔（秒）
        "perchTime": 4.0,         # 惊飞后最少停留（秒）
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


@app.get("/api/models")
def list_models() -> dict:
    models_dir = FRONTEND / "assets" / "models"
    names = sorted(p.name for p in models_dir.glob("*.glb")) if models_dir.exists() else []
    return {"models": names}


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/config.html")
def config_page() -> FileResponse:
    return FileResponse(FRONTEND / "config.html")


# 静态托管放在最后，API 路由优先匹配
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
