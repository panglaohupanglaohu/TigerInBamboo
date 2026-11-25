/** Place an edge anchor inside its actual polygon, independent of old grid center.
 * For narrow cells, cap inward travel before the next boundary. Returns null
 * for degenerate input; caller must skip placement. Mesh footprint is separate.
 */
export function pointInsidePolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
export function insetEdgeAnchor(poly,edge,u,inset){
 if(!Array.isArray(poly)||poly.length<3||!poly.every(p=>p.length===2&&p.every(Number.isFinite))||!Number.isInteger(edge)||edge<0||edge>=poly.length||!Number.isFinite(u)||u<=0||u>=1||!Number.isFinite(inset)||inset<=0)throw new RangeError('edge inset inputs');
 let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[1]-b[0]*a[1]}const a=poly[edge],b=poly[(edge+1)%poly.length],ex=b[0]-a[0],ez=b[1]-a[1],len=Math.hypot(ex,ez);if(len<1e-9||Math.abs(area)<1e-12)return null;
 const sign=Math.sign(area),nx=-ez/len*sign,nz=ex/len*sign,x=a[0]+ex*u,z=a[1]+ez*u;let exit=Infinity;
 for(let i=0;i<poly.length;i++){if(i===edge)continue;const c=poly[i],d=poly[(i+1)%poly.length],sx=d[0]-c[0],sz=d[1]-c[1],den=nx*sz-nz*sx;if(Math.abs(den)<1e-12)continue;const rx=c[0]-x,rz=c[1]-z,t=(rx*sz-rz*sx)/den,v=(rx*nz-rz*nx)/den;if(t>1e-9&&v>=-1e-9&&v<=1+1e-9)exit=Math.min(exit,t)}
 if(!Number.isFinite(exit))return null;const distance=Math.min(inset,exit*.45),p=[x+nx*distance,z+nz*distance];return pointInsidePolygon(p,poly)?{point:p,distance}:null;
}
