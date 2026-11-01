import * as T from 'three';

// Project interpretation of modular massing and connected entrances, not an
// implementation of Oskar Stålberg's private generator. Metres, +Z is approach.
export function createMorrisCastle({root,position=new T.Vector3()}={}){
 const castle=new T.Group();castle.name='morris-oskar-modular-castle';castle.position.copy(position);root?.add(castle);
 const materials=new Map(),supports=[];
 function material(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.94}));return materials.get(color);}
 function mesh(g,color,name,p=[0,0,0]){const m=new T.Mesh(g,material(color));m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;castle.add(m);return m;}
 function box(p,s,color,name){return mesh(new T.BoxGeometry(...s),color,name,p);}
 const stone=0xd3c09a,shade=0xb6aa8d,trim=0xe0cfaa,tile=0x98583e,dark=0x40514e;
 function roof(x,y,z,w,d,h,name){
  const p=[-w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2,-w*.12,h,0,w*.12,h,0];
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,4,1,1,4,5,1,5,2,2,5,3,3,5,4,3,4,0,0,1,2,0,2,3]);g.computeVertexNormals();return mesh(g,tile,name,[x,y,z]);
 }
 const foundation=box([0,.1,0],[14,.2,10],shade,'castle-continuous-foundation');supports.push(foundation);
 const court=box([0,.235,2.1],[5.4,.07,5.2],0xc7b58e,'castle-open-courtyard-floor');supports.push(court);
 const masses=[{x:-.5,z:-2.2,w:4.8,d:4.8,h:10.5,name:'keep'},{x:-4.8,z:-.5,w:3.8,d:6,h:5.5,name:'long-low-west-wing'},{x:4.8,z:-1,w:3.8,d:5,h:7,name:'short-east-wing'}];
 for(const a of masses){
  box([a.x,a.h/2+.2,a.z],[a.w,a.h,a.d],stone,'castle-'+a.name);
  box([a.x,a.h+.2,a.z],[a.w+.16,.2,a.d+.16],trim,'castle-'+a.name+'-eave');
  roof(a.x,a.h+.3,a.z,a.w+.6,a.d+.6,a.name==='keep'?2.5:1.6,'castle-'+a.name+'-hipped-roof');
  for(let row=0;row<Math.floor(a.h/2);row++)for(const sign of[-1,1])box([a.x+sign*a.w*.27,1.55+row*2,a.z+a.d/2+.025],[.42,.8,.08],dark,'castle-deep-window');
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
 }
 // The east side deliberately stays open to the existing musician court.
 for(const x of[-2.45,2.45])box([x,.32,2.1],[.06,.04,4.1],trim,'castle-courtyard-paving-border');
 castle.updateWorldMatrix(true,true);
 const bounds=new T.Box3().setFromObject(castle),size=bounds.getSize(new T.Vector3());
 const report={design:'project Oskar-method modular massing proposal',footprint:[14,10],size:size.toArray(),mainHeights:[10.5,7,5.5],entrance:{direction:'+Z',clearWidth:2.6,clearHeight:3.1},eastMusicCourtOpen:true,supports:['continuous foundation','courtyard floor'],navigationVerified:false};
 castle.userData.castle=report;
 return{castle,root:castle,supports,bounds,report};
}
