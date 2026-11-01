/** Pick the nearest visible castle hit across all registered instances. */
export function nearestCitadelTarget(raycaster,targets){
 let best=null;
 for(const target of targets){
  for(const root of (target.pick?target.pick():[target.get()])||[]){
   if(!root)continue;
   for(const hit of raycaster.intersectObject(root,true)){
    let visible=true;for(let node=hit.object;node;node=node.parent)if(!node.visible){visible=false;break;}
    if(!visible||hit.object.userData?.isOutline||hit.object.userData?.transientFx)continue;
    if(!best||hit.distance<best.hit.distance)best={target,hit};
    break;
   }
  }
 }
 return best;
}
export function isCitadelClick(down,event,slop=6){return !!down&&down.button===event.button&&Math.abs(event.clientX-down.x)+Math.abs(event.clientY-down.y)<=slop;}
