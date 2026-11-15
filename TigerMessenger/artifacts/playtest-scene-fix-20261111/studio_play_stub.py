#!/usr/bin/env python3
"""真实浏览器跑系统工坊 pipeline.html，但把 iframe 里的完整游戏换成「真 pipeline-bridge.js + 假插件」
（VM 4GB 内存跑完整游戏会被 OOM 杀掉渲染进程）。验证：选十二门徒 → 进入编辑 → 游玩检验 时，桥收到的 play 带 apostles，标题跟着变。
用法: python3 studio_play_stub.py <base_url_to_TigerMessenger> <out_dir>"""
import os, sys, json
os.environ['LD_LIBRARY_PATH'] = os.path.expanduser('~/deblib/usr/lib/aarch64-linux-gnu')
from playwright.sync_api import sync_playwright
base, out = sys.argv[1], sys.argv[2]
STUB = """<!doctype html><html><head><meta charset=utf-8><style>body{margin:0;background:#3b6f8c;color:#fff;font:20px sans-serif}#v{padding:30px}</style></head>
<body><div id=v>STUB GAME（假插件）· 当前镜头：<b id=cam>莫西斯湖</b></div><script type=module>
import {mountPipelineBridge} from './src/scene-authoring/pipeline-bridge.js';
const calls=window.__calls=[];const cam=t=>document.getElementById('cam').textContent=t;
const scenes=[{id:'morris-lake',label:'莫西斯湖 · 湖上建筑群',edit:'workbench'},{id:'bookshop',label:'书店镇',edit:'generic',plugin:'generic'},{id:'apostles',label:'十二门徒',edit:'morris-target',plugin:'generic'},{id:'citadel',label:'高山圣城',edit:'editor:citadel',plugin:'generic'},{id:'crystal',label:'水晶城',edit:'editor:crystal'}];
const lab=id=>scenes.find(s=>s.id===id)?.label;
mountPipelineBridge({id:'morris-lake',name:'莫西斯湖',settings:()=>({}),apply(){},open(){calls.push(['open']);cam('莫西斯湖（编辑）');},
 play(id){calls.push(['play',id]);if(id==='morris-lake'){cam('玩家视角 · 莫西斯湖');return {placed:false,id};}cam('玩家视角 · '+lab(id));return {placed:true,id,label:lab(id),distance:14};},
 listScenes:()=>scenes,frameScene(id){calls.push(['focus',id]);cam(lab(id)+'（取景）');return {id};},sceneAdapter:()=>null,
 openSceneEditor(id){calls.push(['editor',id]);cam(lab(id)+'（构建面板）');return scenes.find(s=>s.id===id);},
 setObjectPicking(){},clearObjectFocus(){},focusObject(){},encode:()=>'',validate:()=>({passed:true})});
</script></body></html>"""
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.route('**/TigerMessenger/index.html?*', lambda r: r.fulfill(status=200, content_type='text/html; charset=utf-8', body=STUB))
    pg.goto(base + '/pipeline.html#object', wait_until='load', timeout=60000)
    pg.wait_for_function("document.getElementById('connection').textContent.includes('已连接')", timeout=40000)
    pg.wait_for_function("[...document.querySelectorAll('#scene option')].some(o=>o.value==='apostles')", timeout=20000)
    game = lambda: next(f for f in pg.frames if f != pg.main_frame)
    state = lambda: pg.evaluate("()=>({title:document.getElementById('viewer-title').textContent,status:document.getElementById('status').textContent,scene:window.__tmCurrentScene})")
    for sid in ['apostles', 'citadel', 'bookshop', 'morris-lake']:
        pg.select_option('#scene', sid); pg.wait_for_timeout(800)
        pg.click('#edit'); pg.wait_for_timeout(800)
        pg.click('#play'); pg.wait_for_timeout(800)
        res[sid] = {**state(), 'lastPlay': [c for c in game().evaluate('()=>window.__calls') if c[0] == 'play'][-1:]}
        if sid == 'apostles': pg.screenshot(path=f'{out}/studio-stub-apostles-play.png')
    res['errors'] = errs
    b.close()
print(json.dumps(res, ensure_ascii=False, ))
