/** REACode/clouddeck depth groups, interpreted as optional angular drift.
 * Not recovered physical cloud depth, blur, or cloud-shadow projection.
 */
export const CLOUD_DEPTHS=Object.freeze([3.2,2,1]);
export function cloudDepth(index){if(!Number.isInteger(index)||index<0)throw new RangeError('nonnegative cloud index required');return CLOUD_DEPTHS[index%CLOUD_DEPTHS.length];}

/** 1243228419162341379 "Some moody clouds" — REACode clouddeck.js three-depth deck in world units.
 * Parallax: horizontal speed = wind / depth; blur ∝ depth; density = max over puffs (a sum would
 * flatten the deck into a constant ceiling). The cloud shadow is the SAME density field projected
 * along the sun direction onto any receiver height (roof, ground, water, foliage) — so the shadow
 * pattern equals the cloud pattern shifted by (layerY - receiverY)·sun.xz/sun.y.
 * Layer heights/radii are local choices; the clip shows the look, not the numbers.
 */
export const CLOUD_DECK_LAYERS=Object.freeze([
 Object.freeze({name:'far',depth:3.2,alpha:.34,blur:2.6,gain:.55,height:9}),
 Object.freeze({name:'mid',depth:2,alpha:.62,blur:1.7,gain:.85,height:7}),
 Object.freeze({name:'near',depth:1,alpha:.86,blur:1.1,gain:1,height:5.5}),
]);
export function makeCloudDeck({span=80,seed=7,wind=[1.2,0],layers=CLOUD_DECK_LAYERS}={}){
 if(!Number.isFinite(span)||span<=0||!Number.isFinite(seed)||wind.length!==2||!wind.every(Number.isFinite)||!layers.length)throw new RangeError('Invalid cloud deck');
 const hash=(i,s)=>{let h=Math.imul(i+0x9e3779b9,0x85ebca6b)^Math.imul(s+0x165667b1,0xc2b2ae35);h^=h>>>15;return((h>>>0)%100000)/100000;};
 const deck=layers.map((L,li)=>{const n=Math.round(14*(1+.3*(2-li)));const puffs=[];
  for(let i=0;i<n;i++){const r=hash(i,seed+li*31)*4+2.5;puffs.push({x:hash(i+7,seed+3+li)*span,z:(hash(i+13,seed+5+li)-.5)*span*.6,rx:r*(1.5+hash(i+19,seed+7)*1.5),rz:r*(.6+hash(i+23,seed+11)*.5),k:.55+hash(i+29,seed+13)*.7});}
  return{...L,puffs,vx:wind[0]/L.depth,vz:wind[1]/L.depth};});
 const wrap=v=>((v%span)+span*1.5)%span-span*.5;
 function density(layer,x,z,time=0){
  const L=typeof layer==='number'?deck[layer]:layer;if(!L||![x,z,time].every(Number.isFinite))throw new RangeError('Invalid cloud sample');
  let d=0;for(const p of L.puffs){const dx=wrap(x-(p.x+time*L.vx)),dz=wrap(z-(p.z+time*L.vz)),q=dx*dx/(p.rx*p.rx)+dz*dz/(p.rz*p.rz);if(q<1)d=Math.max(d,(1-q)*p.k);}
  return Math.min(1,d);
 }
 /** Shadow on a receiver at (x,y,z): density where the sun ray from the receiver meets the layer. */
 function shadowAt(x,y,z,sun,time=0,{layer=1,strength=.46}={}){
  if(!sun||sun.length!==3||!sun.every(Number.isFinite)||sun[1]<=1e-3)return 0;
  const L=deck[layer],t=(L.height-y)/sun[1];if(t<=0)return 0;
  return strength*density(L,x+sun[0]*t,z+sun[2]*t,time);
 }
 return{layers:deck,density,shadowAt,span};
}
