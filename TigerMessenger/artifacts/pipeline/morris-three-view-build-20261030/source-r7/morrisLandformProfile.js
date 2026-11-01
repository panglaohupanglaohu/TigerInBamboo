// Authored radial heights, not an Oskar algorithm. Road/creek carving belongs to the caller.
const smooth=(v,a,b)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const mound=(x,z,cx,cz,wx,wz,h)=>h*Math.exp(-(((x-cx)/wx)**2+((z-cz)/wz)**2));
const softmax=(a,b,k)=>Math.max(a,b)+Math.max(0,k-Math.abs(a-b))**2/(4*k);
export function createMorrisLandformProfile({R=160,edge,expansion=1,musicCourt={x:30,z:12,radialHeight:7.2,rx:7,rz:6},castle={x:14,z:5,radialHeight:10.5}}){
 const nodes=[[-24,-33,15,14,32],[-28,-20,26,23,24],[-44,-6,19,22,18],[-37,18,22,23,13.5],[-30,42,22,18,9],[-12,36,21,18,7.5],[-13,57,20,14,5.8],[36,-4,19,19,15],[43,20,18,20,11.5],[42,44,19,18,8.5]];
 const spines=[[-29,-16,-41,32,10,18,11],[-24,-10,-18,44,10,16,7],[35,0,45,48,9,12,8.4]];
 const spine=(x,z,a,b,c,d,w,ha,hb)=>{const dx=c-a,dz=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz))),q=Math.hypot(x-a-dx*t,z-b-dz*t)/w;return mix(ha,hb,t)*Math.exp(-q*q);};
 function naturalElevation(x,z){
  const a=Math.atan2(z,x),u=Math.hypot(x,z)/edge(a);if(u>=1)return null;
  // Low, broad asymmetric flower shoulders; depressions between real spurs remain.
  let h=1.7+mound(x,z,0,18,46,47,3.0)+mound(x,z,-40,40,22,18,2.2)+mound(x,z,43,39,21,18,2.0);
  let mass=0;for(const[cx,cz,wx,wz,top]of nodes){const angle=Math.atan2(z-cz,x-cx),warp=1+.055*Math.sin(angle*3+.6)+.04*Math.cos(angle*5);const q=((x-cx)/(wx*warp))**2+((z-cz)/(wz*warp))**2;mass=softmax(mass,top*Math.exp(-Math.pow(q,2.35)),2.8);}
  for(const p of spines)mass=softmax(mass,spine(x,z,...p),1.8);
  h=softmax(h,mass,1.8);
  // Oblique, softly eroded stone benches: lower shoulders retain width, summit stays rounded.
  const upland=smooth(h,7,12)*(1-smooth(u,.76,.94));
  // Rock benches follow three oblique local bands, never concentric height contours.
  const bands=[[-27,-14,.65,.76,16,1.25],[-24,13,.88,-.47,19,1.0],[38,24,.50,.86,16,.85]];
  for(const[cx,cz,tx,tz,w,amp]of bands){const along=(x-cx)*tx+(z-cz)*tz,cross=-(x-cx)*tz+(z-cz)*tx,window=Math.exp(-((along/w)**2+(cross/(w*.72))**2));h+=upland*window*amp*Math.tanh(2.0*Math.sin(cross*.38+along*.07));}
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
 naturalElevation.report={revision:'morris-wide-eroded-shoulders-r7-staggered-wide-benches-20261030',nodes,spines,layers:['low flower meadow','creek foothills','castle and lower east court','rear summit with connected spurs'],castle,musicCourt,carving:'caller owns creek, road and sightline cuts',expansion};return naturalElevation;
}
