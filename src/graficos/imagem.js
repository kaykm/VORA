// Image modes keep reconstruction, source anti-aliasing and output resolution independent.
const IMAGE_PROFILES={
 auto:{title:'Automático',scale:.85,maximum:.90,fsr:true,note:'Ajusta a resolução pelo tempo de GPU, quando disponível.'},
 fsraa:{title:'FSRAA espacial',scale:1,fsr:true,note:'100% da resolução + AA escolhido + RCAS. Modo espacial; sem reconstrução temporal do FSR.'},
 ultra_quality:{title:'FSR · Ultra qualidade',scale:1/1.3,fsr:true,note:'77% por eixo. Prioriza os detalhes.'},
 quality:{title:'FSR · Qualidade',scale:1/1.5,fsr:true,note:'67% por eixo. Equilíbrio entre imagem e carga.'},
 balanced:{title:'FSR · Equilibrado',scale:1/1.7,fsr:true,note:'59% por eixo. Reduz a carga da cena.'},
 performance:{title:'FSR · Desempenho',scale:.5,fsr:true,note:'50% por eixo. Detalhes finos podem perder definição.'},
 ultra_performance:{title:'FSR · Ultra desempenho',scale:1/3,fsr:true,note:'33% por eixo · escala espacial 3× experimental. A perda de detalhe é maior.'},
 native:{title:'Nativo · FSR desligado',scale:1,fsr:false,note:'100% da resolução escolhida, somente com o AA selecionado.'}
};
const AA_PROFILES={
 off:{title:'Desligado',cost:'MÍNIMO',note:'Sem suavização. Disponível com FSR desligado.',factor:1,fxaa:0},
 fxaa_fast:{title:'FXAA · Rápido',cost:'LEVE',note:'Busca curta e pouca filtragem. Prioriza FPS.',factor:1,fxaa:1},
 fxaa:{title:'FXAA · Equilibrado',cost:'LEVE',note:'Suavização espacial por contraste, sem histórico.',factor:1,fxaa:2},
 fxaa_high:{title:'FXAA · Qualidade',cost:'LEVE / MÉDIO',note:'Busca mais longa nas bordas e melhor cobertura subpixel.',factor:1,fxaa:3},
 smaa_high:{title:'SMAA 1× · High',cost:'MÉDIO',note:'SMAA com buscas diagonais e tratamento de cantos. Requer WebGL 2.',factor:1,smaa:'HIGH'},
 smaa_ultra:{title:'SMAA 1× · Ultra',cost:'MÉDIO / ALTO',note:'SMAA com busca ampliada e limiar mais sensível. Requer WebGL 2.',factor:1,smaa:'ULTRA'},
 taa:{title:'TAA · Experimental',cost:'MÉDIO / ALTO',note:'Acumula amostras ao longo dos quadros. Rejeita histórico em superfícies móveis e reveladas.',factor:1,taa:true,fxaa:1},
 msaa2:{title:'MSAA 2×',cost:'MÉDIO',note:'Multiamostragem real das bordas. Depende da GPU.',factor:1,samples:2},
 msaa4:{title:'MSAA 4×',cost:'ALTO',note:'Multiamostragem real com quatro amostras. Depende da GPU.',factor:1,samples:4},
 msaa8:{title:'MSAA 8×',cost:'MUITO ALTO',note:'Multiamostragem real com oito amostras. Depende da GPU.',factor:1,samples:8},
 msaa4_smaa:{title:'MSAA 4× + SMAA',cost:'MUITO ALTO',note:'Combina cobertura geométrica com suavização morfológica.',factor:1,samples:4,smaa:'HIGH'},
 ssaa2:{title:'SSAA 2×',cost:'ALTO',note:'Renderiza aproximadamente o dobro de pixels antes de reduzir a imagem.',factor:Math.SQRT2,ssaa:2},
 ssaa4:{title:'SSAA 4×',cost:'MUITO ALTO',note:'Renderiza quatro vezes os pixels. Mais detalhe, maior custo.',factor:2,ssaa:4},
 ssaa8:{title:'SSAA 8×',cost:'EXTREMO',note:'Renderiza oito vezes os pixels. Limitado pela memória e resolução.',factor:Math.sqrt(8),ssaa:8}
};
function imageProfile(){return IMAGE_PROFILES[state.imageMode]||IMAGE_PROFILES.auto}
function aaProfile(){return AA_PROFILES[state.aaMode]||AA_PROFILES.fxaa}
function imageScale(){return state.imageMode==='auto'?(lighting?.image?.scale||.85):imageProfile().scale}
function gpuTimerExtension(){
 if(!WEBGL2)return gl.getExtension('EXT_disjoint_timer_query');
 const e=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!e)return null;
 return {GPU_DISJOINT_EXT:e.GPU_DISJOINT_EXT,TIME_ELAPSED_EXT:e.TIME_ELAPSED_EXT,QUERY_RESULT_AVAILABLE_EXT:gl.QUERY_RESULT_AVAILABLE,QUERY_RESULT_EXT:gl.QUERY_RESULT,createQueryEXT:()=>gl.createQuery(),deleteQueryEXT:q=>gl.deleteQuery(q),beginQueryEXT:(t,q)=>gl.beginQuery(t,q),endQueryEXT:t=>gl.endQuery(t),getQueryObjectEXT:(q,p)=>gl.getQueryParameter(q,p)};
}
function queryAASupport(){
 const maximum=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
 let samples=[];if(WEBGL2){
  const color=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA8,gl.SAMPLES)||[]),depth=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES)||[]);
  samples=[2,4,8].filter(n=>color.includes(n)&&depth.includes(n));
 }
 return {maximum,samples,temporal:WEBGL2&&!!gl.getExtension('EXT_color_buffer_float')};
}
function aaSupported(key){
 const a=AA_PROFILES[key],c=lighting?.image?.support;if(!a||!c)return false;
 if(a.smaa&&(!WEBGL2||lighting.image.smaaUnavailable)||a.taa&&!c.temporal||a.samples&&!c.samples.includes(a.samples))return false;
 const scale=imageProfile().maximum||imageProfile().scale,w=Math.round(canvas.width*scale*a.factor),h=Math.round(canvas.height*scale*a.factor);
 return w<=c.maximum&&h<=c.maximum&&w*h<=16777216;
}
function refreshAAControls(){
 const image=lighting?.image;if(!image)return;
 for(const option of Array.from($('aaMode').options||[])){
  const key=option.value,base=AA_PROFILES[key]?.title||key,available=aaSupported(key);
  option.disabled=!available||(key==='off'&&imageProfile().fsr);option.textContent=base+(available?'':' · sem suporte');
 }
 $('imageMode').value=state.imageMode;$('aaMode').value=state.aaMode;$('outputMode').value=state.outputMode||'balanced';
 $('aaInfo').textContent=aaProfile().note;$('aaCost').textContent=aaProfile().cost;$('aaCost').dataset.heavy=aaProfile().factor>1||!!aaProfile().samples||!!aaProfile().taa?'true':'false';
 const info=$('imageInfo'),scene=lighting.scene;if(scene)info.textContent=Math.round(imageScale()*100)+'% por eixo · '+scene.baseWidth+' × '+scene.baseHeight+' → '+canvas.width+' × '+canvas.height+(aaProfile().ssaa?' · SSAA: '+scene.renderWidth+' × '+scene.renderHeight:'');
 $('reconstructionInfo').textContent=imageProfile().note;syncCustomPickers();
}
function configureImageSettings(changed){
 const image=lighting?.image;if(!image)return;
 if(!IMAGE_PROFILES[state.imageMode])state.imageMode='auto';if(!AA_PROFILES[state.aaMode])state.aaMode='fxaa';
 if(changed==='aa'&&state.aaMode==='off'&&imageProfile().fsr)state.imageMode='native';
 if(imageProfile().fsr&&state.aaMode==='off')state.aaMode='fxaa';
 if(!aaSupported(state.aaMode))state.aaMode='fxaa_high';
 image.scale=state.imageMode==='auto'?.85:imageProfile().scale;image.historyValid=false;image.average=0;image.slow=image.fast=0;image.cooldown=performance.now()+1500;
 gl.useProgram(shaderProgram);gl.uniform1f(uniforms.reactive,0);resize();refreshAAControls();persist();placeMenu();
}
function initImagePipeline(vertex) {
 return drainGpuPreparation(initImagePipelineIncremental(vertex, false));
}

function* initImagePipelineIncremental(vertex, cooperative = true) {
 if(!IMAGE_PROFILES[state.imageMode])state.imageMode='native';if(!AA_PROFILES[state.aaMode])state.aaMode='off';
 state.outputMode=state.outputMode==='balanced'?'balanced':'native';
 const prepared = {};
 let installed = false;
 try{
  for (const [name, source, label] of [
   ['easu', FSR_EASU_SOURCE, 'Preparando a reconstrução de imagem'],
   ['rcas', FSR_RCAS_SOURCE, 'Preparando a nitidez'],
   ['present', AA_PRESENT_SOURCE, 'Preparando a apresentação'],
   ['downsample', AA_DOWNSAMPLE_SOURCE, 'Preparando a resolução'],
   ['temporal', AA_TEMPORAL_SOURCE, 'Preparando a suavização temporal']
  ]) {
   prepared[name] = yield* screenProgramIncremental(vertex, source, label, cooperative);
   yield {label};
  }
  lighting.image={spatialVersion:'1.2.0',...prepared,vertex,support:queryAASupport(),scale:state.imageMode==='auto'?.85:imageProfile().scale,refresh:1000/60,cooldown:0,average:0,slow:0,fast:0,pending:[],active:null,timer:gpuTimerExtension(),smaaPrograms:{},historyValid:false,historyRead:0};
  installed = true;
 }catch(error){
  lighting.image=null;console.warn('Usando suavização compatível.',error);
 }finally{
  if (!installed) for (const q of Object.values(prepared)) gl.deleteProgram?.(q.program);
 }
 for(const id of ['imageMode','aaMode','outputMode'])$(id).disabled=!lighting.image;
 if(!lighting.image)return;
 if(!aaSupported(state.aaMode))state.aaMode='fxaa';
 if(imageProfile().fsr&&state.aaMode==='off')state.aaMode='fxaa';
 $('imageMode').value=state.imageMode;$('aaMode').value=state.aaMode;$('outputMode').value=state.outputMode;
 $('imageMode').onchange=()=>{state.imageMode=$('imageMode').value;configureImageSettings('image')};
 $('aaMode').onchange=()=>{state.aaMode=$('aaMode').value;configureImageSettings('aa')};
 $('outputMode').onchange=()=>{state.outputMode=$('outputMode').value;configureImageSettings('output')};
 const preset = aaProfile().smaa;
 if (preset) {
  try { yield* prepareSmaaProgramsIncremental(preset, cooperative); }
  catch (error) {
   lighting.image.smaaUnavailable = true;
   state.aaMode = 'fxaa_high';
   console.warn('SMAA indisponível neste dispositivo.', error);
  }
 }
}

function* prepareSmaaProgramsIncremental(preset, cooperative = true) {
 const image = lighting.image;
 if (!image || image.smaaPrograms[preset]) return image?.smaaPrograms[preset];
 if (!image.lookups) {
  let area = null, search = null, installed = false;
  try {
   area = uploadLookup(SMAA_LOOKUPS.area, true);
   yield {label: 'Preparando as tabelas de suavização'};
   search = uploadLookup(SMAA_LOOKUPS.search, false);
   image.lookups = {area, search};
   installed = true;
   yield {label: 'Preparando as tabelas de suavização'};
  } finally {
   if (!installed) {
    if (area) gl.deleteTexture?.(area);
    if (search) gl.deleteTexture?.(search);
   }
  }
 }
 const result = {};
 let installed = false;
 try {
  for (const pass of ['edges', 'weights', 'blend']) {
   result[pass] = yield* screenProgramIncremental(
    buildSmaaShader(pass, true, preset), buildSmaaShader(pass, false, preset),
    'Preparando a suavização das bordas', cooperative
   );
   yield {label: 'Preparando a suavização das bordas'};
  }
  image.smaaPrograms[preset] = result;
  installed = true;
  return result;
 } finally {
  if (!installed) for (const q of Object.values(result)) gl.deleteProgram?.(q.program);
 }
}
function makeColorTarget(width,height,half=false){
 gl.activeTexture(gl.TEXTURE0);let texture;
 if(half){texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,height,0,gl.RGBA,gl.HALF_FLOAT,null);for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE)}else texture=colorTexture(width,height,gl.LINEAR);
 const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
 const valid=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);return {width,height,texture,fbo,valid};
}
function destroyImageScene(scene){
 if(!scene)return;
 for(const t of scene.targets||[]){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.fbo)}
 if(scene.color)gl.deleteTexture(scene.color);if(scene.depth)gl.deleteTexture(scene.depth);if(scene.surface)gl.deleteTexture(scene.surface);if(scene.fbo)gl.deleteFramebuffer(scene.fbo);
 if(scene.msaa){gl.deleteRenderbuffer(scene.msaa.color);gl.deleteRenderbuffer(scene.msaa.depth);if(scene.msaa.surface)gl.deleteRenderbuffer(scene.msaa.surface);gl.deleteFramebuffer(scene.msaa.fbo)}
}
function updateImageViewport(){
 const scene=lighting?.scene;if(!scene)return;
 const a=aaProfile(),scale=lighting.image?imageScale():1,factor=lighting.image?a.factor:1;
 scene.baseWidth=Math.max(1,Math.min(scene.baseMaximumWidth,Math.round(canvas.width*scale)));scene.baseHeight=Math.max(1,Math.min(scene.baseMaximumHeight,Math.round(canvas.height*scale)));
 scene.renderWidth=Math.min(scene.width,Math.round(scene.baseWidth*factor));scene.renderHeight=Math.min(scene.height,Math.round(scene.baseHeight*factor));
 updateAmbientViewport(scene);refreshAAControls();refreshAmbientControls();
}
function resizeLighting(){
 if(!lighting?.post)return;
 destroyImageScene(lighting.scene);lighting.scene=null;
 const image=lighting.image,a=image?aaProfile():{factor:1},profile=imageProfile();
 if(image&&state.imageMode==='native'&&state.aaMode==='off'&&state.aoMode==='off'&&nativeDepthBits>=24){
  lighting.scene={direct:true,valid:true,width:canvas.width,height:canvas.height,baseMaximumWidth:canvas.width,baseMaximumHeight:canvas.height,targets:[]};
  image.historyValid=false;updateImageViewport();return;
 }
 let maximum=image?(profile.maximum||profile.scale):1;
 const limit=image?.support?.maximum||gl.getParameter(gl.MAX_TEXTURE_SIZE),factor=a.factor;
 let bw=Math.max(1,Math.round(canvas.width*maximum)),bh=Math.max(1,Math.round(canvas.height*maximum));
 if(bw*factor>limit||bh*factor>limit||bw*bh*factor*factor>16777216){state.aaMode='fxaa_high';return resizeLighting()}
 const width=Math.max(1,Math.round(bw*factor)),height=Math.max(1,Math.round(bh*factor)),fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
 gl.activeTexture(gl.TEXTURE0);const color=colorTexture(width,height,gl.LINEAR);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);
 const depth=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,depth);for(const k of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.NEAREST);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
 gl.texImage2D(gl.TEXTURE_2D,0,WEBGL2?gl.DEPTH_COMPONENT24:gl.DEPTH_COMPONENT,width,height,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,depth,0);
 const surface=lighting.ao?.surfaceEnabled&&state.aoMode!=='off'?colorTexture(width,height,gl.NEAREST):null;
 if(surface){gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.TEXTURE_2D,surface,0);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1])}
 const valid=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
 const scene={width,height,baseMaximumWidth:bw,baseMaximumHeight:bh,fbo,color,depth,surface,valid,targets:[],processed:null,upscaled:null,msaa:null};
 if(!valid&&surface){destroyImageScene(scene);lighting.ao.surfaceEnabled=false;return resizeLighting()}
 const target=(w,h,half=false)=>{const t=makeColorTarget(w,h,half);scene.targets.push(t);return t};
 if(image){
  scene.needsComposition=!!a.fxaa||state.aoMode!=='off';
  scene.finalComposition=!profile.fsr&&!a.ssaa&&!a.smaa&&!a.taa;
  if(scene.needsComposition&&!scene.finalComposition)scene.processed=target(width,height);
  if(a.ssaa)scene.resolved=target(bw,bh);
  if(a.smaa){scene.edges=target(bw,bh);scene.weights=target(bw,bh);scene.smaaOutput=target(bw,bh);try{ensureSmaa(a.smaa)}catch(error){destroyImageScene(scene);image.smaaUnavailable=true;state.aaMode='fxaa_high';console.warn('SMAA indisponível neste dispositivo.',error);return resizeLighting()}}
  if(a.taa){scene.history=[target(bw,bh,true),target(bw,bh,true)];image.historyValid=false;image.historyRead=0}
  if(profile.fsr&&profile.scale<1||state.imageMode==='auto')scene.upscaled=target(canvas.width,canvas.height);
  if(a.samples&&WEBGL2&&image.support.samples.includes(a.samples)){
   const m={fbo:gl.createFramebuffer(),color:gl.createRenderbuffer(),depth:gl.createRenderbuffer(),samples:a.samples};gl.bindFramebuffer(gl.FRAMEBUFFER,m.fbo);
   gl.bindRenderbuffer(gl.RENDERBUFFER,m.color);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,a.samples,gl.RGBA8,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,m.color);
   gl.bindRenderbuffer(gl.RENDERBUFFER,m.depth);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,a.samples,gl.DEPTH_COMPONENT24,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,m.depth);
   if(surface){m.surface=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,m.surface);gl.renderbufferStorageMultisample(gl.RENDERBUFFER,a.samples,gl.RGBA8,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT1,gl.RENDERBUFFER,m.surface);gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1])}
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE)scene.msaa=m;else{gl.deleteRenderbuffer(m.color);gl.deleteRenderbuffer(m.depth);if(m.surface)gl.deleteRenderbuffer(m.surface);gl.deleteFramebuffer(m.fbo);image.support.samples=image.support.samples.filter(n=>n!==a.samples);destroyImageScene(scene);state.aaMode='fxaa_high';return resizeLighting()}
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  if(scene.targets.some(t=>!t.valid)){destroyImageScene(scene);lighting.scene=null;state.aaMode='fxaa_high';image.support.temporal=false;if(!a.ssaa&&!a.smaa&&!a.taa&&!a.samples)lighting.image=null;return resizeLighting()}
 }
 allocateAmbientTargets(scene,bw,bh);lighting.scene=scene;updateImageViewport();refreshAmbientControls();
}
