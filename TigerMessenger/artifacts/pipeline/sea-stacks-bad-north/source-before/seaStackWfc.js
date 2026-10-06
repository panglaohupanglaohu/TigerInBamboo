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
 let state=(seed+98173)>>>0,decisions=0,backtracks=0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const domains=Array.from({length:layers},(_,i)=>STACK_MODULES.map((m,id)=>({m,id})).filter(({m})=>m.role===(i===0?'foot':i===1?'shore':i===layers-1?'crown':'body')).map(({id})=>id));
 const propagate=d=>{let changed=true;while(changed){changed=false;for(let i=0;i<layers;i++){
  const next=d[i].filter(id=>(i===0||d[i-1].some(j=>STACK_MODULES[j].top===STACK_MODULES[id].bottom))&&(i===layers-1||d[i+1].some(j=>STACK_MODULES[id].top===STACK_MODULES[j].bottom)));
  if(!next.length)return false;if(next.length!==d[i].length){d[i]=next;changed=true;}
 }}return true;};
 const entropy=ids=>{let sum=0,log=0;for(const id of ids){const w=STACK_MODULES[id].weight;sum+=w;log+=w*Math.log(w);}return Math.log(sum)-log/sum;};
 const search=d=>{
  if(!propagate(d))return null;
  let cell=-1,best=Infinity;for(let i=0;i<layers;i++)if(d[i].length>1){const h=entropy(d[i])+random()*1e-6;if(h<best){best=h;cell=i;}}
  if(cell<0)return d.map(ids=>STACK_MODULES[ids[0]]);
  const choices=[...d[cell]];
  while(choices.length){let r=random()*choices.reduce((s,id)=>s+STACK_MODULES[id].weight,0),pick=0;while(pick<choices.length-1&&(r-=STACK_MODULES[choices[pick]].weight)>0)pick++;
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
