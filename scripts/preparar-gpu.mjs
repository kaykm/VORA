// Exporta as strings efetivamente usadas pelo jogo para o teste GLES offscreen.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {ROOT, read, assemble} from './compilar.mjs';
import {createRuntime} from '../tests/ambiente.mjs';

function shaderLiteral(source, marker) {
 const start = source.indexOf(marker) + marker.length;
 if (start < marker.length) throw new Error('Shader não encontrado: ' + marker);
 const quote = source[start];
 if (!['"', "'", '`'].includes(quote)) throw new Error('Literal inválido');
 let end = start + 1;
 for (; end < source.length; end++) {
  if (source[end] === '\\') { end++; continue; }
  if (source[end] === quote) break;
 }
 return source.slice(start, end + 1);
}

const conversion = read('src/graficos/programa.js').split('function compileShader')[0];
function webgl2(source, type) {
 return vm.runInNewContext(conversion + '\nimageShaderSource(type, source)', {
  WEBGL2: true, gl: {VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632}, type, source
 });
}

function snapshot(html) {
 const runtime = createRuntime(html);
 const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const sceneVertex = runtime.run('vertexSource');
 const screenVertex = runtime.run(shaderLiteral(source, 'const vs='));
 const post = runtime.run(shaderLiteral(source, 'const fs='));
 const programs = {scene: [sceneVertex, runtime.run('fragmentSource')], composition: [screenVertex, post]};
 if(runtime.run('typeof opaqueFragmentSource')==='function'){
  programs.opaque=[sceneVertex,runtime.run('opaqueFragmentSource()')];
  programs.depthOnly=[sceneVertex,runtime.run('DEPTH_ONLY_FRAGMENT')];
 }
 if(runtime.run('typeof SHADOW_REDUCTION_SOURCE')==='string')programs.shadowReduction=[screenVertex,runtime.run('SHADOW_REDUCTION_SOURCE')];
 for (const [name, key] of Object.entries({horizon:'AO_HORIZON_SOURCE', denoise:'AO_DENOISE_SOURCE', easu:'FSR_EASU_SOURCE', rcas:'FSR_RCAS_SOURCE', present:'AA_PRESENT_SOURCE', downsample:'AA_DOWNSAMPLE_SOURCE', temporal:'AA_TEMPORAL_SOURCE'})) {
  programs[name] = [screenVertex, runtime.run(key)];
 }
 // SMAA has its own 300 es source generator, including its vertex entry points.
 for (const preset of ['HIGH','ULTRA']) for (const pass of ['edges', 'weights', 'blend']) {
  try {
   programs['smaa-' + pass + '-' + preset] = [
    runtime.run(`buildSmaaShader(${JSON.stringify(pass)},true,${JSON.stringify(preset)})`),
    runtime.run(`buildSmaaShader(${JSON.stringify(pass)},false,${JSON.stringify(preset)})`)
   ];
  } catch (error) { throw new Error('Preparação de SMAA: ' + error.message); }
 }
 return Object.fromEntries(Object.entries(programs).map(([name, pair]) => [name, {
  es100: name.startsWith('smaa-') ? null : pair,
  es300: pair.map((source, i) => webgl2(source, i ? 35632 : 35633))
 }]));
}

const before = snapshot(read(process.argv[2]||'backup/VORA-original-17.html'));
const after = snapshot(assemble().html);
const directory = path.join(ROOT, 'tests/resultados');
fs.mkdirSync(directory, {recursive:true});
fs.writeFileSync(path.join(directory, 'gpu-fontes.json'), JSON.stringify({before, after}));
console.log('Shaders preparados para testes offscreen em tests/resultados/gpu-fontes.json.');
