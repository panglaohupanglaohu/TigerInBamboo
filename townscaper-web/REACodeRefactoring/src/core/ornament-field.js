/** 1104771432440049664: one distance-field texture, mirrored UVs, independent
 * border/centre cutoff. 1105131621391495176 adds animation; exact source artwork
 * and animation curves are unknown. This canonical line art is a local sample.
 */
export function bakeOrnamentField(size=128) {
  if(!Number.isInteger(size)||size<32||size>256)throw new RangeError('ornament field size must be 32..256');
  const paths=[];
  for(const [cx,cy,r,a0,a1]of [[.48,.36,.29,-.15,1.6],[.28,.72,.18,.1,1.7],[.77,.73,.13,.4,2.1]]) {
    paths.push(Array.from({length:33},(_,i)=>{const a=(a0+(a1-a0)*i/32)*Math.PI;return[cx+Math.cos(a)*r,cy+Math.sin(a)*r]}));
  }
  paths.push([[.07,.08],[.2,.16],[.27,.1],[.38,.19],[.45,.11]]);
  const maxDistance=.25,field=new Float32Array(size*size),rgba=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const px=(x+.5)/size,py=(y+.5)/size;let d=Infinity;
    for(const path of paths)for(let k=1;k<path.length;k++) {
      const [ax,ay]=path[k-1],[bx,by]=path[k],dx=bx-ax,dy=by-ay;
      const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));
      d=Math.min(d,Math.hypot(px-ax-t*dx,py-ay-t*dy));
    }
    const id=y*size+x,v=Math.round(Math.min(1,d/maxDistance)*255);field[id]=d;rgba.set([v,v,v,255],id*4);
  }
  return{size,field,rgba,maxDistance};
}
