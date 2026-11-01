// A/B against the pre-optimization build, never against a different world/save.
// Pure CPU preparation and API submission counts: this is not browser FPS.
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {assemble,read} from './compilar.mjs';
import {createRuntime} from '../tests/ambiente.mjs';
const before=process.argv[2];
if(!before)throw Error('Uso: node scripts/medir-performance.mjs tests/resultados/VORA-performance-antes.html');
const inputs={before:read(before),after:assemble().html},samples={before:[],after:[]};
const timed=fn=>{const start=performance.now();fn();return performance.now()-start;};
for(let round=0;round<3;round++)for(const version of round%2?['after','before']:['before','after']){
 const g=createRuntime(inputs[version],null,{width:1000,height:760});
 const result={startupMs:g.startupMs};
 // Prevent incidental collection and keep the same movement, terrain and camera.
 g.run('collect=()=>{};gl.drawArrays=()=>{};gl.present=()=>{};');
 g.run('for(let i=0;i<60;i++)update(1/60)');
 result.simulationMs=timed(()=>g.run('for(let i=0;i<600;i++)update(1/60)'))/600;
 g.run('keys.d=true');
 result.movingPreparationMs=timed(()=>g.run('for(let i=0;i<90;i++){update(1/60);render()}'))/90;
 result.pickupCandidates=typeof g.run('typeof pickupIndex')==='string'&&g.run('typeof pickupIndex')!=='undefined'
  ?g.json('({queries:pickupIndex.queries,visited:pickupIndex.visited,total:objects.length})'):null;
 // Simulate a WebGL-capable API to count actual production culling/batching.
 // This replaces GPU rasterization only; both versions see identical geometry.
 g.run(`
  gl.isSoftware=false;W=1000;H=760;canvas.width=W;canvas.height=H;
  gl.clear=gl.present=()=>{};lighting=null;
  gl.DYNAMIC_DRAW=35048;gl.ELEMENT_ARRAY_BUFFER=34963;
  gl.bufferSubData=(target,offset,data)=>{if(typeof gl.bound.data==='number')gl.bound.data=new Float32Array(gl.bound.data/4);gl.bound.data.set(data,offset/4);};
  globalThis.submissionCalls=0;globalThis.submissionTriangles=0;
  gl.drawArrays=(mode,first,count)=>{submissionCalls++;submissionTriangles+=count/3;};
  gl.drawElements=(mode,count)=>{submissionCalls++;submissionTriangles+=count/3;};
  gl.drawArraysInstanced=(mode,first,count,n)=>{submissionCalls++;submissionTriangles+=count*n/3;};
  gl.drawElementsInstanced=(mode,count,type,offset,n)=>{submissionCalls++;submissionTriangles+=count*n/3;};
  gl.vertexAttribDivisor=gl.disableVertexAttribArray=()=>{};
  gl.getAttribLocation=(program,name)=>({a_position:0,a_normal:1,a_color:2,a_instanceOrigin:3,a_instanceScale:4,a_instanceRotation:5}[name]??0);
  if(typeof initObjectInstancing==='function')initObjectInstancing();
  warmModelMeshes();
  if(typeof prepareObjectInstances==='function')for(const m of modelMeshes.values())prepareObjectInstances(m);
  state.s=6;unlockWorldResourceAreas();
  for(const o of objects){o.alive=true;o.anim=0;o.spawnTime=1;if(o.worldProp){o.worldProp.consumed=false;o.worldProp.resourceLocked=false;}}
  keys={};camera.x=100;camera.y=70;cameraPan.x=cameraPan.y=cameraPan.z=0;viewYaw=.5;viewElevation=1.02;
 `);
 result.scenes={};
 for(const [name,source]of [['near','smoothZoom=336'],['wide','smoothZoom=1100'],['rotated','smoothZoom=1100;viewYaw=2.2']]){
  g.run(source+';for(let i=0;i<4;i++)render();submissionCalls=submissionTriangles=0');
  const ms=timed(()=>g.run('for(let i=0;i<45;i++)render()'))/45;
  result.scenes[name]={cpuSubmissionMs:ms,...g.json('({drawCalls:submissionCalls/45,triangles:submissionTriangles/45})')};
 }
 samples[version].push(result);console.log(`${round+1}/3 ${version}: simulação ${result.simulationMs.toFixed(3)} ms, movimento ${result.movingPreparationMs.toFixed(3)} ms.`);
}
const median=a=>a.toSorted((x,y)=>x-y)[Math.floor(a.length/2)];
const summary=Object.fromEntries(Object.entries(samples).map(([version,list])=>[version,{
 startupMs:median(list.map(v=>v.startupMs)),simulationMs:median(list.map(v=>v.simulationMs)),
 movingPreparationMs:median(list.map(v=>v.movingPreparationMs)),pickupCandidates:list[0].pickupCandidates,
 scenes:Object.fromEntries(Object.keys(list[0].scenes).map(name=>[name,{
  cpuSubmissionMs:median(list.map(v=>v.scenes[name].cpuSubmissionMs)),
  drawCalls:list[0].scenes[name].drawCalls,triangles:list[0].scenes[name].triangles
 }]))
}]));
const report={environment:`Node ${process.version}, DOM simulado; sem rasterização`,
 method:'3 amostras alternadas, medianas, seed 12345; mesmo mundo, estados, câmera, 1000×760, detalhes e configurações em cada par. A coleta é suspensa somente no replay para manter os objetos.',
 summary,samples,browserFPS:null,browserMemory:null,browserLoading:null,
 limitations:'Tempos são CPU no ambiente de teste, não FPS ou tempos de GPU/navegador. Inicialização é drenada sincronamente pelo harness. Contagem de draw calls usa a lógica real com uma API de GPU simulada.'};
fs.writeFileSync('tests/resultados/performance-comparacao.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
