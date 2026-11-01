const AO_PROFILES={
 off:{title:'Desligada',scale:.5,slices:0,steps:0,note:'Sem oclusão de proximidade entre superfícies.'},
 fast:{title:'Leve',scale:.5,slices:2,steps:4,note:'Contatos suaves com 8 amostras e menor custo.'},
 balanced:{title:'Equilibrada',scale:.65,slices:3,steps:4,note:'Contatos suaves com 12 amostras e filtro que preserva as superfícies.'},
 high:{title:'Alta',scale:1,slices:4,steps:6,note:'24 amostras na resolução da cena, com contatos e bordas mais definidos.'}
};
function ambientProfile(){return AO_PROFILES[state.aoMode]||AO_PROFILES.balanced}
function initAmbientOcclusion(vertex) {
 return drainGpuPreparation(initAmbientOcclusionIncremental(vertex, false));
}

function* initAmbientOcclusionIncremental(vertex, cooperative = true) {
 if(!AO_PROFILES[state.aoMode])state.aoMode='balanced';
 const control=$('aoMode');control.value=state.aoMode;
 let raw = null, denoise = null;
 let installed = false;
 try{
  raw = yield* screenProgramIncremental(vertex, AO_HORIZON_SOURCE, 'Preparando a oclusão ambiente', cooperative);
  yield {label: 'Preparando o filtro de oclusão'};
  denoise = yield* screenProgramIncremental(vertex, AO_DENOISE_SOURCE, 'Preparando o filtro de oclusão', cooperative);
  lighting.ao={raw,denoise,surfaceEnabled:WEBGL2,viewRotation:new Float32Array([1,0,0,0,1,0,0,0,1]),radius:12,strength:.85};
  installed = true;
 }catch(error){
  lighting.ao=null;console.warn('Oclusão de ambiente indisponível.',error);
 }finally{
  if (!installed) {
   if (raw) gl.deleteProgram?.(raw.program);
   if (denoise) gl.deleteProgram?.(denoise.program);
  }
 }
 control.disabled=!lighting.ao;
 control.onchange=()=>{
  state.aoMode=AO_PROFILES[control.value]?control.value:'balanced';
  if(lighting.image)lighting.image.historyValid=false;
  resize();persist();placeMenu();
 };
 yield {label: 'Oclusão preparada'};
}
function refreshAmbientControls(){
 const control=$('aoMode'),info=$('aoInfo');if(!control)return;
 control.disabled=!lighting?.ao;control.value=state.aoMode||'balanced';
 info.textContent=lighting?.ao?ambientProfile().note:'Oclusão indisponível neste modo de compatibilidade.';syncCustomPickers();
}
function updateAmbientViewport(scene){
 if(!scene?.aoRaw)return;
 scene.aoWidth=Math.max(1,Math.min(scene.aoRaw.width,Math.ceil(scene.baseWidth*ambientProfile().scale)));
 scene.aoHeight=Math.max(1,Math.min(scene.aoRaw.height,Math.ceil(scene.baseHeight*ambientProfile().scale)));
}
function allocateAmbientTargets(scene,width,height){
 if(!lighting.ao||state.aoMode==='off')return;
 const aw=Math.max(1,Math.ceil(width*ambientProfile().scale)),ah=Math.max(1,Math.ceil(height*ambientProfile().scale));
 scene.aoRaw=makeColorTarget(aw,ah);scene.aoFiltered=makeColorTarget(aw,ah);
 for(const t of [scene.aoRaw,scene.aoFiltered]){
  scene.targets.push(t);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t.texture);
  for(const key of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,key,gl.NEAREST);
 }
 gl.bindTexture(gl.TEXTURE_2D,null);
 if(!scene.aoRaw.valid||!scene.aoFiltered.valid){lighting.ao=null;scene.aoRaw=scene.aoFiltered=null}
 updateAmbientViewport(scene);refreshAmbientControls();
}
function ambientUniforms(q,scene,aspect){
 const ao=lighting.ao,profile=ambientProfile(),aw=scene.aoWidth||1,ah=scene.aoHeight||1;
 gl.uniform2f(q.resolution,scene.renderWidth,scene.renderHeight);gl.uniform2f(q.activeScale,scene.renderWidth/scene.width,scene.renderHeight/scene.height);
 gl.uniform2f(q.projection,Math.tan(.74/2)*aspect,Math.tan(.74/2));
 const jitter=lighting.image?.taaActive?lighting.image.jitter:[0,0];
 gl.uniform2f(q.projectionJitter,jitter[0],jitter[1]+objectInspection.screenLift*.5);
 gl.uniform2f(q.aoViewport,aw,ah);gl.uniform2f(q.aoResource,scene.aoRaw?.width||1,scene.aoRaw?.height||1);
 gl.uniform1f(q.hasSurface,scene.surface?1:0);gl.uniform1f(q.aoRadius,ao?.radius||12);gl.uniform1f(q.aoStrength,ao?.strength||.85);
 gl.uniform1f(q.aoSlices,profile.slices);gl.uniform1f(q.aoSteps,profile.steps);
 gl.uniform1f(q.aoEnabled,ao&&scene.aoRaw&&state.aoMode!=='off'?1:0);
 gl.uniformMatrix3fv(q.viewRotation,false,ao?.viewRotation||new Float32Array([1,0,0,0,1,0,0,0,1]));
 gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,scene.surface||scene.color);gl.uniform1i(q.surface,5);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,scene.depth);gl.uniform1i(q.sceneDepth,1);
}
function runAmbientOcclusion(scene,aspect){
 if(!lighting.ao||!scene.aoRaw||state.aoMode==='off')return false;
 const ao=lighting.ao,aw=scene.aoWidth,ah=scene.aoHeight;
 gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,null);
 bindScreenPass(ao.raw,scene.depth,scene.aoRaw,aw,ah);ambientUniforms(ao.raw,scene,aspect);gl.drawArrays(gl.TRIANGLES,0,6);
 bindScreenPass(ao.denoise,scene.aoRaw.texture,scene.aoFiltered,aw,ah);ambientUniforms(ao.denoise,scene,aspect);gl.drawArrays(gl.TRIANGLES,0,6);
 return true;
}
