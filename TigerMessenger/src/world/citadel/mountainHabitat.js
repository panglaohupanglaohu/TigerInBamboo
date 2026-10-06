// Project-authored shared habitat field: broad meadows with broken woodland edges.
export function mountainHabitat(x,z){
 return Math.sin(x*.075+Math.cos(z*.08))+.7*Math.cos(z*.105)+.25*Math.sin((x-z)*.047);
}
