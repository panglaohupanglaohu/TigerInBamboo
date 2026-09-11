// Retain validated poses and segment boundaries when composing fleet routes.
// Reversing a berth connector backs the same vessel out without an untested
// instantaneous 180-degree turn. Ocean-only paths retain their original behavior.
export function reverseWaterPath(path){
 const reversed={...path,points:path.points.slice().reverse()};
 if(path.poses)reversed.poses=path.poses.slice().reverse();
 if(path.segments)reversed.segments=path.segments.slice().reverse().map(reverseWaterPath);
 return reversed;
}
export function joinWaterPaths(a,b){
 return {points:[...a.points,...b.points.slice(1)],length:a.length+b.length,segments:[a,b]};
}
