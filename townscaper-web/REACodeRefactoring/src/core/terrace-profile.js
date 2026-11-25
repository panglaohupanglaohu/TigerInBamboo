/** Local World diagnostic, inspired by REACode/terracecliff.classify.
 * 815236105079398400 "irregular is the new hex" does not specify quantization.
 * r53: per-cell inland slope class (REACode classify: flat / one-level soft step / ≥2-level cliff,
 * shore excluded) and inland soft vs cliff step-edge counts, for softSlopes generation.
 * Measures logical undeformed top columns, not actual mesh slopes, caves or overhang underside area.
 */
export function terraceProfile(world,{levelHeight=1}={}){
 if(!Number.isFinite(levelHeight)||levelHeight<=0)throw new RangeError('positive level height required');
 const cells=world.cells,byId=new Map(cells.map(c=>[c.id,c])),heights=new Map(cells.map(c=>[c.id,world.ground(c)])),seen=new Set(),patches=[];
 let topArea=0,stepArea=0,shoreLength=0,stepEdges=0,softSteps=0,cliffSteps=0;const slope={flat:0,soft:0,cliff:0};
 const area=c=>Math.abs(c.pts.reduce((v,p,i)=>{const q=c.pts[(i+1)%c.n];return v+p.x*q.z-q.x*p.z},0))/2;
 for(const c of cells){const h=heights.get(c.id);if(!h)continue;topArea+=area(c);let g=0;for(const id of c.edgeNeighbors)if(byId.has(id)&&heights.get(id))g=Math.max(g,Math.abs(h-heights.get(id)));slope[g===0?'flat':g===1?'soft':'cliff']++;
  for(let i=0;i<c.n;i++){const id=c.edgeNeighbors[i],other=byId.get(id),oh=heights.get(id)||0;if(h<=oh)continue;const a=c.pts[i],b=c.pts[(i+1)%c.n],len=Math.hypot(a.x-b.x,a.z-b.z);stepArea+=len*(h-oh)*levelHeight;stepEdges++;if(!other||oh===0)shoreLength+=len;else if(h-oh===1)softSteps++;else cliffSteps++;}
  if(seen.has(c.id))continue;const queue=[c];seen.add(c.id);let patchArea=0;
  for(let j=0;j<queue.length;j++){const q=queue[j];patchArea+=area(q);for(const id of q.edgeNeighbors)if(!seen.has(id)&&heights.get(id)===h){const next=byId.get(id);if(next){seen.add(id);queue.push(next);}}}
  patches.push({level:h,cells:queue.map(c=>c.id),area:patchArea});
 }
 return{version:world.version,landCells:seen.size,slope,softSteps,cliffSteps,patches,topArea,stepArea,stepEdges,shoreLength,logicalColumnsOnly:true};
}
/** r55 (REACode/terracecliff fieldSmooth vs fieldTerrace, measured on the drawn mesh instead of logical columns):
 * bins the final top-surface triangles and wall quads recorded by terrain/terrainmesh.js (World.terrainSurface)
 * by their real slope. flat < flatDeg ≤ soft < cliffDeg ≤ steep top; walls are reported separately with their
 * area. With world.softTops the one-level soft steps become sloped top area and their wall area disappears.
 */
export function meshSlopeProfile(surface,{flatDeg=3,cliffDeg=40}={}){
 if(!surface?.tops||!surface?.walls)throw new RangeError('meshSlopeProfile needs World.terrainSurface');
 const area3=(A,B,C)=>{const u=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],v=[C[0]-A[0],C[1]-A[1],C[2]-A[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);return{a:l/2,ny:l?Math.abs(n[1])/l:1};};
 const top={flat:0,soft:0,steep:0};let maxDeg=0;const hist=new Array(9).fill(0);
 for(const t of surface.tops){const{a,ny}=area3(...t.t);if(a<1e-12)continue;const deg=Math.acos(Math.min(1,ny))*180/Math.PI;maxDeg=Math.max(maxDeg,deg);hist[Math.min(8,Math.floor(deg/10))]+=a;top[deg<flatDeg?'flat':deg<cliffDeg?'soft':'steep']+=a;}
 let wallArea=0;for(const w of surface.walls){const[A,B,C,D]=w.q;wallArea+=area3(A,B,C).a+area3(A,C,D).a;}
 const total=top.flat+top.soft+top.steep;
 return{top,topArea:total,softShare:total?top.soft/total:0,wallArea,maxTopDeg:maxDeg,histogram10deg:hist};
}

/** height 选项：'top' = 柱顶（岩石 + 建筑都算，World.top）；'ground' = 只看岩石地表（World.ground）；
 * 或自定义 (cell)=>层数 的函数。缺省 'top'——同高片看的是「能站人的顶面」，不是只看地形。
 */
const heightFn=(world,height)=>{
 if(typeof height==='function')return height;
 if(height==='top'||height==null)return c=>world.top(c);
 if(height==='ground')return c=>world.ground(c);
 throw new RangeError('height must be "top", "ground" or a function');
};
const cellArea=c=>Math.abs(c.pts.reduce((v,p,i)=>{const q=c.pts[(i+1)%c.n];return v+p.x*q.z-q.x*p.z},0))/2;
const edgeLen=(c,i)=>{const a=c.pts[i],b=c.pts[(i+1)%c.n];return Math.hypot(a.x-b.x,a.z-b.z);};

/** 补学 #6（815236105079398400，185帧「irregular is the new hex」）：真实 World 的「同高片」诊断。
 * 相邻（共边）且顶面同高的柱子聚成一片；输出每片的层数、格数、面积与边界长（边界 = 片内格子
 * 朝格外 / 水面 / 不同高邻居的边长之和）。与 terraceProfile 的 patches 不同：这里按 top（含建筑）
 * 分片并量边界周长，patches 按 ground（只岩石）分片只量面积——两者都保留，语义不同。
 * 原片算法未公开（learn/data.js 卡点·C），这是可观察行为诊断，不是原算法恢复。
 */
export function plateauRuns(world,{height='top'}={}){
 const h=heightFn(world,height),cells=world.cells,byId=new Map(cells.map(c=>[c.id,c])),H=new Map(cells.map(c=>[c.id,h(c)])),seen=new Set(),runs=[];
 for(const c of cells){const level=H.get(c.id);if(!level||seen.has(c.id))continue;
  const members=[c];seen.add(c.id);let area=0,boundary=0,boundaryEdges=0;
  for(let j=0;j<members.length;j++){const q=members[j];area+=cellArea(q);
   for(let i=0;i<q.n;i++){const id=q.edgeNeighbors[i],nb=byId.get(id),nh=nb?H.get(id):0;
    if(nb&&nh===level){if(!seen.has(id)){seen.add(id);members.push(nb);}}
    else{boundary+=edgeLen(q,i);boundaryEdges++;}}}
  runs.push({level,cells:members.map(q=>q.id),count:members.length,area,boundary,boundaryEdges});
 }
 runs.sort((a,b)=>b.count-a.count||a.level-b.level);
 const levels={};for(const r of runs)levels[r.level]=(levels[r.level]||0)+1;
 return{version:world.version,height:typeof height==='string'?height:'custom',landCells:seen.size,count:runs.length,levels,runs,logicalColumnsOnly:true};
}

/** 补学 #6 同一来源：真实 World 的「逻辑阶差面积」诊断。
 * 逐条格边看（只从较高那侧计一次，与 terraceProfile 的 step 边同一口径）：邻柱（缺邻居按 0 层，
 * 与岸线同一约定）矮 minStep 层以上（缺省 ≥2 层）的边是「逻辑阶差」——量化台地之间那一面近垂直的墙。
 * 所夹面积 = 边长 × 高差层数 × levelHeight（逻辑立面面积，不是实际网格墙面）。
 * 返回边数、总长、总面积、按高差分桶；land = 两边都是柱子的阶差，shore = 朝水面 / 格外的阶差。
 */
export function stepDropArea(world,{minStep=2,levelHeight=1,height='top'}={}){
 if(!Number.isFinite(minStep)||minStep<1)throw new RangeError('minStep must be >= 1');
 if(!Number.isFinite(levelHeight)||levelHeight<=0)throw new RangeError('positive level height required');
 const h=heightFn(world,height),cells=world.cells,byId=new Map(cells.map(c=>[c.id,c])),steps=[],byDrop={};
 let length=0,area=0,land=0,shore=0,shoreLength=0;
 for(const c of cells){const level=h(c);if(!level)continue;
  for(let i=0;i<c.n;i++){const id=c.edgeNeighbors[i],nb=byId.get(id),oh=nb?h(nb):0,d=level-oh;
   if(d<minStep)continue;
   const len=edgeLen(c,i),toWater=!nb||!oh;
   steps.push({cell:c.id,edge:i,level,other:oh,drop:d,length:len,shore:toWater});
   length+=len;area+=len*d*levelHeight;byDrop[d]=(byDrop[d]||0)+1;
   if(toWater){shore++;shoreLength+=len;}else land++;}}
 return{version:world.version,minStep,edges:steps.length,land,shore,shoreLength,length,area,byDrop,steps,logicalColumnsOnly:true};
}
