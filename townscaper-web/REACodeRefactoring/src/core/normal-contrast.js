/** 1482011744843223042: "pixel thin lines from contrasts in my procedural normal map".
 * Local analytic Voronoi normal field, NOT the original UV charts/painted map.
 * Physical framebuffer pixel coverage; projection seams/large minification remain approximations.
 */
export const NORMAL_CONTRAST_GLSL = /* glsl */ `
uniform vec4 uNormalContrast; // enable, world frequency, normal difference threshold, pixel width
float ncCoverage(float distanceToEdge, float pixelGradient, float pixels) {
  return clamp(.5 + pixels*.5 - abs(distanceToEdge)/max(pixelGradient,1e-6),0.,1.);
}
vec2 ncHash(vec2 p) {
  return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}
vec3 ncPatchNormal(vec2 id) {return normalize(vec3((ncHash(id)*2.-1.)*.8,1.));}
float normalContrastInk(vec3 worldPosition) {
  vec3 gn=abs(normalize(cross(dFdx(worldPosition),dFdy(worldPosition))));
  vec2 p=gn.y>max(gn.x,gn.z)?worldPosition.xz:(gn.x>gn.z?worldPosition.zy:worldPosition.xy);
  vec2 q=p*uNormalContrast.y,cell=floor(q),a=vec2(0.),b=vec2(0.),ia=vec2(0.),ib=vec2(0.);
  float d1=1e9,d2=1e9;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++) {
    vec2 id=cell+vec2(float(x),float(y)),point=id+.2+.6*ncHash(id),delta=q-point;
    float d=dot(delta,delta);
    if(d<d1){d2=d1;b=a;ib=ia;d1=d;a=point;ia=id;}
    else if(d<d2){d2=d;b=point;ib=id;}
  }
  vec2 edgeNormal=normalize(b-a);
  float distanceToEdge=(d2-d1)/(2.*max(length(b-a),1e-6));
  float pixelGradient=length(vec2(dot(dFdx(q),edgeNormal),dot(dFdy(q),edgeNormal)));
  float difference=length(ncPatchNormal(ia)-ncPatchNormal(ib));
  return difference>uNormalContrast.z?ncCoverage(distanceToEdge,pixelGradient,uNormalContrast.w):0.;
}
`;
