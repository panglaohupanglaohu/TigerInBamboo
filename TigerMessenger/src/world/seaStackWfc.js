// Hand-authored stratified cliff modules. Socket numbers are the shared
// normalized radii of adjoining rings, so solved modules weld exactly.
export const STACK_MODULES = [
 {id:'sea-foot',role:'foot',bottom:1,top:1,profile:[1.06,1.12,1.04,1],weight:1},
 {id:'wave-notch',role:'shore',bottom:1,top:.86,profile:[1,.72,.76,.86],weight:2},
 {id:'wave-shelf',role:'shore',bottom:1,top:1,profile:[1,.81,.85,1],weight:1},
 {id:'broad-cliff',role:'body',bottom:1,top:1,profile:[1,1.01,.98,1],weight:3},
 {id:'retreating-shoulder',role:'body',bottom:1,top:.86,profile:[1,.97,.88,.86],weight:3},
 {id:'rock-ledge',role:'body',bottom:.86,top:1,profile:[.86,.86,1,1],weight:1},
 {id:'jointed-cliff',role:'body',bottom:.86,top:.86,profile:[.86,.88,.84,.86],weight:4},
 {id:'upper-shoulder',role:'body',bottom:.86,top:.70,profile:[.86,.83,.72,.70],weight:2},
 {id:'narrow-cliff',role:'body',bottom:.70,top:.70,profile:[.70,.73,.69,.70],weight:2},
 {id:'broad-crown',role:'crown',bottom:1,top:.82,profile:[1,.96,.90,.82],weight:1},
 {id:'broken-crown',role:'crown',bottom:.86,top:.66,profile:[.86,.88,.72,.66],weight:2},
 {id:'narrow-crown',role:'crown',bottom:.70,top:.53,profile:[.70,.73,.59,.53],weight:1},
];
export function solveStackWfc(seed=1,layers=8){
 if(!Number.isInteger(layers)||layers<4)throw new Error('Sea stack needs at least four module layers');
 return solveProfileDomains(seed,STACK_MODULES,Array.from({length:layers},(_,i)=>i===0?'foot':i===1?'shore':i===layers-1?'crown':'body'));
}
function solveProfileDomains(seed,catalog,roles){
 const layers=roles.length;
 let state=(seed+98173)>>>0,decisions=0,backtracks=0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const domains=Array.from({length:layers},(_,i)=>catalog.map((m,id)=>({m,id})).filter(({m})=>m.role===roles[i]).map(({id})=>id));
 const propagate=d=>{let changed=true;while(changed){changed=false;for(let i=0;i<layers;i++){
  const next=d[i].filter(id=>(i===0||d[i-1].some(j=>catalog[j].top===catalog[id].bottom))&&(i===layers-1||d[i+1].some(j=>catalog[id].top===catalog[j].bottom)));
  if(!next.length)return false;if(next.length!==d[i].length){d[i]=next;changed=true;}
 }}return true;};
 const entropy=ids=>{let sum=0,log=0;for(const id of ids){const w=catalog[id].weight;sum+=w;log+=w*Math.log(w);}return Math.log(sum)-log/sum;};
 const search=d=>{
  if(!propagate(d))return null;
  let cell=-1,best=Infinity;for(let i=0;i<layers;i++)if(d[i].length>1){const h=entropy(d[i])+random()*1e-6;if(h<best){best=h;cell=i;}}
  if(cell<0)return d.map(ids=>catalog[ids[0]]);
  const choices=[...d[cell]];
  while(choices.length){let r=random()*choices.reduce((s,id)=>s+catalog[id].weight,0),pick=0;while(pick<choices.length-1&&(r-=catalog[choices[pick]].weight)>0)pick++;
   const [id]=choices.splice(pick,1),copy=d.map(ids=>[...ids]);copy[cell]=[id];decisions++;const result=search(copy);if(result)return result;backtracks++;
  }return null;
 };
 const modules=search(domains);if(!modules)throw new Error('Sea stack WFC exhausted compatible module domains');
 return {seed,modules,decisions,backtracks,socketMismatches:modules.slice(1).filter((m,i)=>modules[i].top!==m.bottom).length};
}
export function sampleStackProfile(modules,t){
 const y=Math.min(1,Math.max(0,t))*modules.length,i=Math.min(modules.length-1,Math.floor(y)),u=y-i,p=modules[i].profile;
 const x=u*(p.length-1),j=Math.min(p.length-2,Math.floor(x)),s=x-j;
 return p[j]+(p[j+1]-p[j])*s;
}

// Coastal specimen library. Every pair in `rings` is [local height, radius].
// Repeated heights encode an actual ledge, not a line drawn on a smooth wall.
// Numeric sockets are shared cross-sections; the assembler uses one angular
// footprint for all modules, and welds the repeated boundary ring exactly.
export const COASTAL_STACK_MODULES = [
 {id:'talus-plinth',role:'foot',bottom:1.015,top:1,weight:1,rings:[[0,1.015],[.55,1.04],[1,1]]},
 {id:'deep-wave-notch',role:'shore',bottom:1,top:1,weight:3,rings:[[0,1],[.38,.76],[.7,.8],[1,1]]},
 {id:'sheltered-wave-notch',role:'shore',bottom:1,top:.94,weight:2,rings:[[0,1],[.4,.86],[.8,.86],[1,.94]]},
 {id:'massive-lower-cliff',role:'lower',bottom:1,top:1,weight:2,rings:[[0,1],[.34,.98],[.7,1.01],[1,1]]},
 {id:'jointed-lower-cliff',role:'lower',bottom:.94,top:.94,weight:2,rings:[[0,.94],[.28,.96],[.7,.92],[1,.94]]},
 {id:'wide-broken-terrace',role:'terrace',bottom:1,top:.66,weight:3,rings:[[0,1],[.45,.98],[.45,.67],[1,.66]]},
 {id:'narrow-broken-terrace',role:'terrace',bottom:1,top:.78,weight:2,rings:[[0,1],[.7,1],[.7,.79],[1,.78]]},
 {id:'recessed-terrace',role:'terrace',bottom:.94,top:.66,weight:2,rings:[[0,.94],[.3,.94],[.3,.68],[1,.66]]},
 {id:'slab-upper-cliff',role:'upper',bottom:.66,top:.66,weight:2,rings:[[0,.66],[.5,.69],[1,.66]]},
 {id:'broad-upper-cliff',role:'upper',bottom:.78,top:.78,weight:2,rings:[[0,.78],[.35,.76],[.75,.8],[1,.78]]},
 {id:'fractured-cap-ledge',role:'cap',bottom:.66,top:.46,weight:2,rings:[[0,.66],[.25,.65],[.25,.51],[1,.46]]},
 {id:'blunt-broken-cap',role:'cap',bottom:.78,top:.64,weight:2,rings:[[0,.78],[.25,.78],[.25,.7],[1,.64]]}
];
export function solveCoastalStackWfc(seed=1){
 return {...solveProfileDomains(seed,COASTAL_STACK_MODULES,['foot','shore','lower','terrace','upper','cap']),revision:2};
}
