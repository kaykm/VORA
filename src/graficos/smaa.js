function uploadLookup(asset,linear){
 const text=atob(asset.data),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);
 const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,asset.width,asset.height,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
 for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,linear?gl.LINEAR:gl.NEAREST);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);gl.bindTexture(gl.TEXTURE_2D,null);return t;
}
function buildSmaaShader(pass,vertex,preset='HIGH'){
 const header='precision highp float;\nuniform vec4 u_metrics;uniform vec2 u_activeScale;\n#define SMAA_GLSL_3 1\n#define SMAA_PRESET_'+preset+' 1\n#define SMAA_RT_METRICS u_metrics\n#define SMAA_INCLUDE_VS '+(vertex?1:0)+'\n#define SMAA_INCLUDE_PS '+(vertex?0:1)+'\n#define SMAASampleLookup(tex,coord) textureLod(tex,coord,0.0)\nvec2 smaaBufferUV(vec2 p){p=clamp(p,.5*u_metrics.xy,u_activeScale-.5*u_metrics.xy);return vec2(p.x,u_activeScale.y-p.y);}\n';
 let declarations='varying vec2 vUv;',body;
 if(pass==='edges'||pass==='weights')declarations+='varying vec4 vOffset[3];';else declarations+='varying vec4 vOffset;';
 if(pass==='weights')declarations+='varying vec2 vPixcoord;';
 if(vertex){
  declarations+='attribute vec2 a_position;';
  const setup=pass==='edges'?'SMAAEdgeDetectionVS(vUv,vOffset);':pass==='weights'?'SMAABlendingWeightCalculationVS(vUv,vPixcoord,vOffset);':'SMAANeighborhoodBlendingVS(vUv,vOffset);';
  body='void main(){vec2 uv=a_position*.5+.5;vUv=vec2(uv.x,1.-uv.y)*u_activeScale;'+setup+'gl_Position=vec4(a_position,0.,1.);}';
 }else{
  declarations+='uniform sampler2D u_color;uniform sampler2D u_edges;uniform sampler2D u_area;uniform sampler2D u_search;uniform sampler2D u_weights;';
  body=pass==='edges'?'void main(){gl_FragColor=vec4(SMAAColorEdgeDetectionPS(vUv,vOffset,u_color),0.,0.);}':pass==='weights'?'void main(){gl_FragColor=SMAABlendingWeightCalculationPS(vUv,vPixcoord,vOffset,u_edges,u_area,u_search,vec4(0.));}':'void main(){gl_FragColor=SMAANeighborhoodBlendingPS(vUv,vOffset,u_color,u_weights);}';
 }
 return header+SMAA_LIBRARY+'\n'+declarations+body;
}
function ensureSmaa(preset){
 const image=lighting.image;if(image.smaaPrograms[preset])return image.smaaPrograms[preset];
 if(!image.lookups)image.lookups={area:uploadLookup(SMAA_LOOKUPS.area,true),search:uploadLookup(SMAA_LOOKUPS.search,false)};
 const result={};for(const pass of ['edges','weights','blend'])result[pass]=screenProgram(buildSmaaShader(pass,true,preset),buildSmaaShader(pass,false,preset));
 image.smaaPrograms[preset]=result;return result;
}
function setScreenMetrics(q,target,rw,rh){gl.uniform4f(q.metrics,1/target.width,1/target.height,target.width,target.height);gl.uniform2f(q.activeScale,rw/target.width,rh/target.height)}
function runSmaa(source,rw,rh,preset){
 const image=lighting.image,scene=lighting.scene,q=ensureSmaa(preset);
 bindScreenPass(q.edges,source.texture,scene.edges,rw,rh);setScreenMetrics(q.edges,scene.edges,rw,rh);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
 bindScreenPass(q.weights,scene.edges.texture,scene.weights,rw,rh);setScreenMetrics(q.weights,scene.weights,rw,rh);gl.uniform1i(q.weights.edges,0);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,image.lookups.area);gl.uniform1i(q.weights.area,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,image.lookups.search);gl.uniform1i(q.weights.search,2);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
 bindScreenPass(q.blend,source.texture,scene.smaaOutput,rw,rh);setScreenMetrics(q.blend,scene.smaaOutput,rw,rh);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,scene.weights.texture);gl.uniform1i(q.blend.weights,1);gl.drawArrays(gl.TRIANGLES,0,6);return scene.smaaOutput;
}
