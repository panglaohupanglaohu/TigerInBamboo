/** 906425294533394432 "It's like navigating a Swiss cheese";
 * 797119718477991936 "Got some basic navigation going".
 * Stateful route cache only: all occupancy remains in the shared World.
 * Every unit keeps its floor, so a roof above a tunnel is not its ground.
 */
import {buildLayeredNav} from './layerednav.js';
import {buildNav} from './navgraph.js';
export class BattleNavigation {
  constructor(world,index,{levelHeight=.5,radius=.055}={}){if(!Number.isFinite(radius)||radius<0)throw new RangeError('Invalid unit radius');this.radius=radius;this.world=world;this.index=index;this.L=levelHeight;this.version=-1;this.trees=new Map();}
  refresh(){
    if(this.version===this.world.version)return;
    const world=this.world,surface=buildNav(world);
    this.graph=buildLayeredNav(world,{maxStep:2,canStep:(a,b)=>{
      if(a.floor===b.floor)return true;
      if(a.floor===world.top(a.cell)&&b.floor===world.top(b.cell))return Number.isFinite(surface.cost(a.cell,b.cell));
      return Math.abs(a.floor-b.floor)<=1;
    },edgeCost:(a,b,distance)=>{
      if(a.floor===world.top(a.cell)&&b.floor===world.top(b.cell)&&surface.walk[a.cell.id]&&surface.walk[b.cell.id])return surface.cost(a.cell,b.cell);
      return distance*(a.floor===b.floor?1:1.8);
    }});
    this.version=world.version;this.trees.clear();
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
    let tree=this.trees.get(goal);if(!tree){tree=this.graph.treeTo(goal);this.trees.set(goal,tree);}
    if(!Number.isFinite(tree.distance[from.id]))return null;
    const next=this.graph.nodes[tree.next[from.id]]??from;
    return {from,next,goal:this.graph.nodes[goal],arrived:from.id===goal,distance:tree.distance[from.id],tree};
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
    return true;
  }
  move(unit,x,z,plan){
    if(!plan||this.version!==this.world.version||![x,z,unit.x,unit.z].every(Number.isFinite))return false;
    const radius=unit.radius??this.radius;
    if(!Number.isFinite(radius)||radius<0)return false;
    const length=Math.hypot(x-unit.x,z-unit.z),steps=Math.max(1,Math.ceil(length/Math.max(.01,radius*.5)));
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
  canMelee(a,b){return Math.abs(a.y-b.y)<this.L*.6&&this.clearSegment({x:a.x,y:a.y+.1,z:a.z},{x:b.x,y:b.y+.1,z:b.z});}
}
