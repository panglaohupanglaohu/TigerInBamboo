import * as T from 'three';

export function buildExpeditionHair(head){
 const base=new T.MeshStandardMaterial({name:'courier-hair-dark',color:0x34332f,roughness:.97});
 const grey=new T.MeshStandardMaterial({name:'courier-hair-grey',color:0x827f75,roughness:.97});
 const cap=new T.Mesh(new T.SphereGeometry(1,24,16),base);cap.position.set(0,.203,-.017);cap.scale.set(.090,.055,.082);head.add(cap);
 function lock(points,radius,index){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),frames=curve.computeFrenetFrames(12,false),positions=[],indices=[];
  for(let j=0;j<=12;j++){const t=j/12,p=curve.getPointAt(t),r=radius*(.55+.75*Math.sin(t*Math.PI))*(1-t*.985);for(let i=0;i<=8;i++){const a=i/8*Math.PI*2,v=p.clone().addScaledVector(frames.normals[j],Math.cos(a)*r).addScaledVector(frames.binormals[j],Math.sin(a)*r*.82);positions.push(...v.toArray());}}
  for(let j=0;j<12;j++)for(let i=0;i<8;i++){const a=j*9+i,b=a+1,c=a+9,d=c+1;indices.push(a,c,b,b,c,d);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const m=new T.Mesh(g,base);m.name='swept-tapered-hair-lock';head.add(m);
  // Fine grey strands follow the raised crown, rather than white end-caps.
  if(index%4===0){const strand=[];for(let j=1;j<11;j++){const t=j/12,p=curve.getPointAt(t);p.addScaledVector(frames.binormals[j],radius*.35*(1-t));strand.push(p);}const h=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(strand),12,.0008,4,false),grey);head.add(h);}
 }
 for(let row=0;row<4;row++)for(let i=0;i<13;i++){
  const phase=Math.sin(i*2.19+row*3.7),x=(i-6)*.012+phase*.003,a=Math.abs(x)/.08,z=.064-row*.031;
  const rise=.014*Math.sin(i*1.31+row*2.3),sweep=.016*Math.sin(i*.8+row);
  lock([[x,.198+row*.006,z],[x+sweep*.4,.225+rise-a*.009,z+.003],[x+sweep,.254+rise-a*.017,z-.025],[x+sweep+.007,.262+rise-a*.02,z-.052],[x+sweep+.014,.238+rise-a*.012,z-.082]],.0095+(phase+1)*.0018,i+row*13);
 }
 for(const side of[-1,1])for(let j=0;j<15;j++){
  const y=.190-j*.0075,z=-.018-(j%3)*.014,phase=Math.sin(j*2.17);
  lock([[side*.078,y,z],[side*.089,y-.018,z-.019],[side*(.087+phase*.005),y-.035,z-.040],[side*(.091+phase*.006),y-.030,z-.055]],.010,j);
 }
 // A small uneven front lock falls over the headband.
 lock([[.025,.232,.071],[.006,.221,.090],[-.006,.193,.097],[.005,.180,.100]],.011,0);
 head.userData.hairRevision='swept-tapered-grey-strands-2';
}
