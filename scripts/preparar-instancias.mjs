// Export production shaders and meshes for the optional native GLES regression.
import fs from 'node:fs';
import vm from 'node:vm';
import {assemble,read} from './compilar.mjs';
import {createRuntime} from '../tests/ambiente.mjs';
const g=createRuntime(assemble().html);
const conversion=read('src/graficos/programa.js').split('function compileShader')[0];
const convert=(source,type)=>vm.runInNewContext(conversion+'\nimageShaderSource(type,source)',{WEBGL2:true,gl:{VERTEX_SHADER:35633,FRAGMENT_SHADER:35632},source,type});
const meshes={};
for(const [name,code]of [['lata','getModelMesh(0,0,1)'],['banco',"getModelMesh('bench',0,1)"],['arvore',"getModelMesh('tree',0,1)"]]){
 const data=g.run(code+'.vertices');meshes[name]=Buffer.from(data.buffer,data.byteOffset,data.byteLength).toString('base64');
}
const source={opaque:[convert(g.run('vertexSource'),35633),convert(g.run('opaqueFragmentSource()'),35632)],depth:[convert(g.run('vertexSource'),35633),convert(g.run('DEPTH_ONLY_FRAGMENT'),35632)],program:[convert(g.run('vertexSource'),35633),convert(g.run('fragmentSource'),35632)],meshes};
fs.writeFileSync('tests/resultados/instancias-gpu-fontes.json',JSON.stringify(source));console.log('Malhas e shaders de produção exportados.');
