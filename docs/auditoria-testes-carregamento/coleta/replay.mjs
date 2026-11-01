import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [repo,experiments,out]=process.argv.slice(2);
const {createRuntime}=await import(pathToFileURL(path.join(repo,'tests/ambiente.mjs')));
const advanced=JSON.parse(fs.readFileSync(path.join(out,'synthetic-advanced.json'),'utf8'));
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const results=[];
for(const [scenario,save]of [['new',null],['advanced',advanced]]){
 let expected=null;
 for(const name of ['baseline','cap1024','walk-cache']){
  const source=fs.readFileSync(path.join(name==='baseline'?repo:path.join(experiments,name),'dist/VORA.html'),'utf8');
  const g=createRuntime(source,save);
  g.run(`globalThis.auditReplay={simulationMs:0,renderMs:[],maxQueueMs:0};
   for(let i=0;i<1200;i++){
    keys.d=i<300;keys.w=i>=300&&i<600;keys.a=i>=600&&i<900;keys.s=i>=900;
    if(i===300){orbitCamera(30,5);zoomCamera(.9)}if(i===600){orbitCamera(-60,-5);zoomCamera(1.2)}
    const began=__profileNow();update(1/60);auditReplay.simulationMs+=__profileNow()-began;
    const queueStart=__profileNow();processResourceWork(2);auditReplay.maxQueueMs=Math.max(auditReplay.maxQueueMs,__profileNow()-queueStart);
    if(i%300===0){const start=__profileNow();render();auditReplay.renderMs.push(__profileNow()-start)}
   }
   keys={};persist();const finalRenderStart=__profileNow();render();auditReplay.renderMs.push(__profileNow()-finalRenderStart);
  `,120000);
  const snapshot={save:hash(g.store.get('vora-v1')),world:hash(g.json('({player,camera,objects,worldProps,environmentDetails})')),
   stationMeshes:hash(g.json('Object.fromEntries(Object.entries(stationMeshes).map(([k,m])=>[k,Array.from(m.buffer.data)]))')),
   pixels:hash(Buffer.from(g.run('gl.image.data'))),memory:g.json('({vegetationBytes:vegetationResources.bytes,jobs:resourceWork.jobs.size})')};
  if(expected)assert.deepEqual(snapshot,expected);else expected=snapshot;
  results.push({scenario,name,environment:'1200 deterministic update steps, SoftwareGL; not 20 real browser seconds',metrics:g.json('auditReplay'),snapshot});
  fs.writeFileSync(path.join(out,'replay-samples.json'),JSON.stringify(results,null,2)+'\n');console.log(scenario,name,'matched');
 }
}
// Exercise native preparation and buffer ownership with an in-memory backend.
// This validates CPU bytes/indexing/ranges, never execution by an actual GPU.
const native=[];
for(const name of ['baseline','walk-cache']){
 const source=fs.readFileSync(path.join(name==='baseline'?repo:path.join(experiments,name),'dist/VORA.html'),'utf8');
 const g=createRuntime(source,null,{boot:'manual'});
 g.run(`gl.isSoftware=false;gl.drawElements=()=>{};gl.ELEMENT_ARRAY_BUFFER=34963;gl.DYNAMIC_DRAW=35048;
  globalThis.auditBindings=new Map();
  gl.createBuffer=()=>({bytes:new Uint8Array(0),deleted:false});
  gl.bindBuffer=(target,buffer)=>auditBindings.set(target,buffer);
  gl.bufferData=(target,data)=>{auditBindings.get(target).bytes=typeof data==='number'?new Uint8Array(data):new Uint8Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength))};
  gl.bufferSubData=(target,offset,data)=>auditBindings.get(target).bytes.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset);
  gl.deleteBuffer=buffer=>buffer.deleted=true;
  globalThis.auditStages={};const work=buildWalkMeshIncremental();let step;
  do{step=work.next();const stage=step.value?.stage;if(stage)auditStages[stage]=(auditStages[stage]||0)+1}while(!step.done);
  globalThis.auditNativeWalk=step.value;
 `,120000);
 const mesh=g.run('auditNativeWalk');
 native.push({name,count:mesh.count,vertexCount:mesh.vertexCount,byteLength:mesh.byteLength,
  vertices:hash(Buffer.from(mesh.buffer.bytes)),indices:mesh.indexBuffer?hash(Buffer.from(mesh.indexBuffer.bytes)):null,
  ranges:g.json('auditNativeWalk.parts.map(p=>({first:p.first,count:p.count,sphere:p.sphere}))'),
  stats:hash(g.json('walkMeshStats')),stages:g.json('auditStages')});
}
assert.deepEqual({...native[0],name:null},{...native[1],name:null});
fs.writeFileSync(path.join(out,'native-walk-validation.json'),JSON.stringify({environment:'In-memory GPU buffer backend, not GPU execution',results:native},null,2)+'\n');
console.log('Native preparation bytes, indices, ranges, stats and yield stages match');
