import sys,json
from pathlib import Path
sys.path.insert(0,'/tmp/tiger-idle-plot-deps')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parent
r=json.loads((root/'final-02/validation.json').read_text())
rows=r['lifecycle']; times=[row['time'] for row in rows]
fig,axes=plt.subplots(2,1,figsize=(11,6.8),sharex=True,facecolor='#f7f6f0')
colors={'red-0':'#b85948','blue-0':'#587b9d','red-1':'#cf8475','blue-1':'#304f6f'}
for uid,color in colors.items():
 states=[next(s for s in row['states'] if s['unit']==uid) for row in rows]
 values=[3 if not s['visible'] else 2 if s['dead'] else 1 if s['downed'] else 0 for s in states]
 axes[0].step(times,values,where='post',label=uid,color=color,lw=2.2,ls='--' if uid.endswith('1') else '-')
 radius=[sum(x*x for x in s['worldPosition'])**.5 for s in states]
 axes[1].plot(times,[radius[0]-v for v in radius],color=color,lw=2.2)
axes[0].set_yticks([0,1,2,3],['Active','Downed','Dead','Hidden']);axes[0].set_ylim(-.2,3.3);axes[0].legend(ncol=4,loc='lower right');axes[0].set_title('Same four model roots: state changes driven by nearest-foe combat')
axes[1].set_ylabel('Measured radial sinking (m)');axes[1].set_xlabel('Godot simulation time (seconds)');axes[1].set_title('Original death presentation: hold, then sink and hide')
for ax in axes:ax.grid(alpha=.18)
fig.suptitle('Roman gladius combat — original-rule lifecycle evidence',fontsize=17)
fig.text(.5,.015,'Actual Godot state/position samples; not a global battlefield screenshot or completed siege.',ha='center',fontsize=10)
fig.tight_layout(rect=(0,.03,1,.94));fig.savefig(root/'combat-lifecycle.png',dpi=140)
