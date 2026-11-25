/** Ground-level courtyard components, using actual wall occupancy above the paving.
 * A bridge high above a missing wall layer must not seal a courtyard. This is
 * a local voxel rule, not a recovered formula from 1238474550511308800.
 *
 * quayWalls（r193，1178731576982724611）：临水的那条边按**码头护墙**算封边。
 * 片子里贴着岸边、由一圈房子 + 岸边矮墙围起来的空地也是草地块（石沿底下就是护墙 + 栏杆），
 * 而原来的规则把水侧当成「缺墙层」→ 整块地进 openComponents、一格草都不铺。
 * 只放松水侧（tops===0 与网格外），房子之间留的缺口（街道）仍然算开口。
 *
 * 开口按**真实墙层**分型（本地离散近似，非原作判定逐式复原）：
 *   'ground-opening'  邻格墙位整列空（街道 / 水面 / 岩石 / 坑）：贴地层能走出去。
 *   'wall-layer-gap'  邻格第 2 层缺、更高层仍有实心——桥 / 悬空屋顶跨过口子：
 *                     上方结构在头顶、人高仍是通道，院子不因此封死。
 *   'grid-boundary'   网格外（quayWalls 关时才算开口）。
 * 每条开口附 openLayers = 邻格列在 2..top 层里实际缺失的层，供逐层审计；
 * bridge 标记即「上层有桥/拱跨过此缺口」。
 *
 * lowWalls（可选）：高度 < 1 层的矮墙边集合——**分区但不封闭**。
 *   形态：[[idA,idB],…] / Set<'a:b'> / (idA,idB)=>bool；边方向不限。
 *   封闭组件内部沿这些边再切一次连通，结果写进 subregions（与 components 同序，
 *   每项 = 若干子区，子区 = 格 id 数组）；实际生效的边收进 lowWallEdges（'a:b'，a<b）。
 *   原作的矮墙是沿小径自动生成的（本地近似在 build/yard-r56.js planYardWalls：
 *   选线/门洞归它），这里只如实记录外部给定的分区关系，不发明矮墙位置。 */
export function classifyCourtyards(world, {tops=Int32Array.from(world.cells,c=>world.top(c)), quayWalls=false, lowWalls=null}={}) {
  const cells=world.cells,seen=new Uint8Array(cells.length),mask=new Uint8Array(cells.length),components=[],openComponents=[];
  let quaySealed=0;
  const ground=c=>tops[c.id]===1&&world.isBuilt(c,1);
  const lowBlocked=lowWallPred(lowWalls);
  for(const start of cells){
    if(seen[start.id]||!ground(start))continue;
    const component=[],openings=[],stack=[start];seen[start.id]=1;
    while(stack.length){
      const c=stack.pop();component.push(c);
      for(let i=0;i<c.n;i++){
        const nb=world.neighbor(c,i);
        if(!nb){ if(quayWalls)quaySealed++; else openings.push({cell:c.id,edge:i,reason:'grid-boundary'}); continue; }
        if(ground(nb)){if(!seen[nb.id]){seen[nb.id]=1;stack.push(nb);}continue;}
        if(quayWalls&&tops[nb.id]===0){quaySealed++;continue;}   // 水侧 = 码头护墙
        if(!world.isSolid(nb,2)){
          const top=tops[nb.id],openLayers=[];
          for(let lv=2;lv<=Math.max(top,2);lv++)if(!world.isSolid(nb,lv))openLayers.push(lv);
          const bridge=top>2;   // 缺口上方还有实心（桥/悬空屋顶跨过）：跨过去但不封院
          openings.push({cell:c.id,neighbor:nb.id,edge:i,reason:bridge?'wall-layer-gap':'ground-opening',openLayers,bridge});
        }
      }
    }
    if(openings.length)openComponents.push({cells:component.map(c=>c.id),openings});
    else {components.push(component);for(const c of component)mask[c.id]=1;}
  }
  // 矮墙 = 分区不封院：封闭组件内部沿给定矮墙边再做一次连通，得到子区。
  const subregions=[],lowWallSet=new Set();
  for(const comp of components){
    if(!lowBlocked){subregions.push(comp.map(c=>c.id));continue;}
    const inside=new Set(comp.map(c=>c.id)),regions=[];
    for(const s of comp){
      if(!inside.has(s.id))continue;
      const region=[],st=[s];inside.delete(s.id);
      while(st.length){
        const c=st.pop();region.push(c.id);
        for(let i=0;i<c.n;i++){
          const nb=world.neighbor(c,i);
          if(!nb||!inside.has(nb.id))continue;
          if(lowBlocked(c.id,nb.id)){lowWallSet.add(c.id<nb.id?c.id+':'+nb.id:nb.id+':'+c.id);continue;}
          inside.delete(nb.id);st.push(nb);
        }
      }
      regions.push(region);
    }
    subregions.push(regions);
  }
  return {mask,components,openComponents,quaySealed,subregions,lowWallEdges:[...lowWallSet].sort()};
}
function lowWallPred(lowWalls){
  if(!lowWalls)return null;
  if(typeof lowWalls==='function')return (a,b)=>!!lowWalls(a,b)||!!lowWalls(b,a);
  const set=new Set();
  for(const e of lowWalls){if(typeof e==='string')set.add(e);else if(e&&e.length>=2)set.add(e[0]+':'+e[1]);}
  return set.size?(a,b)=>set.has(a+':'+b)||set.has(b+':'+a):null;
}
