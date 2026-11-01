// One cached 4x4 min/max reduction, rather than a full mip pyramid. Only
// high/ultra PCF uses it; the original per-tap path remains the fallback.
const SHADOW_REDUCTION_SOURCE=/* @text src/graficos/shaders/sombras-reducao.frag */;

function shadowBoundsRequested(target){
 return !!lighting?.shadowBounds&&shadowProfile().quality>1.5&&target.size>=512&&target.size%4===0;
}
function deleteShadowBounds(target){
 const bounds=target?.bounds;if(!bounds)return;
 gl.deleteFramebuffer(bounds.fbo);gl.deleteTexture(bounds.texture);target.bounds=null;
}
function* prepareShadowBoundsTarget(target){
 if(!shadowBoundsRequested(target)||target.bounds)return;
 yield {label:'Preparando sombras suaves'};
 let bounds=null;
 try{
  const size=target.size/4;bounds=makeColorTarget(size,size);
  if(!bounds.valid)throw Error('Resumo de sombras indisponível.');
  gl.bindTexture(gl.TEXTURE_2D,bounds.texture);
  for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.NEAREST);
  Object.assign(bounds,{ready:false,bytes:size*size*4});target.bounds=bounds;bounds=null;
 }catch(error){
  console.warn('Mantendo a filtragem completa das sombras:',error);
 }finally{
  if(bounds){gl.deleteFramebuffer(bounds.fbo);gl.deleteTexture(bounds.texture);}
  gl.bindTexture(gl.TEXTURE_2D,null);
 }
}
function* initShadowBoundsIncremental(vertex,cooperative=true){
 if(gl.isSoftware||(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)||0)<8)return;
 try{
  lighting.shadowBounds=yield* screenProgramIncremental(vertex,SHADOW_REDUCTION_SOURCE,'Preparando sombras suaves',cooperative);
  yield* prepareShadowBoundsTarget(lighting.fixed);
 }catch(error){
  console.warn('Mantendo a filtragem compatível das sombras:',error);
 }
 gl.useProgram(shaderProgram);
}
function shadowBoundsReady(){
 return !!(lighting?.valid&&lighting.shadowBounds&&lighting.fixed?.bounds?.ready&&shadowProfile().quality>1.5);
}
function configureShadowBoundsUniforms(q){
 gl.uniform1f(q.shadowBoundsEnabled,shadowBoundsReady()?1:0);
 if(!gl.isSoftware)gl.uniform1i(q.shadowBoundsMap,lighting?.shadowBounds?7:4);
}
function bindShadowBounds(){
 configureShadowBoundsUniforms(uniforms);
 if(!lighting?.shadowBounds)return;
 gl.activeTexture(gl.TEXTURE0+7);
 gl.bindTexture(gl.TEXTURE_2D,shadowBoundsReady()?lighting.fixed.bounds.texture:lighting.turf?.texture||null);
 gl.activeTexture(gl.TEXTURE0);
}
function renderShadowBounds(target){
 const bounds=target.bounds,q=lighting.shadowBounds;
 if(!bounds?.valid||!q||shadowProfile().quality<=1.5)return;
 bounds.ready=false;
 // Packed numeric bytes must never be interpolated or dithered. Unbind the
 // destination sampler before writing it; no feedback loop is permitted.
 gl.activeTexture(gl.TEXTURE0+7);gl.bindTexture(gl.TEXTURE_2D,null);
 gl.disable(gl.DITHER);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
 try{
  bindScreenPass(q,target.texture,bounds,bounds.width,bounds.height);
  gl.uniform2f(q.inputViewport,target.size,target.size);gl.drawArrays(gl.TRIANGLES,0,6);
  bounds.ready=true;
 }finally{
  geometryVAO?.bind(null);boundGeometry=null;meshUniformState.fill(NaN);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
  gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.enable(gl.DITHER);gl.useProgram(shaderProgram);
 }
}
