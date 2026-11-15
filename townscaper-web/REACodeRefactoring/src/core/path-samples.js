/** Arc-length sampling strategy adapted from REACode/navribbon, for an existing routed polyline.
 * Engineering choice only: cited 823848950553780226 is dust AO, not an arc-length tutorial.
 * No spline smoothing or navigation shortcut is introduced.
 */
export function samplePath(points,{spacing=.15,maxSamples=4096}={}){
 if(!Array.isArray(points)||!Number.isFinite(spacing)||spacing<=0||!Number.isInteger(maxSamples)||maxSamples<1)throw new RangeError('invalid path sampling bounds');
 if(!points.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw new TypeError('finite XYZ triples required');
 if(!points.length)return{points:[],distances:[],length:0};
 const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));
 const length=cumulative.at(-1);if(!Number.isFinite(length)||Math.ceil(length/spacing)+1>maxSamples)throw new RangeError('path sample budget exceeded');
 const out=[],distances=[];let edge=1;
 const at=d=>{while(edge<points.length-1&&cumulative[edge]<d)edge++;const a=points[edge-1]??points[0],b=points[edge]??a,den=(cumulative[edge]??0)-cumulative[edge-1],t=den>0?(d-cumulative[edge-1])/den:0;return a.map((v,k)=>v+(b[k]-v)*t);};
 for(let n=0;n*spacing<length;n++){const d=n*spacing;out.push(at(d));distances.push(d);}
 out.push(points.at(-1).slice());distances.push(length);return{points:out,distances,length};
}

/** REACode/src/navribbon.js 的中线：Catmull-Rom（张力 0.5，端点复制）在每段 [i,i+1] 内按参数取 perSeg 个样本。
 * accept(p, i) 为 false 的样本退回该段折线上的同参数点——平滑不得把路线拉进墙里/台外（G5，Battle 命令路径）。 */
export function smoothRoutedPath(points,{perSeg=8,accept=()=>true}={}){
 if(!Array.isArray(points)||!points.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw new TypeError('finite XYZ triples required');
 if(!Number.isInteger(perSeg)||perSeg<1||perSeg>256)throw new RangeError('perSeg 1..256');
 if(points.length<3)return points.map(p=>p.slice());
 const P=i=>points[Math.max(0,Math.min(points.length-1,i))],out=[];
 for(let i=0;i<points.length-1;i++){const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2);
  for(let k=0;k<perSeg;k++){const t=k/perSeg,t2=t*t,t3=t2*t;
   const cr=p1.map((_,d)=>.5*((2*p1[d])+(-p0[d]+p2[d])*t+(2*p0[d]-5*p1[d]+4*p2[d]-p3[d])*t2+(-p0[d]+3*p1[d]-3*p2[d]+p3[d])*t3));
   out.push(k===0||accept(cr,i)?(k===0?p1.slice():cr):p1.map((v,d)=>v+(p2[d]-v)*t));}}
 out.push(points.at(-1).slice());return out;
}
/** 带状格子：相邻两个样本 + 各自半宽 → 一个四边形，首尾共享两角（不重叠、不留缝；navribbon ②）。
 * 法向在 XZ 平面内取切向的左侧；halfWidth 可以是数或 (p,i)=>number。 */
export function ribbonCells(points,{halfWidth=.12}={}){
 const n=points.length,w=typeof halfWidth==='function'?halfWidth:()=>halfWidth,L=[],R=[];
 for(let i=0;i<n;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(n-1,i+1)];let tx=b[0]-a[0],tz=b[2]-a[2],l=Math.hypot(tx,tz);
  if(l<1e-9){tx=1;tz=0;l=1;}const hw=w(points[i],i),nx=-tz/l*hw,nz=tx/l*hw;
  if(!Number.isFinite(hw)||hw<0)throw new RangeError('invalid ribbon width');
  L.push([points[i][0]+nx,points[i][1],points[i][2]+nz]);R.push([points[i][0]-nx,points[i][1],points[i][2]-nz]);}
 const cells=[];for(let i=0;i+1<n;i++)cells.push({quad:[L[i],L[i+1],R[i+1],R[i]],wA:Math.hypot(L[i][0]-R[i][0],L[i][2]-R[i][2])/2,wB:Math.hypot(L[i+1][0]-R[i+1][0],L[i+1][2]-R[i+1][2])/2});
 return cells;
}
