/** 1242824460325052417: "playful by just tilting them slightly".
 * Local deterministic visual jitter. Untransformed slots remain the hit targets;
 * constrain both AABB overhangs to less than half the inter-slot gap.
 */
export function playfulJitter(key,{seed=7,width=240,height=44,gap=10,maxRot=2.4,maxDx=4,maxDy=1}={}){
 if(typeof key!=='string'||!key||!Number.isSafeInteger(seed)||![width,height,gap,maxRot,maxDx,maxDy].every(Number.isFinite)||width<=0||height<=0||gap<0||maxRot<0||maxRot>10||maxDx<0||maxDy<0)throw new RangeError('Invalid playful layout');
 let h=seed>>>0;for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619)>>>0;
 const rnd=()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296*2-1;};
 const raw={rot:rnd()*maxRot,dx:rnd()*maxDx,dy:rnd()*maxDy};
 const shape=k=>{const rot=raw.rot*k,dx=raw.dx*k,dy=raw.dy*k,a=Math.abs(rot)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),hw=(width*c+height*s)/2,hh=(height*c+width*s)/2;return{rot,dx,dy,bounds:{x:dx-hw,y:dy-hh,width:2*hw,height:2*hh},overhang:Math.max(hw-width/2+Math.abs(dx),hh-height/2+Math.abs(dy))};};
 let result=shape(1);if(result.overhang>gap*.45){let lo=0,hi=1;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(shape(mid).overhang<=gap*.45)lo=mid;else hi=mid;}result=shape(lo);}
 return result;
}

/** REACode uikit.js layoutList / hueFor / colorFor / GLYPHS on top of playfulJitter.
 * Slots are the facts (equal-spaced hit rectangles); jitter is the look. The rotated AABBs of
 * neighbours must never overlap, so playfulJitter's overhang cap (< gap·0.45) is reused.
 */
export function layoutList(keys,{x=0,y=0,size=40,gap=6,seed=17,maxRot=1.6,maxDx=2.4,maxDy=1.8,wobble=true}={}){
 if(!Array.isArray(keys)||!keys.every(k=>typeof k==='string'&&k)||new Set(keys).size!==keys.length)throw new RangeError('layoutList needs unique string keys');
 const items=keys.map((key,i)=>{
  const slot={key,x,y:y+i*(size+gap),w:size,h:size};
  const j=wobble?playfulJitter(key,{seed,width:size,height:size,gap,maxRot,maxDx,maxDy}):{rot:0,dx:0,dy:0,bounds:{x:-size/2,y:-size/2,width:size,height:size}};
  const cx=slot.x+size/2,cy=slot.y+size/2;
  return{...slot,rot:j.rot,dx:j.dx,dy:j.dy,iconRot:j.rot*.8,aabb:{x:cx+j.bounds.x,y:cy+j.bounds.y,w:j.bounds.width,h:j.bounds.height}};
 });
 let overlaps=0,minGap=Infinity;
 for(let i=1;i<items.length;i++){const a=items[i-1].aabb,b=items[i].aabb,sep=b.y-(a.y+a.h);minGap=Math.min(minGap,sep);if(sep<0)overlaps++;}
 return{items,overlaps,minGapPx:minGap,maxRotDeg:Math.max(0,...items.map(i=>Math.abs(i.rot))),maxDispPx:Math.max(0,...items.map(i=>Math.hypot(i.dx,i.dy)))};
}
/** Hue walks red → purple down the list (never back to red: first and last differ). */
export function hueFor(i,n){if(!Number.isInteger(i)||!Number.isInteger(n)||n<1||i<0||i>=n)throw new RangeError('Invalid hue index');return i/Math.max(1,n-1)*300;}
export function colorFor(i,n){const h=hueFor(i,n);return{fill:`hsl(${h} 62% 62%)`,edge:`hsl(${h} 55% 44%)`};}
/** Stroke-only 24×24 icon paths (rotate/scale with the button without blurring). */
export const GLYPHS=Object.freeze({
 brush:'M4 20c3 0 4-1.5 4-4M4 20c0-2 1-3 3-3M7 17 17 7l-1-1-10 10ZM16 6l2 2-3 3-2-2Z',
 hammer:'M4 20l5-5M9 15l7-7M13 5l6 6M16 8l2-2',
 eye:'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
 water:'M4 9c2-2 4-2 6 0s4 2 6 0 4-2 4 0M4 15c2-2 4-2 6 0s4 2 6 0 4-2 4 0',
 tree:'M12 3l4 6h-2l3 5h-4v7h-2v-7H7l3-5H8Z',
 grid:'M4 4h16v16H4Z M4 12h16 M12 4v16',
 camera:'M3 8h4l2-2h6l2 2h4v11H3Z M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
 wand:'M5 19 15 9M14 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1Z',
});
