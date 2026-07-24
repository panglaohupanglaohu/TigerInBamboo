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

OBJECT_REFERENCE_CATALOG: dict[str, dict[str, Any]] = {
    "bamboo": {
        "label": "竹",
        "query": "bamboo culm node internode branch leaf real-world morphology",
        "archetype": "中空分节竖向茎干，节与节间清晰，细枝侧出，披针形叶簇挂在枝端",
        "parts": ["竖向竹竿", "竹节", "节间", "侧枝", "披针形竹叶", "基部丛生关系"],
        "physicalTraits": ["竿身细长近圆柱", "节点略凸起成环", "整体弹性强但主轴稳定", "枝叶轻薄外展"],
        "geometryHints": {"primaryAxis": "vertical", "crossSection": "hollow-cylinder", "segmentation": "nodes-internodes", "branching": "lateral-twigs"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.16, "avoidHorizontalRod": True},
        "negativeHints": ["不要把竹竿生成成横向粗杆", "不要把叶簇和主竿合成一个无节块体", "不要丢失竖向主轴"],
    },
    "pine": {
        "label": "松",
        "query": "pine tree trunk branch whorl needle foliage morphology",
        "archetype": "粗糙树干与曲折枝干支撑针叶簇，枝条多横斜伸展但有明确木质骨架",
        "parts": ["主干", "侧枝", "针叶簇", "树皮皴裂", "枝端冠团"],
        "physicalTraits": ["树干较硬", "枝条横斜", "针叶成簇", "冠团不应变成实体板"],
        "geometryHints": {"primaryAxis": "branching", "crossSection": "woody-cylinder", "foliage": "needle-clumps"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.22, "avoidHorizontalRod": True},
        "negativeHints": ["不要把整片松针冠生成成单块纸板", "不要忽略枝干支撑关系"],
    },
    "plum": {
        "label": "梅",
        "query": "plum blossom old branch flower morphology",
        "archetype": "苍老曲枝、短枝节、散点梅花共同构成，花朵附着在枝条节点附近",
        "parts": ["老枝", "短枝", "花瓣", "花蕊", "节点"],
        "physicalTraits": ["枝条曲折硬质", "花瓣薄而圆", "花朵不应漂离枝条"],
        "geometryHints": {"primaryAxis": "curved-branch", "flower": "thin-petals"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.2},
        "negativeHints": ["不要把梅花和枝干合成一团", "不要生成无枝撑的花球"],
    },
    "flower": {
        "label": "花草",
        "query": "flowering herb shrub stem leaf petal morphology",
        "archetype": "细茎、叶片、花萼和薄花瓣共同构成，花朵必须依附茎叶而不是漂浮花球",
        "parts": ["茎", "叶", "花萼", "薄花瓣", "花蕊", "基部"],
        "physicalTraits": ["茎叶较薄", "花瓣轻薄有层次", "花冠与枝叶有连接点"],
        "geometryHints": {"primaryAxis": "stem-flower", "leaf": "thin-surface", "flower": "layered-petals"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.14},
        "negativeHints": ["不要把花瓣做成厚块", "不要让花冠脱离枝茎", "不要把整株压成一张纸"],
    },
    "vine": {
        "label": "藤蔓",
        "query": "wisteria vine hanging raceme woody vine morphology",
        "archetype": "缠绕木质藤条、细枝和下垂花序共同构成，主藤有曲线骨架",
        "parts": ["主藤", "缠绕枝", "叶片", "下垂花序", "附着点"],
        "physicalTraits": ["藤条细长曲折", "花序重心向下", "叶片薄而分散"],
        "geometryHints": {"primaryAxis": "curved-vine", "flower": "hanging-raceme"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.15, "avoidHorizontalRod": True},
        "negativeHints": ["不要把藤蔓生成为硬直横杆", "不要把花序合成单个块体"],
    },
    "reed": {
        "label": "芦苇",
        "query": "reed stem plume wetland plant morphology",
        "archetype": "水岸细长秆、线形叶和穗状花序构成的成丛湿地植物",
        "parts": ["细秆", "线形叶", "穗", "丛生基部"],
        "physicalTraits": ["极细长", "成簇直立或微倾", "顶部穗较轻"],
        "geometryHints": {"primaryAxis": "vertical", "crossSection": "thin-cylinder", "foliage": "linear-leaves"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.12},
        "negativeHints": ["不要生成厚板", "不要把秆横放"],
    },
    "lotus": {
        "label": "莲荷",
        "query": "lotus leaf flower stem aquatic morphology",
        "archetype": "圆盾形荷叶、细长叶柄和层叠花瓣组成，水面以下有根茎",
        "parts": ["圆叶", "叶柄", "花瓣", "莲蓬", "水下根茎"],
        "physicalTraits": ["叶片薄而宽", "柄细长", "花瓣层叠"],
        "geometryHints": {"primaryAxis": "stem-with-disc", "leaf": "thin-disc", "flower": "layered-petals"},
        "fitHints": {"anisotropic": False, "thicknessBias": 0.12},
        "negativeHints": ["不要把荷叶做成厚石块", "不要让花叶脱离叶柄"],
    },
    "bird": {
        "label": "禽鸟",
        "query": "bird body wing tail beak leg morphology",
        "archetype": "椭圆躯干、头颈、双翼、尾羽、喙和足共同构成，飞行姿态有翼展主轴",
        "parts": ["躯干", "头颈", "喙", "翼", "尾羽", "腿足"],
        "physicalTraits": ["躯干有体积", "翼为薄面羽片", "喙和尾羽形成方向性", "足部可很细"],
        "geometryHints": {"primaryAxis": "body-wing", "wing": "thin-surface", "body": "ellipsoid"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.18},
        "negativeHints": ["不要把鸟生成单个无翼团块", "不要把翼做成厚实体"],
    },
    "quadruped": {
        "label": "趾行走兽",
        "query": "digitigrade quadruped body leg tail head morphology tiger leopard dog",
        "archetype": "有胸腹体积、头颈、四肢、爪足和尾部的趾行四足兽，体轴与脊柱方向清楚",
        "parts": ["躯干", "头颈", "肩胯", "前后肢", "爪足", "尾"],
        "physicalTraits": ["躯干为主质量", "四肢支撑身体", "足端细但不能丢失", "尾部延续体轴"],
        "geometryHints": {"primaryAxis": "spine", "body": "ellipsoid", "limbs": "jointed-cylinders"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.28},
        "negativeHints": ["不要生成无腿团块", "不要把尾巴并进身体", "不要让身体变成薄纸片"],
    },
    "ungulate": {
        "label": "蹄兽",
        "query": "unguligrade deer horse hoof leg body morphology",
        "archetype": "长腿、蹄端、躯干、颈和头共同构成，腿部竖向承重非常关键",
        "parts": ["躯干", "长颈", "头", "细长腿", "蹄", "尾"],
        "physicalTraits": ["腿长且细", "蹄端接地", "躯干较横向", "颈部抬升形成姿态"],
        "geometryHints": {"primaryAxis": "body-leg", "limbs": "slender-load-bearing"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.18},
        "negativeHints": ["不要把四条腿糊成一块", "不要丢失蹄端接地关系"],
    },
    "rabbit": {
        "label": "兔类小兽",
        "query": "rabbit hare body ear hind leg morphology",
        "archetype": "圆润小躯干、长耳、短前肢和强壮后腿共同构成，跳跃结构以后肢为主",
        "parts": ["躯干", "长耳", "头", "前肢", "后腿", "短尾"],
        "physicalTraits": ["身体圆润", "耳朵薄而长", "后腿体量比前肢明显"],
        "geometryHints": {"primaryAxis": "body-hindleg", "ears": "thin-surfaces"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.24},
        "negativeHints": ["不要把耳朵丢掉", "不要把后腿做成单块阴影"],
    },
    "fish": {
        "label": "鱼",
        "query": "fish body fin tail aquatic morphology",
        "archetype": "流线形鱼体、尾鳍、背鳍、胸鳍和腹鳍共同构成，体轴沿游动方向",
        "parts": ["流线鱼体", "尾鳍", "背鳍", "胸鳍", "眼"],
        "physicalTraits": ["侧向扁", "体轴清晰", "鳍为薄片"],
        "geometryHints": {"primaryAxis": "body-tail", "fin": "thin-surface"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.16},
        "negativeHints": ["不要生成圆球鱼", "不要丢失尾鳍方向"],
    },
    "insect": {
        "label": "蝶虫",
        "query": "butterfly insect body wing antenna morphology",
        "archetype": "细小躯干、触角、足和大面积薄翼共同构成，翼面极薄且左右对称",
        "parts": ["躯干", "触角", "薄翼", "足", "翅脉"],
        "physicalTraits": ["翼面宽薄", "躯干细小", "触角和足可细但不能消失"],
        "geometryHints": {"primaryAxis": "body-wing", "wing": "very-thin-surface"},
        "fitHints": {"anisotropic": True, "thicknessBias": 0.08},
        "negativeHints": ["不要把蝴蝶生成厚块", "不要把双翼并成一团"],
    },
    "water": {
        "label": "水面",
        "query": "water ripple wave surface flow physical behavior",
        "archetype": "连续薄层流体表面，涟漪与浪峰来自法线和位移变化而不是实体厚块",
        "parts": ["薄水面", "流向", "涟漪", "浪峰", "泡沫边缘"],
        "physicalTraits": ["厚度极薄", "连续面", "局部高光和法线扰动表现流动"],
        "geometryHints": {"primaryAxis": "surface", "crossSection": "thin-plane"},
        "fitHints": {"anisotropic": False, "thicknessBias": 0.05},
        "negativeHints": ["不要生成固体蓝色厚板", "不要把涟漪做成孤立石块"],
    },
    "terrain": {
        "label": "地势",
        "query": "terrain rock mountain slope soil morphology",
        "archetype": "连续地形体块由坡面、岩脊、碎石和土层构成，适合低频体积和表面起伏",
        "parts": ["坡面", "岩脊", "土层", "碎石", "岸线"],
        "physicalTraits": ["体积稳定", "底部接地", "起伏连续", "边缘不应像纸片"],
        "geometryHints": {"primaryAxis": "mass", "crossSection": "solid-relief"},
        "fitHints": {"anisotropic": False, "thicknessBias": 0.45},
        "negativeHints": ["不要生成薄纸片地形", "不要让山石悬浮"],
    },
}

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


def _object_reference_server_url() -> str:
    """Optional LLM/RAG lookup that describes the real-world object before 2D→3D generation."""
    return os.environ.get("LLM_OBJECT_REFERENCE_URL", "").strip().rstrip("/")


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
    return base


def _morphology_plan_for_key(key: str, subject: dict[str, Any], profile: dict[str, Any] | None = None) -> dict[str, Any]:
    """Translate real-world morphology into a Three.js component plan.

    The plan is intentionally geometric rather than pixel-based: masks keep
    the artwork anchor, while these components define what the confirmed object
    must be made of. An external LLM/RAG response may override this plan.
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
    plans: dict[str, dict[str, Any]] = {
        "lotus": {
            "archetype": "aquatic lotus composed of shield leaves, slender petioles, layered petals, and seedpod center",
            "components": [
                {"type": "petiole", "role": "leaf-stem", "count": 2, "radius": 0.018, "height": 0.72, "lean": 0.18},
                {"type": "lotusLeaf", "role": "shield-leaf", "count": 2, "radiusX": 0.34, "radiusY": 0.27, "thickness": 0.018, "dome": 0.045, "veins": 12, "notch": 0.16},
                {"type": "flowerStem", "role": "flower-support", "count": 1, "radius": 0.014, "height": 0.88, "lean": -0.08},
                {"type": "petalLayer", "role": "outer-petals", "count": 9, "length": 0.22, "width": 0.07, "thickness": 0.014, "tilt": 0.65},
                {"type": "petalLayer", "role": "middle-petals", "count": 8, "length": 0.18, "width": 0.06, "thickness": 0.012, "tilt": 0.34},
                {"type": "petalLayer", "role": "inner-petals", "count": 7, "length": 0.13, "width": 0.045, "thickness": 0.01, "tilt": 0.1},
                {"type": "seedpod", "role": "flower-center", "count": 1, "radius": 0.05, "height": 0.035},
            ],
            "constraints": [
                "leaf discs are shallow domes with thickness and veins, not flat planes",
                "petals are layered curved thin solids connected to the seedpod",
                "stems connect leaf and flower to the waterline",
            ],
        },
        "bamboo": {
            "archetype": "segmented hollow bamboo culms with nodes, internodes, lateral twigs, and lanceolate leaves",
            "components": [
                {"type": "culm", "role": "vertical-stem", "count": 2, "radius": 0.026, "height": 1.05, "nodes": 7},
                {"type": "nodeRing", "role": "bamboo-nodes", "count": 14, "radius": 0.03, "height": 0.01},
                {"type": "twig", "role": "lateral-branch", "count": 5, "radius": 0.01, "length": 0.24},
                {"type": "lanceolateLeaf", "role": "leaf-cluster", "count": 16, "length": 0.18, "width": 0.035, "thickness": 0.004},
            ],
            "constraints": ["main culms remain vertical", "nodes must be visible rings", "leaves attach to twigs"],
        },
        "pine": {
            "archetype": "woody trunk and branches carrying needle foliage clusters",
            "components": [
                {"type": "woodyTrunk", "role": "trunk", "count": 1, "radius": 0.055, "height": 0.92},
                {"type": "branch", "role": "woody-branches", "count": 5, "radius": 0.018, "length": 0.42},
                {"type": "needleCluster", "role": "foliage", "count": 8, "radius": 0.16, "needles": 18},
            ],
            "constraints": ["needle masses must be supported by branches", "avoid single flat crown plate"],
        },
        "reed": {
            "archetype": "wetland reed clump with thin upright stems, linear leaves, and plume heads",
            "components": [
                {"type": "reedStem", "role": "thin-stem", "count": 5, "radius": 0.012, "height": 0.95},
                {"type": "linearLeaf", "role": "blade-leaves", "count": 14, "length": 0.36, "width": 0.025, "thickness": 0.004},
                {"type": "plume", "role": "seed-head", "count": 3, "radius": 0.035, "height": 0.18},
            ],
            "constraints": ["stems stay thin and upright", "plumes attach to the tops of stems"],
        },
        "flower": {
            "archetype": "flowering herb or shrub with stems, leaves, calyx, petals, and center",
            "components": [
                {"type": "stem", "role": "support", "count": 2, "radius": 0.018, "height": 0.65},
                {"type": "leaf", "role": "thin-leaves", "count": 8, "length": 0.22, "width": 0.06, "thickness": 0.006},
                {"type": "petalLayer", "role": "flower-petals", "count": 10, "length": 0.13, "width": 0.045, "thickness": 0.01, "tilt": 0.28},
                {"type": "seedpod", "role": "flower-center", "count": 1, "radius": 0.035, "height": 0.028},
            ],
            "constraints": ["petals connect to center", "flower connects to stem"],
        },
        "vine": {
            "archetype": "curved woody vine with attached leaves and hanging flower racemes",
            "components": [
                {"type": "curvedVine", "role": "main-vine", "count": 1, "radius": 0.018, "length": 0.92},
                {"type": "leaf", "role": "vine-leaves", "count": 10, "length": 0.18, "width": 0.05, "thickness": 0.005},
                {"type": "hangingPetals", "role": "raceme", "count": 12, "length": 0.09, "width": 0.035, "thickness": 0.008},
            ],
            "constraints": ["racemes hang from vine", "main vine remains curved not straight rod"],
        },
    }
    selected = plans.get(key)
    if selected is None and key in {"plum"}:
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
