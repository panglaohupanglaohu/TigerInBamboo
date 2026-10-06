// Project-authored cached flow field. Not Oskar's private cloud/impostor shader.
export function buildRidgeCloudField(sample,{minX=-110,maxX=130,minZ=-65,maxZ=105,step=8}={}){
 const nx=Math.floor((maxX-minX)/step)+1,nz=Math.floor((maxZ-minZ)/step)+1,alt=new Float32Array(nx*nz),valid=new Uint8Array(nx*nz);
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const p=sample(minX+x*step,minZ+z*step),i=z*nx+x;if(p&&Number.isFinite(p.height)&&p.allowed){alt[i]=p.height;valid[i]=1;}}
 function lookup(x,z){const fx=(x-minX)/step,fz=(z-minZ)/step,ix=Math.floor(fx),iz=Math.floor(fz);if(ix<0||iz<0||ix>=nx-1||iz>=nz-1)return null;const ids=[iz*nx+ix,iz*nx+ix+1,(iz+1)*nx+ix,(iz+1)*nx+ix+1];if(ids.some(i=>!valid[i]))return null;return {ids,u:fx-ix,v:fz-iz};}
 const height=(x,z)=>{const q=lookup(x,z);if(!q)return NaN;const {ids,u,v}=q;return (alt[ids[0]]*(1-u)+alt[ids[1]]*u)*(1-v)+(alt[ids[2]]*(1-u)+alt[ids[3]]*u)*v;};
 const clearanceHeight=(x,z)=>{const q=lookup(x,z);return q?Math.max(...q.ids.map(i=>alt[i])):NaN;};
 const kind=(x,z)=>lookup(x,z)?1:0;
 const grad=(x,z)=>{const c=height(x,z),a=height(x-step*.4,z),b=height(x+step*.4,z),d=height(x,z-step*.4),e=height(x,z+step*.4);return [Number.isFinite(a)&&Number.isFinite(b)?(b-a)/(step*.8):0,Number.isFinite(d)&&Number.isFinite(e)?(e-d)/(step*.8):0];};
 const crests=[];let total=0;
 for(let z=1;z<nz-2;z++)for(let x=1;x<nx-2;x++){const px=minX+(x+.5)*step,pz=minZ+(z+.5)*step,h=height(px,pz);if(!Number.isFinite(h))continue;const [gx,gz]=grad(px,pz);if(Math.hypot(gx,gz)>2.5)continue;const w=1/(1+Math.hypot(gx,gz));crests.push({x:px,z:pz,w});total+=w;}
 return {height,clearanceHeight,kind,grad,crests,total,stats:{nx,nz,step,validCells:valid.reduce((a,b)=>a+b,0),samples:nx*nz}};
}
