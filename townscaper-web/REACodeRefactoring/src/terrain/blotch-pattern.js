// Local procedural blotches; source videos do not specify their internal atlas/mask algorithm.
export const BLOTCH_GLSL = `
uniform float uBlotchLevel;
uniform float uBlotchStyleMode;
uniform vec4 uBlotchStyle;
float bh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(bh(i), bh(i + vec2(1, 0)), f.x), mix(bh(i + vec2(0, 1)), bh(i + vec2(1, 1)), f.x), f.y); }
float bfbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * bn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
float blotchTone(vec3 w) {
  float level = floor(w.y / max(uBlotchLevel, 0.00001) + 0.01);
  vec2 p = w.xz * (uBlotchStyleMode > .5 ? uBlotchStyle.z : .9);
  if(uBlotchStyleMode > .5) {
    float a = (bfbm(w.xz * .3 + 13.7) - .45) * 2.0 * uBlotchStyle.x;
    float ca=cos(a), sa=sin(a);
    p=mat2(ca,-sa,sa,ca)*p;
  }
  vec2 q = vec2(bfbm(p * 0.7 + level * 1.7), bfbm(p * 0.7 + 5.2 - level));
  float b = bfbm(p * 1.1 + q * 2.5 + level * 3.1);
  if(uBlotchStyleMode > .5) {
    // Low-frequency independent field controls coverage threshold, rather than
    // merely darkening every existing patch by the same amount.
    float density=bfbm(w.xz * .22 + vec2(51.7,19.3));
    float thresholdShift=(density-.45)*uBlotchStyle.y*.5;
    float width=max(fwidth(b),.002);
    float tone=.8+.2*smoothstep(.42-width,.42+width,b+thresholdShift)
                  +.14*smoothstep(.58-width,.58+width,b+thresholdShift);
    return mix(1.,tone,uBlotchStyle.w);
  }
  return b < 0.42 ? 0.8 : b < 0.58 ? 1.0 : 1.14;
}`;
