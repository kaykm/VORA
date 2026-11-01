// Prévia isolada da geometria real pelo fallback CPU; não testa shaders ou FPS.
// Uso: node scripts/inspecionar-modelos.mjs [HTML de referência] [rótulo]
import fs from 'node:fs';
import path from 'node:path';
import {assemble, read, ROOT} from './compilar.mjs';
import {createRuntime} from '../tests/ambiente.mjs';
import {png} from '../tests/png.mjs';

const html = process.argv[2] ? read(process.argv[2]) : assemble().html;
const label = process.argv[3] || 'depois';
if (!/^[a-z0-9-]+$/i.test(label)) throw new Error('Rótulo inválido.');
const game = createRuntime(html);
const directory = path.join(ROOT, 'tests/resultados');
fs.mkdirSync(directory, {recursive: true});
game.run(`
 canvas.width=1000;canvas.height=760;gl.viewport(0,0,1000,760);
 gl.uniform3f(uniforms.hole,100000,100000,0);
 gl.uniform1f(uniforms.depth,0);gl.uniform1f(uniforms.travel,0);
 const previewStation=buildStationMeshes(),previewSigns=makeParkProp('sign');
 const previewGround=mesh([
  ...triangle([-500,0,-500],[500,0,500],[500,0,-500],[.36,.43,.28],[0,1,0]),
  ...triangle([-500,0,-500],[-500,0,500],[500,0,500],[.36,.43,.28],[0,1,0])
 ]);
 function previewModel(eye,target,mode,level=1){
  gl.clearColor(.66,.715,.64,1);gl.clear();
  gl.uniformMatrix4fv(uniforms.viewProjection,false,multiply(perspective(.74,1000/760,2,4000),lookAt(eye,target)));
  gl.uniform3fv(uniforms.eye,eye);gl.uniformMatrix4fv(uniforms.bodyRotation,false,BODY_IDENTITY);
  if(mode==='station'){
   drawMesh(previewGround,0,0,0,1,1,1,[1,1,1],0);
   for(const [key,material]of [['foundation',11],['floor',0],['solid',0]])drawMesh(previewStation[key],0,0,0,1,1,1,[1,1,1],material);
   state.depotLevel=level;drawMesh(buildDepotCrate(),0,0,0,1,1,1,[1,1,1],14);
  }else drawMesh(previewSigns,0,0,0,1,1,1,[1,1,1],14);
 }
`);
const shots = [
 ['vendas-frente',[130,142,230],[0,54,-13],'station',1],
 ['vendas-lateral',[-180,153,150],[0,54,-13],'station',2],
 ['vendas-superior',[145,250,215],[0,54,-13],'station',1],
 ['balanca',[17,85,32],[9,67,-32],'station',1],
 ['placa-frente',[50,100,180],[0,55,0],'sign',1],
 ['placa-verso',[-75,105,-175],[0,55,0],'sign',1]
];
for (const [name,eye,target,mode,level] of shots) {
 game.run(`previewModel(${JSON.stringify(eye)},${JSON.stringify(target)},${JSON.stringify(mode)},${level})`,60000);
 const file=path.join(directory,`modelos-${label}-${name}.png`);
 fs.writeFileSync(file,png(1000,760,game.run('gl.image.data')));
 console.log(path.relative(ROOT,file));
}
