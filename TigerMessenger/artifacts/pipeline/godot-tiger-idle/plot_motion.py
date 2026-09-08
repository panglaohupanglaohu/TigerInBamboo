import sys, json
from pathlib import Path
sys.path.insert(0, '/tmp/tiger-idle-plot-deps')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.animation import FuncAnimation, PillowWriter
root=Path(__file__).resolve().parent
r=json.loads((root/'final-01/validation.json').read_text())
rest=np.array(r['beforeRestPivotPoints'])
rows=r['samples'][:33]
points=np.array([s['worldRelativePivotPoints'] for s in rows])
times=np.array([s['time'] for s in rows])
tip=np.linalg.norm(points[:,-1]-rest[-1],axis=1)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11})
fig=plt.figure(figsize=(13.5,5.5),facecolor='#f7f6f0')
ax=fig.add_subplot(121,projection='3d')
ax.plot(*rest.T,'o--',color='#87928d',lw=2,label='Before: authored rest')
for i,color in [(0,'#163f56'),(8,'#cd794b'),(16,'#387b78'),(24,'#795f8d')]:
 ax.plot(*points[i].T,'o-',color=color,lw=2,label=f'Idle t={times[i]:.3f}s')
ax.set(xlabel='World X offset (m)',ylabel='World Y offset (m)',zlabel='World Z offset (m)',title='Same nine pivots; original world placement')
ax.view_init(22,-45)
ax.legend(fontsize=8,loc='upper left')
bx=fig.add_subplot(122)
bx.plot(times,tip,color='#cd794b',lw=2.5)
bx.scatter(times,tip,color='#cd794b',s=12)
bx.axhline(0,color='#87928d',ls='--',label='Before: rest')
bx.set(xlabel='Idle loop time (seconds)',ylabel='Last joint displacement from rest (m)',title='Measured Godot motion after integration')
bx.grid(alpha=.18)
fig.suptitle('Godot tiger idle tail — measured before / after motion',fontsize=17)
fig.text(.5,.025,'Actual headless Godot joint samples; this is a motion plot, not a rendered model screenshot or visual approval.',ha='center',fontsize=10)
fig.tight_layout(rect=(0,.045,1,.93))
fig.savefig(root/'motion-before-after.png',dpi=140)
plt.close(fig)
fig=plt.figure(figsize=(7,6),facecolor='#f7f6f0'); ax=fig.add_subplot(111,projection='3d')
ax.plot(*rest.T,'o--',color='#a5aaa5',label='Authored rest')
line,=ax.plot(*points[0].T,'o-',color='#cd794b',lw=3,label='Measured animated pivots')
allpoints=np.concatenate([rest,points.reshape(-1,3)])
for dim,setter in enumerate([ax.set_xlim,ax.set_ylim,ax.set_zlim]):
 lo,hi=allpoints[:,dim].min(),allpoints[:,dim].max(); setter(lo-.05,hi+.05)
ax.view_init(22,-45);ax.legend(fontsize=9)
ax.set(xlabel='World X offset (m)',ylabel='World Y offset (m)',zlabel='World Z offset (m)')
title=ax.set_title('')
fig.text(.5,.025,'Godot sample visualization — not an engine-rendered screenshot',ha='center',fontsize=9)
def draw(i):
 line.set_data_3d(*points[i].T);title.set_text(f'Original idle tail formula / t={times[i]:.3f}s');return line,title
ani=FuncAnimation(fig,draw,frames=32,interval=1000*times[-1]/32)
ani.save(root/'motion-measured.gif',writer=PillowWriter(fps=32/times[-1]))
(root/'motion-metrics.json').write_text(json.dumps({'maximumLastJointDisplacementMeters':float(tip.max()),'loopSeconds':float(times[-1]),'source':'final-01/validation.json','visualizationOnly':True,'engineScreenshot':False},indent=2)+'\n')
