// Art-directed, game-scale heavy-aircraft circuit. Not a real bomber procedure.
export function heavyCircuit(distance){
 const straight=140,r=65,arc=Math.PI*r,total=straight*2+arc*2;
 let s=((distance+straight/2)%total+total)%total;
 if(s<straight)return{x:0,z:-70+s};s-=straight;
 if(s<arc){const a=Math.PI-s/r;return{x:r+Math.cos(a)*r,z:70+Math.sin(a)*r};}s-=arc;
 if(s<straight)return{x:r*2,z:70-s};s-=straight;
 const a=-s/r;return{x:r+Math.cos(a)*r,z:-70+Math.sin(a)*r};
}
