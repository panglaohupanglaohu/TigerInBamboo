/** 1241046107125399552: reserve a 32² corner of a 128² atlas.
 * Local procedural leaf motif, not the author's painted asset. Other slots are
 * left available; this does NOT make every scene material share one texture.
 */
export function buildLeafAtlas() {
  const size=128, rect={x:96,y:96,w:32,h:32}, data=new Uint8Array(size*size*4);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const u=(x+.5)/32,v=(y+.5)/32;
    const wave=Math.cos(2*Math.PI*(u*4+.15*Math.sin(v*8*Math.PI)))*Math.cos(v*8*Math.PI);
    const value=Math.round(255*(.5+.5*wave));
    data.set([value,value,value,255],((96+y)*size+96+x)*4);
  }
  return {size,rect,data};
}
export function sphereLeafUV(x,y,z) {
  const l=Math.hypot(x,y,z);if(!Number.isFinite(l)||l===0)throw new RangeError('finite nonzero direction required');
  return [.5+Math.atan2(z,x)/(2*Math.PI),.5+Math.asin(Math.max(-1,Math.min(1,y/l)))/Math.PI];
}
