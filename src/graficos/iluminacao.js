function initLighting() {
 return drainGpuPreparation(initLightingIncremental(false));
}

function* initLightingIncremental(cooperative = true) {
 if (!shaderProgram) yield* initSceneProgramIncremental(cooperative);
 $("aoMode").disabled = true;
 if (gl.isSoftware) {
  for (const id of ['imageMode','aaMode','outputMode','aoMode']) $(id).disabled = true;
  $('imageInfo').textContent = 'Modo de compatibilidade do navegador.';
  return;
 }

 if (!Object.prototype.hasOwnProperty.call(SHADOW_PROFILES, state.shadowQuality)) state.shadowQuality = 'high';
 const sizes = shadowTargetSizes();
 yield {label: 'Preparando o gramado'};
 const turf = yield* makeTurfTextureIncremental();
 yield {label: 'Preparando as sombras do parque'};
 const fixed = makeShadowTarget(sizes.fixed);
 yield {label: 'Preparando as sombras dos objetos'};
 const moving = makeShadowTarget(sizes.moving);
 lighting = {
  size: moving.size, shadow: moving.texture, fixed, moving, valid: fixed.valid && moving.valid,
  key: '', dynamicKey: '', extent: 0, staticVersion: 0, scene: null, turf,
  depthExtension: WEBGL2 ? true : gl.getExtension('WEBGL_depth_texture')
 };
 gl.useProgram(shaderProgram);
 gl.uniform1i(uniforms.shadowMap, 3);
 gl.uniform1i(uniforms.staticShadowMap, 2);
 gl.uniform1i(uniforms.turfMap, 4);
 gl.uniform1f(uniforms.renderPass, 0);
 configureShadowUniforms();
 gl.uniform1f(uniforms.shadowTexel, 1 / moving.size);
 gl.uniform1f(uniforms.staticShadowTexel, 1 / fixed.size);
 gl.uniformMatrix4fv(uniforms.lightViewProjection, false, BODY_IDENTITY);
 if (!lighting.depthExtension) {
  for (const id of ['imageMode','aaMode','outputMode']) $(id).disabled = true;
  $('imageInfo').textContent = 'Modo de compatibilidade do navegador.';
  return;
 }

 const vs=/* @text src/graficos/shaders/tela.vert */;
 const fs=/* @template src/graficos/shaders/composicao.frag */;
 let post;
 try {
  post = yield* screenProgramIncremental(vs, fs, 'Preparando a imagem', cooperative);
 } catch (error) {
  lighting.depthExtension = null;
  for (const id of ['imageMode','aaMode','outputMode']) $(id).disabled = true;
  $('imageInfo').textContent = 'Modo de compatibilidade do navegador.';
  console.warn('Composição de imagem indisponível.', error);
  gl.useProgram(shaderProgram);
  return;
 }
 const quad = gl.createBuffer();
 gl.bindBuffer(gl.ARRAY_BUFFER, quad);
 gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
 post.quad = quad;
 // The composition's depth sampler is named sceneDepth; temporal AA uses depth.
 post.depth = post.sceneDepth;
 lighting.post = post;
 yield* initShadowBoundsIncremental(vs,cooperative);
 yield {label: 'Preparando os modos de imagem'};
 yield* initImagePipelineIncremental(vs, cooperative);
 yield* initAmbientOcclusionIncremental(vs, cooperative);
 gl.useProgram(shaderProgram);
 yield {label: 'Iluminação preparada'};
}

function screenProgramLocations(program) {
 const q = {program, p: gl.getAttribLocation(program, 'a_position')};
 for (const name of ['color','inputViewport','resourceSize','sharpness','outputSize','metrics','activeScale','edges','area','search','weights','history','depth','reactive','inverseVP','previousVP','historyValid','jitter','previousJitter','sceneDepth','surface','resolution','projection','projectionJitter','aoViewport','aoResource','viewRotation','hasSurface','aoRadius','aoStrength','aoSlices','aoSteps','aoEnabled','aaKind']) {
  q[name] = gl.getUniformLocation(program, 'u_' + name);
 }
 return q;
}

function* screenProgramIncremental(vertex, fragment, label = 'Preparando imagem', cooperative = true) {
 const program = yield* linkProgramIncremental(vertex, fragment, label, cooperative);
 return screenProgramLocations(program);
}

function screenProgram(vertex, fragment) {
 return drainGpuPreparation(screenProgramIncremental(vertex, fragment, 'Preparando imagem', false));
}
