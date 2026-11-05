/** 1897266928961700215 "Yet another hallway design";
 * 1890018647655272491 "Further iterations on hallway design".
 * Procedural interpretation: stable panel-local decoration, not the artist's generator.
 */
import{makeRng}from'./noise.js';
export function planDoodlePanels({width=1024,height=512,panelWidth=180,wainscot=.38,rows=4,seed=7}={}){
  if(![width,height,panelWidth].every(Number.isFinite)||width<1||height<1||width>4096||height>4096||panelWidth<24||!Number.isFinite(wainscot)||wainscot<0||wainscot>=1||!Number.isInteger(rows)||rows<1||rows>20||!Number.isInteger(seed))throw new RangeError('Invalid wall layout');
  const wallH=height*(1-wainscot),gap=panelWidth*.07,panels=[];
  for(let x=0,index=0;x<width;index++){
    const rng=makeRng((seed^Math.imul(index+1,16777619))|0),w=panelWidth*(.85+rng()*.3),motifs=[];
    for(let row=0;row<rows;row++)for(let col=0;col<2;col++)motifs.push({kind:Math.floor(rng()*6),x:x+w*(col+.5)/2+(rng()-.5)*w*.1,y:wallH*(row+.5)/rows+(rng()-.5)*wallH/rows*.25,size:Math.min(w*.23,wallH/rows*.36)*(.8+rng()*.4),rotation:(rng()-.5)*.3});
    panels.push({index,x,w,visibleWidth:Math.min(w,width-x),wallH,gap,tint:((seed%6+6)%6+index)%6,motifs});x+=w+gap;
  }return {width,height,wallH,panelWidth,panels,lineWidth:Math.max(1,panelWidth*.008),flutePitch:panelWidth*.045};
}
