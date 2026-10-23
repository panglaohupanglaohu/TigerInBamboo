import * as T from 'three';
export function createDukeSteam({parent,matrix,funnel,count=10}){
 let map;if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(250,250,246,.9)');g.addColorStop(1,'rgba(250,250,246,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);map=new T.CanvasTexture(c);}else{const bytes=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const a=Math.max(0,1-Math.hypot(x-7.5,y-7.5)/8),i=(y*16+x)*4;bytes.set([250,250,246,Math.round(a*a*230)],i);}map=new T.DataTexture(bytes,16,16);map.needsUpdate=true;}
 const root=new T.Group();root.name='duke-live-funnel-steam';root.userData.noDistanceCulling=true;parent.add(root);const size=matrix.getMaxScaleOnAxis(),puffs=[];
 for(let i=0;i<count;i++){const o=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false,opacity:0,color:0xf4f3ec,fog:false}));o.name='duke-steam';o.userData.noDistanceCulling=true;root.add(o);puffs.push(o);}
 function update(_dt,t=0){for(let i=0;i<count;i++){const a=((t/6+i/count)%1+1)%1,wind=8*a+.7*Math.sin(a*5+i)*a;const o=puffs[i];o.position.set(funnel.x+wind*.55,funnel.y+.2+12*a,funnel.z-wind).applyMatrix4(matrix);o.scale.setScalar((1.4+a*6)*size);o.material.opacity=.64*Math.min(1,a/.075)*Math.pow(1-a,.9);o.material.rotation=.14*Math.sin(t*.28+i);}}
 update(0,0);return{root,puffs,update,dispose(){root.removeFromParent();puffs.forEach(o=>o.material.dispose());map.dispose();}};
}
