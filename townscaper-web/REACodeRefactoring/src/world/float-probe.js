/** 1664565063552847873: test, rather than assume, float render targets and CPU
 * feedback. Owns a temporary context; never changes the game's renderer state.
 */
export function probeFloatTargets(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const gl=canvas.getContext('webgl2',{antialias:false,depth:false,preserveDrawingBuffer:true,premultipliedAlpha:false});
 if(!gl)return{webgl2:false,formats:[],scope:'current-browser-only'};
 const resources={textures:[],buffers:[],framebuffers:[],programs:[],shaders:[]};
 const result={webgl2:true,scope:'current-browser-only',renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),extensions:{colorFloat:!!gl.getExtension('EXT_color_buffer_float'),floatLinear:!!gl.getExtension('OES_texture_float_linear')},formats:[]};
 const drain=()=>{let error=gl.NO_ERROR;for(let i=0;i<16;i++){const next=gl.getError();if(next===gl.NO_ERROR)break;error=next}return error};
 const shader=(type,source)=>{const s=gl.createShader(type);resources.shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
 const program=fragment=>{const p=gl.createProgram();resources.programs.push(p);gl.attachShader(p,shader(gl.VERTEX_SHADER,'#version 300 es\nlayout(location=0) in vec2 position;void main(){gl_Position=vec4(position,0.,1.);}'));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 pixel;'+fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p};
 try{
  const fill=program('void main(){pixel=vec4(1.25,-0.5,0.125,0.75);}'),filter=program('uniform sampler2D source;void main(){pixel=texture(source,vec2(0.5));}');
  const buffer=gl.createBuffer();resources.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.viewport(0,0,1,1);gl.disable(gl.BLEND);gl.disable(gl.DITHER);
  for(const[name,internal]of[['RGBA16F',gl.RGBA16F],['RGBA32F',gl.RGBA32F]]){
   drain();const texture=gl.createTexture();resources.textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,internal,1,1,0,gl.RGBA,gl.FLOAT,null);
   const framebuffer=gl.createFramebuffer();resources.framebuffers.push(framebuffer);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
   const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER),row={name,framebufferStatus:status,renderable:status===gl.FRAMEBUFFER_COMPLETE,readback:false,linearFiltering:false};result.formats.push(row);
   if(row.renderable){gl.useProgram(fill);gl.drawArrays(gl.TRIANGLES,0,3);const values=new Float32Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,values);row.readError=drain();row.values=[...values];row.readback=row.readError===gl.NO_ERROR&&values.every((v,i)=>Math.abs(v-[1.25,-.5,.125,.75][i])<1e-5)}
   // Filtering and framebuffer completeness are separate tests. Output to RGBA8.
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,internal,2,1,0,gl.RGBA,gl.FLOAT,new Float32Array([0,0,0,1,1,1,1,1]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.useProgram(filter);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(gl.getUniformLocation(filter,'source'),0);gl.drawArrays(gl.TRIANGLES,0,3);const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);row.filterError=drain();row.filteredValue=pixel[0]/255;row.linearFiltering=row.filterError===gl.NO_ERROR&&Math.abs(row.filteredValue-.5)<.02;
  }
 }catch(error){result.probeError=error.message}
 finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);for(const x of resources.textures)gl.deleteTexture(x);for(const x of resources.framebuffers)gl.deleteFramebuffer(x);for(const x of resources.buffers)gl.deleteBuffer(x);for(const x of resources.programs)gl.deleteProgram(x);for(const x of resources.shaders)gl.deleteShader(x);gl.getExtension('WEBGL_lose_context')?.loseContext()}
 return result;
}
