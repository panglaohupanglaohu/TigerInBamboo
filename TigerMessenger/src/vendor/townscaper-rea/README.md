Imported 2026-10-31 from townscaper-web/REACode/src in the same workspace.

quadgrid.js, town.js, townmesh.js and save.js are copied unchanged. These are the local REACode project's Three.js recreation; they are not the original Townscaper Unity engine. Integration lives in src/world/morrisTownscaper.js and shares the project's Three.js import map.

Grid radius 30, hexSize 3, levelHeight 2. Only cells wholly inside the Morris lake are editable. Local storage is isolated under morris-townscaper-rea-v1; exports use REACode's encoding.


2026-10-31 follow-up: imported shore.js and engine/{waves,shorefield,backlit,watervol}.js. shorefield's relative town import is adjusted to the installed directory. townmesh.js adds independent AO and bounce flags; both default on and its position/color/aGlow output matches the reference mesher exactly for the verification fixture. Scene shaders and composition are adapted into morrisTownscaperEffects.js for a tilted tangent frame. Grid uses the original hexSize=1 and levelHeight=.5; a single parent scales all geometry and effects by 3. Existing saves keep their cell IDs and voxel masks.
