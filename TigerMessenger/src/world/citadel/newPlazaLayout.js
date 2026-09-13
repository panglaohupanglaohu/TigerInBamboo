import {citadelRevision} from "./layoutRelease.js";
// Shared authored dimensions: keep the original horse actor and its route in sync.
export const PLAZA_OFFSET_ENABLED=typeof location==="undefined" || new URLSearchParams(location.search).get('citadelPlazaOffset')!=='0';
export const PLAZA_R03=typeof location!=="undefined"&&citadelRevision('citadelPlaza')==='3';
export const PLAZA_SHIFT=PLAZA_R03?10:PLAZA_OFFSET_ENABLED?6:0;
export const PLAZA_LAYOUT={statueX:PLAZA_R03?65:59+PLAZA_SHIFT,horseX:75+PLAZA_SHIFT,left:44.85,right:81+PLAZA_SHIFT,centerX:62.925+PLAZA_SHIFT/2,width:36.15+PLAZA_SHIFT,front:88.5,back:59.5,axisX:60,ringRadius:PLAZA_R03?10.7:7.4};
