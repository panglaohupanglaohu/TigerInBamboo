/** Oriented intersection index. Coincident same-facing shared-edge hits count once;
 * opposing enter/exit hits cancel, even when closer than the clustering tolerance.
 * This is not general manifold certification; use solid-angle/boundary checks too. */
export function orientedRayCrossings(hits,tolerance=1e-5){
 const sorted=hits.filter(h=>Number.isFinite(h.distance)&&Number.isFinite(h.normalDot)&&Math.abs(h.normalDot)>1e-12).sort((a,b)=>a.distance-b.distance),clusters=[];
 for(const hit of sorted){let c=clusters.at(-1);if(!c||hit.distance-c.start>tolerance){c={start:hit.distance,end:hit.distance,positive:0,negative:0,count:0};clusters.push(c);}c.end=hit.distance;c.count++;if(hit.normalDot>0)c.positive++;else c.negative++;}
 let index=0;for(const c of clusters){c.index=c.positive&&c.negative?0:c.positive?1:-1;index+=c.index;}
 return{index,inside:Math.abs(index)%2===1,clusters};
}
