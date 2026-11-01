/** Normal homepage and integration checks must use the same composition.
 * Individual feature fixtures are not a substitute for this option set. */
export function createTargetCityProductionOptions({tramSystem,oldCityWingStreets=true}={}){
 return {includeFrontRail:false,newCityStreetInfill:true,newCityFoundationRefinement:true,
  newCityWindowBatching:true,newCitySecondaryClusters:true,oldCityWingStreets,
  oldCityWingCollisionGroups:[tramSystem?.group].filter(Boolean),
  cliffTransitRelease:tramSystem?.citadelTransitRelease??null,
  cloudRailCurves:tramSystem?.crossingBundle?tramSystem.curves:null,
  cliffTransitStructureOptions:tramSystem?.crossingBundle?.structureOptions??{newCityTransitLinks:true}};
}
