import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Morris castle restyled to the Highland citadel (高山圣城) vocabulary: pale blue-grey walls,
// blue cornice bands, slate roofs and arched warm windows set in dark reveals.
// Footprint, +Z approach, the 2.6 m gate passage and the open east musician court are unchanged.
const WARM_GLASS=0xffb066;

function archShape(w,h){const r=w/2,sy=h-r,s=new T.Shape();s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,sy);s.absarc(0,sy,r,0,Math.PI,false);s.closePath();return s;}

export function createMorrisCastle({root,position=new T.Vector3()}={}){
 const castle=new T.Group();castle.name='morris-handcrafted-castle';castle.position.copy(position);root?.add(castle);
 const materials=new Map(),supports=[],detailBatches=new Map(),detailCounts={masonry:0,windowSurrounds:0,roofTiles:0,footings:0};
 function material(color){if(!materials.has(color)){const m=new T.MeshStandardMaterial({color,roughness:color===WARM_GLASS?.55:.93});if(color===WARM_GLASS){m.emissive.setHex(0xff8a3d);m.emissiveIntensity=.32;}materials.set(color,m);}return materials.get(color);}
 function mesh(g,color,name,p=[0,0,0]){const m=new T.Mesh(g,material(color));m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;castle.add(m);return m;}
 function box(p,s,color,name){return mesh(new T.BoxGeometry(...s),color,name,p);}
 function detail(g,p,color,rotation=0){g.deleteAttribute('uv');g.rotateY(rotation);g.translate(...p);if(!detailBatches.has(color))detailBatches.set(color,[]);detailBatches.get(color).push(g);}
 function detailBox(p,s,color,rotation=0){detail(new T.BoxGeometry(...s),p,color,rotation);}
 function softenedWall(p,size,color,name){const[w,h,d]=size,b=.10,shape=new T.Shape();shape.moveTo(-w/2+b,-h/2+b);shape.lineTo(w/2-b,-h/2+b);shape.lineTo(w/2-b,h/2-b);shape.lineTo(-w/2+b,h/2-b);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:1,steps:1});g.translate(0,0,-d/2+b);return mesh(g,color,name,p);}
 // Highland palette: wallLight d8e1e8, wallMid a9bdcf, wallShadow 7898b5, band 6685a0, roof 5d7790, windowDark 13243a.
 const stone=0xd8e1e8,shade=0xa9bdcf,plinth=0x7898b5,trim=0x6685a0,slate=0x5d7790,dark=0x13243a,pale=0xe3ebf1;
 function roof(x,y,z,w,d,h,name){
  const p=[-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,-w*.12,h,0,w*.12,h,0];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,4,1,1,4,5,1,5,2,2,5,3,3,5,4,3,4,0,0,1,2,0,2,3]);g.computeVertexNormals();const m=mesh(g,slate,name,[x,y,z]);
  const nx=Math.ceil(w/.32),nz=Math.ceil(d/.29);
  // Clip each slate tile to the four exact hip planes; a quad spanning the ridge
  // otherwise cuts through the roof core and produces black sawtooth seams.
  const planes=[[0,-2*h/d,h],[0,2*h/d,h],[-h/(w*.38),0,h*.5/.38],[h/(w*.38),0,h*.5/.38]];
  const value=(plane,p)=>plane[0]*p[0]+plane[1]*p[1]+plane[2];
  const clip=(poly,A,B)=>{const out=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=value(A,a)-value(B,a),db=value(A,b)-value(B,b),ina=da<=1e-8,inb=db<=1e-8;if(ina)out.push(a);if(ina!==inb){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;};
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
   const x0=-w/2+ix*w/nx+.009,x1=-w/2+(ix+1)*w/nx-.009,z0=-d/2+iz*d/nz+.006,z1=-d/2+(iz+1)*d/nz-.006;
   for(let f=0;f<planes.length;f++){let poly=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];for(let k=0;k<planes.length&&poly.length;k++)if(k!==f)poly=clip(poly,planes[f],planes[k]);if(poly.length<3)continue;const pts=[],idx=[],n=poly.length;for(const lift of[.012,.044])for(const[a,b]of poly)pts.push(a,value(planes[f],[a,b])+lift,b);for(let j=1;j<n-1;j++)idx.push(n,n+j+1,n+j,0,j,j+1);for(let j=0;j<n;j++){const k=(j+1)%n;idx.push(j,k,n+j,k,n+k,n+j);}const tg=new T.BufferGeometry();tg.setAttribute('position',new T.Float32BufferAttribute(pts,3));tg.setIndex(idx);tg.computeVertexNormals();detail(tg,[x,y,z],[0x5d7790,0x667f98,0x54708a][(ix+iz*5)%3]);}
   detailCounts.roofTiles++;
  }
  return m;
 }
 // Arched window: dark reveal, glowing arch glass, and a projecting trim sill, as on the Highland facades.
 function windows(a,side){
  const front=side==='front',span=front?a.w:a.d,angle=front?0:(side==='right'?Math.PI/2:-Math.PI/2),out=front?a.d/2:a.w/2;
  const at=(uu,yy,dd)=>front?[a.x+uu,yy,a.z+out+dd]:[a.x+(side==='right'?1:-1)*(out+dd),yy,a.z-(side==='right'?1:-1)*uu];
  const result=[];
  for(let row=0;row<Math.floor(a.h/2);row++)for(const sign of[-1,1]){
   const u=sign*span*.27,w=.5,h=1.0,y0=1.35+row*2.05;
   detail(new T.ShapeGeometry(archShape(w+.2,h+.2),6),at(u,y0-.1,.012),dark,angle);
   detail(new T.ShapeGeometry(archShape(w,h),6),at(u,y0,.03),WARM_GLASS,angle);
   detailBox(at(u,y0-.14,.08),[w+.36,.09,.16],trim,angle);
   result.push({u,y:y0+h/2,w:w+.36,h:h+.3});detailCounts.windowSurrounds++;
  }return result;
 }
 function masonry(a,side,openings){
  const front=side==='front',span=front?a.w:a.d,out=front?a.d/2:a.w/2,angle=front?0:(side==='right'?Math.PI/2:-Math.PI/2),rows=Math.floor(a.h/.42);
  for(let row=0;row<rows;row++)for(let col=0;col<Math.ceil(span/.78)+1;col++){
   const width=.67+.08*Math.sin(row*4+col),u=-span/2+col*.78+(row%2)*.39,y=.42+row*.42;
   if(u-width/2<-span/2+.18||u+width/2>span/2-.18||openings.some(o=>Math.abs(u-o.u)<width/2+o.w/2&&Math.abs(y-o.y)<.21+o.h/2))continue;
   const depth=.035+.035*(.5+.5*Math.sin(row*13+col*7)),p=front?[a.x+u,y,a.z+out+depth/2]:[a.x+(side==='right'?1:-1)*(out+depth/2),y,a.z-(side==='right'?1:-1)*u];
   detailBox(p,[width,.35,depth],[stone,pale,0xcad8e3,0xbccedb][(col+row*3)%4],angle);detailCounts.masonry++;
  }
 }
 const foundation=box([0,.1,0],[14,.2,10],shade,'castle-continuous-foundation');supports.push(foundation);
 const court=box([0,.235,2.1],[5.4,.07,5.2],0xc5d1d8,'castle-open-courtyard-floor');supports.push(court);
 const masses=[
  {x:-.35,z:-2.3,w:3.45,d:4.35,h:13.2,name:'keep'},
  {x:-4.8,z:-.6,w:3.2,d:5.5,h:4.8,name:'long-low-west-wing'},
  {x:-2.5,z:-.4,w:1.8,d:4.7,h:7.1,name:'west-stair-tower'},
  {x:4.65,z:-1.1,w:3.4,d:5.1,h:6.1,name:'short-east-wing'},
  {x:2.15,z:-1.25,w:1.65,d:4.25,h:8.5,name:'east-stair-tower'}
 ];
 for(const a of masses){
  softenedWall([a.x,a.h/2+.2,a.z],[a.w,a.h,a.d],stone,'castle-'+a.name);
  // Blue cornice band under the slate roof, as on the Highland tower bands.
  box([a.x,a.h+.2,a.z],[a.w+.16,.2,a.d+.16],trim,'castle-'+a.name+'-eave');
  box([a.x,a.h-.9,a.z],[a.w+.12,.12,a.d+.12],trim,'castle-'+a.name+'-cornice');
  roof(a.x,a.h+.3,a.z,a.w+.6,a.d+.6,a.name==='keep'?3.15:a.name.includes('stair')?1.8:1.45,'castle-'+a.name+'-hipped-roof');
  for(const side of['front','left','right'])masonry(a,side,windows(a,side));
  // Two plinth courses seat the walls in the Highland wallShadow tone.
  for(const [yy,hh,extra]of[[.38,.32,.14],[.68,.20,.07]])detailBox([a.x,yy,a.z],[a.w+extra,hh,a.d+extra],plinth);
  for(const sign of[-1,1])box([a.x+sign*(a.w/2-.17),a.h/2+.2,a.z+a.d/2+.04],[.20,a.h,.10],pale,'castle-structural-corner');
 }
 // Open gate: real void beneath an extruded arch, rather than a painted door.
 const r=1.3,spring=1.8,gateY=.27,z=4.25;
 for(const x of[-2.05,2.05])box([x,gateY+1.7,z],[1.5,3.4,.7],stone,'castle-gate-jamb');
 const arch=new T.Shape();arch.moveTo(-r,spring);arch.absarc(0,spring,r,Math.PI,0,true);arch.lineTo(r,3.4);arch.lineTo(-r,3.4);arch.closePath();
 mesh(new T.ExtrudeGeometry(arch,{depth:.7,bevelEnabled:false,curveSegments:16}),stone,'castle-open-arch-crown',[0,gateY,z-.35]);
 for(const sign of[-1,1]){
  const door=box([sign*1.48,1.12,z-.15],[.12,1.7,1.1],0x33506e,'castle-folded-open-slate-door');door.rotation.y=sign*.22;
  box([sign*2.05,3.75,z],[1.75,.3,1],trim,'castle-gate-cap');
  for(let row=0;row<7;row++)detailBox([sign*2.05,.5+row*.44,z+.39],[1.38,.37,.09],[0xc4d3df,0xb4c7d6,0xd3e0ea][row%3]);
 }
 // Individual wedge voussoirs project forward but never narrow the 2.6m arch.
 for(let i=0;i<13;i++){
  const t0=i*Math.PI/13+.012,t1=(i+1)*Math.PI/13-.012,pts=[];
  for(const zz of[-.035,.095])for(const[radius,angle]of[[r,t0],[r+.27,t0],[r+.27,t1],[r,t1]])pts.push(Math.cos(angle)*radius,Math.sin(angle)*radius,zz);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setIndex([4,5,7,5,6,7,0,3,1,1,3,2,0,1,4,1,5,4,1,2,5,2,6,5,2,3,6,3,7,6,3,0,7,0,4,7]);g.computeVertexNormals();detail(g,[0,gateY+spring,z+.35],i%2?trim:pale);detailCounts.masonry++;
 }
 for(const a of masses)for(let j=0;j<6;j++){
  const xx=a.x-a.w/2+.35+j*(a.w-.7)/5;
  detailBox([xx,.29,a.z+a.d/2+.16],[.55,.18,.30],j%2?shade:stone);detailCounts.footings++;
 }
 // The east side deliberately stays open to the existing musician court.
 for(const x of[-2.45,2.45])box([x,.32,2.1],[.06,.04,4.1],trim,'castle-courtyard-paving-border');
 for(const[color,geometries]of detailBatches){const merged=mergeGeometries(geometries.map(g=>g.index?g.toNonIndexed():g),false);mesh(merged,color,'castle-static-detail-batch');geometries.forEach(g=>g.dispose());}
 castle.updateWorldMatrix(true,true);
 const bounds=new T.Box3().setFromObject(castle),size=bounds.getSize(new T.Vector3());
 const report={design:'Morris castle restyled to the Highland citadel vocabulary: blue-grey walls, blue cornice bands, slate roofs, arched warm windows; original footprint, gate and east court retained',revision:'highland-citadel-style-r7',previousGeometry:'oskar-reference-slender-keep-r6',wallBevel:.10,footprint:[14,10],size:size.toArray(),mainHeights:masses.map(a=>a.h),masses:masses.map(a=>({...a})),reference:'Highland citadel (odysseyCitadel / highlandCitadelDesign) palette and window language',entrance:{direction:'+Z',clearWidth:2.6,clearHeight:3.1},eastMusicCourtOpen:true,supports:['continuous foundation','courtyard floor'],detailCounts,detailBatches:detailBatches.size,navigationVerified:false};
 castle.userData.castle=report;
 return{castle,root:castle,supports,bounds,report};
}
