import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';

const html=read('dist/VORA.html');
const saved={
 coins:987,r:2,d:3,s:1,v:2,cargo:[0,1],collected:17,sold:2,
 reward1:true,reward2:true,worldScaleVersion:2,nativeDisplayDefaultsV1:true,
 imageMode:'native',outputMode:'native',aaMode:'off',aoMode:'off',
 cargoPoses:[
  {t:0,x:0,z:0,y:-8,q:[0,0,0,1],variant:0},
  {t:1,x:2,z:-1,y:-12,q:[0,0,0,1],variant:1}
 ]
};

test('boot avança por trabalho real, só conclui em 100% e não salva estado parcial',()=>{
 const game=createRuntime(html,saved,{boot:'manual'});
 assert.equal(game.incrementalBoot,true);
 assert.equal(game.run('gameLoading.ready'),false);
 assert.equal(game.run('gameLoading.active'),true);
 assert.equal(game.doc.getElementById('loadingScreen').hidden,false);
 assert.equal(game.doc.getElementById('loadingProgress').getAttribute('role'),'progressbar');
 const untouched=game.store.get('vora-v1');
 assert.equal(game.storageWrites.length,0,'ler o save não deve regravá-lo durante o boot');

 let previous=0,steps=0;
 for(;;){
  const result=game.nextBoot();
  const progress=game.run('gameLoading.progress');
  assert.ok(Number.isFinite(progress)&&progress>=previous&&progress<100,'progresso deve ser monotônico e reservado abaixo de 100');
  assert.equal(game.run('gameLoading.ready'),false);
  assert.equal(game.doc.getElementById('loadingScreen').hidden,false);
  assert.equal(game.storageWrites.length,0,'uma etapa não pode publicar um snapshot incompleto');
  previous=progress;
  if(result.done)break;
  if(++steps===3){
   game.run('persist()');
   game.event('pagehide');
   assert.equal(game.store.get('vora-v1'),untouched,'sair no meio preserva o último save íntegro');
  }
  assert.ok(steps<1000000,'carregamento deve terminar');
 }
 assert.ok(steps>5,'o trabalho foi separado em etapas reais');
 game.event('keydown',{code:'KeyD'});game.event('keydown',{code:'KeyE'});
 assert.equal(game.run('!!keys.d'),false,'o overlay deve bloquear movimento antes de liberar a partida');
 assert.equal(game.run('returning'),false,'atalhos não devem iniciar ações por trás do carregamento');
 game.completeBoot();
 assert.equal(game.run('gameLoading.ready'),true);
 assert.equal(game.run('gameLoading.active'),false);
 assert.equal(game.run('gameLoading.progress'),100);
 assert.equal(game.doc.getElementById('loadingScreen').hidden,true);
 assert.equal(game.doc.getElementById('loadingProgress').getAttribute('aria-valuenow'),'100');
 assert.match(game.doc.getElementById('loadingPercent').textContent,/100/);
 const restored=JSON.parse(game.store.get('vora-v1'));
 assert.equal(restored.coins,saved.coins);
 assert.deepEqual(restored.cargo,saved.cargo);
 assert.deepEqual(restored.cargoPoses,saved.cargoPoses);
 assert.ok(game.storageWrites.length>0);

 const directory=path.join(ROOT,'tests/resultados');fs.mkdirSync(directory,{recursive:true});
 const durations=game.bootSteps.map(step=>step.ms).toSorted((a,b)=>a-b);
 fs.writeFileSync(path.join(directory,'carregamento-cpu.json'),JSON.stringify({
  environment:'Node/DOM simulado; mesmas etapas da produção consumidas sincronamente para teste',
  yieldedSteps:steps,maxStepMs:durations.at(-1),medianStepMs:durations[Math.floor(durations.length/2)],
  browserFrameTimes:null,notes:'Tempo real de execução de cada next(); não mede pintura da tela ou FPS no navegador.'
 },null,2)+'\n');
});

test('driver real apresenta erro e preserva o save se a preparação falhar',async()=>{
 const game=createRuntime(html,saved,{boot:'manual',clockStep:1});
 const untouched=game.store.get('vora-v1');
 const pending=game.run(`initSceneProgramIncremental=function*(){throw new Error('Falha de preparação injetada pelo teste')};startVora()`);
 pending?.catch?.(()=>{});
 for(let count=0;count<1000;count++){
  await Promise.resolve();
  if(game.run('!!gameLoading.error'))break;
  const advanced=game.runAnimationFrame()||game.runTimer();
  assert.ok(advanced,'o driver deve agendar o próximo passo ou registrar a falha');
 }
 assert.equal(game.run('gameLoading.ready'),false);
 assert.ok(game.run('!!gameLoading.error'));
 assert.ok(game.run('gameLoading.progress')<100);
 assert.equal(game.doc.getElementById('loadingScreen').hidden,false);
 assert.match(game.doc.getElementById('loadingError').textContent,/Falha de preparação/);
 assert.equal(game.doc.getElementById('loadingRetry').hidden,false);
 game.run('persist()');game.event('pagehide');
 assert.equal(game.store.get('vora-v1'),untouched);
 assert.equal(game.storageWrites.length,0);
 assert.equal(game.run('frameCount'),0,'a partida não deve iniciar depois de uma falha');
});

test('render de vegetação e sombras solicita recursos sem bake síncrono ou tarefas duplicadas',()=>{
 const game=createRuntime(html);
 game.run(`
  let synchronousBakes=0;
  bakePlantTile=()=>{synchronousBakes++;throw Error('Bake síncrono dentro do render')};
  buildGroundDetails();
  for(const tile of groundDetailsBatches){tile.meshes=[null,null];tile.shadowMesh=null}
  vegetationPlanes=null;currentEye=[100,200,70];
  gl.isSoftware=false;
  drawGroundDetails();
 `);
 assert.equal(game.run('synchronousBakes'),0);
 const first=game.run('resourceWork.jobs.size');
 assert.ok(first>0,'recursos ainda ausentes devem ser pedidos à fila');
 game.run('drawGroundDetails();drawGroundDetails()');
 assert.equal(game.run('resourceWork.jobs.size'),first,'pedidos repetidos devem compartilhar a mesma tarefa');
 game.run(`lighting={center:[player.x,player.y],extent:500};drawVegetationShadows();drawVegetationShadows()`);
 assert.equal(game.run('synchronousBakes'),0);
});

test('fila respeita orçamento, compartilha pedidos e cancela builders antigos',()=>{
 const game=createRuntime(html,null,{boot:'manual',clockStep:.25});
 game.run(`
  let queueSteps=0,queueFinalized=0,secondFactoryCalls=0;
  function* longPreparation(){try{for(let i=0;i<100;i++){queueSteps++;yield}}finally{queueFinalized++}}
  queueResourceWork('first',longPreparation,{vegetation:true,priority:1});
  queueResourceWork('first',longPreparation,{vegetation:true,priority:0});
  queueResourceWork('second',()=>{secondFactoryCalls++;return longPreparation()},{priority:2});
  processResourceWork(3);
 `);
 assert.equal(game.run('resourceWork.jobs.size'),2);
 assert.ok(game.run('queueSteps')>0&&game.run('queueSteps')<100);
 assert.equal(game.run('secondFactoryCalls'),0,'só um builder pode manter temporários ao mesmo tempo');
 game.run('resetVegetationResourceCache()');
 assert.equal(game.run('queueFinalized'),1,'cancelar deve executar cleanup do iterator');
 assert.equal(game.run('resourceWork.jobs.has("first")'),false);
 assert.equal(game.run('resourceWork.jobs.has("second")'),true);
});

test('cache limita bytes, reutiliza recursos e preserva a malha visível',()=>{
 const game=createRuntime(html,null,{boot:'manual'});
 game.run(`
  vegetationResources.limitBytes=100;
  let released=0;gl.deleteBuffer=()=>released++;
  const cacheA={meshes:[null,null],near:false,lastVisibleFrame:-999};
  const cacheB={meshes:[null,null],near:false,lastVisibleFrame:-999};
  const cacheC={meshes:[null,null],near:false,lastVisibleFrame:-999};
  const smallMesh=()=>({buffer:{},count:3,byteLength:80});
  installVegetationResource(cacheA,0,smallMesh(),vegetationResourceKey(cacheA,0));
  installVegetationResource(cacheB,0,smallMesh(),vegetationResourceKey(cacheB,0));
 `);
 assert.equal(game.run('vegetationResources.bytes'),80);
 assert.equal(game.run('cacheA.meshes[0]'),null);
 assert.equal(game.run('released'),1);
 const jobs=game.run('resourceWork.jobs.size');
 game.run('requestVegetationResources(cacheB,0)');
 assert.equal(game.run('resourceWork.jobs.size'),jobs,'retornar à região pronta não cria trabalho');
 game.run('cacheB.lastVisibleFrame=frameCount;globalThis.cacheAccepted=installVegetationResource(cacheC,0,smallMesh(),vegetationResourceKey(cacheC,0))');
 assert.equal(game.run('cacheAccepted'),false);
 assert.equal(game.run('vegetationResources.bytes'),80);
 assert.equal(game.run('!!cacheB.meshes[0]'),true,'não retirar a última representação visível');
});

test('compilação adiada aguarda KHR em vez de bloquear o início do script',()=>{
 const game=createRuntime(html,null,{boot:'manual'});
 assert.equal(game.run('shaderProgram'),null);
 game.run(`
  let shaderPolls=0,waitingSteps=0;
  gl.getExtension=name=>name==='KHR_parallel_shader_compile'?{COMPLETION_STATUS_KHR:37297}:null;
  gl.getProgramParameter=(program,name)=>name===37297?++shaderPolls>2:true;
  const compileIterator=initSceneProgramIncremental();
  let compileStep;do{compileStep=compileIterator.next();if(compileStep.value?.waiting)waitingSteps++}while(!compileStep.done);
 `);
 assert.equal(game.run('waitingSteps'),2);
 assert.ok(game.run('!!shaderProgram'));
 assert.equal(game.run('gameLoading.ready'),false);
});
