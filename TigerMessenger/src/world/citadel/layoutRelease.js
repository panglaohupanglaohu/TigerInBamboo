// One release selection for the original game. Explicit revision URLs retain their historical behavior.
const released={citadelMasterTerrain:"9",citadelWater:"2",citadelFrontGate:"1",citadelPlacement:"1",citadelMassing:"2",citadelPlaza:"3",citadelPort:"4"};
export function citadelRevision(key){
 if(typeof location==="undefined")return null;
 const q=new URLSearchParams(location.search);
 if(q.get("citadelLayout")==="legacy")return null;
 if(Object.keys(released).some(k=>q.has(k)))return q.get(key);
 return released[key]??null;
}
