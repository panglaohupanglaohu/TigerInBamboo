// Authored radial heights, not an Oskar algorithm. Road/creek carving belongs to the caller.
const smooth=(v,a,b)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const mound=(x,z,cx,cz,wx,wz,h)=>h*Math.exp(-(((x-cx)/wx)**2+((z-cz)/wz)**2));
const softmax=(a,b,k)=>Math.max(a,b)+Math.max(0,k-Math.abs(a-b))**2/(4*k);
export function createMorrisLandformProfile({R=160,edge,expansion=1,musicCourt={x:30,z:12,radialHeight:7.2,rx:7,rz:6},castle={x:14,z:5,radialHeight:10.5}}){
 const nodes=[[-16,-22,16,15,24],[-30,-13,17,13,17],[-3,-22,13,16,18],[-25,6,19,14,12.3],[-35,25,18,16,8.4],[6,-6,15,16,12],[30,-5,15,14,9.3],[-18,40,24,24,8.2],[33,37,23,23,8.4]];
 function naturalElevation(x,z){
  const a=Math.atan2(z,x),u=Math.hypot(x,z)/edge(a);if(u>=1)return null;
  // Low, broad asymmetric flower shoulders; depressions between real spurs remain.
  let h=1.7+mound(x,z,0,18,46,47,3.0)+mound(x,z,-40,40,22,18,2.2)+mound(x,z,43,39,21,18,2.0);
  let mass=0;for(const[cx,cz,wx,wz,top]of nodes){const angle=Math.atan2(z-cz,x-cx),warp=1+.055*Math.sin(angle*3+.6)+.04*Math.cos(angle*5);mass=softmax(mass,mound(x,z,cx,cz,wx*warp,wz*warp,top),1.8);}
  h=softmax(h,mass,1.8);
  // Oblique, softly eroded stone benches: lower shoulders retain width, summit stays rounded.
  const upland=smooth(h,7,12)*(1-smooth(u,.76,.94));
  const phase=h/3.8+.10*Math.sin(x*.17+z*.08),whole=Math.floor(phase),f=phase-whole;
  const ledged=(whole+smooth(f,.18,.84)-.10*Math.sin(x*.17+z*.08))*3.8;
  h=mix(h,ledged,upland*.56);
  h+=upland*(.28*Math.sin(x*.41+z*.13)+.20*Math.cos(z*.37-x*.16));
  // Gentle exterior aprons meet unchanged coastline. No raised perimeter wall.
  h=mix(h,1.0+.10*Math.sin(a*5),smooth(u,.83,1));
  // Protected foundations are horizontal world-chart floors, not radially curved discs.
  for(const p of [{...castle,rx:8.2,rz:6.4},{...musicCourt}]){
   const q=(Math.abs((x-p.x)/p.rx)**4+Math.abs((z-p.z)/p.rz)**4)**.25;
   if(q<2.15){const y=Math.sqrt((R+p.radialHeight)**2-p.x*p.x-p.z*p.z)-R,target=Math.hypot(x,R+y,z)-R;h=mix(h,target,1-smooth(q,.95,2.15));}
  }
  return h;
 }
 naturalElevation.report={revision:'morris-wide-eroded-shoulders-r2-20261030',nodes,layers:['low flower meadow','creek foothills','castle and lower east court','rear summit with connected spurs'],castle,musicCourt,carving:'caller owns creek, road and sightline cuts',expansion};return naturalElevation;
}
