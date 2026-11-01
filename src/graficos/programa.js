function imageShaderSource(type,source){
 if(!WEBGL2||/^\s*#version 300 es/.test(source))return source;
 source=source.replace(/#ifdef GL_OES_standard_derivatives\s*#extension GL_OES_standard_derivatives : enable\s*#endif/g,'');
 source=source.replace(/#ifdef GL_OES_standard_derivatives\s*([\s\S]*?)#else[\s\S]*?#endif/g,'$1');
 source=source.replace(/#ifdef GL_OES_standard_derivatives\s*([\s\S]*?)#endif/g,'$1');
 source=source.replace(/\battribute\b/g,'in').replace(/\bvarying\b/g,type===gl.VERTEX_SHADER?'out':'in').replace(/\btexture2D\b/g,'texture');
 if(type===gl.FRAGMENT_SHADER){
  const surface=source.includes('VORA_SURFACE_OUTPUT');
  source=(surface?'#define VORA_SURFACE_OUTPUT 1\nlayout(location=0) out highp vec4 fragmentColor;\nlayout(location=1) out highp vec4 surfaceColor;\n':'out highp vec4 fragmentColor;\n')+source.replace(/\bgl_FragColor\b/g,'fragmentColor');
 }
 return '#version 300 es\n'+source;
}
function compileShader(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,imageShaderSource(type,source));gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader}

// The loading screen can paint before any driver compilation/link query starts.
// Canonical general scene program/table. Specialized opaque programs own local tables.
let shaderProgram = null, parallelShaderCompilation;
const attrib = {}, uniforms = {};

function shaderCompilationExtension() {
 if (parallelShaderCompilation === undefined) {
  const extension = gl.getExtension?.('KHR_parallel_shader_compile');
  parallelShaderCompilation = Number.isFinite(extension?.COMPLETION_STATUS_KHR) ? extension : null;
 }
 return parallelShaderCompilation;
}

function drainGpuPreparation(iterator) {
 let step;
 do { step = iterator.next(); } while (!step.done);
 return step.value;
}

function* linkProgramIncremental(vertex, fragment, label = 'Preparando imagem', cooperative = true, attributes = null) {
 const program = gl.createProgram(), shaders = [];
 let ready = false;
 try {
  for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
   const shader = gl.createShader(type);
   shaders.push(shader);
   gl.shaderSource(shader, imageShaderSource(type, source));
   gl.compileShader(shader);
   gl.attachShader(program, shader);
   yield {label};
  }
  if(attributes)for(const [name,location]of Object.entries(attributes))gl.bindAttribLocation(program,location,name);
  gl.linkProgram(program);
  gl.flush?.();
  yield {label};

  // LINK_STATUS/COMPILE_STATUS can block until the driver's job is complete.
  // KHR exposes a nonblocking completion query; the loader resumes next frame.
  const extension = cooperative ? shaderCompilationExtension() : null;
  if (extension) {
   const started = performance.now();
   while (!gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR)) {
    if (performance.now() - started > 30000) throw Error('A GPU demorou demais para preparar a imagem. Reabra o arquivo.');
    yield {label, waiting: true};
   }
  }
  for (const shader of shaders) {
   if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  ready = true;
  return program;
 } finally {
  for (const shader of shaders) {
   gl.detachShader?.(program, shader);
   gl.deleteShader?.(shader);
  }
  if (!ready) gl.deleteProgram?.(program);
 }
}

function* initSceneProgramIncremental(cooperative = true) {
 if (shaderProgram) return shaderProgram;
 gl.getExtension?.('OES_standard_derivatives');
 const program = yield* linkProgramIncremental(vertexSource, fragmentSource, 'Preparando o cenário', cooperative);
 shaderProgram = program;
 gl.useProgram(program);
 attrib.p = gl.getAttribLocation(program, 'a_position');
 attrib.n = gl.getAttribLocation(program, 'a_normal');
 attrib.c = gl.getAttribLocation(program, 'a_color');
 for (const name of ['instanced','viewProjection','origin','scale','rotation','tint','hole','apertureSin','apertureCos','material','depth','travel','eye','pixelScale','bodyRotation','pivot','lightViewProjection','renderPass','shadowEnabled','shadowQuality','shadowSoftness','shadowDistance','shadowCenter','shadowDepthRange','shadowTexel','shadowWorldTexel','shadowMap','staticShadowMap','staticShadowTexel','staticShadowWorldTexel','liveShadowWindow','shadowBoundsMap','shadowBoundsEnabled','turfMap','reactive']) {
  uniforms[name] = gl.getUniformLocation(program, 'u_' + name);
 }
 gl.uniformMatrix4fv(uniforms.bodyRotation, false, BODY_IDENTITY);
 initObjectInstancing();
 yield {label: 'Cenário preparado'};
 return program;
}

function initSceneProgram() {
 return drainGpuPreparation(initSceneProgramIncremental(false));
}

