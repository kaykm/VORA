function drawVegetationShadows(){
 if(!groundDetailsBatches)return;
 for(const t of groundDetailsBatches){
  if(Math.hypot(t.center[0]-lighting.center[0],t.center[2]-lighting.center[1])>shadowCasterRange()+t.radius)continue;
  // Reuse the visible geometry, including low grass and creeping leaves.
  // No second shadow-only bake, duplicate allocation or mismatched leaf LOD.
  t.lastUsed=frameCount;
  drawMesh(vegetationMeshForView(t,true,1000),0,0,0,1,1,1,[1,1,1],15);
 }
}
function drawStaticShadowCasters(){
 drawWalkways();
 drawWorldBase();
 beginObjectInstances();
 for(const p of worldProps){if(!worldPropVisible(p))continue;
  if(Math.hypot(p.p[0]-lighting.center[0],p.p[1]-lighting.center[1])>shadowCasterRange()+(p.p[2]||70)*.65+30)continue;
  if(p.type==='tree')drawTree(p.p);else if(p.type==='scenery')drawParkProp(p);else drawBench(p.p,p.rotation,p.variant);
 }
 for(const o of objects){
  if(o.worldProp||!o.alive||motionAllowed()&&o.spawnTime!==undefined&&o.spawnTime<1)continue;
  if(Math.hypot(o.x-lighting.center[0],o.y-lighting.center[1])>shadowCasterRange()+ASSET_METRICS[o.t].renderHeight*.65+30)continue;
  drawAnimatedObject(o.t,o.x,o.y,terrainElevationAt(o.x,o.y),o.rot,1);
 }
 endObjectInstances();
 drawVegetationShadows();
}
function drawMovingShadowCasters(){
 // The opening analytically shades the lining and cargo. Rasterizing the lining again
 // caused curved receiver facets to shadow themselves, and wasted mobile shadow fill.
 for(const [m,material]of [[rimMesh,4],[fragmentMesh,8],[rootMesh,9],[grassMesh,10]])drawMesh(m,player.x,0,player.y,1,1,1,[1,1,1],material);
 for(const o of lighting.liveSpawns){
  drawAnimatedObject(o.t,o.x,o.y,terrainElevationAt(o.x,o.y),o.rot,.45+.55*(1-Math.pow(1-o.spawnTime,3)));
 }
 drawStored();if(lighting.liveDepot)drawDepot();drawSaleGhosts();drawWorldResourceFalls();
}
function drawSceneGeometry(shadowPass=false){
drawMesh(plane,0,0,0,1,1,1,[1,1,1],1);if(!shadowPass)drawParkBackdrop();drawWalkways();drawWorldBase();drawMesh(wallMesh,player.x,0,player.y,1,1,1,[1,1,1],2);drawMesh(floorMesh,player.x,0,player.y,1,1,1,[1,1,1],3);drawMesh(rimMesh,player.x,0,player.y,1,1,1,[1,1,1],4);drawMesh(fragmentMesh,player.x,0,player.y,1,1,1,[1,1,1],8);drawMesh(rootMesh,player.x,0,player.y,1,1,1,[1,1,1],9);drawMesh(grassMesh,player.x,0,player.y,1,1,1,[1,1,1],10);
if(gl.isSoftware){
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);for(const o of objects)if(!o.worldProp&&o.alive&&Math.hypot(o.x-camera.x,o.y-camera.y)<1050*viewRangeFactor())shadowAt(o.x+ASSET_METRICS[o.t].bodySize[1]*.18,o.y+ASSET_METRICS[o.t].bodySize[1]*.14,TYPES[o.t].size*.95,TYPES[o.t].size*.72);for(const p of worldProps){if(!worldPropVisible(p))continue;const [x,z,h]=p.p;if(shadowPass?Math.hypot(p.p[0]-camera.x-cameraPan.x,p.p[1]-camera.y-cameraPan.z)>lighting.extent*1.65+(p.p[2]||70):!sceneryVisibleAt(p))continue;shadowAt(x+(p.type==='tree'?h*.18:meters(.10)),z+(p.type==='tree'?h*.14:meters(.08)),p.type==='tree'?h*.30:meters(.94),p.type==='tree'?h*.23:meters(.37))}gl.disable(gl.BLEND);gl.depthMask(true);
}
beginObjectInstances();
for(const o of objects)if(!o.worldProp&&o.alive&&Math.hypot(o.x-camera.x,o.y-camera.y)<1050*viewRangeFactor())drawAnimatedObject(o.t,o.x,o.y,terrainElevationAt(o.x,o.y),o.rot,motionAllowed()&&o.spawnTime!==undefined?.45+.55*(1-Math.pow(1-o.spawnTime,3)):1);for(const p of worldProps){if(!worldPropVisible(p))continue;if(shadowPass?Math.hypot(p.p[0]-camera.x-cameraPan.x,p.p[1]-camera.y-cameraPan.z)>lighting.extent*1.65+(p.p[2]||70):!sceneryVisibleAt(p))continue;if(p.type==='tree')drawTree(p.p);else if(p.type==='scenery')drawParkProp(p);else drawBench(p.p,p.rotation,p.variant)}
endObjectInstances();
if(shadowPass)drawVegetationShadows();else drawGroundDetails();drawStored();drawDepot();drawSaleGhosts();drawWorldResourceFalls();if(!shadowPass&&state.particles!==false)for(const p of particles){const size=motionAllowed()?Math.min(1,p.life/.22):1;drawMesh(shapes.rock,p.x,p.z,p.y,size,size,size,[.62,.48,.28],16,(.7-p.life)*2)}
}
function prepareSceneCamera(updateFrustum=true){
const aspect=W/H,mobileScale=Math.max(1,.72/aspect),distance=Math.min(smoothZoom*mobileScale,Math.max(800,3800-cavityDepth()-Math.abs(cameraPan.y))),horiz=Math.cos(viewElevation)*distance;const target=[camera.x+cameraPan.x,-Math.min(cavityDepth()*.18,meters(.65))+cameraPan.y,camera.y+cameraPan.z];currentEye=[target[0]+Math.sin(viewYaw)*horiz,target[1]+Math.sin(viewElevation)*distance,target[2]+Math.cos(viewYaw)*horiz];const eyeX=currentEye[0]-player.x,eyeZ=currentEye[2]-player.y,minEye=pointInAperture(eyeX,eyeZ)?cavityHeightAt(eyeX,eyeZ)+3:5;currentEye[1]=Math.max(minEye,currentEye[1]);const cameraView=lookAt(currentEye,target),projection=perspective(.74,aspect,2,4000);
 projection[9]-=objectInspection.screenLift;
 const vp=multiply(projection,cameraView);
if(updateFrustum)prepareVegetationView(vp);return {aspect,cameraView,vp,target};
}
function render(){rebuildCavity();beginImageTiming();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.depthMask(true);if(!lighting){gl.clearColor(.66,.715,.64,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)}gl.useProgram(shaderProgram);const {aspect,cameraView,vp,target}=prepareSceneCamera(false);
if(lighting?.ao){const r=lighting.ao.viewRotation;for(let c=0;c<3;c++)for(let j=0;j<3;j++)r[c*3+j]=cameraView[c*4+j]}prepareImageFrame(vp);opaqueGPU.viewProjection=vp;gl.uniformMatrix4fv(uniforms.viewProjection,false,vp);if(gl.isSoftware)gl.camera={eye:currentEye,target,aspect,fov:.74,screenLift:objectInspection.screenLift};gl.uniform3f(uniforms.hole,player.x,player.y,physicalRadius());gl.uniform1f(uniforms.depth,cavityDepth());gl.uniform1f(uniforms.travel,travelDistance);gl.uniform1f(uniforms.pixelScale,2*Math.tan(.74/2)/(lighting?.scene?.renderHeight||canvas.height));gl.uniform3fv(uniforms.eye,currentEye);prepareVegetationView(vp);
const phase=travelDistance/26,a2=1.2*Math.sin(phase*.31+.3),a3=Math.sin(phase*.23+1.1)+.9,a4=.8*Math.sin(phase*.19+2.2)+1.7;gl.uniform3f(uniforms.apertureSin,Math.sin(a2),Math.sin(a3),Math.sin(a4));gl.uniform3f(uniforms.apertureCos,Math.cos(a2),Math.cos(a3),Math.cos(a4));updateSunShadows();gl.uniformMatrix4fv(uniforms.viewProjection,false,vp);beginSceneLighting();drawSceneGeometry();finishSceneLighting(aspect);endImageTiming();rememberSceneFrame(lighting?.image?.taaActive?lighting.image.unjitteredVP:vp);drawSpawnDebug(lighting?.image?.taaActive?lighting.image.unjitteredVP:vp);updateObjectHighlight(lighting?.image?.taaActive?lighting.image.unjitteredVP:vp);frameCount++;if(frameCount%12===0){canvas.dataset.renderer=gl.isSoftware?'software-3d':'webgl-3d';canvas.dataset.lighting=gl.isSoftware?'software':lighting?.scene?.valid?'cached-sun+live-shadows+ssao':'cached-sun+live-shadows';canvas.dataset.renderSize=(lighting?.scene?.renderWidth||canvas.width)+'×'+(lighting?.scene?.renderHeight||canvas.height);canvas.dataset.outputSize=canvas.width+'×'+canvas.height;canvas.dataset.antialiasing=state.aaMode||'fxaa';canvas.dataset.reconstruction=state.imageMode||'auto';canvas.dataset.msaa=String(lighting?.scene?.msaa?.samples||0);canvas.dataset.temporal=String(!!lighting?.image?.taaActive);canvas.dataset.ambientOcclusion=lighting?.ao&&state.aoMode!=='off'?'contact+normals+bilateral':'off';canvas.dataset.aoResolution=(lighting?.scene?.aoWidth||0)+'×'+(lighting?.scene?.aoHeight||0);canvas.dataset.shadowQuality=state.shadowQuality;canvas.dataset.shadowUpdate=state.shadowQuality==='off'?'off':'same-frame';canvas.dataset.textureFiltering='mipmaps+anisotropy-'+(lighting?.turf?.anisotropy||1);canvas.dataset.terrain=terrainAt(player.x,player.y);canvas.dataset.playerX=player.x.toFixed(2);canvas.dataset.playerY=player.y.toFixed(2);canvas.dataset.facing=(player.facing||0).toFixed(3);canvas.dataset.depth=(cavityDepth()).toFixed(1);canvas.dataset.falling=fallingItems.length;canvas.dataset.frame=frameCount}if(gl.present)gl.present()}
