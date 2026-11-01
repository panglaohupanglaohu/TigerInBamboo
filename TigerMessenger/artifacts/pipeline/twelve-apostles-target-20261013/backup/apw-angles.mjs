import {createIrregularQuadGrid} from '../../../../src/procgen/graph/irregularQuadGrid.js';
const g=createIrregularQuadGrid({seed:6477,radius:7,size:6.4,relaxIterations:30});let n=0,near90=0,min=180,max=0;
for(const f of g.faces)for(let i=0;i<4;i++){const p=g.positions[f[(i+3)%4]],c=g.positions[f[i]],q=g.positions[f[(i+1)%4]];const ux=p[0]-c[0],uy=p[1]-c[1],vx=q[0]-c[0],vy=q[1]-c[1];const a=Math.acos((ux*vx+uy*vy)/Math.hypot(ux,uy)/Math.hypot(vx,vy))*180/Math.PI;n++;if(Math.abs(a-90)<3)near90++;min=Math.min(min,a);max=Math.max(max,a);}
console.log('quads',g.faces.length,'angles',n,'within90±3',(near90/n*100).toFixed(1)+'%','min',min.toFixed(1),'max',max.toFixed(1));
