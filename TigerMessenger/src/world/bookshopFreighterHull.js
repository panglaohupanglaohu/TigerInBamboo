import * as T from 'three';

// The existing vessel faces +Z. Each closed waterline has a parallel working
// middle, a narrowing forebody and a rounded stern, rather than an extrusion.
const sections=[
  [.02,2.88,9.60,5.50,-8.20,-6.80],
  [-.35,2.93,9.42,5.50,-8.15,-6.75],
  [-.90,2.88,9.28,5.45,-7.98,-6.60],
  [-1.50,2.72,9.50,6.45,-7.72,-6.40],
  [-2.05,2.10,10.20,6.70,-7.25,-6.10],
  [-2.60,1.34,9.70,5.90,-6.65,-5.75],
  [-3.10,.62,7.35,4.70,-6.03,-5.25],
  [-3.40,.18,5.85,3.80,-5.55,-4.90],
];
// Monotone Hermite waterlines round the nose without cubic overshoot into
// the quay. End slopes are shared, avoiding a crease at each authored station.
const interpolateSection=(i,t)=>{
  const a=sections[i],b=sections[i+1],h=a[0]-b[0];
  const slope=(k,j)=>{const d=(sections[k+1][j]-sections[k][j])/(sections[k][0]-sections[k+1][0]);return d;};
  const tangent=(k,j)=>{if(k===0)return slope(0,j);if(k===sections.length-1)return slope(k-1,j);const u=slope(k-1,j),v=slope(k,j);return u*v<=0?0:2*u*v/(u+v);};
  return a.map((v,j)=>j===0?T.MathUtils.lerp(v,b[j],t):(2*t**3-3*t*t+1)*v+(t**3-2*t*t+t)*h*tangent(i,j)+(-2*t**3+3*t*t)*b[j]+(t**3-t*t)*h*tangent(i+1,j));
};
const ringPoints=([y,beam,bow,bowShoulder,stern,sternShoulder])=>{
  const points=[];
  for(let i=0;i<16;i++){const a=-Math.PI/2+i*Math.PI/16;points.push([beam*Math.sin(a),y,bowShoulder+(bow-bowShoulder)*Math.cos(a)]);}
  for(let i=0;i<8;i++)points.push([beam,y,bowShoulder+(sternShoulder-bowShoulder)*i/8]);
  for(let i=0;i<16;i++){const a=Math.PI/2+i*Math.PI/16;points.push([beam*Math.sin(a),y,sternShoulder+(sternShoulder-stern)*Math.cos(a)]);}
  for(let i=0;i<8;i++)points.push([-beam,y,sternShoulder+(bowShoulder-sternShoulder)*i/8]);
  return points;
};

export function createBookshopFreighterHull(depth=3.4){
  const dense=[];
  for(let i=0;i<sections.length-1;i++)for(let step=0;step<4;step++){const t=step/4;dense.push(interpolateSection(i,t));}
  dense.push(sections.at(-1));
  const rings=dense.map(s=>ringPoints([s[0]*depth/3.4,...s.slice(1)])),count=rings[0].length,position=rings.flat(2),indices=[];
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<count;i++){
    const a=r*count+i,b=r*count+(i+1)%count,c=(r+1)*count+i,d=(r+1)*count+(i+1)%count;
    indices.push(a,c,d,a,d,b);
  }
  for(const top of [true,false]){
    const r=top?0:rings.length-1,centre=position.length/3;
    position.push(0,rings[r][0][1],0);
    for(let i=0;i<count;i++){const a=r*count+i,b=r*count+(i+1)%count;indices.push(...(top?[centre,a,b]:[centre,b,a]));}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={closedWaterlineLoft:true,depth,sections:sections.map(s=>[s[0]*depth/3.4,...s.slice(1)]),bowDirection:'+z',waterlineVertexCount:count};
  return geometry;
}

export function createLeeBaiNameTexture(compact=false){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=compact?256:1024;
  const ctx=canvas.getContext('2d'),face='"Songti SC", "Songti TC", "PingFang SC", "Noto Serif CJK SC", "Microsoft YaHei", serif';
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#e8d7b1';ctx.textAlign='center';ctx.textBaseline='middle';
  if(compact){ctx.fillStyle='#e3d7b8';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#243330';ctx.font=`600 180px ${face}`;ctx.fillText('年 · LeeBai',512,128);}
  else{ctx.font=`600 580px ${face}`;ctx.fillText('年',512,370);ctx.font='bold 154px Georgia, "Times New Roman", serif';ctx.fillText('LeeBai',512,830);}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.userData={shipName:'年',englishName:'LeeBai',fontFallback:face,compact};return texture;
}

function beamAt(z,y,depth){
  const yy=y*3.4/depth;let a=sections[0],b=a,station=0;
  for(let i=0;i<sections.length-1;i++)if(yy<=sections[i][0]&&yy>=sections[i+1][0]){a=sections[i];b=sections[i+1];station=i;break;}
  const t=a===b?0:T.MathUtils.clamp((yy-a[0])/(b[0]-a[0]),0,1),s=a===b?a:interpolateSection(station,t),[,beam,bow,shoulder,stern,sternShoulder]=s;
  const ratio=z>shoulder?(z-shoulder)/(bow-shoulder):z<sternShoulder?(sternShoulder-z)/(sternShoulder-stern):0;
  return beam*Math.sqrt(Math.max(0,1-ratio*ratio));
}

export function installLeeBaiHullNames(ship,depth=3.4,detail=null){
  const texture=createLeeBaiNameTexture(),material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),names=[];
  for(const side of [-1,1]){
    // Keep the original patch aspect ratio while raising the entire name
    // above the curved bow waterline; shrinking only Y would squash glyphs.
    const position=[],uv=[],index=[],nu=24,nv=12;
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      const u=i/nu,v=j/nv,z=side>0?8.0-1.0*u:7.0+1.0*u,y=(-.05-.60*v)*depth/3.4;
      position.push(side*(beamAt(z,y,depth)+.028),y,z);uv.push(u,1-v);
    }
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;index.push(a,c,b,b,c,d);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(position,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();geometry.computeBoundingBox();
    const name=new T.Mesh(geometry,material);name.name=side<0?'freighter-name-port':'freighter-name-starboard';name.userData={shipName:'年',englishName:'LeeBai',separateHullName:true,side};ship.add(name);names.push(name);
  }
  // These three original sign boards have already been individually merged by
  // their map materials. Replace their maps, leaving equipment and geometry intact.
  const compact=createLeeBaiNameTexture(true);let replaced=0;
  detail?.traverse(o=>{if(o.isMesh&&o.userData.materialSourceNames?.includes('factory-sign')){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)if(m.map){const old=m.map;m.map=compact;m.needsUpdate=true;old.dispose();replaced++;}o.userData.shipName='年';o.userData.englishName='LeeBai';}});
  ship.userData.hullName={chinese:'年',english:'LeeBai',textureSize:[1024,1024],sideMeshes:names.map(o=>o.uuid),replacedLegacyBoards:replaced};return names;
}
