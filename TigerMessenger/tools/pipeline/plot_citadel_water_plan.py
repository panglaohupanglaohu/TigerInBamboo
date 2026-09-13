from pathlib import Path
import json,matplotlib,sys
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.font_manager import FontProperties
from matplotlib.patches import Circle
font='/System/Library/Fonts/STHeiti Light.ttc';font_manager.fontManager.addfont(font)
plt.rcParams['font.family']=FontProperties(fname=font).get_name();plt.rcParams['axes.unicode_minus']=False
r=Path(__file__).resolve().parents[2]/'artifacts/pipeline/citadel-water-plan'
tag='r02' if '--water=2' in sys.argv else 'r01'
d=json.loads((r/(tag+'-survey.json')).read_text());plan=d['plan'];s=d['samples']
fig,ax=plt.subplots(figsize=(12,9),layout='constrained')
im=ax.scatter([p['x']for p in s],[p['z']for p in s],c=[p['depth']for p in s],cmap='Blues',s=150,marker='s',vmin=0,vmax=d.get('requiredDepth',1.25)+1)
a=plan['approach'];ax.plot([p[0]for p in a],[p[1]for p in a],color='#b9243a',lw=2,label='拟定航道：'+('水深样本通过' if not d['failures'] else '水深不通过'))
q=plan['quay'];ax.plot([q['xMin'],q['xMax']],[q['z'],q['z']],color='#bf821c',lw=7,label='拟定码头前缘')
t=plan['turning'];ax.add_patch(Circle(t['center'],t['radius'],fill=False,color='#a53b73',ls='--',lw=2,label='拟定转向区，待扫掠验证'))
ax.plot(*plan['gate'],'s',color='#493724',ms=10);ax.annotate('新城前港拱门预留',plan['gate'],xytext=(-50,-22),textcoords='offset points')
ax.set(title=f"理水 {2 if tag=='r02' else 1}/3：港池与航道实际水深\n{len(s)}点港池测量；{len(d['lane'])}点航道检查，{len(d['failures'])}点不足",xlabel='新城局部 X / 米',ylabel='新城局部 Z / 米');ax.set_aspect('equal');ax.invert_yaxis();ax.legend(loc='lower left');fig.colorbar(im,ax=ax,label='海面至最高底面/障碍物的径向水深 / 米');fig.savefig(r/(tag+'-depth-plan.png'),dpi=140)
