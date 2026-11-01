import * as T from 'three';
const {throttledCollect}=await import(process.argv[2]);
const root=new T.Group();for(let i=0;i<5000;i++){const g=new T.Group();g.userData.k=i%10===0;root.add(g);for(let j=0;j<3;j++)g.add(new T.Object3D());}
let t=0;globalThis.performance={now:()=>t};
const get=throttledCollect(root,o=>!!o.userData.k,500,2000);
console.log('first',get().length);           // 500 immediately
const extra=new T.Group();extra.userData.k=true;root.add(extra);
t=600;let calls=0,l;do{l=get();calls++;}while(l.length===500&&calls<50);
console.log('after new pass',l.length,'calls',calls);
