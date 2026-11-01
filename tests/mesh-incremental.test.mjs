import test from 'node:test';
import assert from 'node:assert/strict';
import {read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';

// A frozen pre-loading program supplies the original synchronous implementations.
// Inject only the new builders so these tests remain independent of boot timing.
function environment() {
 const game=createRuntime(read('backup/VORA-original-17.html'));
 const meshes=read('src/graficos/malhas.js'),plants=read('src/mundo/vegetacao.js');
 game.run(meshes.slice(meshes.indexOf('function* meshVerticesIncremental'),meshes.indexOf('function partitionStaticMesh(')));
 game.run(meshes.slice(meshes.indexOf('function* partitionStaticMeshIncremental'),meshes.indexOf('function makeWalkTiles(')));
 game.run(plants.slice(plants.indexOf('function* bakePlantTileIncremental'),plants.indexOf('function buildGroundDetails(')));
 game.run(`
  const incrementalBuffers=[],incrementalBindings=new Map();
  gl.isSoftware=false;gl.drawElements=()=>{};
  gl.ELEMENT_ARRAY_BUFFER=34963;gl.DYNAMIC_DRAW=35048;
  gl.createBuffer=()=>{const buffer={bytes:new Uint8Array(0),deleted:false};incrementalBuffers.push(buffer);return buffer};
  gl.bindBuffer=(target,buffer)=>incrementalBindings.set(target,buffer);
  gl.bufferData=(target,data)=>{const buffer=incrementalBindings.get(target);buffer.bytes=typeof data==='number'?new Uint8Array(data):new Uint8Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength))};
  gl.bufferSubData=(target,offset,data)=>incrementalBindings.get(target).bytes.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset);
  gl.deleteBuffer=buffer=>{buffer.deleted=true};
  function drainBuilder(iterator){let item,steps=0;while(!(item=iterator.next()).done)steps++;return {mesh:item.value,steps}}
  function meshDescription(mesh){return {count:mesh.count,vertexCount:mesh.vertexCount,sphere:mesh.sphere,
   vertices:Array.from(mesh.buffer.bytes),indices:mesh.indexBuffer?Array.from(mesh.indexBuffer.bytes):null,
   parts:mesh.parts?.map(p=>({first:p.first,count:p.count,sphere:p.sphere}))}}
 `);
 return game;
}

test('builders de malhas preservam bytes, índices e ranges ao serem retomados',()=>{
 const g=environment();
 g.run(`const testTriangles=[];for(let i=0;i<640;i++){
  const x=i%20,z=Math.floor(i/20);for(const p of [[x,0,z],[x+1,0,z],[x,0,z+1]])testTriangles.push(...p,0,1,0,.2,.4,.3)
 }`);
 for(const expression of ['testTriangles','new Float32Array(testTriangles)','[]']){
  g.run(`{const currentData=${expression};globalThis.expectedMesh=mesh(currentData);globalThis.builtMesh=drainBuilder(meshIncremental(currentData))}`);
  assert.deepEqual(g.json('meshDescription(builtMesh.mesh)'),g.json('meshDescription(expectedMesh)'));
  assert.equal(g.run('builtMesh.mesh.byteLength'),g.run('builtMesh.mesh.buffer.bytes.byteLength+(builtMesh.mesh.indexBuffer?.bytes.byteLength||0)'));
  if(expression!=='[]')assert.ok(g.run('builtMesh.steps')>10);
  g.run('delete globalThis.expectedMesh;delete globalThis.builtMesh');
 }
 g.run('globalThis.partitionExpected=partitionStaticMesh(testTriangles,8);globalThis.partitionBuilt=drainBuilder(partitionStaticMeshIncremental(testTriangles,8))');
 assert.deepEqual(g.json('meshDescription(partitionBuilt.mesh)'),g.json('meshDescription(partitionExpected)'));
 assert.equal(g.run('partitionBuilt.mesh.parts.every(p=>p.geometry===partitionBuilt.mesh&&p.byteLength===0)'),true);
});

test('bake incremental conserva recortes e geometria nos dois LODs',()=>{
 const g=environment();
 g.run('gl.isSoftware=true;buildGroundDetails();globalThis.testPlants=groundDetailsBatches.find(t=>t.plants.length>20).plants.slice(0,24)');
 for(const detail of [0,1]){
  g.run(`globalThis.plantExpected=bakePlantTile(testPlants,${detail});globalThis.plantBuilt=drainBuilder(bakePlantTileIncremental(testPlants,${detail}))`);
  assert.deepEqual(g.json('meshDescription(plantBuilt.mesh)'),g.json('meshDescription(plantExpected)'));
  assert.ok(g.run('plantBuilt.steps')>g.run('testPlants.length'));
 }
});

test('cancelar um upload incremental libera os buffers já alocados',()=>{
 const g=environment();
 g.run(`const cancelData=new Float32Array(3000*9);for(let i=0;i<cancelData.length;i++)cancelData[i]=i;
  const firstBuffer=incrementalBuffers.length,iterator=meshIncremental(cancelData,true);
  let step;do{step=iterator.next()}while(!step.done&&step.value?.stage!=='allocate');
  iterator.return();
  globalThis.cancelledBuffers=incrementalBuffers.slice(firstBuffer);
 `);
 assert.equal(g.run('cancelledBuffers.length'),1);
 assert.equal(g.run('cancelledBuffers.every(buffer=>buffer.deleted)'),true);
});

test('cada retomada limita lotes inclusive na indexação WebGL',t=>{
 const g=environment();
 g.run(`const workData=[];for(let i=0;i<6000;i++){
   const x=i%100,z=Math.floor(i/100);for(const p of [[x,0,z],[x+1,0,z],[x,0,z+1]])workData.push(...p,0,1,0,.2,.4,.3)
  }
  const workIterator=meshIncremental(workData),lastProgress={},largestBlock={};
  let workStep,maxNextMs=0,workSteps=0;
  do{
   const start=__profileNow();workStep=workIterator.next();maxNextMs=Math.max(maxNextMs,__profileNow()-start);workSteps++;
   if(!workStep.done&&workStep.value?.completed){
    const value=workStep.value,previous=lastProgress[value.stage]||0;
    largestBlock[value.stage]=Math.max(largestBlock[value.stage]||0,value.completed-previous);
    lastProgress[value.stage]=value.completed;
   }
  }while(!workStep.done);
  globalThis.incrementalWorkMetric={steps:workSteps,maxNextMs,largestBlock};
 `);
 assert.ok(g.run('incrementalWorkMetric.steps')>100);
 assert.ok(g.run('incrementalWorkMetric.largestBlock.deduplicate')<=256);
 assert.ok(g.run('incrementalWorkMetric.largestBlock.bounds')<=256*9);
 assert.ok(g.run('incrementalWorkMetric.largestBlock.upload')<=128*1024);
 t.diagnostic('Maior next() observado com indexação ativa: '+g.run('incrementalWorkMetric.maxNextMs').toFixed(2)+' ms.');
});

test('geração incremental do parque conserva a distribuição e devolve controle',()=>{
 const g=environment();
 g.run('buildParkLayout();globalThis.expectedPark=JSON.stringify({worldProps,environmentDetails,vegetationClearings})');
 const source=read('src/mundo/vegetacao.js');
 g.run('const makeVegetationReserveSlots=makeSpawnSlots;function* extendParkLayoutIncremental(){extendParkLayout();yield {stage:"outer-test"}}');
 g.run(source.slice(source.indexOf('function buildParkLayout('),source.indexOf('function makePlantModel(')));
 g.run('globalThis.generatedPark=drainBuilder(buildParkLayoutIncremental())');
 assert.equal(g.run('JSON.stringify({worldProps,environmentDetails,vegetationClearings})'),g.run('expectedPark'));
 assert.ok(g.run('generatedPark.steps')>200);
});
