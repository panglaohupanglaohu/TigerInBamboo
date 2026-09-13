"""Plot measured candidate heights; empty ray samples remain unknown."""
from pathlib import Path
import json,numpy as np,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.font_manager import FontProperties
font='/System/Library/Fonts/STHeiti Light.ttc'
font_manager.fontManager.addfont(font)
plt.rcParams['font.family']=FontProperties(fname=font).get_name()
plt.rcParams['axes.unicode_minus']=False
root=Path(__file__).resolve().parents[2]
out=root/'artifacts/pipeline/citadel-master-terrain'
d=json.loads((out/'r08-survey.json').read_text())
g=d['grid'];shape=(d['bounds']['nz'],d['bounds']['nx'])
x=np.array([v['x'] for v in g]).reshape(shape);z=np.array([v['z'] for v in g]).reshape(shape)
h=np.array([np.nan if v['radialAltitude'] is None else v['radialAltitude'] for v in g]).reshape(shape)
fig,ax=plt.subplots(figsize=(13,10),layout='constrained')
ax.set_facecolor('#d9dce0')
im=ax.pcolormesh(x,z,np.ma.masked_invalid(h),cmap='terrain',vmin=-15,vmax=80,shading='nearest')
cs=ax.contour(x,z,h,levels=np.arange(0,101,5),colors='#544a43',linewidths=.6)
ax.clabel(cs,fontsize=7,fmt='%d米')
ax.contour(x,z,h,levels=[0],colors='#008ac0',linewidths=2)
names={'citadel-plaza-hero-statue':'雕像广场','citadel-trojan-horse':'木马台','citadel-front-harbor-watergate':'既有前港（待重排）','citadel-new-main-gate':'主堡入口'}
for name,p in d['landmarks'].items():
 ax.plot(p[0],p[2],'o',color='#ba2739');ax.annotate(names[name],(p[0],p[2]),xytext=(6,8),textcoords='offset points',bbox=dict(fc='white',alpha=.85,ec='none'))
ax.set(title='筑山 2/3：实际候选等高线（5米间隔）\n灰色为未命中所选岩面，不推断为海洋',xlabel='圣城局部 X / 米',ylabel='圣城局部 Z / 米')
ax.set_aspect('equal');ax.invert_yaxis();fig.colorbar(im,ax=ax,label='相对官方海面的径向高差 / 米')
fig.savefig(out/'r08-contours.png',dpi=130);plt.close(fig)
s=d['section'];a=np.array([p['distance'] for p in s]);rock=np.array([p['y'] if p['y'] is not None else np.nan for p in s]);water=np.array([p['water'] for p in s]);road=np.array([p['routeY'] for p in s]);join=np.array([p['joining'] for p in s])
fig,ax=plt.subplots(figsize=(14,5),layout='constrained')
ax.plot(a,rock,label='实际岩面（不含楼板、石砌台基）',color='#675044')
ax.plot(a,water,label='当地官方海面',color='#008ac0')
ax.plot(a,np.where(join,np.nan,road),label='既有路线',color='#c77917')
ax.plot(a,np.where(join,road,np.nan),label='路线间示意连接，未验收',color='#c77917',ls=':')
ax.set(title='筑山 2/3：前港—广场—主堡剖面\n岩面与路线不重合不等于悬空，须结合建筑支撑检查',xlabel='沿路线距离 / 米',ylabel='圣城局部高度 / 米')
ax.legend();ax.grid(alpha=.2);fig.savefig(out/'r08-section.png',dpi=130)
print(json.dumps({'gridSamples':len(g),'known':int(np.isfinite(h).sum()),'sectionSamples':len(s)}))
