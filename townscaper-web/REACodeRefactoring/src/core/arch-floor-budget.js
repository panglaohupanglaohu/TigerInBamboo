/** Vertical opening budget adapted from REACode/piercefloor.
 * Preserve a slab below the supporting voxel base, including floating arches.
 * Existing default crown/rise are retained; this is not a new Boolean cutter.
 */
export function archFloorBudget({base,floor,storey,slab=.05}){
 if(![base,floor,storey,slab].every(Number.isFinite)||storey<=0||slab<=0||slab>=storey||base-floor<=slab)throw new RangeError('invalid opening/slab budget');
 const crown=base-slab,rise=Math.min((base-floor)*.75,storey*.8,crown-floor);
 return{base,floor,crown,rise,spring:crown-rise,slab};
}
