/** 958371606350454784: "content agnostic ... similar hierarchy".
 * Local deterministic rendering helpers, not a reconstruction of source assets.
 * Streams expose a mutable integer state. Mirrored branches replay one stream
 * and consume its samples once; temporary rendering never advances its caller.
 */
export function withRandomState(stream,state,draw){
 if(!Number.isSafeInteger(state)||state<=0||typeof draw!=='function')throw new RangeError('Invalid part seed');
 const saved=stream.state;stream.state=state;try{return draw()}finally{stream.state=saved;}
}
export function mirroredRandom(stream,left,right){
 if(typeof left!=='function'||typeof right!=='function')throw new TypeError('Invalid mirror branches');
 const before=stream.state;let after=before;
 try{const a=left();after=stream.state;stream.state=before;return[a,right()]}finally{stream.state=after;}
}
/** Stable identity for a visible slot, independent of responsive column count. */
export function partSeed(base,index){
 if(!Number.isSafeInteger(base)||base<1||base>2147483646||!Number.isInteger(index)||index<0||index>1000000)throw new RangeError('Invalid part identity');
 let h=(base>>>0)^Math.imul(index+1,2654435761);h=Math.imul(h^(h>>>16),2246822507);return((h^(h>>>13))>>>0)%2147483646+1;
}
