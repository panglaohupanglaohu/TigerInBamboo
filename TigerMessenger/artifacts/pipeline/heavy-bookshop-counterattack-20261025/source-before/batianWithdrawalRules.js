// Shared deterministic thresholds; no timer invents damage or casualties.
export function judgeBookshopWithdrawal(s={}){
 if(s.energy<15)return 'energy';
 if(s.wingNodes===0)return 'wing-nodes';
 if(s.heat>95)return 'overheat';
 if(s.assigned>0&&s.lost>=Math.ceil(s.assigned*.6))return 'ground-force-losses';
 if(s.initialTransports>0&&s.disabledTransports>=Math.ceil(s.initialTransports*2/3))return 'transport-losses';
 if(s.initialEscorts>0&&s.activeEscorts<s.initialEscorts/2)return 'escort-losses';
 if(s.controllers>=6&&s.heldFor>=8)return 'plaza-objective-complete';
 if(s.arrivalSeconds>=90)return 'bookshop-time-limit';
 return null;
}
export function allowCoverBombing(s={}){return s.energy>=26&&s.wingNodes>0&&s.heat<=95&&!['energy','wing-nodes','overheat','pilot-or-story','command','transport-losses'].includes(s.reason);}
