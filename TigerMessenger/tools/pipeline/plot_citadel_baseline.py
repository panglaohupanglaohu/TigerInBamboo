from pathlib import Path
import json,numpy as np,matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
from matplotlib import font_manager
font_manager.fontManager.addfont('/System/Library/Fonts/STHeiti Light.ttc')
plt.rcParams['font.family']=FontProperties(fname='/System/Library/Fonts/STHeiti Light.ttc').get_name()
plt.rcParams['axes.unicode_minus']=False
R=Path(__file__).resolve().parents[2]/'artifacts/pipeline/citadel-terrain-baseline'
d=json.loads((R/'survey.json').read_text());g=d['grid'];b=d['bounds'];shape=(b['nz'],b['nx']);x=np.array([v['x'] for v in g]).reshape(shape);z=np.array([v['z'] for v in g]).reshape(shape)
a=np.array([np.nan if v['radialAltitude'] is None else v['radialAltitude'] for v in g]).reshape(shape)
fig,ax=plt.subplots(figsize=(12,10),layout='constrained');ax.set_facecolor('#d5d8df');im=ax.pcolormesh(x,z,np.ma.masked_invalid(a),cmap='terrain',shading='nearest',vmin=-15,vmax=80);levels=np.arange(0,101,10);cs=ax.contour(x,z,a,levels=levels,colors='#4d423a',linewidths=.6);ax.clabel(cs,inline=True,fontsize=8,fmt='%d米');ax.contour(x,z,a,levels=[0],colors='#007da8',linewidths=2)
labels={'citadel-plaza-hero-statue':'雕像广场','citadel-trojan-horse':'木马台','citadel-front-harbor-watergate':'当前前港拱门','citadel-new-main-gate':'主堡入口'}
for k,v in d['landmarks'].items():ax.plot(v[0],v[2],'o',color='#b31e2b',markersize=5);ax.annotate(labels[k],(v[0],v[2]),xytext=(9,9),textcoords='offset points',fontsize=10,bbox=dict(fc='white',alpha=.85,ec='none'))
ax.set(xlabel='圣城局部 X（米）',ylabel='圣城局部 Z（米）',title='现状底稿：实测山体等高线与海陆交界\n灰色为未采到所选岩面的区域，不推断为海洋');ax.set_aspect('equal');ax.invert_yaxis();fig.colorbar(im,ax=ax,label='相对官方海面的径向高差（米）');fig.savefig(R/'contours.png',dpi=160)
for text in list(ax.texts):
    if text.get_bbox_patch() is not None:text.remove()
from matplotlib.patches import Rectangle
census=json.loads((R/'support-census.json').read_text())
labels_support={'highland-town-foundation-platform':'旧城现有台地','west-city-plaza-foundation':'新城广场台基','horse-terrace-foundation':'木马高台','west-city-harbor-quay':'旧版后港码头'}
seen=set()
for m in census['meshes']:
    if m['category']!='built-support':continue
    lo,hi=m['min'],m['max']
    ax.add_patch(Rectangle((lo[0],lo[2]),hi[0]-lo[0],hi[2]-lo[2],facecolor='#ed37cf',alpha=.12,edgecolor='#9c006b',lw=1))
    if m['name'] in labels_support and m['name'] not in seen:
        seen.add(m['name']);ax.annotate(labels_support[m['name']],((lo[0]+hi[0])/2,(lo[2]+hi[2])/2),fontsize=9,color='#80004c',bbox=dict(fc='white',alpha=.85,ec='none'))
ax.set_title('山体与现有建设范围叠图\n紫色为石砌构件轴对齐外包范围，不是实际地块边界或承托证明')
fig.savefig(R/'support-footprints.png',dpi=160);plt.close(fig)
s=d['section'];dist=np.array([v['distance'] for v in s]);terrain=np.array([np.nan if v['y'] is None else v['y'] for v in s]);water=np.array([v['water'] for v in s]);road=np.array([v['routeY'] for v in s]);join=np.array([v.get('joining',False) for v in s]);fig,ax=plt.subplots(figsize=(14,5),layout='constrained');ax.plot(dist,terrain,color='#685a4b',label='所选岩面');ax.plot(dist,water,color='#008fc2',label='同处官方海面');ax.plot(dist,np.where(join,np.nan,road),color='#d17700',lw=2,label='现有前港 / 广场至塔顶路线');ax.plot(dist,np.where(join,road,np.nan),color='#d17700',ls=':',label='两条路线间示意连接（未验收）');ax.set(xlabel='沿路线控制点累计长度（米）',ylabel='圣城局部竖向高度（米）',title='现状剖面：前港 → 广场 → 主堡与塔内通路\n岩面线不包含石砌台基和建筑楼板，不能据此判为悬空');ax.grid(alpha=.2);ax.legend(loc='best');fig.savefig(R/'section.png',dpi=160);plt.close(fig)
summary={'samples':len(g),'known':int(np.isfinite(a).sum()),'unknown':int(np.isnan(a).sum()),'radialAltitudeRange':[float(np.nanmin(a)),float(np.nanmax(a))],'gridSpacing':b['step'],'contourInterval':10,'scope':d['scope']};(R/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(summary)
