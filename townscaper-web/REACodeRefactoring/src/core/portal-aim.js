/** Portal-constrained lookahead in XZ; not triangle-surface interpolation. */
export function portalAim(position,a,b,next,toward,{radius=.055,advance=.12}={}){
 const ex=b.x-a.x,ez=b.z-a.z,len=Math.hypot(ex,ez);if(len<=2*radius+.02)return null;
 const dx=toward.x-position.x,dz=toward.z-position.z,den=dx*ez-dz*ex;
 let u=Math.abs(den)>1e-10?((a.x-position.x)*dz-(a.z-position.z)*dx)/den:((position.x-a.x)*ex+(position.z-a.z)*ez)/(len*len);
 const margin=(radius+.01)/len;u=Math.max(margin,Math.min(1-margin,u));
 const x=a.x+u*ex,z=a.z+u*ez,nx=next.x-x,nz=next.z-z,n=Math.hypot(nx,nz);
 return{x:x+(n?nx/n:0)*Math.min(advance,n*.5),z:z+(n?nz/n:0)*Math.min(advance,n*.5)};
}
