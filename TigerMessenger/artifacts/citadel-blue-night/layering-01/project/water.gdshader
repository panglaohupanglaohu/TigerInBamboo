shader_type spatial;
render_mode cull_disabled;
varying vec3 world_position;
uniform float wave_time=0.0;
void vertex(){world_position=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;}
void fragment(){
 ALBEDO=vec3(0.13,0.22,0.28); METALLIC=0.85; ROUGHNESS=0.14; SPECULAR=0.8;
 vec3 slope=vec3(sin(world_position.x*2.2+world_position.z*1.3+wave_time)*0.05,0.0,cos(world_position.z*3.8-wave_time*0.7)*0.08);
 NORMAL=normalize(NORMAL+(VIEW_MATRIX*vec4(slope,0.0)).xyz);
}
