/** 1015142746372366336: "z-depth and draw order ... 2 passes".
 * Two passes retain their own far-to-near instance order. Intersecting sprites
 * still approximate volumetric transparency; this is not order-independent blending.
 */
export function smokeDepthOrder(particles,viewMatrix){
 if(!viewMatrix||viewMatrix.length!==16||![...viewMatrix].every(Number.isFinite))throw new TypeError('Invalid camera matrix');
 const depth=p=>viewMatrix[2]*p.x+viewMatrix[6]*p.y+viewMatrix[10]*p.z+viewMatrix[14];
 return [...particles].sort((a,b)=>depth(a)-depth(b)||(a.serial??0)-(b.serial??0));
}
