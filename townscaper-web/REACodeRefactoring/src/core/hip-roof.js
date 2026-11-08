/** Rectangular equal-pitch hip roof, adapted from REACode/hiproof.
 * Local footprint strategy, not a recovered swarm-pathfinding algorithm.
 * Vertices are normalized [u,v,rise]; consumers map into their actual quad.
 */
export function hipRoof(width,depth,rise){
 if(![width,depth,rise].every(Number.isFinite)||width<=0||depth<=0||rise<=0)throw new RangeError('positive finite roof dimensions required');
 const alongU=width>=depth,long=Math.max(width,depth),short=Math.min(width,depth),inset=short/(2*long);
 const a=alongU?[inset,.5,rise]:[.5,inset,rise],b=alongU?[1-inset,.5,rise]:[.5,1-inset,rise];
 const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0]];
 const faces=alongU?[[corners[0],corners[1],b,a],[corners[1],corners[2],b],[corners[2],corners[3],a,b],[corners[3],corners[0],a]]:[[corners[0],corners[1],a],[corners[1],corners[2],b,a],[corners[2],corners[3],b],[corners[3],corners[0],a,b]];
 return{faces:faces.map(face=>face.filter((p,i)=>i===0||p.some((x,k)=>x!==face[i-1][k]))),ridge:[a,b],ridgeLength:long-short,eaveHeight:0};
}
