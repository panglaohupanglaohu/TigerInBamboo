// Local sRGB four-corner palette. OkHsl/OkLab modes in the video remain pending.
export function makePalettePatch(corners){if(!Array.isArray(corners)||corners.length!==4||corners.some(c=>!Array.isArray(c)||c.length!==3||!c.every(v=>Number.isFinite(v)&&v>=0&&v<=1)))throw new RangeError('four sRGB corners');return Object.freeze(corners.map(c=>Object.freeze([...c])))}
export function samplePalettePatch(corners,u,v,white=0){if(![u,v,white].every(Number.isFinite)||[u,v,white].some(x=>x<0||x>1))throw new RangeError('palette coordinates');return [0,1,2].map(i=>((1-u)*(1-v)*corners[0][i]+u*(1-v)*corners[1][i]+(1-u)*v*corners[2][i]+u*v*corners[3][i])*(1-white)+white)}
export const PALETTE_PATCH_GLSL=`
uniform vec3 uPaletteA;uniform vec3 uPaletteB;uniform vec3 uPaletteC;uniform vec3 uPaletteD;
vec3 palettePatch(vec2 uv){vec3 c=mix(mix(uPaletteA,uPaletteB,uv.x),mix(uPaletteC,uPaletteD,uv.x),uv.y);return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
`;
