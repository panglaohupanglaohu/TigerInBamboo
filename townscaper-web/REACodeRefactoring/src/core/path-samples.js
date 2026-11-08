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
