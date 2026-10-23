import * as T from 'three';

// One continuous jaw/nose/cheek surface; beard is colour on the skin surface.
export function buildExpeditionFace(head){
 const skin=new T.MeshStandardMaterial({name:'courier-face-skin',color:0xffffff,vertexColors:true,roughness:.94});
 const neckMaterial=new T.MeshStandardMaterial({name:'courier-face-neck',color:0xb99b82,roughness:.94});
 const neck=new T.Mesh(new T.CylinderGeometry(.048,.055,.10,20),neckMaterial);neck.position.set(0,-.014,-.008);head.add(neck);
 const dark=new T.MeshStandardMaterial({name:'courier-face-brows',color:0x393a36,roughness:1});
 const lid=new T.MeshStandardMaterial({name:'courier-face-lids',color:0x896a59,roughness:1});
 const white=new T.MeshStandardMaterial({name:'courier-face-eye',color:0xd8d0bc,roughness:.65});
 const iris=new T.MeshStandardMaterial({name:'courier-face-iris',color:0x33454a,roughness:.6});
 const rows=[[.009,.026,.030,.064],[.022,.039,.038,.083],[.043,.054,.047,.085],[.061,.067,.057,.077],[.080,.074,.064,.075],[.100,.081,.072,.078],[.120,.082,.074,.079],[.140,.082,.077,.082],[.160,.085,.078,.083],[.185,.086,.077,.080],[.212,.077,.069,.068],[.237,.048,.042,.039]];
 const interpolate=y=>{for(let j=1;j<rows.length;j++)if(y<=rows[j][0]){const a=rows[j-1],b=rows[j],t=T.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);return a.map((v,i)=>T.MathUtils.lerp(v,b[i],t));}return rows.at(-1);};
 function front(x,y){const [,w,,z]=interpolate(y),c=Math.sqrt(Math.max(0,1-(x/w)**2));
  const nose=.017*Math.exp(-Math.pow(((y-.092)/.018),2))+.014*Math.exp(-Math.pow(((y-.118)/.031),2));
  const nasal=nose*Math.exp(-Math.pow((x/.013),2))*c**6;
  const cheek=.0065*Math.exp(-Math.pow(((y-.106)/.022),2))*Math.exp(-Math.pow(((Math.abs(x)-.053)/.019),2));
  const socket=-.009*Math.exp(-Math.pow(((y-.131)/.013),2))*Math.exp(-Math.pow(((Math.abs(x)-.036)/.020),2));
  const brow=.007*Math.exp(-Math.pow((y-.147)/.009,2))*Math.exp(-Math.pow((Math.abs(x)-.032)/.024,2));
  const hollow=-.0035*Math.exp(-Math.pow((y-.079)/.014,2))*Math.exp(-Math.pow((Math.abs(x)-.057)/.019,2));
  const chin=.007*Math.exp(-Math.pow((y-.034)/.012,2))*Math.exp(-Math.pow(x/.033,4));
  return z*Math.pow(c,.87)+nasal+cheek+socket+brow+hollow+chin;
 }
 const positions=[],colors=[],indices=[],segments=64,vertical=48;
 const skinColor=new T.Color(0xc0a088),beardColor=new T.Color(0x55554c);
 for(let j=0;j<=vertical;j++){const y=.009+(.237-.009)*j/vertical,[,w,back]=interpolate(y);for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2,x=Math.sin(a)*w,c=Math.cos(a),z=c>=0?front(x,y):c*back;positions.push(x,y,z);
  const jawLine=.052+.038*T.MathUtils.smoothstep(Math.abs(x),.024,.075);
  const beard=c>0?1-T.MathUtils.smoothstep(y,jawLine-.014,jawLine+.008):0;
  const colour=skinColor.clone().lerp(beardColor,beard*.86);const grain=Math.sin(i*41.7+j*17.1)*.018;colour.multiplyScalar(1+grain);colors.push(colour.r,colour.g,colour.b);
 }}
 for(let j=0;j<vertical;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;indices.push(a,b,c,b,d,c);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const face=new T.Mesh(geometry,skin);face.name='expedition-continuous-face';head.add(face);
 const ell=(pos,scale,mat)=>{const m=new T.Mesh(new T.SphereGeometry(1,16,10),mat);m.position.set(...pos);m.scale.set(...scale);head.add(m);return m;};
 const line=(xy,r,mat,lift=.0015)=>{const pts=xy.map(([x,y])=>new T.Vector3(x,y,front(x,y)+lift));const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),16,r,5,false),mat);head.add(m);return m;};
 for(const s of[-1,1]){
  const x=s*.034,y=.132,z=front(x,y);
  ell([x,y,z+.001],[.013,.0037,.0025],white);
  ell([x,y,z+.003],[.0032,.0029,.0012],iris);
  line([[s*.018,.132],[s*.034,.135],[s*.050,.135]],.0018,lid);
  line([[s*.017,.141],[s*.034,.147],[s*.056,.149]],.0035,dark);
  line([[s*.025,.061],[s*.017,.065],[s*.003,.064]],.0030,dark);
  line([[s*.022,.077],[s*.026,.068],[s*.031,.059]],.00065,lid,.0006);
  line([[s*.022,.122],[s*.037,.120],[s*.049,.124]],.00065,lid,.0006);
  line([[s*.052,.131],[s*.064,.126]],.00055,lid,.0005);
  ell([s*.083,.113,-.002],[.009,.020,.010],new T.MeshStandardMaterial({color:0xb29079,roughness:.95}));
  ell([s*.01,.079,front(s*.01,.079)+.001],[.003,.0018,.001],lid);
 }
 line([[-.022,.055],[-.011,.056],[0,.0555],[.011,.056],[.022,.055]],.0013,lid);
 // Short stubble follows the face, with scattered grey hairs at the chin and temples.
 for(let i=0;i<680;i++){const x=Math.sin(i*14.713)*.076,y=.021+((Math.sin(i*47.12)*.5+.5)*.076),jaw=.049+.042*T.MathUtils.smoothstep(Math.abs(x),.025,.074);if(y>jaw||Math.abs(x)>interpolate(y)[1]*.93)continue;const dx=Math.sin(i*4.9)*.0012,dy=.0025+(i%4)*.00045;line([[x,y],[x+dx,y-dy]],.00034,i%7===0?neckMaterial:dark,.0008);}
 head.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
 head.userData.faceRevision='lean-angular-reference-face-5';
 return face;
}
