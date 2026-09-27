/** Admit a complete four-person reinforcement only into vacant authored slots.
 * Living/downed friendlies and enemies occupy space; invisible/dead actors do not.
 * The caller spawns synchronously, so subsequent ships observe these reservations.
 */
export function vacantGarrisonSlots(groups,actors,preferred=0,clearance=.7){
  const occupied=actors.filter(a=>a.visible&&!a.userData.dead);
  const free=[];
  for(let n=0;n<groups.length;n++){
    const group=groups[(preferred+n)%groups.length];
    for(let index=0;index<group.points.length;index++){
      const point=group.points[index];
      if(occupied.some(a=>a.position.distanceToSquared(point)<clearance*clearance))continue;
      free.push({point,post:group.id,index});
      if(free.length===4)return free;
    }
  }
  return null;
}
