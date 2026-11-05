/** Ground-level courtyard components, using actual wall occupancy above the paving.
 * A bridge high above a missing wall layer must not seal a courtyard. This is
 * a local voxel rule, not a recovered formula from 1238474550511308800. */
export function classifyCourtyards(world, {tops=Int32Array.from(world.cells,c=>world.top(c))}={}) {
  const cells=world.cells,seen=new Uint8Array(cells.length),mask=new Uint8Array(cells.length),components=[],openComponents=[];
  const ground=c=>tops[c.id]===1&&world.isBuilt(c,1);
  for(const start of cells){
    if(seen[start.id]||!ground(start))continue;
    const component=[],openings=[],stack=[start];seen[start.id]=1;
    while(stack.length){
      const c=stack.pop();component.push(c);
      for(let i=0;i<c.n;i++){
        const nb=world.neighbor(c,i);
        if(!nb){openings.push({cell:c.id,edge:i,reason:'grid-boundary'});continue;}
        if(ground(nb)){if(!seen[nb.id]){seen[nb.id]=1;stack.push(nb);}continue;}
        if(!world.isSolid(nb,2))openings.push({cell:c.id,neighbor:nb.id,edge:i,reason:'missing-wall-layer'});
      }
    }
    if(openings.length)openComponents.push({cells:component.map(c=>c.id),openings});
    else {components.push(component);for(const c of component)mask[c.id]=1;}
  }
  return {mask,components,openComponents};
}
