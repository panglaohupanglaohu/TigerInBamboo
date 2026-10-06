// Project-authored fixed-cell woodland proposal. Not Oskar's tree/impostor code.
function hash(x,z,salt=0){let h=(Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(salt+98231,1274126177))>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return ((h^(h>>>16))>>>0)/4294967296;}
export function woodlandCell(ix,iz,pass=1){
 const priority=hash(ix,iz,0),cluster=Math.sin(ix*.19+Math.sin(iz*.11))+.65*Math.cos(iz*.17-ix*.06);
 // One local winner per neighborhood, independent of terrain acceptance and iteration.
 let tree=cluster>(pass===2?.15:.35)&&priority>.4;
 if(tree)for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++)if((x||z)&&(pass!==2||Math.abs(x)+Math.abs(z)===1)&&hash(ix+x,iz+z,0)>priority)tree=false;
 return {id:`${ix},${iz}`,eligible:cluster>-.7&&hash(ix,iz,1)<.61,jitterX:(hash(ix,iz,2)-.5)*1.1,jitterZ:(hash(ix,iz,3)-.5)*1.1,isTree:tree,size:tree?(pass===2?.45:.32)+hash(ix,iz,4)*(pass===2?.23:.24):(pass===2?.64:.48)+hash(ix,iz,4)*.40,yaw:hash(ix,iz,5)*Math.PI*2,priority,pass};
}
export function woodlandOnSurface(cell,{height,slope,crest=false}){
 if(!cell.eligible||height>35)return null;
 if(height>27&&cell.priority<.83)return null;
 const isTree=cell.isTree&&height<25&&slope>.78&&!crest;
 return {...cell,isTree,size:isTree?cell.size:Math.min(cell.size,cell.pass===2?1.04:.72)*(height>27?.7:1)};
}
