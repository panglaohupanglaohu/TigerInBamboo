// Local bounded scalar contrast solver for an explicit adjacency graph.
// Not the original atlas, RGB/OKLab asset pipeline or a convergence guarantee.
export function solveContrastField(count,edges,{iterations=100,target=.3,pull=.2,push=.5,seed=1}={}){
 if(!Number.isInteger(count)||count<1||count>100000||!Number.isInteger(iterations)||iterations<0||iterations>2000||![target,pull,push,seed].every(Number.isFinite)||target<0||target>1||pull<0||pull>1||push<0||push>1||!Array.isArray(edges)||edges.some(e=>!Number.isInteger(e.i)||!Number.isInteger(e.j)||e.i<0||e.j<0||e.i>=count||e.j>=count||e.i===e.j))throw new RangeError('contrast graph');
 let state=seed>>>0;const values=Float64Array.from({length:count},()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296});const initial=values.slice();
 for(let pass=0;pass<iterations;pass++){const delta=new Float64Array(count),degree=new Uint32Array(count);for(const e of edges){const d=values[e.j]-values[e.i],distance=Math.abs(d);let change=e.contrast? (distance<target?-(d===0?((e.i<e.j)?1:-1):Math.sign(d))*(target-distance)*push*.5:0):d*pull*.5;delta[e.i]+=change;delta[e.j]-=change;degree[e.i]++;degree[e.j]++}for(let i=0;i<count;i++)values[i]=Math.max(0,Math.min(1,values[i]+delta[i]/Math.max(1,degree[i])))}
 // Finish with bounded hard-constraint projections. Infeasible graphs or
 // conflicting orientations may still retain violations; report them below.
 if(iterations>0)for(let pass=0;pass<32;pass++){let changed=false;for(const e of edges){if(!e.contrast)continue;const a=values[e.i],b=values[e.j];if(Math.abs(a-b)+1e-9>=target)continue;const lo=Math.max(0,Math.min(1-target,(a+b-target)*.5));if(a<=b){values[e.i]=lo;values[e.j]=lo+target}else{values[e.j]=lo;values[e.i]=lo+target}changed=true}if(!changed)break}
 const measure=a=>{let same=0,contrast=0,ns=0,nc=0,violations=0;for(const e of edges){const d=Math.abs(a[e.i]-a[e.j]);if(e.contrast){contrast+=d;nc++;if(d+1e-6<target)violations++}else{same+=d;ns++}}return {sameMean:ns?same/ns:0,contrastMean:nc?contrast/nc:0,violations}};
 return {values,initial,before:measure(initial),after:measure(values)};
}
