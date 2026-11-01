// Production input for native GLES validation. No runtime resource loading.
import fs from 'node:fs';
import vm from 'node:vm';
import {read,assemble} from './compilar.mjs';
import {createRuntime} from '../tests/ambiente.mjs';
const g=createRuntime(assemble().html);
const reference=process.argv[2];
if(!reference)throw Error('Uso: node scripts/preparar-sombras-limites.mjs <HTML anterior>');
const old=createRuntime(read(reference));
const conversion=read('src/graficos/programa.js').split('function compileShader')[0];
const convert=(source,type)=>vm.runInNewContext(conversion+'\nimageShaderSource(type,source)',{WEBGL2:true,gl:{VERTEX_SHADER:35633,FRAGMENT_SHADER:35632},source,type});
const fragment=g.run('opaqueFragmentSource()');
const isolate=process.argv[3]==='--isolate-bounds';
const vertex=convert(g.run('vertexSource'),35633);
let probe=g.run('fragmentSource').split('void main(){')[0]
 .replace('uniform float u_shadowBoundsEnabled;','float u_shadowBoundsEnabled=0.;');
probe+=`uniform vec2 u_testViewport;uniform float u_testCase;uniform float u_testPlane;
void main(){
 vec2 position=gl_FragCoord.xy/u_testViewport;
 vec2 xy=fract(position+vec2(u_testCase*.037,u_testCase*.019))*(1.04)-.02;
 float z=fract(position.x*3.17+position.y*7.31+u_testCase*.113)*.7+.15;
 vec3 q=vec3(xy,z);
 vec2 gradient=vec2(sin(position.y*31.),cos(position.x*37.))*u_testPlane;
 float cell=.5+fract(position.x*5.3+position.y*1.7)*5.;
 float facing=fract(position.x*3.7),foliage=step(.5,position.y);
 u_shadowBoundsEnabled=0.;float original=shadowFilter(u_staticShadowMap,q,u_staticShadowTexel,cell,gradient,1.,facing,foliage);
 u_shadowBoundsEnabled=1.;float bounded=shadowFilter(u_staticShadowMap,q,u_staticShadowTexel,cell,gradient,1.,facing,foliage);
 gl_FragColor=vec4(step(.000002,abs(original-bounded)),original,bounded,1.);
}`;
const probeVertex=`attribute vec2 a_position;varying vec3 v_world;varying vec3 v_normal;varying vec3 v_color;varying vec3 v_local;varying vec4 v_shadow;
void main(){gl_Position=vec4(a_position,0.,1.);v_world=vec3(a_position.x*120.,0.,a_position.y*120.);v_local=v_world;v_normal=vec3(0.,1.,0.);v_color=vec3(1.);v_shadow=vec4(0.);}`;
const beforeFragment=isolate?fragment.replace('uniform float u_shadowBoundsEnabled;','const float u_shadowBoundsEnabled=0.;'):old.run('opaqueFragmentSource()');
const data={beforeReference:isolate?'Current production materials, conservative shortcut disabled':reference,before:[isolate?vertex:convert(old.run('vertexSource'),35633),convert(beforeFragment,35632)],after:[vertex,convert(fragment,35632)],
 depth:[vertex,convert(g.run('DEPTH_ONLY_FRAGMENT'),35632)],
 reduce:[convert(read('src/graficos/shaders/tela.vert'),35633),convert(g.run('SHADOW_REDUCTION_SOURCE'),35632)],
 probe:[convert(probeVertex,35633),convert(probe,35632)]};
fs.writeFileSync('tests/resultados/sombras-limites-fontes.json',JSON.stringify(data));
console.log('Shaders de limites preparados para ensaio nativo.');
