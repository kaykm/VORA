function resolveMultisampleScene(scene,width,height){
 if(!scene.msaa)return;
 gl.bindFramebuffer(gl.READ_FRAMEBUFFER,scene.msaa.fbo);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,scene.fbo);
 gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
 gl.blitFramebuffer(0,0,width,height,0,0,width,height,gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT,gl.NEAREST);
 if(scene.surface){
  gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.drawBuffers([gl.NONE,gl.COLOR_ATTACHMENT1]);
  gl.blitFramebuffer(0,0,width,height,0,0,width,height,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);
 }
 if(WEBGL2)gl.invalidateFramebuffer(gl.READ_FRAMEBUFFER,scene.surface?[gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.DEPTH_ATTACHMENT]:[gl.COLOR_ATTACHMENT0,gl.DEPTH_ATTACHMENT]);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}

