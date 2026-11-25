/** Export the shared World surface, not instanced vegetation, water or effects.
 * 1430224300003545091 shows OBJ export and a white model in another application.
 * RGB vertex values are an optional extension, not evidence of original material export.
 */
export function geometryToOBJ(geometry, { name='townscaper', precision=null }={}) {
  if(precision!==null&&(!Number.isInteger(precision)||precision<0||precision>10))throw new RangeError('OBJ precision');
  const pos=geometry?.getAttribute('position'),nor=geometry?.getAttribute('normal'),col=geometry?.getAttribute('color');
  if(!pos||pos.itemSize!==3)throw new Error('OBJ requires 3D positions');
  for(const [label,a] of [['position',pos],['normal',nor],['color',col]])if(a){
    if(a.itemSize!==3||a.count!==pos.count)throw new Error(`OBJ ${label} count mismatch`);
    for(let i=0;i<a.count;i++)if(![a.getX(i),a.getY(i),a.getZ(i)].every(Number.isFinite))throw new Error(`OBJ ${label} contains nonfinite values`);
  }
  const index=geometry.getIndex(),count=index?index.count:pos.count;
  if(count%3)throw new Error('OBJ incomplete triangle');
  if(index)for(let i=0;i<count;i++){const n=index.getX(i);if(!Number.isInteger(n)||n<0||n>=pos.count)throw new Error('OBJ index out of range');}
  // Exact values by default: rounding must not silently collapse small valid triangles.
  const q=x=>precision===null?x:Math.round(x*10**precision)/10**precision;
  const map=new Map(),v=[],vn=[],f=[];let droppedFaces=0;
  const id=i=>{
    const values=[q(pos.getX(i)),q(pos.getY(i)),q(pos.getZ(i)),...(nor?[q(nor.getX(i)),q(nor.getY(i)),q(nor.getZ(i))]:[]),...(col?[q(col.getX(i)),q(col.getY(i)),q(col.getZ(i))]:[])];
    const key=values.join(',');let k=map.get(key);
    if(k===undefined){k=map.size+1;map.set(key,k);v.push(`v ${values.slice(0,3).join(' ')}${col?' '+values.slice(nor?6:3).join(' '):''}`);if(nor)vn.push(`vn ${values.slice(3,6).join(' ')}`);}
    return k;
  };
  for(let t=0;t<count;t+=3){const ids=[0,1,2].map(k=>id(index?index.getX(t+k):t+k));if(new Set(ids).size<3){droppedFaces++;continue;}f.push('f '+ids.map(i=>nor?`${i}//${i}`:String(i)).join(' '));}
  const safeName=String(name).replace(/[\r\n\s#]+/g,'_')||'townscaper';
  const text=`# REACodeRefactoring shared World surface; optional RGB values in source color space\no ${safeName}\n${v.join('\n')}\n${vn.join('\n')}\n${f.join('\n')}\n`;
  return {text,vertices:v.length,faces:f.length,sourceVerts:pos.count,sourceFaces:count/3,droppedFaces,precision};
}
export function downloadOBJ(geometry,filename='town.obj') {
  const r=geometry?geometryToOBJ(geometry):null;if(!r)return null;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([r.text],{type:'text/plain'}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);return r;
}

/* ---- 全场景导出：水面 + 烘焙实例化植被 + .mtl 材质 ---------------------------
 * 1430224300003545091 残差：原片第三方视口只有灰白主体，水面/植被/材质属补做范围。
 * 水面是着色器平面（动画噪声/反射不出几何），植被是 InstancedMesh（按实例矩阵烘焙，
 * 墨线外壳与远景面片替身不导）。.mtl 只给每对象一个 Kd 近似色，逐顶点色仍以 RGB
 * 扩展留在 v 行——不声称与原作导出格式相同。瀑布/水花/特效仍不在导出范围。 */

const IDENT=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mul4=(a,b)=>{const r=new Array(16);for(let c=0;c<4;c++)for(let i=0;i<4;i++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+i]*b[c*4+k];r[c*4+i]=s;}return r;};
const xfPoint=(e,x,y,z)=>[e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]];
// 法线要乘 3x3 的逆转置；退化（镜面/零缩放）退回原 3x3 再归一。
const xfNormal=(e,x,y,z)=>{
  const a=e[0],b=e[4],c=e[8],d=e[1],f=e[5],g=e[9],h=e[2],i=e[6],j=e[10];
  const A=f*j-g*i,B=g*h-d*j,C=d*i-f*h,det=a*A+b*B+c*C;
  let nx,ny,nz;
  if(Math.abs(det)>1e-12){const s=1/det;nx=(A*x+B*y+C*z)*s;ny=((c*h-b*j)*x+(a*j-c*d)*y+(b*d-a*h)*z)*s;nz=((b*g-c*f)*x+(c*a-a*g)*y+(a*f-b*d)*z)*s;}
  else{nx=a*x+b*y+c*z;ny=d*x+f*y+g*z;nz=h*x+i*y+j*z;}
  const l=Math.hypot(nx,ny,nz)||1;return[nx/l,ny/l,nz/l];
};
const attr3=a=>a&&a.itemSize===3?a:null;
const readAttr=(a,n)=>a?[a.getX(n),a.getY(n),a.getZ(n)]:null;
const rgbOf=c=>Array.isArray(c)?[c[0],c[1],c[2]]:c?[c.r??c.x??0,c.g??c.y??0,c.b??c.z??0]:null;
const finite3=p=>p&&p.every(Number.isFinite);

/** 摊平一份 THREE 风格几何（getAttribute/getIndex）成普通数组；matrix 可选 16 元列主序。 */
export function geometryData(geometry,{matrix=null}={}){
  const pos=attr3(geometry?.getAttribute('position'));if(!pos)throw new Error('OBJ requires 3D positions');
  const nor=attr3(geometry.getAttribute('normal')),col=attr3(geometry.getAttribute('color'));
  for(const [label,a]of[['position',pos],['normal',nor],['color',col]])if(a&&a.count!==pos.count)throw new Error(`OBJ ${label} count mismatch`);
  const positions=[],normals=nor?[]:null,colors=col?[]:null;
  for(let i=0;i<pos.count;i++){
    const p=readAttr(pos,i);if(!finite3(p))throw new Error('OBJ position contains nonfinite values');
    positions.push(...(matrix?xfPoint(matrix,...p):p));
    if(nor){const n=readAttr(nor,i);if(!finite3(n))throw new Error('OBJ normal contains nonfinite values');normals.push(...(matrix?xfNormal(matrix,...n):n));}
    if(col){const c=readAttr(col,i);if(!finite3(c))throw new Error('OBJ color contains nonfinite values');colors.push(...c);}
  }
  const index=geometry.getIndex(),faces=[];
  if(index){for(let i=0;i<index.count;i++){const n=index.getX(i);if(!Number.isInteger(n)||n<0||n>=pos.count)throw new Error('OBJ index out of range');faces.push(n);}}
  else for(let i=0;i<pos.count;i++)faces.push(i);
  if(faces.length%3)throw new Error('OBJ incomplete triangle');
  return{positions,normals,colors,faces};
}

/** 读取实例 i 的着色：优先 mesh.instanceColor（setColorAt），再几何上的实例属性 aColor/aCardColor。 */
function instanceColorOf(mesh,i){
  const ic=mesh.instanceColor;if(ic)return readAttr(ic,i);
  for(const n of['aColor','aCardColor']){const a=attr3(mesh.geometry.getAttribute?.(n));if(a&&i<a.count)return readAttr(a,i);}
  return null;
}

/** 把 InstancedMesh 风格对象（geometry+count+instanceMatrix+可选 instanceColor/实例色属性）按实例矩阵烘成普通网格数据。 */
export function bakeInstances(mesh,{base=null,color=null}={}){
  const g=mesh?.geometry,count=Math.min(mesh?.count??0,(mesh?.instanceMatrix?.array?.length??0)/16|0);
  if(!g||!count)return{positions:[],normals:null,colors:null,faces:[],instances:0};
  const pos=attr3(g.getAttribute('position'));if(!pos)throw new Error('OBJ requires 3D positions');
  const nor=attr3(g.getAttribute('normal')),vcol=attr3(g.getAttribute('color'));
  const base0=base??mesh.matrixWorld?.elements??mesh.matrix?.elements??IDENT;
  const im=mesh.instanceMatrix.array,index=g.getIndex(),vcount=index?index.count:pos.count;
  if(vcount%3)throw new Error('OBJ incomplete triangle');
  const positions=[],normals=nor?[]:null,colors=[],faces=[];let anyColor=false;
  for(let k=0;k<count;k++){
    const e=mul4(base0,im.subarray(k*16,k*16+16));
    const icol=rgbOf(color)??instanceColorOf(mesh,k);if(icol&&!finite3(icol))throw new Error('OBJ instance color nonfinite');
    const off=positions.length/3;
    for(let i=0;i<pos.count;i++){
      const p=readAttr(pos,i);if(!finite3(p))throw new Error('OBJ position contains nonfinite values');
      positions.push(...xfPoint(e,...p));
      if(nor){const n=readAttr(nor,i);if(!finite3(n))throw new Error('OBJ normal contains nonfinite values');normals.push(...xfNormal(e,...n));}
      const c=icol??(vcol?readAttr(vcol,i):null);
      if(c){if(!finite3(c))throw new Error('OBJ color contains nonfinite values');colors.push(...c);anyColor=true;}
    }
    for(let t=0;t<vcount;t++){const n=index?index.getX(t):t;if(!Number.isInteger(n)||n<0||n>=pos.count)throw new Error('OBJ index out of range');faces.push(off+n);}
  }
  return{positions,normals,colors:anyColor?colors:null,faces,instances:count};
}

const safeName=s=>String(s).replace(/[\r\n\s#]+/g,'_')||'part';
const f3=n=>Number.isInteger(n)?String(n):String(+n.toFixed(6));
const num6=p=>p.map(f3).join(' ');

/** 多对象场景导出：parts=[{name,positions,normals,colors,faces,material,kd}]，返回 {text,mtlText,...}。 */
export function sceneToOBJ(parts,{name='townscaper',mtl='townscaper.mtl',precision=null}={}){
  if(!Array.isArray(parts)||!parts.length)throw new Error('sceneToOBJ requires parts');
  if(precision!==null&&(!Number.isInteger(precision)||precision<0||precision>10))throw new RangeError('OBJ precision');
  const q=x=>precision===null?x:Math.round(x*10**precision)/10**precision;
  const map=new Map(),v=[],vn=[],mtls=[],seen=new Set();let nv=0;
  const num=precision===null?(x=>String(x)):(x=>f3(q(x)));   // 与 geometryToOBJ 同口径：默认精确值，显式 precision 才量化
  const keyOf=(p,n,c)=>[...p,...n??[],...c??[]].map(q).join(',');
  const emit=(p,n,c)=>{
    const key=keyOf(p,n,c);let k=map.get(key);
    // v/vn 一一对应（缺法线的顶点补一条永不引用的占位 vn），否则混合有无vn的部位时 f v//vn 索引整体错位
    if(k===undefined){k=++nv;map.set(key,k);v.push(`v ${p.map(num).join(' ')}${c?' '+c.map(num).join(' '):''}`);vn.push(`vn ${n?n.map(num).join(' '):'0 0 1'}`);}
    return k;
  };
  const sections=[],stats=[];
  for(const part of parts){
    const{positions,normals=null,colors=null,faces}=part??{};
    if(!positions||positions.length%3||!positions.every(Number.isFinite))throw new Error(`OBJ part ${part?.name}: bad positions`);
    if(normals&&(normals.length!==positions.length||!normals.every(Number.isFinite)))throw new Error(`OBJ part ${part.name}: bad normals`);
    if(colors&&(colors.length!==positions.length||!colors.every(Number.isFinite)))throw new Error(`OBJ part ${part.name}: bad colors`);
    if(!faces||faces.length%3||!faces.every(i=>Number.isInteger(i)&&i>=0&&i<positions.length/3))throw new Error(`OBJ part ${part.name}: bad faces`);
    const mat=part.material?safeName(part.material):null;
    if(mat&&!seen.has(mat)){seen.add(mat);mtls.push({name:mat,kd:rgbOf(part.kd)??meanColor(colors)??[1,1,1]});}
    const pf=[],out=[],vt0=map.size;
    for(let t=0;t<faces.length;t+=3){
      const ids=[0,1,2].map(k=>{const i=faces[t+k];return emit(positions.slice(i*3,i*3+3),normals?normals.slice(i*3,i*3+3):null,colors?colors.slice(i*3,i*3+3):null);});
      if(new Set(ids).size<3){pf.push(t/3);continue;}
      out.push('f '+ids.map(i=>normals?`${i}//${i}`:String(i)).join(' '));
    }
    sections.push({name:safeName(part.name),mat,lines:out});
    stats.push({name:safeName(part.name),vertices:map.size-vt0,faces:out.length,droppedFaces:pf.length,sourceFaces:faces.length/3,instances:part.instances});
  }
  const text=`# REACodeRefactoring scene export: town surface + water + baked instanced vegetation; RGB values in source color space\nmtllib ${safeName(mtl)}\n${v.join('\n')}\n${vn.join('\n')}\n${sections.map(s=>`o ${s.name}${s.mat?`\nusemtl ${s.mat}`:''}\n${s.lines.join('\n')}`).join('\n')}\n`;
  const mtlText=`# REACodeRefactoring scene materials: one approximate Kd per object group (shader colors flattened)\n${mtls.map(m=>`newmtl ${m.name}\nKd ${num6(m.kd)}\nKa 0 0 0\nKs 0 0 0\nd 1\nillum 1`).join('\n')}\n`;
  return{text,mtlText,vertices:nv,faces:stats.reduce((n,s)=>n+s.faces,0),parts:stats,materials:mtls.map(m=>m.name)};
}
function meanColor(colors){if(!colors?.length)return null;const s=[0,0,0];for(let i=0;i<colors.length;i+=3){s[0]+=colors[i];s[1]+=colors[i+1];s[2]+=colors[i+2];}const n=colors.length/3;return s.map(x=>x/n);}

/** 从运行中的 view 收集可导出对象：主体表面、水面平面、各类植被实例网格（墨线/impostor替身/瀑布特效不导）。 */
export function sceneParts(view){
  const parts=[];
  const wg=view?.worldMesh?.geometry;if(wg)parts.push({name:'town',material:'town',kd:[1,1,1],...geometryData(wg)});
  const w=view?.water;
  if(w?.geometry){
    const sh=rgbOf(view.waterUniforms?.uShallow?.value),de=rgbOf(view.waterUniforms?.uDeep?.value);
    const kd=sh&&de?de.map((d,i)=>d+(sh[i]-d)*0.55):[0.36,0.62,0.66];   // 与片元着色器同一 0.55 中点混色
    parts.push({name:'water',material:'water',kd,...geometryData(w.geometry,{matrix:w.matrixWorld?.elements??w.matrix?.elements??null})});
  }
  const veg=view?.vegetation;
  if(veg){
    const put=(label,mesh)=>{if(!mesh?.count||mesh.visible===false)return;const b=bakeInstances(mesh);if(b.positions.length)parts.push({name:label,material:`veg_${label}`,instances:b.instances,...b});};
    put('grass',veg.tufts);put('flowers',veg.flowers);put('shrubs',veg.shrubs);put('wallshrubs',veg.wallCards);put('trunks',veg.trunks);
    veg.crowns?.forEach((c,i)=>put(`crown${i}`,c?.m));
  }
  return parts;
}

/** 真实下载 .obj + .mtl 两个文件（同一个 basename）。 */
export function downloadSceneOBJ(view,basename='town'){
  const parts=sceneParts(view);if(!parts.length)return null;
  const r=sceneToOBJ(parts,{name:basename,mtl:`${basename}.mtl`});
  const dl=(text,file)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
  dl(r.text,`${basename}.obj`);dl(r.mtlText,`${basename}.mtl`);
  return r;
}
