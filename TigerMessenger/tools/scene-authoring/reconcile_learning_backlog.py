"""Reviewed reconciliation ledger. Only exact source text matches inherit a review."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
UP=ROOT/'townscaper-web/REACodeRefactoring'
progress=json.loads((UP/'learn/coverage-progress.json').read_text())
assert hashlib.sha256(json.dumps(progress['next'],ensure_ascii=False,sort_keys=True).encode()).hexdigest()=='6a5ace5462d9be277fdeae4ebbe9cc160e665cd0cdb27b8e3cf8d06057bc6596', 'Upstream backlog changed: re-review before generating'
names='''天光柱地面目标与宽度标定
烟球膨胀与火光耦合
网格层序回归纪律
灌木带宽与深层档位
战斗连续流场接入
灌木带宽与深层档位
战斗连续流场接入
火血尘与落水特效组合
体素幽灵色板与环绕镜头
节点图可视编辑器
伤害数字受击抖动与速度
九模块页面与运行接入
导航面连续流向与共享World
多格tile共享World与美术
导航与多格tile联合接入
长矛姿态与命中反馈
精灵方向与受击状态
火焰色带与火星
体素软化硬边与碰撞
角色分件与UV诊断
小队占位与选中提示
战斗HUD与贴地尸血层
等值面倒影与水线
等值面建筑硬边
黑烟火光血迹与来袭提示
弹道场景碰撞与参数口径
行军队列与跨层落位
路线检查点编辑器
球面胞元细分与装配
球面两级碎片尺度
球面装配起点入口
飞岛操控与附属几何
拆建动画时序素材
血腥开关样式与底材色差
AO烘焙半透明层与建筑体积
飞岛补全片学习
血迹双空间与调试层
流场调试可读性与截图
可走图调试与削台标定
血流精灵与流挂标定
生态色斑树冠草带与逆光
光照对比与灯塔网格视觉
生成Job时序与节点资产
格心语义与三维网格
岛屿循环与贴花图集
主视图混合投影
高拱洞与无限格稳定性
悬空建筑结构支撑
爆炸编排与等值面生长
挖洞历史记录截断核对
到期交接旧排期核对
拓扑交互与飞岛支撑
四子格联合WFC
软影与导航走廊旧覆盖登记
球面投影与动态重三角化
显式半边与局部编辑
纯六边World与模块组合
笼形变碰撞与联合生成
拱券塔基旧覆盖登记核对
层级平滑语义与自交
球面模块冲突与World融合
河网约束与球面导航
海陆纹理与山体图集
径向UV与法线笔触
树云卡片与俯仰层次
图集扩容与三维树接口
矩形树兼容接口
头像资产与角色身份
UI纹饰与游戏命令
UI移动目标与布局语义
云冬景与船群组合
风雪局部场与表面扫掠
船迹泡沫与贴水雾
草坪石边带与墙根灌木
道具稳定身份与生命周期
船迹旧覆盖登记
导出DCC与录像动作
存档环境与合批上传
QA复杂几何与反弹校准
轮廓速度拖抹与调色导出
轮廓速度拖抹与调色导出
HSL彩色约束与图集
色体与对比纹理旧覆盖登记
浮凸双高度与建筑接缝
草边图集与跨崖采样
软坡排水与World适配
悬挑侧壁自交与碰撞
草丛背景对比采样
球面patch投射与UV
SDF表面距离与笔触
反弹形因子参考接口
GI表面与体积反馈
点光漏光形变与增量
点光漏光形变与增量
房屋轮廓切入与编辑
增量tile候选与导航
衣绳多高度与避让
中心格与塔顶视觉
规则补丁与过渡重网格
对偶采样与贴附导航
边境Bezier与缝合
多格身份与socket联合WFC
拥挤窄道与弯岔压力
局部网格prefab与接缝
火焰轮廓与动态火光
斜坡脚高与精细portal
拥挤窄道与弯岔压力
多格身份与socket联合WFC
走廊拱顶与贴面光照
半影与快照指标
房屋kit旧覆盖登记
调色角点与导出
浮凸双高度与建筑接缝'''.splitlines()
assert len(names)==len(progress['next'])==113,'Upstream changed: review before regenerating ledger'
# Consolidate the same remaining deliverable, keep all original statements and clips.
merges={5:3,6:4,80:79,112:83,93:92,107:101,106:102}
learning={0,3,5,25,32,33,35,38,43,58}
validation={11,16,37,47,49,50,58,78,97,102,106,109}
closed={
 2:('原文明确复验全过、不再排期；只保留修改深度状态后重跑的回归纪律。',[]),
 53:('核销“尚未覆盖”的旧基线；coverage已登记两个模块frameReview与迁移证据。尘粒AO不属于navribbon完成范围，仍由火血尘项保留。',['src/blobshadow.js','src/navribbon.js']),
 75:('核销“仅静态映射/先学习”的旧基线；后续证据已记录Wake/Ship迁移、舷侧泡沫及Kelvin测量。靠岸行为仍在船迹组合项。',['src/wake.js']),
 82:('核销“新增待覆盖/先学习”的旧基线；两模块已有逐帧登记与View接入证据。自由拖角点/导出仍由调色续项保留。',['src/colorvolume.js','src/contrasttex.js']),
 110:('核销“仅静态对应/先学习”的旧基线；后续房屋kit证据包含坡度池、烟囱就座与村落接口，原始美术素材未迁入。',['src/housekit.js']),
 74:('后续r55证据已列稳定slot身份、保留消失几何、错峰及跨World重建接入；按历史证据核销本项，不代表本轮重新执行验收。',['src/propanim.js'])}
coverage=json.loads((UP/'learn/coverage.json').read_text());by={m['source']:m for m in coverage['modules']}
items={}
for i,r in enumerate(progress['next']):
 k=merges.get(i,i)
 if k not in items:
  stages=['implementation']
  if k in learning:stages.insert(0,'learning')
  if k in validation:stages.insert(0,'validation')
  if k==35:stages=['learning']
  if k in [49,50,58]:stages=['review']
  items[k]={'id':'backlog-'+hashlib.sha256(progress['next'][k]['title'].encode()).hexdigest()[:16],'title':names[k],'stages':stages,'state':'open','records':[],'reason':'逐项按剩余交付内容归类；原文已学不等于剩余代码已实现。','evidence':[]}
  if k in closed:
   reason,modules=closed[k];items[k].update(state='closed',stages=[],reason=reason)
   for m in modules:
    row=by[m];assert row.get('frameReview') and row.get('evidence')
    assert (UP/row['evidence']).is_file()
    items[k]['evidence'].append({'module':m,'path':row['evidence'],'status':row['status'],'gap':row['gap']})
  if k in [49,50,58]:items[k]['reason']='原记录截断、旧调度或覆盖基线已变化；先核实完整来源再拆解，不按待学习或完成计数。'
  if k==92:items[k]['reason']='合并同一漏光/形变遮挡/增量问题；较新原文明确太阳DDA已补，旧记录的太阳DDA不再单独排期。'
  if k==3:items[k]['reason']='同一灌木深层覆盖问题按较新第85轮结论收敛；旧第83轮建议保留追溯，不再并行执行已被证伪的宽度修法。'
 items[k]['records'].append({'fingerprint':hashlib.sha256(json.dumps({'title':r['title'],'clips':sorted(r.get('clips',[]))},ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),'originalIndex':i,'title':r['title'],'clips':r.get('clips',[])})
ledger={'version':1,'reviewedAt':'2026-11-12','scope':'人工审阅113条历史排期；核销仅指所列旧排期，不表示完整原作或游戏验收。','sourceUpdatedAt':progress['updatedAt'],'items':list(items.values())}
out=ROOT/'TigerMessenger/src/scene-authoring/catalog/learning-backlog-review.json';out.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
print('groups',len(items),'active',sum(i['state']=='open' for i in items.values()),'closed',len(closed),'merged',len(merges))
