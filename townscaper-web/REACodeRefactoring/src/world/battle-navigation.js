import{portalAim}from'../core/portal-aim.js';
/** 906425294533394432 "It's like navigating a Swiss cheese";
 * 797119718477991936 "Got some basic navigation going".
 * Stateful route cache only: all occupancy remains in the shared World.
 * Every unit keeps its floor, so a roof above a tunnel is not its ground.
 */
import {buildLayeredNav} from './layerednav.js';
import {buildNav} from './navgraph.js';
import {samplePath, smoothRoutedPath, ribbonCells} from '../core/path-samples.js';
import {navMeshFromLayeredGraph, buildVertexField, buildFaceDirs, flowAt, buildPolyField, guardedFlowAt} from './navmesh-flow.js';
import {buildFinePortals, UNIT_HEIGHT} from './fine-portals.js';
/** 楼梯几何与 world/navlayer.js 画的一致：低格贴墙一侧 rise·3 级，每级进深 0.11，宽 min(0.36, 0.6·边长)。 */
export const STAIR_STEP_DEPTH=.11,STAIR_STEPS_PER_LEVEL=3,LADDER_RUNG=.08;
export class BattleNavigation {
  constructor(world,index,{levelHeight=.5,radius=.055,doorCost=1.35,continuousFlow=false,finePortals=false,unitHeight=UNIT_HEIGHT}={}){if(!Number.isFinite(radius)||radius<0)throw new RangeError('Invalid unit radius');if(!Number.isFinite(doorCost)||doorCost<1)throw new RangeError('Invalid door cost');this.radius=radius;
    // 906425294533394432 / REACode holenav：穿拱洞/洞道（头顶还有实心层）的边加价——窄门要排队，绕另一个门可能更优
    this.doorCost=doorCost;
    // 816748103193817088（G5）：开了以后同层移动按导航面内连续流向前视（world/navmesh-flow.js），失败回退通口前视
    this.continuousFlow=continuousFlow;this.flowAgree=.5;
    // 第 55 批 G3：格内精细门户 + 形变侧壁（world/fine-portals.js），默认关；切换后下一次 refresh 重建
    this.finePortals=finePortals;this.unitHeight=unitHeight;this.world=world;this.index=index;this.L=levelHeight;this.version=-1;this.trees=new Map();}
  refresh(){
    if(this.version===this.world.version&&this._fineBuilt===!!this.finePortals&&this._thinBuilt===!!this.avoidThinLadders)return;
    this._thinBuilt=!!this.avoidThinLadders;
    const world=this.world,surface=buildNav(world),covered=n=>n.floor<world.top(n.cell);
    // 第 55 批 G3（terraceladder）：梯子模式下，搭在薄悬平台上的梯子（上层下面没有足够实心层可靠，ladderContact.thinPlatform）不进图
    const thin=new Set();if(this.avoidThinLadders)for(const st of surface.stairs){const h=surface.hgt[st.low.id],rise=st.rise||1;let depth=0;for(let lv=h+rise;lv>=1&&world.isSolid(st.high,lv);lv--)depth++;if(depth<rise)thin.add(st.low.id+':'+st.high.id);}
    this.thinLadders=thin;
    this.graph=buildLayeredNav(world,{maxStep:2,canStep:(a,b)=>{
      if(a.floor===b.floor)return true;
      if(thin.size&&(thin.has(a.cell.id+':'+b.cell.id)||thin.has(b.cell.id+':'+a.cell.id)))return false;
      if(a.floor===world.top(a.cell)&&b.floor===world.top(b.cell))return Number.isFinite(surface.cost(a.cell,b.cell));
      return Math.abs(a.floor-b.floor)<=1;
    },edgeCost:(a,b,distance)=>{
      if(a.floor===world.top(a.cell)&&b.floor===world.top(b.cell)&&surface.walk[a.cell.id]&&surface.walk[b.cell.id])return surface.cost(a.cell,b.cell);
      // 906425294533394432 / holenav 门洞加价：一条洞道有**两个洞口**（进、出各排一次队），
      // 通道内部一律平价。只按「b 被覆盖」单侧收会变成方向相关（同一棵树里读出的距离非对称），
      // 且逐格收会把 5 格长隧道的排队价放大 5 倍 —— 两种都不对。这里只数「跨了几个洞口」：0 或 2 收 1，1 收 doorCost。
      const mouths=(covered(a)?1:0)+(covered(b)?1:0);
      return distance*(a.floor===b.floor?1:1.8)*(mouths===1?this.doorCost:1);
    }});
    this.version=world.version;this.trees.clear();
    this._fineBuilt=!!this.finePortals;this.fine=this.finePortals?buildFinePortals(world,this.graph,{L:this.L,unitHeight:this.unitHeight}):null;
    // 楼梯（与 navlayer 渲染同一份 buildNav 结果）：低格 id → [{low,high,edge,rise}]
    this.stairs=surface.stairs;this.stairByLow=new Map();
    for(const s of surface.stairs){if(!this.stairByLow.has(s.low.id))this.stairByLow.set(s.low.id,[]);this.stairByLow.get(s.low.id).push(s);}
    this.minPortalWidth=Math.min(Infinity,...this.graph.portals.map(p=>p.width));
    this.flowMesh=null;this.flowFields=new Map();
    // 816748103193817088：连续流向的可观测量。steer = 走过 flowAim 分支的次数；used = 流向前视被采纳；
    // rejected = 与图的下一步偏差过大 / 扫掠放不下（回退通口前视）；mesh = 自动生成的导航面规模。
    this.flowStats={steer:0,used:0,rejected:0};
  }
  pick(cell,y,{tolerance=.22}={}){
    this.refresh();if(!cell||!Number.isFinite(y))return null;
    const id=this.graph.nearest(cell,y/this.L),node=this.graph.nodes[id];
    return node&&Math.abs(node.floor*this.L-y)<=tolerance?node:null;
  }
  unitNode(unit){
    this.refresh();const c=this.index.cellAt(unit.x,unit.z);if(!c)return null;
    const floor=unit.navFloor??Math.round(unit.y/this.L);
    return this.graph.nodes[this.graph.at(c,floor)]??null;
  }
  plan(unit,cell,floor){
    this.refresh();const from=this.unitNode(unit),goal=cell?this.graph.at(cell,floor):-1;
    if(!from||goal<0)return null;
    // 体型重路由（880853661936734211 后续 / G5）：身体直径放不进的通口不进这棵树，按体型分档缓存
    const need=2*(unit.radius??this.radius)+.01,narrow=need>this.minPortalWidth,key=narrow?goal+':'+need.toFixed(3):goal;
    let tree=this.trees.get(key);if(!tree){tree=narrow?this.graph.treeTo(goal,{allow:e=>e.portal.width>=need}):this.graph.treeTo(goal);this.trees.set(key,tree);}
    if(!Number.isFinite(tree.distance[from.id]))return null;
    const next=this.graph.nodes[tree.next[from.id]]??from;
    return {from,next,goal:this.graph.nodes[goal],arrived:from.id===goal,distance:tree.distance[from.id],tree};
  }
  steerTarget(unit,plan){
    if(plan&&!plan.arrived&&plan.from.floor!==plan.next.floor){
      // 换层：对准楼梯中线（片子里一列人沿台阶一级级上去），没有楼梯几何（悬崖边的 1 级落差）就照旧朝格心
      const st=this.stairBetween(plan.from.cell,plan.next.cell);
      if(st){const m=st.mid,n=plan.next;return{x:m.x+(n.x-m.x)*.18,z:m.z+(n.z-m.z)*.18};}
      return plan.next;
    }
    if(!plan||plan.arrived)return plan?.next;
    const edge=this.graph.adj[plan.from.id].find(e=>e.to===plan.next.id)?.portal?.edge;
    if(edge===undefined)return plan.next;
    const pts=plan.from.cell.pts,next=plan.next,following=this.graph.nodes[plan.tree.next[next.id]]??plan.goal;
    const fa=this.fine?.aperture(plan.from.id,edge),pa=fa?.p?fa.p:pts[edge],pb=fa?.p?fa.q:pts[(edge+1)%pts.length];
    let base=portalAim(unit,pa,pb,next,following,{radius:unit.radius??this.radius})??(fa?.p?{x:(pa.x+pb.x)/2,z:(pa.z+pb.z)/2}:next);
    if(fa?.p&&(fa.t0>1e-9||fa.t1<1-1e-9))base=this.#throughAperture(unit,pa,pb,base);
    if(this.continuousFlow){this.flowStats.steer++;const aim=this.flowAim(unit,plan,base);if(aim){this.flowStats.used++;return aim;}this.flowStats.rejected++;}
    return base;
  }
  /** 精细门户：从 unit 到 aim 的直线若不在收窄后的门户（两端各让出半径）里穿过，先对准门户上离自己最近的可穿点。 */
  #throughAperture(unit,a,b,aim){
    const r=(unit.radius??this.radius)+.01,ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez);if(len<1e-9)return aim;
    const dx=aim.x-unit.x,dz=aim.z-unit.z,den=dx*ez-dz*ex,lo=Math.min(.5,r/len),hi=1-lo;
    if(Math.abs(den)>1e-12){const t=((a.x-unit.x)*dz-(a.z-unit.z)*dx)/den,s=((a.x-unit.x)*ez-(a.z-unit.z)*ex)/den;
      if(s<0||s>1||(t>=lo&&t<=hi))return aim;}            // 这一步还没到门户边，或正好从门户中段穿过
    const t=Math.max(lo,Math.min(hi,((unit.x-a.x)*ex+(unit.z-a.z)*ez)/(len*len)));
    const c={x:a.x+ex*t,z:a.z+ez*t};
    // 已经贴到门户上了：沿门户法向朝 aim 一侧再推半步，免得原地打转
    if(Math.hypot(c.x-unit.x,c.z-unit.z)<r*.5){let nx=-ez/len,nz=ex/len;if(nx*(aim.x-c.x)+nz*(aim.z-c.z)<0){nx=-nx;nz=-nz;}return{x:c.x+nx*r,z:c.z+nz*r};}
    return c;
  }
  /** Swept horizontal footprint; derived directly from polygon portals.
   * Radius is the body cylinder's radius, not a second collision voxel field.
   * 906425294533394432: preserve passage clearance in perforated structures.
   */
  discFits(node,x,z,radius){
    const c=node.cell,allowed=id=>this.graph.adj[node.id].some(e=>this.graph.nodes[e.to].cell.id===id);
    for(let i=0;i<c.n;i++){
      const p=c.pts[i],q=c.pts[(i+1)%c.n],dx=q.x-p.x,dz=q.z-p.z;
      const distance=Math.abs(dx*(z-p.z)-dz*(x-p.x))/(Math.hypot(dx,dz)||1);
      if(distance+1e-9<radius&&!allowed(c.edgeNeighbors[i]))return false;
      if(Math.hypot(x-p.x,z-p.z)+1e-9<radius){
        const incident=this.world.grid.vertexCells?.get(p.id)??[];
        // A disk at an L-shaped corner must not spill into the missing diagonal.
        for(const id of incident)if(id!==c.id&&this.graph.at(this.world.cells[id],node.floor)<0)return false;
      }
    }
    if(this.fine&&!this.fine.fits(node,x,z,radius))return false;
    return true;
  }
  move(unit,x,z,plan){
    if(!plan||this.version!==this.world.version||![x,z,unit.x,unit.z].every(Number.isFinite))return false;
    const radius=unit.radius??this.radius;
    if(!Number.isFinite(radius)||radius<0)return false;
    const length=Math.hypot(x-unit.x,z-unit.z),steps=Math.max(1,Math.ceil(length/Math.max(.01,radius*.5)));
    /* 816743289500106752（第 174 轮）：贴脚一挪（≤ 一个身体直径）只判**终点**。
     * 原实现把整段逐点采 1/2 半径，任何中间点压到格子拐角的斜向缺格就整步作废 ——
     * 一支队列在目标格门口会稳定停在离落位 0.06 处（终点本身 `discFits` 是过的）。
     * 只在「步长 ≤ 2×半径 且终点合法、且起终点同属 from/next」时放行，不会穿墙、不跨第三格。 */
    if(length<=radius*2){
      const a=this.index.cellAt(unit.x,unit.z),b=this.index.cellAt(x,z);
      const ok=(c)=>c&&(c.id===plan.from.cell.id||c.id===plan.next.cell.id);
      const node=b?(b.id===plan.next.cell.id?plan.next:plan.from):null;
      if(ok(a)&&ok(b)&&node&&(!radius||this.discFits(node,x,z,radius))){unit.x=x;unit.z=z;unit.navFloor=node.floor;return true;}
    }
    let floor=plan.from.floor;
    for(let k=0;k<=steps;k++){
      const t=k/steps,px=unit.x+(x-unit.x)*t,pz=unit.z+(z-unit.z)*t,c=this.index.cellAt(px,pz);
      if(!c||c.id!==plan.from.cell.id&&c.id!==plan.next.cell.id)return false;
      const node=c.id===plan.next.cell.id?plan.next:plan.from;
      if(radius&&!this.discFits(node,px,pz,radius))return false;
      floor=node.floor;
    }
    unit.x=x;unit.z=z;unit.navFloor=floor;return true;
  }
  supportBelow(x,z,y){
    this.refresh();const c=this.index.cellAt(x,z);if(!c)return 0;
    let floor=0;for(const id of this.graph.layers[c.id]){const n=this.graph.nodes[id];if(n.floor*this.L<=y+.03)floor=Math.max(floor,n.floor);}
    return floor*this.L;
  }
  clearSegment(a,b,{step=.06}={}){
    if(!(step>0)||!Number.isFinite(step))throw new RangeError('Invalid visibility sampling step');
    if(![a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite))return false;
    const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/step));
    for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,z=a.z+(b.z-a.z)*t;
      const c=this.index.cellAt(x,z);if(c&&y>=0&&this.world.isSolid(c,Math.floor(y/this.L)+1))return false;
    }
    return true;
  }
  /** 两格之间的楼梯（低格→高格任一方向），带中线点。 */
  stairBetween(a,b){
    this.refresh();
    const pick=(low,high)=>(this.stairByLow.get(low.id)??[]).find(s=>s.high.id===high.id);
    const s=pick(a,b)??pick(b,a);if(!s)return null;
    const c=s.low,p=c.pts[s.edge],q=c.pts[(s.edge+1)%c.n];
    return {...s,mid:{x:(p.x+q.x)/2,z:(p.z+q.z)/2},p,q};
  }
  /** 脚下真实地面高度：节点楼层；若在低格楼梯的踏步范围内，取那一级踏面（navlayer 同参数；不含笼形变形）。 */
  surfaceHeight(x,z,node){return this.stairAt(x,z,node)?.tread??node.floor*this.L;}
  /** 踏面命中：{tread, slope:{x,z,deg}}（slope 指向上坡，deg = 整段楼梯的平均坡角），不在楼梯上返回 null。 */
  stairAt(x,z,node){
    const base=node.floor*this.L;
    if(node.floor!==this.world.top(node.cell))return null;   // 洞道里没有楼梯
    let best=null;
    for(const s of this.stairByLow?.get(node.cell.id)??[]){
      const c=s.low,p=c.pts[s.edge],q=c.pts[(s.edge+1)%c.n],ux=q.x-p.x,uz=q.z-p.z,len=Math.hypot(ux,uz);if(len<.2)continue;
      let vx=-uz/len,vz=ux/len;const mx=(p.x+q.x)/2,mz=(p.z+q.z)/2;if((c.cx-mx)*vx+(c.cz-mz)*vz<0){vx=-vx;vz=-vz;}
      const rise=s.rise||1,steps=rise*STAIR_STEPS_PER_LEVEL,width=Math.min(.36,len*.6);
      const d=(x-mx)*vx+(z-mz)*vz,along=Math.abs((x-mx)*ux/len+(z-mz)*uz/len);
      if(this.ladderMode){const lad=this.#ladderAt(c,mx,mz,vx,vz,len,rise,base,d,along);if(lad&&(!best||lad.tread>best.tread))best=lad;continue;}
      if(d<0||d>=steps*STAIR_STEP_DEPTH||along>width/2)continue;
      const k=Math.floor(d/STAIR_STEP_DEPTH),tread=base+rise*this.L*(steps-k)/steps;
      if(!best||tread>best.tread)best={tread,rise,slope:{x:-vx,z:-vz,deg:Math.atan2(rise*this.L,steps*STAIR_STEP_DEPTH)*180/Math.PI}};
    }
    return best;
  }
  /** 梯子模式（view 的 woodladders）：梯脚离墙 run = min(.22, .65·墙中点到格心)（ladderAnchors 同参数，不含笼形），
   * d∈[0,run] 时在梯子上：攀爬按横档量化——每级横档之间 smoothstep（手脚交替一级一级上），t=1 在顶边。 */
  #ladderAt(c,mx,mz,vx,vz,len,rise,base,d,along){
    const run=Math.min(.22,Math.hypot(c.cx-mx,c.cz-mz)*.65),width=Math.min(.18,len*.4);
    if(d<0||d>run||along>width/2+.02||run<1e-6)return null;
    const t=1-d/run,h=rise*this.L,length=Math.hypot(run,h),spacing=LADDER_RUNG,along3=t*length,k=Math.floor(along3/spacing),f=along3/spacing-k,e=f*f*(3-2*f);
    const progress=Math.min(1,(k+e)*spacing/length);
    return{tread:base+h*progress,rise,slope:null,ladder:{t,progress,rung:k,wallX:-vx,wallZ:-vz,run}};
  }
  footHeight(unit){const node=this.unitNode(unit);return node?this.surfaceHeight(unit.x,unit.z,node):(unit.navFloor??Math.round(unit.y/this.L))*this.L;}
  /** 828984794407170048 / REACode unitsnap.measure：逐人「悬空 / 埋入」与脚下层数、相邻落差。 */
  measureFooting(units,{eps=.02}={}){
    let floating=0,buried=0,maxGap=0;const levels=new Set(),grounded=units.filter(u=>!u.dead&&!u.onBoat&&!u.fall);
    const h=grounded.map(u=>{const t=this.footHeight(u),d=u.y-t;if(d>eps)floating++;if(d<-eps)buried++;levels.add(Math.round(t*1000));return t;});
    const order=grounded.map((u,i)=>i).sort((a,b)=>Math.atan2(grounded[a].z,grounded[a].x)-Math.atan2(grounded[b].z,grounded[b].x));
    for(let i=0;i<order.length;i++)maxGap=Math.max(maxGap,Math.abs(h[order[i]]-h[order[(i+1)%order.length]]));
    return {units:grounded.length,floating,buried,levels:levels.size,maxGap};
  }
  /** 816748103193817088：分层图 → 导航面 → 顶点距离场 → 面内连续流向。aim 必须落在 from/next 两格内（move 的约束）。 */
  flowAim(unit,plan,base=plan.next){
    if(!this.flowMesh)this.flowMesh=navMeshFromLayeredGraph(this.graph,{levelHeight:this.L});
    let f=this.flowFields.get(plan.goal.id);
    if(!f){const field=buildVertexField(this.flowMesh,{goalPolys:[plan.goal.id]});f={field,dirs:buildFaceDirs(this.flowMesh,field),pf:buildPolyField(this.flowMesh,plan.goal.id)};this.flowFields.set(plan.goal.id,f);}
    // 第 55 批 G3：鞍点守卫——连续流向要出的边是墙 / 树距离不降时改走面级树出口（navmesh-flow.guardedFlowAt）
    let [dx,dz]=guardedFlowAt(this.flowMesh,f.field,plan.from.id,unit.x,unit.z,f.dirs,f.pf);if(!dx&&!dz)return null;
    // 连续流向 + 通口前视各占一半：面内方向逐点连续（片中人群过面边界是平滑的），通口项保证不会被
    // 顶点距离场的鞍点/墙角困住（纯 stepCrowd 在实际岛上 24 人里仍有 1–2 人卡在鞍点，见 tests/layered-continuous-flow.mjs）
    const bx=base.x-unit.x,bz=base.z-unit.z,bl=Math.hypot(bx,bz);
    if(bl>1e-6){if(dx*bx+dz*bz<this.flowAgree*bl)return null;   // 与图的下一步偏差超过 acos(flowAgree)（两条路代价相近的鞍点 / 图的代价与几何距离不一致）→ 听图的
      dx+=bx/bl;dz+=bz/bl;const l=Math.hypot(dx,dz);if(l<1e-6)return null;dx/=l;dz/=l;}
    const ahead=Math.min(bl||Infinity,Math.max(.12,(unit.radius??this.radius)*3)),x=unit.x+dx*ahead,z=unit.z+dz*ahead,c=this.index.cellAt(x,z);
    if(!c||(c.id!==plan.from.cell.id&&c.id!==plan.next.cell.id))return null;
    const node=c.id===plan.next.cell.id?plan.next:plan.from;
    // 第 55 批 G3：整段扫掠都要放得下（只查终点时，转角处流向前视常被 move 拒掉，单位原地停一帧）
    const r=unit.radius??this.radius;
    for(const t of [.25,.5,.75,1]){const px=unit.x+(x-unit.x)*t,pz=unit.z+(z-unit.z)*t,pc=this.index.cellAt(px,pz);
      if(!pc||(pc.id!==plan.from.cell.id&&pc.id!==plan.next.cell.id))return null;
      if(!this.discFits(pc.id===plan.next.cell.id?plan.next:plan.from,px,pz,r))return null;}
    return {x,z};
  }
  /** 816748103193817088 验收口径：一次读齐「导航面是否自动生成 / 连续流被采纳多少 / 与图的偏差多少」。
   *  导航面来自共享 World 的分层图（navMeshFromLayeredGraph(this.graph)），不是手搓的规则地形。 */
  flowSummary(){
    const mesh=this.flowMesh,poly=mesh?.polys?.length??0,vert=mesh?.verts?.length??0;
    const s=this.flowStats??{steer:0,used:0,rejected:0};
    return {continuousFlow:!!this.continuousFlow,flowAgree:this.flowAgree,polys:poly,verts:vert,
      links:mesh?.links?.length??0,goals:this.flowFields?.size??0,graphNodes:this.graph?.nodes?.length??0,
      portals:this.graph?.portals?.length??0,steer:s.steer,used:s.used,rejected:s.rejected,
      adopted:s.steer?s.used/s.steer:null};
  }
  /** 827215002448846848 / REACode navribbon：命令路径 = 分层折线 → Catmull-Rom（落到不可站处的样本退回折线）
   * → 弧长等距 → 每点贴实际地面（含楼梯踏面）→ 两侧按格内净宽出带状格子（首尾共享边）。 */
  commandRibbon(points,{spacing=.15,perSeg=8,halfWidth=.12,lift=.05,maxSamples=65536}={}){
    this.refresh();
    const nodeAt=(p)=>{const c=this.index.cellAt(p[0],p[2]);if(!c)return null;const id=this.graph.nearest(c,(p[1]-lift)/this.L),n=this.graph.nodes[id];return n&&Math.abs(n.floor*this.L-(p[1]-lift))<=this.L*2.01?n:null;};
    const smooth=smoothRoutedPath(points,{perSeg,accept:(p,i)=>{const n=nodeAt(p);if(!n)return false;const a=nodeAt(points[i]),b=nodeAt(points[i+1]??points[i]);return !!n&&(n===a||n===b)&&this.discFits(n,p[0],p[2],Math.min(halfWidth,.08));}});
    const s=samplePath(smooth,{spacing,maxSamples});
    // 换层判据（r255 楼层序列 + r256 窗口按楼梯进深自适应）。楼层序列只看「本样本 navFloor 与前后 ±win 个样本」，
    // 能挡住①一段爬升里还没上楼梯的样本被抬到踏面、②两段楼梯之间隔一格平走时平走段被判成换层；
    // 但固定 win=4（0.6）比一段楼梯的进深（rise·3·0.11，rise=2 → 0.66）还短：楼梯靠里那头已经在踏面上、
    // 楼层却要到洞口才变，于是命令线先贴地钻进楼梯、再一步跳 rise·L（r256 fixture 实测单步 0.833）。
    // 现在只在**几何上真踩在踏面**时才把窗口放到整段楼梯进深；没踩踏面仍用短的固定窗口，
    // 所以「同层穿过挂着楼梯的墙洞」（洞道里 floor 恒 1、窗口再宽也没有楼层变化）依旧不抬升，r254 的用例不受影响。
    const CLIMB_WIN=4;   // 兜住偏出窄踏面宽度的爬升样本（≈0.6 世界单位 @spacing 0.15），又跨不到邻段的平走
    const nodes=s.points.map(p=>nodeAt(p));
    const fl=nodes.map(n=>n?n.floor:null);
    const climbAt=(i)=>{
      const n=nodes[i],f=fl[i]; if(f==null)return false;
      const st=n?this.stairAt(s.points[i][0],s.points[i][2],n):null;
      const win=st?Math.ceil(st.rise*STAIR_STEPS_PER_LEVEL*STAIR_STEP_DEPTH/spacing)+CLIMB_WIN:CLIMB_WIN;
      for(let d=1;d<=win;d++){
        const a=fl[i-d],b=fl[i+d];
        if(a!=null&&a!==f)return true;
        if(b!=null&&b!==f)return true;
      }
      return false;
    };
    s.points=s.points.map((p,i)=>{const n=nodes[i];if(!n)return p;
      const h=climbAt(i)?this.surfaceHeight(p[0],p[2],n):n.floor*this.L;
      return [p[0],h+lift,p[2]];});
    s.climbSamples=s.points.reduce((c,_,i)=>c+(climbAt(i)?1:0),0);
    s.climbWin=CLIMB_WIN;
    const width=(p)=>{const n=nodeAt(p);if(!n)return halfWidth*.5;let w=halfWidth;const c=n.cell;
      for(let i=0;i<c.n;i++){const a=c.pts[i],b=c.pts[(i+1)%c.n],open=this.graph.adj[n.id].some(e=>this.graph.nodes[e.to].cell.id===c.edgeNeighbors[i]);if(open)continue;
        const ex=b.x-a.x,ez=b.z-a.z;w=Math.min(w,Math.abs(ex*(p[2]-a.z)-ez*(p[0]-a.x))/(Math.hypot(ex,ez)||1));}
      return Math.max(.02,w);};
    s.cells=ribbonCells(s.points,{halfWidth:width});s.smoothed=smooth.length;
    return s;
  }
  /** 洞口 = 同层、一侧头顶还有实心层（covered）另一侧没有的格边 —— r238 的门价就是按这条边界收的。
   *  返回 {key, edge, width, x, z, fromCovered}；key 双向同值（两个方向抢的是**同一个**洞口）。 */
  mouth(a, b) {
    if (!a || !b || a.floor !== b.floor) return null;
    const w = this.world, ca = a.floor < w.top(a.cell), cb = b.floor < w.top(b.cell);
    if (ca === cb) return null;
    const e = this.graph.adj[a.id]?.find((x) => x.to === b.id);
    if (!e) return null;
    const lo = Math.min(a.cell.id, b.cell.id), hi = Math.max(a.cell.id, b.cell.id);
    return { key: lo + '>' + hi, edge: e.portal.edge, width: e.portal.width, x: e.portal.x, z: e.portal.z, fromCovered: ca };
  }
  /** 906425294533394432：洞口「几个人同时在门口」的只读账（Battle 的占用表按这里的 width 定价）。 */
  mouthStats() {
    this.refresh();
    const seen = new Set(); let narrow = 0, minWidth = Infinity;
    for (const n of this.graph.nodes) for (const e of this.graph.adj[n.id]) {
      const m = this.mouth(n, this.graph.nodes[e.to]);
      if (!m || seen.has(m.key)) continue;
      seen.add(m.key);
      if (m.width < 2 * this.radius + .02) narrow++;
      minWidth = Math.min(minWidth, m.width);
    }
    return { mouths: seen.size, narrow, minWidth: Number.isFinite(minWidth) ? minWidth : null, bodyDiameter: 2 * this.radius };
  }
  canMelee(a,b){return Math.abs(a.y-b.y)<this.L*.6&&this.clearSegment({x:a.x,y:a.y+.1,z:a.z},{x:b.x,y:b.y+.1,z:b.z});}
}
