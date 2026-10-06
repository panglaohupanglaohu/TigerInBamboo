// Selected geometry/turf from r16 and rock palette from r19. Explicit query
// overrides remain available; citadelMountainRelease=0 restores legacy defaults.
export const RELEASE_ENABLED=true;
export const MOUNTAIN_RELEASE_VERSION='citadel-mountain-20261005-r19';
export const MOUNTAIN_RELEASE_PARAMS=Object.freeze({
 citadelRidgePass:'6',citadelTurfPass:'5',citadelWoodlandPass:'2',
 citadelRockSurfacePass:'4',citadelRockRelief:'.22',citadelSurfaceIndex:'1',
 citadelMountainPalette:'3',citadelMountainLightPass:'0',citadelRockDetail:'.35',
});
/** Pure resolution: no globals, persistence, geometry, or validation coercion.
 * Explicit values (including 0, empty, unknown) always retain old parser semantics.
 * release=0 suppresses defaults even after publication; release=1 previews the
 * manifest explicitly. enabled override is intended for isolated config tests.
 */
export function resolveMountainParams(search='',{enabled=RELEASE_ENABLED}={}){
 const params=new URLSearchParams(search),request=params.get('citadelMountainRelease'),active=request!=='0'&&(enabled||request==='1'),applied=[];
 if(active)for(const [key,value]of Object.entries(MOUNTAIN_RELEASE_PARAMS))if(!params.has(key)){params.set(key,value);applied.push(key);}
 return {params,releaseVersion:MOUNTAIN_RELEASE_VERSION,releaseEnabled:enabled,active,mode:active?(enabled?'release-defaults':'explicit-candidate-preview'):'legacy-defaults',applied,resolved:Object.fromEntries(params)};
}
