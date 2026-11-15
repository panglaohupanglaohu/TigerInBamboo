import {classifyWireframe} from './grid-wireframe.js';
/** Shared World coordinates, no guessed clip parameters or synthetic replacement grid. */
export function navDiagnosticGeometry(world,{nav,levelHeight=.5,at=(p)=>[p.x,p.z]}={}){
 if(!nav||!Number.isFinite(levelHeight)||levelHeight<=0)throw new TypeError('navigation and level height required');
 const corners=[],background=[],typed=[],colors=[],seen=new Set(),wire=classifyWireframe(world.grid),byId=new Map(world.grid.verts.map(p=>[p.id,p])),byCell=new Map(world.cells.map(c=>[c.id,c]));
 for(const c of world.cells){if(!nav.walk[c.id])continue;const h=nav.hgt[c.id];for(const p of c.pts){const key=p.id+':'+h;if(seen.has(key))continue;seen.add(key);const [x,z]=at(p,h);corners.push(x,h*levelHeight+.075,z);}}
 const palette={quad:[1,.43,.12],tri:[.05,.85,.9],seam:[.3,1,.35],rim:[.08,.4,.2],other:[1,1,1],nonmanifold:[1,0,0]};
 for(const edge of wire.edges){const a=byId.get(edge.a),b=byId.get(edge.b);background.push(a.x,.015,a.z,b.x,.015,b.z);
  // Both sides retain their own level. A cliff is not flattened into a top-down diagram.
  const levels=new Set(edge.faces.map(id=>world.top(byCell.get(id))));for(const h of levels){const A=at(a,h),B=at(b,h);typed.push(A[0],h*levelHeight+.08,A[1],B[0],h*levelHeight+.08,B[1]);colors.push(...palette[edge.kind],...palette[edge.kind]);}}
 return{corners,background,typed,colors,stats:{corners:corners.length/3,backgroundEdges:background.length/6,typedEdges:typed.length/6,edgeKinds:wire.counts}};
}
