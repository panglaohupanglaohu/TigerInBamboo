shader_type spatial;
render_mode unshaded,cull_disabled,depth_draw_always;
uniform vec3 water_color=vec3(0.01,0.14,0.26);
uniform float opacity=0.94;
uniform float night_grade=1.0;
varying vec3 radial;
varying float wave;
void vertex(){
    radial=normalize(VERTEX);
    float phase=dot(radial,vec3(1.7,0.6,-1.1));
    wave=sin(phase*8.0+TIME*0.9)*0.045+cos(phase*13.0-TIME*0.57)*0.022;
    VERTEX+=radial*wave;
}
void fragment(){
    float mask=clamp(UV2.y,0.0,1.0);
    if(mask<0.42)discard;
    float depth=clamp(COLOR.r,0.0,1.0);
    float shore=clamp(COLOR.g,0.0,1.0);
    float fetch=clamp(COLOR.b,0.0,1.0);
    float light=0.66+0.34*max(dot(normalize(NORMAL),normalize(vec3(0.35,0.8,0.42))),0.0);
    float crest=smoothstep(0.014,0.052,abs(wave))*(0.18+fetch*0.82);
    float foam=(1.0-smoothstep(0.05,0.32,shore))*smoothstep(0.008,0.035,abs(wave));
    vec3 color=water_color*mix(0.64,1.0,depth)*light*mix(0.48,1.0,night_grade);
    color+=vec3(0.02,0.05,0.065)*(wave+0.06);
    color=mix(color,vec3(0.42,0.69,0.76),clamp((crest+foam)*0.55,0.0,1.0));
    ALBEDO=color;
    ALPHA=opacity*mix(0.9,1.0,depth)*smoothstep(0.42,0.78,mask);
}
