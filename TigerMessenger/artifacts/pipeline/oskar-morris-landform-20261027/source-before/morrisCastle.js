import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Preserved three-part massing with independent Morris material/edge refinement.
// Original modular work is retained; metres, +Z is approach.
export function createMorrisCastle({root,position=new T.Vector3()}={}){
 const castle=new T.Group();castle.name='morris-handcrafted-castle';castle.position.copy(position);root?.add(castle);
 const materials=new Map(),supports=[],detailBatches=new Map(),detailCounts={masonry:0,windowSurrounds:0,roofTiles:0,footings:0};
 function material(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:color===0x776044?.98:color===0x98583e?.86:.95}));return materials.get(color);}
 function mesh(g,color,name,p=[0,0,0]){const m=new T.Mesh(g,material(color));m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;castle.add(m);return m;}
 function box(p,s,color,name){return mesh(new T.BoxGeometry(...s),color,name,p);}
 function detail(g,p,color,rotation=0){g.deleteAttribute('uv');g.rotateY(rotation);g.translate(...p);if(!detailBatches.has(color))detailBatches.set(color,[]);detailBatches.get(color).push(g);}
 function detailBox(p,s,color,rotation=0){detail(new T.BoxGeometry(...s),p,color,rotation);}
 function softenedWall(p,size,color,name){const[w,h,d]=size,b=.065,shape=new T.Shape();shape.moveTo(-w/2+b,-h/2+b);shape.lineTo(w/2-b,-h/2+b);shape.lineTo(w/2-b,h/2-b);shape.lineTo(-w/2+b,h/2-b);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,curveSegments:1,steps:1});g.translate(0,0,-d/2+b);return mesh(g,color,name,p);}
 const stone=0xd3c09a,shade=0xb6aa8d,trim=0xe0cfaa,tile=0x98583e,dark=0x40514e;
 function roof(x,y,z,w,d,h,name){
  const p=[-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,-w*.12,h,0,w*.12,h,0];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,4,1,1,4,5,1,5,2,2,5,3,3,5,4,3,4,0,0,1,2,0,2,3]);g.computeVertexNormals();const m=mesh(g,tile,name,[x,y,z]);
  const top=(xx,zz)=>h*Math.max(0,Math.min(1-Math.abs(zz)/(d/2),(w/2-Math.abs(xx))/(w*.38)));
  const nx=Math.ceil(w/.32),nz=Math.ceil(d/.29);
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
   const x0=-w/2+ix*w/nx+.012,x1=-w/2+(ix+1)*w/nx-.012,z0=-d/2+iz*d/nz+.008,z1=-d/2+(iz+1)*d/nz-.008;
   const pts=[];for(const lift of[.018,.055])for(const[a,b]of[[x0,z0],[x1,z0],[x1,z1],[x0,z1]])pts.push(a,top(a,b)+lift,b);
   const tg=new T.BufferGeometry();tg.setAttribute('position',new T.Float32BufferAttribute(pts,3));tg.setIndex([4,7,5,5,7,6,0,1,4,1,5,4,1,2,5,2,6,5,2,3,6,3,7,6,3,0,7,0,4,7]);tg.computeVertexNormals();detail(tg,[x,y,z],[0xa66546,0x9e6040,0xac6b49][(ix+iz*5)%3]);detailCounts.roofTiles++;
  }
  return m;
 }
 function windows(a,side){
  const front=side==='front',span=front?a.w:a.d,angle=front?0:(side==='right'?Math.PI/2:-Math.PI/2),out=front?a.d/2:a.w/2;
  const result=[];
  for(let row=0;row<Math.floor(a.h/2);row++)for(const sign of[-1,1]){
   const u=sign*span*.27,y=1.55+row*2,w=.48,h=.86;
   const at=(uu,yy,dd)=>front?[a.x+uu,yy,a.z+out+dd]:[a.x+(side==='right'?1:-1)*(out+dd),yy,a.z-(side==='right'?1:-1)*uu];
   detailBox(at(u,y,.012),[w,h,.025],dark,angle);
   for(const s of[-1,1])detailBox(at(u+s*(w/2+.06),y,.10),[.12,h+.20,.20],trim,angle);
   detailBox(at(u,y+h/2+.07,.10),[w+.24,.14,.20],trim,angle);
   detailBox(at(u,y-h/2-.055,.12),[w+.32,.13,.27],0xb9a78b,angle);
   detailBox(at(u,y,.05),[.045,h,.07],0x827457,angle);
   result.push({u,y,w:w+.3,h:h+.24});detailCounts.windowSurrounds++;
  }return result;
 }
 function masonry(a,side,openings){
  const front=side==='front',span=front?a.w:a.d,out=front?a.d/2:a.w/2,angle=front?0:(side==='right'?Math.PI/2:-Math.PI/2),rows=Math.floor(a.h/.42);
  for(let row=0;row<rows;row++)for(let col=0;col<Math.ceil(span/.78)+1;col++){
   const width=.67+.08*Math.sin(row*4+col),u=-span/2+col*.78+(row%2)*.39,y=.42+row*.42;
   if(u-width/2<-span/2+.18||u+width/2>span/2-.18||openings.some(o=>Math.abs(u-o.u)<width/2+o.w/2&&Math.abs(y-o.y)<.21+o.h/2))continue;
   const depth=.035+.035*(.5+.5*Math.sin(row*13+col*7)),p=front?[a.x+u,y,a.z+out+depth/2]:[a.x+(side==='right'?1:-1)*(out+depth/2),y,a.z-(side==='right'?1:-1)*u];
   detailBox(p,[width,.35,depth],[0xd0bb94,0xc5b18e,0xd9c8a3,0xbba98b][(col+row*3)%4],angle);detailCounts.masonry++;
  }
 }
 const foundation=box([0,.1,0],[14,.2,10],shade,'castle-continuous-foundation');supports.push(foundation);
 const court=box([0,.235,2.1],[5.4,.07,5.2],0xc7b58e,'castle-open-courtyard-floor');supports.push(court);
 const masses=[{x:-.5,z:-2.2,w:4.8,d:4.8,h:10.5,name:'keep'},{x:-4.8,z:-.5,w:3.8,d:6,h:5.5,name:'long-low-west-wing'},{x:4.8,z:-1,w:3.8,d:5,h:7,name:'short-east-wing'}];
 for(const a of masses){
  softenedWall([a.x,a.h/2+.2,a.z],[a.w,a.h,a.d],stone,'castle-'+a.name);
  box([a.x,a.h+.2,a.z],[a.w+.16,.2,a.d+.16],trim,'castle-'+a.name+'-eave');
  roof(a.x,a.h+.3,a.z,a.w+.6,a.d+.6,a.name==='keep'?2.5:1.6,'castle-'+a.name+'-hipped-roof');
  for(const side of['front','left','right'])masonry(a,side,windows(a,side));
  // Two physical plinth courses seat the walls, rather than a floating colour band.
  for(const [yy,hh,extra]of[[.38,.32,.14],[.68,.20,.07]])detailBox([a.x,yy,a.z],[a.w+extra,hh,a.d+extra],shade);
  for(const sign of[-1,1])box([a.x+sign*(a.w/2-.17),a.h/2+.2,a.z+a.d/2+.04],[.34,a.h,.18],trim,'castle-structural-corner');
 }
 // Open gate: real void beneath an extruded arch, rather than a painted door.
 const r=1.3,spring=1.8,gateY=.27,z=4.25;
 for(const x of[-2.05,2.05])box([x,gateY+1.7,z],[1.5,3.4,.7],stone,'castle-gate-jamb');
 const arch=new T.Shape();arch.moveTo(-r,spring);arch.absarc(0,spring,r,Math.PI,0,true);arch.lineTo(r,3.4);arch.lineTo(-r,3.4);arch.closePath();
 mesh(new T.ExtrudeGeometry(arch,{depth:.7,bevelEnabled:false,curveSegments:16}),stone,'castle-open-arch-crown',[0,gateY,z-.35]);
 for(const sign of[-1,1]){
  const door=box([sign*1.48,1.12,z-.15],[.12,1.7,1.1],0x776044,'castle-folded-open-timber-door');door.rotation.y=sign*.22;
  box([sign*2.05,3.75,z],[1.75,.3,1],trim,'castle-gate-cap');
  for(let row=0;row<7;row++)detailBox([sign*2.05,.5+row*.44,z+.39],[1.38,.37,.09],[0xd0bb94,0xc5b18e,0xd9c8a3][row%3]);
 }
 // Individual wedge voussoirs project forward but never narrow the 2.6m arch.
 for(let i=0;i<13;i++){
  const t0=i*Math.PI/13+.012,t1=(i+1)*Math.PI/13-.012,pts=[];
  for(const zz of[-.035,.095])for(const[radius,angle]of[[r,t0],[r+.27,t0],[r+.27,t1],[r,t1]])pts.push(Math.cos(angle)*radius,Math.sin(angle)*radius,zz);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setIndex([4,5,7,5,6,7,0,3,1,1,3,2,0,1,4,1,5,4,1,2,5,2,6,5,2,3,6,3,7,6,3,0,7,0,4,7]);g.computeVertexNormals();detail(g,[0,gateY+spring,z+.35],i%2?trim:shade);detailCounts.masonry++;
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
 const report={design:'independent Morris handcraft material and softened-edge refinement; original modular massing retained',revision:'morris-handcraft-r3',previousGeometry:'masonry-r2',wallBevel:.065,footprint:[14,10],size:size.toArray(),mainHeights:[10.5,7,5.5],entrance:{direction:'+Z',clearWidth:2.6,clearHeight:3.1},eastMusicCourtOpen:true,supports:['continuous foundation','courtyard floor'],detailCounts,detailBatches:detailBatches.size,navigationVerified:false};
 castle.userData.castle=report;
 return{castle,root:castle,supports,bounds,report};
}
