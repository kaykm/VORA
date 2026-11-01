// Resolution and filtering are independent of AO. Old saves retain the previous map sizes.
const SHADOW_PROFILES = {
 off: {title: 'Desligadas', fixed: 1, moving: 1, quality: 0, softness: 0},
 low: {title: 'Baixa', fixed: 512, moving: 256, quality: 0, softness: .25},
 balanced: {title: 'Média', fixed: 1024, moving: 512, quality: 1, softness: .65},
 high: {title: 'Alta', fixed: 2048, moving: 1024, quality: 2, softness: 1},
 ultra: {title: 'Ultra', fixed: 4096, moving: 2048, quality: 2, softness: 1}
};
let shadowSettingsVersion = 0, shadowSettingsPending = false, shadowSettingsError = '';
const SHADOW_DISTANCES={very_low:220,low:360,medium:540,high:760,very_high:1050,ultra:1450};
function shadowDistanceRange(){return Object.prototype.hasOwnProperty.call(SHADOW_DISTANCES,state.shadowDistance)?SHADOW_DISTANCES[state.shadowDistance]:SHADOW_DISTANCES.high}
function shadowMapExtent(){return Math.ceil((shadowDistanceRange()+256)/64)*64}
function shadowCasterRange(){
 // The cached map stays in place while the camera moves inside this margin.
 // Keep its surrounding casters so the moving distance fade never reveals holes.
 return shadowDistanceRange()+Math.min(200,shadowMapExtent()*.15);
}
function setShadowDistance(key){
 state.shadowDistance=Object.prototype.hasOwnProperty.call(SHADOW_DISTANCES,key)?key:'high';
 if(lighting){lighting.key='';lighting.dynamicKey='';if(lighting.image)lighting.image.historyValid=false;}
 pausedRenderStamp='';refreshShadowDistanceControls();
}
function refreshShadowDistanceControls(){
 const control=$('shadowDistance');control.value=state.shadowDistance;
 control.disabled=gl.isSoftware||!lighting?.fixed;
 $('shadowDistanceInfo').textContent=control.disabled?'Disponível com sombras WebGL.':
  'Alcance aproximado de '+Math.round(shadowDistanceRange()/WORLD_UNITS_PER_METER)+' m ao redor da câmera. Independente da qualidade.';
}

function shadowProfile(key = state.shadowQuality) {
 return SHADOW_PROFILES[Object.prototype.hasOwnProperty.call(SHADOW_PROFILES, key) ? key : 'high'];
}

function shadowTargetSizes(profile = shadowProfile()) {
 const mobile = matchMedia('(pointer:coarse)').matches;
 const textureLimit = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
 const depthLimit = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || textureLimit;
 const limit = Math.min(textureLimit, depthLimit);
 // Keep the historical mobile budget for Alta; Ultra remains an explicit opt-in.
 const factor = mobile && profile.fixed >= 2048 ? .5 : 1;
 return {fixed: Math.max(1, Math.min(limit, profile.fixed * factor)), moving: Math.max(1, Math.min(limit, profile.moving * factor))};
}

function deleteShadowTarget(target) {
 if (!target) return;
 deleteShadowBounds(target);
 gl.deleteFramebuffer(target.fbo);gl.deleteRenderbuffer(target.depth);gl.deleteTexture(target.texture);
}

function configureShadowUniforms() {
 if (!shaderProgram) return;
 const profile = shadowProfile();
 gl.useProgram(shaderProgram);
 gl.uniform1f(uniforms.shadowEnabled, lighting?.valid && lighting.fixed.size > 1 && state.shadowQuality !== 'off' ? 1 : 0);
 gl.uniform1f(uniforms.shadowQuality, profile.quality);
 gl.uniform1f(uniforms.shadowSoftness, profile.softness);
 configureShadowBoundsUniforms(uniforms);
 gl.uniform1f(uniforms.shadowDistance,shadowDistanceRange());
 gl.uniform1f(uniforms.shadowDepthRange,lighting?.depthRange||2200);
 gl.uniform2f?.(uniforms.shadowCenter,camera.x+cameraPan.x,camera.y+cameraPan.z);
 if (lighting?.fixed && lighting?.moving) {
  gl.uniform1f(uniforms.staticShadowTexel, 1 / lighting.fixed.size);
  gl.uniform1f(uniforms.shadowTexel, 1 / lighting.moving.size);
 }
}

function refreshShadowControls() {
 const control = $('shadowQuality'), info = $('shadowInfo');
 control.value = state.shadowQuality;
 control.disabled = gl.isSoftware || !lighting?.fixed;
 if (control.disabled) info.textContent = 'Sombras solares indisponíveis no modo de compatibilidade.';
 else if (shadowSettingsPending) info.textContent = 'Preparando a qualidade escolhida…';
 else if (shadowSettingsError) info.textContent = shadowSettingsError;
 else if (state.shadowQuality === 'off') info.textContent = 'Sombras solares desligadas. A oclusão tem ajuste independente.';
 else {
  const profile = shadowProfile();
  info.textContent = 'Sombras suaves · mapas ' + lighting.fixed.size + ' / ' + lighting.moving.size + ' px.';
  if (profile === SHADOW_PROFILES.ultra) info.textContent += ' Ultra usa mais memória da GPU.';
 }
}

function* replaceShadowTargets(sizes) {
 let fixed = null, moving = null, committed = false;
 try {
  fixed = makeShadowTarget(sizes.fixed);
  yield {waiting: true};
  yield* prepareShadowBoundsTarget(fixed);
  moving = makeShadowTarget(sizes.moving);
  yield {waiting: true};
  if (!fixed.valid || !moving.valid) throw new Error('Mapas de sombras indisponíveis.');
  const previousFixed = lighting.fixed, previousMoving = lighting.moving;
  Object.assign(lighting, {fixed, moving, size: moving.size, shadow: moving.texture, valid: true, center: null, key: '', dynamicKey: '', extent: 0});
  committed = true;
  deleteShadowTarget(previousFixed);deleteShadowTarget(previousMoving);
  configureShadowUniforms();
  invalidateSceneFrame();
 } finally {
  if (!committed) {deleteShadowTarget(fixed);deleteShadowTarget(moving);}
 }
}

function setShadowQuality(key) {
 state.shadowQuality = Object.prototype.hasOwnProperty.call(SHADOW_PROFILES, key) ? key : 'high';
 const version = ++shadowSettingsVersion;
 cancelResourceWork(job => job.shadowTargets === true);
 shadowSettingsPending = false;shadowSettingsError = '';
 configureShadowUniforms();
 if (lighting?.fixed && !gl.isSoftware) {
  const sizes = shadowTargetSizes();
  if (sizes.fixed !== lighting.fixed.size || sizes.moving !== lighting.moving.size || shadowBoundsRequested(lighting.fixed)&&!lighting.fixed.bounds) {
   shadowSettingsPending = true;
   queueResourceWork('shadow-targets', () => replaceShadowTargets(sizes), {
    shadowTargets: true, priority: -100, isValid: () => version === shadowSettingsVersion,
    onComplete: () => {shadowSettingsPending = false;refreshShadowControls();pausedRenderStamp = '';},
    onError: error => {
     shadowSettingsPending = false;
     shadowSettingsError = 'A GPU manteve os mapas anteriores. Experimente uma qualidade menor.';
     console.warn('Qualidade das sombras:', error);refreshShadowControls();
    }
   });
  }
 }
 pausedRenderStamp = '';refreshShadowControls();
}

function initShadowControls() {
 if (!Object.prototype.hasOwnProperty.call(SHADOW_PROFILES, state.shadowQuality)) state.shadowQuality = 'high';
 if (!Object.prototype.hasOwnProperty.call(SHADOW_DISTANCES, state.shadowDistance)) state.shadowDistance = 'high';
 $('shadowDistance').onchange=()=>{setShadowDistance($('shadowDistance').value);syncCustomPickers();persist();};
 refreshShadowDistanceControls();
 $('shadowQuality').onchange = () => {setShadowQuality($('shadowQuality').value);syncCustomPickers();persist();};
 configureShadowUniforms();refreshShadowControls();
}

function shadowProjection(x,z,extent){
 const len=Math.hypot(.62,.78,.28),L=[-.62/len,.78/len,.28/len],U=[L[2],0,-L[0]],ul=Math.hypot(U[0],U[2]);U[0]/=ul;U[2]/=ul;
 const V=[L[1]*U[2],L[2]*U[0]-L[0]*U[2],-L[1]*U[0]],cell=extent*2/lighting.size;
 const u=Math.round((x*U[0]+z*U[2])/cell)*cell,v=Math.round((x*V[0]+z*V[2])/cell)*cell,det=U[0]*V[2]-U[2]*V[0];
 x=(u*V[2]-v*U[2])/det;z=(v*U[0]-u*V[0])/det;
 lighting.center=[x,z];lighting.extent=extent;
 // Larger distance profiles need depth room for tall crowns at the map edge.
 const lightDistance=Math.max(1050,extent+256);
 lighting.depthRange=Math.max(2200,lightDistance*2+100);
 lighting.matrix=multiply(orthographic(-extent,extent,-extent,extent,1,lighting.depthRange+1),lookAt([x+L[0]*lightDistance,L[1]*lightDistance,z+L[2]*lightDistance],[x,0,z]));
 gl.uniform1f(uniforms.shadowDepthRange,lighting.depthRange);
}
function renderShadowLayer(target,pass,draw){
 // Packed depth is numeric data. Color dithering would corrupt the most significant byte.
 gl.disable(gl.DITHER);gl.disable(gl.BLEND);gl.depthMask(true);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,null);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,null);
 if(lighting.shadowBounds){gl.activeTexture(gl.TEXTURE0+7);gl.bindTexture(gl.TEXTURE_2D,lighting.turf?.texture||null);gl.activeTexture(gl.TEXTURE0);}
 gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);gl.viewport(0,0,target.size,target.size);
 gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.uniform1f(uniforms.renderPass,pass);gl.uniform1f(uniforms.shadowEnabled,0);gl.uniformMatrix4fv(uniforms.viewProjection,false,pass===1?lighting.liveMatrix:lighting.matrix);
 shadowCasterPlanes=extractVisibilityPlanes(pass===1?lighting.liveMatrix:lighting.matrix,shadowCasterPlanes);
 renderingShadow=true;try{draw();}finally{renderingShadow=false;shadowCasterPlanes=null;}
 if(WEBGL2)gl.invalidateFramebuffer(gl.FRAMEBUFFER,[gl.DEPTH_ATTACHMENT]);
 gl.uniform1f(uniforms.renderPass,0);gl.uniform1f(uniforms.shadowEnabled,state.shadowQuality==='off'?0:1);gl.enable(gl.DITHER);
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
}
function fitMovingShadowWindow(){
 const m=lighting.matrix,span=lighting.extent*2;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 const bounds=(x,z,y0,y1,rx,rz)=>{
  for(const X of [x-rx,x+rx])for(const Z of [z-rz,z+rz])for(const Y of [y0,y1]){
   const u=(m[0]*X+m[4]*Y+m[8]*Z+m[12])*.5+.5,v=(m[1]*X+m[5]*Y+m[9]*Z+m[13])*.5+.5;
   minX=Math.min(minX,u);minY=Math.min(minY,v);maxX=Math.max(maxX,u);maxY=Math.max(maxY,v);
  }
 };
 const r=physicalRadius()*1.36+8,e=cavityVisual.elevation;
 bounds(player.x,player.y,e-cavityDepth()-5,e+7,r,r);
 lighting.liveDepot=vegetationVisible(base.x,STATION.deck+meters(.5),base.y+13,meters(2.5))||depotFlights.length>0||saleGhosts.length>0;
 if(lighting.liveDepot){const [w,d,h]=depotDimensions();bounds(base.x,base.y+13,0,Math.max(STATION.deck+h+8,depotFlights.length||saleGhosts.length?STATION.receipt.y+meters(1):0),w*.65+8,d*.65+8)}
 lighting.liveSpawns=[];
 for(const o of objects){
  if(!o.alive||!motionAllowed()||o.spawnTime===undefined||o.spawnTime>=1)continue;
  const h=ASSET_METRICS[o.t].renderHeight;
  if(!vegetationVisible(o.x,h*.5,o.y,h*1.7+8))continue;
  lighting.liveSpawns.push(o);bounds(o.x,o.y,0,h+4,TYPES[o.t].size+3,TYPES[o.t].size+3);
 }
 // Spend the small live map on the moving region, retaining the previous texel density.
 const worldSize=Math.min(span,Math.ceil(Math.max(96,(maxX-minX)*span*1.12,(maxY-minY)*span*1.12)/32)*32),size=worldSize/span,step=size/lighting.size;
 const x=Math.max(0,Math.min(1-size,Math.round(((minX+maxX-size)*.5)/step)*step)),y=Math.max(0,Math.min(1-size,Math.round(((minY+maxY-size)*.5)/step)*step));
 const crop=new Float32Array(BODY_IDENTITY);crop[0]=crop[5]=1/size;crop[12]=(1-size-2*x)/size;crop[13]=(1-size-2*y)/size;
 lighting.liveMatrix=multiply(crop,lighting.matrix);lighting.liveWindow=[x,y,size,size];
 gl.uniform4f(uniforms.liveShadowWindow,x,y,size,size);gl.uniform1f(uniforms.shadowWorldTexel,worldSize/lighting.size);
 return lighting.liveWindow.map(v=>v.toFixed(8)).join(':');
}
function updateSunShadows(){
 if(!lighting?.valid||lighting.fixed.size<=1||state.shadowQuality==='off'){gl.uniform1f(uniforms.shadowEnabled,0);return}
 configureShadowUniforms();
 const x=camera.x+cameraPan.x,z=camera.y+cameraPan.z;
 const extent=shadowMapExtent();
 let objectKey=2166136261,spawning=false;
 for(let i=0;i<objects.length;i++){const o=objects[i];if(!o.alive)continue;
  if(motionAllowed()&&o.spawnTime!==undefined&&o.spawnTime<1){spawning=true;continue}
  objectKey=Math.imul(objectKey^(i*7+o.t),16777619);
 }
 const key=extent+':'+objectKey+':'+state.depotLevel+':'+shadowSceneLODKey();
 const recenter=!lighting.center||Math.hypot(x-lighting.center[0],z-lighting.center[1])>Math.min(200,extent*.15);
 if(recenter||lighting.extent!==extent||key!==lighting.key){
  if(recenter||lighting.extent!==extent)shadowProjection(x,z,extent);
  lighting.key=key;lighting.staticVersion++;
  gl.uniformMatrix4fv(uniforms.lightViewProjection,false,lighting.matrix);
  gl.uniform1f(uniforms.staticShadowWorldTexel,extent*2/lighting.fixed.size);
  renderShadowLayer(lighting.fixed,2,drawStaticShadowCasters);
  renderShadowBounds(lighting.fixed);
 }
 let pose=0;for(const b of cargoBodies)pose+=b.lx*.37+b.ly*.53+b.z*.71+b.q[0]*.19+b.q[1]*.29+b.q[2]*.43+b.q[3]*.61;
 const liveWindow=fitMovingShadowWindow();
 const dynamicKey=[lighting.staticVersion,liveWindow,lighting.liveDepot,player.x.toFixed(5),player.y.toFixed(5),physicalRadius().toFixed(5),cavityDepth().toFixed(5),cavityVisual.elevation.toFixed(5),travelDistance.toFixed(5),state.cargo.length,pose.toFixed(5),state.depot.length,depotPending.size].join(':');
 const active=lighting.liveSpawns.length||fallingItems.length||depotFlights.length||saleGhosts.length||worldResourceFalls.length||sceneMotionActive;
 if(active||dynamicKey!==lighting.dynamicKey){
  lighting.dynamicKey=dynamicKey;renderShadowLayer(lighting.moving,1,drawMovingShadowCasters);
 }
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,lighting.fixed.texture);
 gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,lighting.moving.texture);gl.activeTexture(gl.TEXTURE0);
 bindShadowBounds();
}
