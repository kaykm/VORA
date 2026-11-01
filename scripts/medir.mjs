// Medições reproduzíveis do trabalho de CPU. Não estima FPS do navegador/GPU.
import fs from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {ROOT, read, assemble} from './compilar.mjs';
import {createRuntime} from '../tests/ambiente.mjs';

const inputs = {before:read('backup/VORA-original-17.html'), after:assemble().html};
const samples = {before:[], after:[]};
const stages = ['generate','buildParkLayout','populateParkTrees','buildGroundDetails','bakePlantTile'];
const timed = callback => {const start=performance.now();callback();return performance.now()-start};

for (let round=0;round<3;round++) {
 for (const version of round%2 ? ['after','before'] : ['before','after']) {
  const game=createRuntime(inputs[version],null,{instrument:stages});
  const sample={startupMs:game.startupMs};
  // Current boot already prepares the index and resident tiles. Rebuilding it
  // here would discard readiness and make the first-frame comparison invalid.
  sample.tileIndexMs=game.incrementalBoot?null:timed(()=>game.run('buildGroundDetails()'));
  if(game.incrementalBoot){
   const durations=game.bootSteps.map(s=>s.ms).toSorted((a,b)=>a-b);
   sample.bootSteps=durations.length;
   sample.maxBootStepMs=durations.at(-1);
  }
  sample.preparedPlantTemplates=game.run('plantMeshes.size');
  // Count the original render submissions without spending time rasterizing in JS.
  game.run(`let measuredCalls=0,measuredTriangles=0;
   gl.drawArrays=(mode,start,count)=>{measuredCalls++;measuredTriangles+=count/3};`);
  sample.firstFramePreparationMs=timed(()=>game.run('render()'));
  sample.initialSubmission=game.json('({calls:measuredCalls,triangles:measuredTriangles})');
  game.run('measuredCalls=0;measuredTriangles=0');
  sample.warmFramesPreparationMs=timed(()=>game.run('for(let i=0;i<30;i++)render()'))/30;
  sample.world=game.json('({props:worldProps.length,plants:environmentDetails.length,slots:objects.length})');
  sample.stages=game.json('__profileRecords');
  samples[version].push(sample);
  console.log(`Amostra ${round+1}/3 ${version}: inicialização ${sample.startupMs.toFixed(1)} ms; índice de tiles ${sample.tileIndexMs===null?'incluído no carregamento':sample.tileIndexMs.toFixed(1)+' ms'}.`);
 }
}

const median=values=>values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)];
const summary=Object.fromEntries(Object.entries(samples).map(([version,list])=>[version,{
 startupMs:median(list.map(s=>s.startupMs)),
 tileIndexMs:list[0].tileIndexMs===null?null:median(list.map(s=>s.tileIndexMs)),
 firstFramePreparationMs:median(list.map(s=>s.firstFramePreparationMs)),
 warmFramePreparationMs:median(list.map(s=>s.warmFramesPreparationMs)),
 preparedPlantTemplates:list[0].preparedPlantTemplates,
 initialSubmission:list[0].initialSubmission,world:list[0].world
}]));
const report={environment:'Node.js '+process.version+' / DOM simulado / SoftwareGL sem rasterização',
 method:'3 amostras por versão em ordem alternada; mediana; cena inicial 320×240, seed 12345, mesmo estado. Tempos incluem o ambiente de teste.',
 summary,samples,browserFps:null,browserLoadMs:null,browserMemory:null,
 limits:'Preparação de CPU e inicialização em Node; não mede FPS, tempo de GPU, carregamento ou memória do navegador. O boot atual inclui geometria antes construída no primeiro quadro: compare também a soma inicialização + primeira preparação. A imagem CPU completa e os shaders GPU são verificados em testes separados.'};
fs.mkdirSync(path.join(ROOT,'tests/resultados'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'tests/resultados/desempenho.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
