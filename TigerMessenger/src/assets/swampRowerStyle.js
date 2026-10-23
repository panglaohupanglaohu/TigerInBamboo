import * as THREE from 'three';

// Only the swamp work crews use these clothes. All saved Blender pose nodes,
// hands, oar contacts and passenger identities remain the real animation rig.
export function createSwampRowerStyle(){
 const palette={cloth:0xa7b9b6,fold:0x879f9f,wrap:0x8da4a3,headwear:0xb8ac86,skin:0xd8b7a0,ink:0x435968};
 const material=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});material.name='swamp-rower-fine-cloth';
 const skin=new THREE.MeshBasicMaterial({color:palette.skin,toneMapped:false});skin.name='swamp-rower-original-grip';
 const templates=new Map();
 function oval(rings){
  const p=[],segments=12;
  const point=(r,i)=>{const a=i/segments*Math.PI*2;return [Math.cos(a)*r[1],r[0],Math.sin(a)*r[2]];};
  const tri=(a,b,c)=>p.push(...a,...b,...c);
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
   const a=point(rings[j],i),b=point(rings[j],i+1),c=point(rings[j+1],i),d=point(rings[j+1],i+1);tri(a,c,b);tri(b,c,d);
  }
  for(let i=0;i<segments;i++){tri([0,rings[0][0],0],point(rings[0],i),point(rings[0],i+1));tri([0,rings.at(-1)[0],0],point(rings.at(-1),i+1),point(rings.at(-1),i));}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;
 }
 function sphere(radius,scale,position){return new THREE.SphereGeometry(radius,12,8).scale(...scale).translate(...position);}
 function combine(pieces){
  const positions=[],normals=[],colors=[];
  for(const [source,color,ink=true] of pieces){
   const g=source.index?source.toNonIndexed():source,p=g.attributes.position,n=g.attributes.normal,c=new THREE.Color(color),line=new THREE.Color(palette.ink);
   for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(c.r,c.g,c.b);}
   // A sub-millimetre boat-local reverse shell shares this draw. It cannot
   // inflate a tiny wrist into the former thick blue-looking sleeve silhouette.
   if(ink)for(let i=0;i<p.count;i+=3)for(const j of [0,2,1]){
    const k=i+j,w=.00065;positions.push(p.getX(k)+n.getX(k)*w,p.getY(k)+n.getY(k)*w,p.getZ(k)+n.getZ(k)*w);normals.push(-n.getX(k),-n.getY(k),-n.getZ(k));colors.push(line.r,line.g,line.b);
   }
   if(g!==source)g.dispose();source.dispose();
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();return g;
 }
 function build(role){
  if(role==='220')return combine([[oval([[.021,.058,.036],[.05,.053,.034],[.11,.062,.038],[.137,.066,.036],[.16,.042,.03]]),palette.cloth]]);
  if(role==='221')return combine([[oval([[-.06,.089,.06],[-.035,.085,.055],[0,.065,.04],[.024,.057,.036]]),palette.wrap]]);
  if(role==='222')return combine([
   [sphere(1,[.039,.047,.034],[0,.191,.006]),palette.skin],
   [sphere(1,[.008,.011,.01],[0,.19,.039]),palette.skin],
   [sphere(1,[.0028,.0025,.0015],[-.014,.202,.037]),palette.ink,false],
   [sphere(1,[.0028,.0025,.0015],[.014,.202,.037]),palette.ink,false],
  ]);
  if(role==='223')return combine([[new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI*.53).scale(.044,.038,.039).translate(0,.211,.003),palette.headwear]]);
  if(role==='227'||role==='228')return combine([
   [new THREE.CylinderGeometry(.022,.02,.15,8).translate(0,-.075,0),palette.skin],
   [new THREE.CylinderGeometry(.029,.027,.059,10).translate(0,-.025,0),palette.cloth],
  ]);
  if(role==='229'||role==='230')return combine([[new THREE.CylinderGeometry(.024,.021,.16,8).translate(0,-.08,0),palette.fold]]);
  return null;
 }
 return {material,skin,templates,resolve(id,original){
  const role=/^n(22[0-9]|230):i\d+$/.exec(id||'')?.[1];
  if(role){
   // Saved crest nodes stay in the rig/boarding slots; a low cloth head wrap
   // replaces the three ornamental feather layers for these working crews.
   if(['224','225','226'].includes(role))return [];
   const key=['228'].includes(role)?'227':role==='230'?'229':role;
   if(!templates.has(key))templates.set(key,build(key));
   const g=templates.get(key);return [{g,material,signature:`swamp-robe-${key}`}];
  }
  if(/^add:(forearm|hand)-\d+[LR]$/.test(id||''))return original.map(part=>({...part,material:skin,signature:`swamp-grip-${part.signature}`}));
  return original;
 }};
}
