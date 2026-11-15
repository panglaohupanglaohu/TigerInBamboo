/** Shared zero-drag table from the existing Battle implementation.
 * Cost weight is editable, but not the original Inspector expression language.
 * Quantization selects an angle; velocity/time are solved for the exact target.
 */
export const PROJECTILE_GRAVITY=6;
export function createBallisticTable({impactWeight=.6}={}){
 if(!Number.isFinite(impactWeight)||impactWeight<0||impactWeight>4)throw new RangeError('impact weight must be 0..4');
 const solve=(dx,dy,th)=>{const c=Math.cos(th),den=2*c*c*(dx*Math.tan(th)-dy);if(den<=0||dx<.05)return null;const v=Math.sqrt(PROJECTILE_GRAVITY*dx*dx/den);if(v>9)return null;const time=dx/(v*c),impact=Math.atan2(PROJECTILE_GRAVITY*time-v*Math.sin(th),v*c),cost=time+impactWeight*Math.abs(impact-Math.PI/4);return{th,v,time,cost};};
 const best=(dx,dy)=>{let out=null;for(let a=10;a<=80;a+=2){const shot=solve(dx,dy,a*Math.PI/180);if(shot&&(!out||shot.cost<out.cost))out=shot;}return out;};
 const table=new Map();for(let d=0;d<=60;d++)for(let h=-30;h<=30;h++)table.set(d*100+h,best(d*.1,h*.1));
 return Object.freeze({impactWeight,lookup(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy)||dx<.05||dx>6||Math.abs(dy)>3)return null;const bin=table.get(Math.round(dx*10)*100+Math.round(dy*10));const shot=(bin&&solve(dx,dy,bin.th))||best(dx,dy);return shot?Object.freeze(shot):null;}});
}
export const defaultBallisticTable=createBallisticTable();
