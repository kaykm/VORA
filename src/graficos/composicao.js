function beginSceneLighting(){
 if(!lighting)return;for(const unit of [5,6]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,null)}
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,lighting.fixed.texture);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,lighting.moving.texture);gl.activeTexture(gl.TEXTURE0);
 gl.bindFramebuffer(gl.FRAMEBUFFER,lighting.scene?.valid?(lighting.scene.msaa?.fbo||lighting.scene.fbo):null);
 gl.viewport(0,0,lighting.scene?.valid?lighting.scene.renderWidth:canvas.width,lighting.scene?.valid?lighting.scene.renderHeight:canvas.height);gl.clearColor(.66,.715,.64,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
}
function bindScreenPass(q,source,target,width,height){
 gl.bindFramebuffer(gl.FRAMEBUFFER,target?.fbo||null);gl.viewport(0,0,width,height);gl.useProgram(q.program);
 boundGeometry=null;
 if(geometryVAO){
  if(!q.vao){q.vao=geometryVAO.create();geometryVAO.bind(q.vao||null);gl.bindBuffer(gl.ARRAY_BUFFER,lighting.post.quad);gl.enableVertexAttribArray(q.p);gl.vertexAttribPointer(q.p,2,gl.FLOAT,false,0,0)}
  geometryVAO.bind(q.vao||null);
 }else{gl.bindBuffer(gl.ARRAY_BUFFER,lighting.post.quad);for(const loc of [attrib.p,attrib.n,attrib.c])gl.disableVertexAttribArray(loc);gl.enableVertexAttribArray(q.p);gl.vertexAttribPointer(q.p,2,gl.FLOAT,false,0,0)}
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,source);gl.uniform1i(q.color,0);
}
function finishSceneLighting(aspect){
 if(!lighting?.scene?.valid||lighting.scene.direct)return;
 const q=lighting.post,scene=lighting.scene,image=lighting.image,a=image?aaProfile():AA_PROFILES.fxaa,rw=scene.renderWidth,rh=scene.renderHeight,bw=scene.baseWidth,bh=scene.baseHeight;
 resolveMultisampleScene(scene,rw,rh);
 gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(false);
 if(!image||scene.needsComposition){
 runAmbientOcclusion(scene,aspect);
 const finalComposition=!image||scene.finalComposition;
 bindScreenPass(q,scene.color,finalComposition?null:scene.processed,finalComposition?canvas.width:rw,finalComposition?canvas.height:rh);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,scene.depth);gl.uniform1i(q.depth,1);
 gl.uniform2f(q.resolution,rw,rh);gl.uniform2f(q.activeScale,rw/scene.width,rh/scene.height);gl.uniform2f(q.projection,Math.tan(.74/2)*aspect,Math.tan(.74/2));gl.uniform1f(q.aaKind,a.fxaa||0);
 ambientUniforms(q,scene,aspect);gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,scene.aoFiltered?.texture||scene.color);gl.uniform1i(q.ao,6);
 gl.drawArrays(gl.TRIANGLES,0,6);
 }
 if(image&&!(scene.needsComposition&&scene.finalComposition)){
  let source=scene.needsComposition?scene.processed:{texture:scene.color,width:scene.width,height:scene.height};
  if(a.ssaa){bindScreenPass(image.downsample,source.texture,scene.resolved,bw,bh);bindSourceSize(image.downsample,source,rw,rh);gl.uniform2f(image.downsample.outputSize,bw,bh);gl.drawArrays(gl.TRIANGLES,0,6);source=scene.resolved}
  if(a.smaa)source=runSmaa(source,bw,bh,a.smaa);
  if(a.taa)source=runTemporal(source,bw,bh);
  let vw=bw,vh=bh;
  if(scene.upscaled){bindScreenPass(image.easu,source.texture,scene.upscaled,canvas.width,canvas.height);bindSourceSize(image.easu,source,bw,bh);gl.drawArrays(gl.TRIANGLES,0,6);source=scene.upscaled;vw=canvas.width;vh=canvas.height}
  const final=imageProfile().fsr?image.rcas:image.present;
  bindScreenPass(final,source.texture,null,canvas.width,canvas.height);bindSourceSize(final,source,vw,vh);gl.uniform1f(final.sharpness,.65);gl.drawArrays(gl.TRIANGLES,0,6);
 }
 gl.activeTexture(gl.TEXTURE0);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(shaderProgram);
}

