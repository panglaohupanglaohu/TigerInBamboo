/** Stable numeric min-heap. Equal costs use integer IDs for deterministic routes. */
export class MinHeap {
  constructor(){this.items=[];}
  get length(){return this.items.length;}
  less(a,b){return a[0]<b[0]||(a[0]===b[0]&&a[1]<b[1]);}
  push(cost,id){const a=this.items;let i=a.length;a.push([cost,id]);while(i){const p=(i-1)>>1;if(!this.less(a[i],a[p]))break;[a[i],a[p]]=[a[p],a[i]];i=p;}}
  pop(){const a=this.items;if(!a.length)return null;const first=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){let m=i;const l=2*i+1,r=l+1;if(l<a.length&&this.less(a[l],a[m]))m=l;if(r<a.length&&this.less(a[r],a[m]))m=r;if(m===i)break;[a[i],a[m]]=[a[m],a[i]];i=m;}}return first;}
}
