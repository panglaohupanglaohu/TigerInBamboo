// Shared dimensions with godot/scripts/citadel_stair_candidate.gd.
// Pure geometry specification; y coordinates denote tread top surfaces.
export function buildContinuousStairSpec() {
  const radius = .86, width = .66, going = .34, thickness = .12, maxRise = .14;
  const heights = [2.25, 8.9, 15.55, 22.15, 28.75, 30.05];
  const positions = [], floorRoutes = [];
  let angle = -Math.PI / 4, treadCount = 0;
  const halfAngle = going / radius / 2 + .003;
  // Three.js outward CCW winding (Godot uses the opposite convention).
  const faces = [[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
  for (let floor = 0; floor < 5; floor++) {
    const rise = heights[floor + 1] - heights[floor];
    const count = Math.ceil(rise / maxRise);
    const points = [];
    for (let step = 0; step <= count; step++) {
      const a = angle + step * going / radius;
      const y = heights[floor] + thickness / 2 + rise * step / count;
      points.push([Math.cos(a) * radius, y, Math.sin(a) * radius]);
      // Shared landing belongs to the preceding flight; avoid coplanar duplicates.
      if (floor > 0 && step === 0) continue;
      const corners = [];
      for (const dy of [-thickness, 0]) {
        for (const [r, da] of [[radius-width/2,-halfAngle],[radius+width/2,-halfAngle],[radius+width/2,halfAngle],[radius-width/2,halfAngle]]) {
          corners.push([Math.cos(a+da)*r,y+dy,Math.sin(a+da)*r]);
        }
      }
      for (const [a,b,c,d] of faces) for (const i of [a,b,c,a,c,d]) positions.push(...corners[i]);
      treadCount++;
    }
    floorRoutes.push({floor, points, surface:'interior-rotating-stairs'});
    angle += count * going / radius;
  }
  const entryRoute=[],exitRoute=[];
  function bridge(a,b,route){
    const delta=b.map((v,i)=>v-a[i]);
    const count=Math.max(1,Math.ceil(Math.hypot(...delta)/.24),Math.ceil(Math.abs(delta[1])/maxRise));
    const run=Math.hypot(delta[0],delta[2])/count;
    const yaw=Math.atan2(delta[0],delta[2]),c=Math.cos(yaw),sn=Math.sin(yaw);
    for(let i=0;i<=count;i++){
      const point=a.map((v,k)=>v+delta[k]*i/count);route.push(point);
      const depth=Math.max(run+.06,.12),corners=[];
      for(const y of [-thickness,0])for(const [x,z] of [[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]])corners.push([point[0]+x*c+z*sn,point[1]+y,point[2]-x*sn+z*c]);
      for(const [a,b,c,d] of faces)for(const k of [a,b,c,a,c,d])positions.push(...corners[k]);
    }
  }
  const bottom=floorRoutes[0].points[0][1];
  const waypoints=[[0,3.55,3.5],[0,3.55,2.45],[1.8,3.55,2.45],[1.8,3.55,1.9],[1.8,bottom,-.3]];
  for(let i=1;i<waypoints.length;i++)bridge(waypoints[i-1],waypoints[i],entryRoute);
  let cursor=waypoints.at(-1);const r=Math.hypot(1.8,-.3),start=Math.atan2(-.3,1.8);
  for(let i=1;i<=8;i++){const a=start+(-Math.PI/4-start)*i/8,next=[Math.cos(a)*r,bottom,Math.sin(a)*r];bridge(cursor,next,entryRoute);cursor=next;}
  bridge(cursor,floorRoutes[0].points[0],entryRoute);
  // Extend around the existing spiral to the actual capture deck top, then radially inward.
  const last=floorRoutes.at(-1).points.at(-1),goalY=30.4;
  let prev=last;
  const count=Math.ceil((goalY-last[1])/maxRise);
  for(let i=1;i<=count;i++){
    const a=angle+going/radius*i,next=[Math.cos(a)*radius,last[1]+(goalY-last[1])*i/count,Math.sin(a)*radius];
    bridge(prev,next,exitRoute);prev=next;
  }
  bridge(prev,[0,goalY,.08],exitRoute);
  return {positions, floorRoutes, entryRoute,exitRoute,treadCount, radius, width, going, thickness, maxRise, version:'continuous-stairs-web-v1'};
}
