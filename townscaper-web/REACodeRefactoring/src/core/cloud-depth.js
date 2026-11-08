/** REACode/clouddeck depth groups, interpreted as optional angular drift.
 * Not recovered physical cloud depth, blur, or cloud-shadow projection.
 */
export const CLOUD_DEPTHS=Object.freeze([3.2,2,1]);
export function cloudDepth(index){if(!Number.isInteger(index)||index<0)throw new RangeError('nonnegative cloud index required');return CLOUD_DEPTHS[index%CLOUD_DEPTHS.length];}
