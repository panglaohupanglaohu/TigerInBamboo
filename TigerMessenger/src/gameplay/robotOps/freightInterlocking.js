const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const wrap=u=>(u%1+1)%1;
// Geometric junction blocks. Ordinary adjacent parallel tracks are not junctions:
// only distant sections of the same authored route can create a block.
export function findFreightJunctions(curve){
 const length=curve.getLength(),count=Math.ceil(length/2.5),points=Array.from({length:count},(_,i)=>curve.getPointAt(i/count)),hits=[];
 for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
  const gap=Math.min(j-i,count-j+i)*length/count;if(gap<100)continue;
  if(distance(points[i],points[j])<5.2){const a=points[i],b=points[j],p={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2};const hit=hits.find(h=>distance(h.center,p)<15);
   if(hit){const n=++hit.count;for(const k of['x','y','z'])hit.center[k]+=(p[k]-hit.center[k])/n;}
   else hits.push({center:p,count:1});
  }
 }
 const zones=hits.map(h=>({center:h.center,radius:13,count:h.count}));
 // Overlapping junctions are one indivisible block, avoiding opposed lock ownership.
 for(let changed=true;changed;){changed=false;outer:for(let i=0;i<zones.length;i++)for(let j=i+1;j<zones.length;j++){const a=zones[i],b=zones[j],d=distance(a.center,b.center);if(d>a.radius+b.radius+4)continue;const total=a.count+b.count,center={};for(const k of['x','y','z'])center[k]=(a.center[k]*a.count+b.center[k]*b.count)/total;const radius=Math.max(distance(center,a.center)+a.radius,distance(center,b.center)+b.radius);zones[i]={center,radius,count:total};zones.splice(j,1);changed=true;break outer;}}
 return zones.map((z,i)=>({...z,id:'junction-'+(i+1),owner:null,entered:false}));
}
export function createFreightInterlocking(curve,services,pitch){
 const zones=findFreightJunctions(curve);const position=(s,offset=0)=>s.curve.getPointAt(wrap(s.progress+s.direction*offset/s.trackLen));
 const leading=(s,ahead=0)=>position(s,s.shuntingBack?-s.wagons.length*pitch-ahead:ahead);
 function occupied(s,z){for(let i=0;i<=s.wagons.length;i++)if(distance(position(s,-i*pitch),z.center)<z.radius+4)return true;return false;}
 return {zones,update(){const blocked=new Set();
  for(const z of zones){
   if(z.owner){const owner=services.find(s=>s.tram.userData.variant===z.owner),inside=owner&&occupied(owner,z);if(inside)z.entered=true;if(!owner||(z.entered&&!inside)){z.owner=null;z.entered=false;}}
   if(!z.owner){const candidates=services.filter(s=>{const d=distance(leading(s),z.center),next=distance(leading(s,8),z.center);return occupied(s,z)||(d<z.radius+14&&next<d);});candidates.sort((a,b)=>distance(position(a),z.center)-distance(position(b),z.center));if(candidates.length){z.owner=candidates[0].tram.userData.variant;z.entered=occupied(candidates[0],z);}}
   for(const s of services){if(!z.owner||z.owner===s.tram.userData.variant)continue;const d=distance(leading(s),z.center),next=distance(leading(s,10),z.center);if(d<z.radius+13&&next<d)blocked.add(s.tram.userData.variant);}
  }
  return blocked;
 }};
}
