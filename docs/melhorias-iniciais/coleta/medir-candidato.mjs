// One process per sample. Instrumentation exists only in the disposable harness.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';

const [repo,scenario,saveFile,outFile,mode='boot']=process.argv.slice(2);
const html=fs.readFileSync(path.join(repo,'dist/VORA.html'),'utf8');
const save=scenario==='new'?null:JSON.parse(fs.readFileSync(saveFile,'utf8'));
const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
function snapshot(game){
 const vertices=game.run('walkMesh.buffer.data');
 return {
  state:hash(game.json('state')),save:hash(game.store.get('vora-v1')),
  world:hash(game.json('({player,camera,objects,worldProps,environmentDetails})')),
  camera:hash(game.json('({viewYaw,viewElevation,viewDistance,cameraPan,cameraZoomFactor})')),
  paths:hash(Buffer.from(vertices.buffer,vertices.byteOffset,vertices.byteLength)),stats:hash(game.json('walkMeshStats')),
  station:hash(game.json('Object.fromEntries(Object.entries(stationMeshes).map(([key,m])=>[key,Array.from(m.buffer.data)]))')),
  resourceCounts:game.json('({vegetationBytes:vegetationResources.bytes,jobs:resourceWork.jobs.size})'),
  ready:game.run('gameLoading.ready'),progress:game.run('gameLoading.progress'),writes:game.storageWrites.length
 };
}
let result;
if(mode==='boot'){
 let source=fs.readFileSync(path.join(repo,'tests/ambiente.mjs'),'utf8');
 function replaceOnce(needle,replacement){
  assert.equal(source.split(needle).length-1,1,'unique harness anchor: '+needle);
  source=source.replace(needle,replacement);
 }
 replaceOnce('performance:{now:()=>{const now=clock;clock+=clockStep;return now}},','performance:{now:()=>performance.now()},');
 replaceOnce(" vm.runInContext(js,context,{timeout:45000,filename:'VORA.js'});",
  " if(incrementalBoot)js+='\\nglobalThis.__measuredLoading=gameLoading;';\n vm.runInContext(js,context,{timeout:45000,filename:'VORA.js'});");
 const {createRuntime}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const game=createRuntime(html,save,{boot:'manual'});
 const pending=game.run('startVora()'),loading=game.context.__measuredLoading;
 let activeMs=0,callbacks=0,maxSliceMs=0,heapMaxSampled=0,rssMaxSampled=0;
 while(!loading.ready){
  if(loading.error)throw loading.error;
  const began=performance.now();
  assert.ok(game.runAnimationFrame(),'pending driver must schedule work');
  const elapsed=performance.now()-began;
  activeMs+=elapsed;callbacks++;maxSliceMs=Math.max(maxSliceMs,elapsed);
  const memory=process.memoryUsage();heapMaxSampled=Math.max(heapMaxSampled,memory.heapUsed);rssMaxSampled=Math.max(rssMaxSampled,memory.rss);
  assert.ok(callbacks<100000,'driver must finish');
 }
 await pending;
 // Capture the high-water mark before snapshot serialization allocates memory.
 const maxRssBootKiB=process.resourceUsage().maxRSS;
 result={scenario,mode,node:process.version,environment:'Node/DOM simulado/SoftwareGL, immediate RAF; isolated process',
  setupMs:game.startupMs,activeMs,callbacks,maxSliceMs,steps:loading.steps,heapMaxSampled,rssMaxSampled,maxRssBootKiB,
  settings:game.json('({backend:gl.isSoftware?"SoftwareGL":"WebGL",W,H,imageMode:state.imageMode,outputMode:state.outputMode,aaMode:state.aaMode,aoMode:state.aoMode,shadowQuality:state.shadowQuality,viewRange:state.viewRange})'),
  snapshot:snapshot(game),browserFirstFrameMs:null,browserP95FrameMs:null};
}else if(mode==='replay'){
 const {createRuntime}=await import(pathToFileURL(path.join(repo,'tests/ambiente.mjs')));
 const game=createRuntime(html,save);
 game.run(`globalThis.replayFrames=[];globalThis.replayMetrics={simulationMs:0,renders:[],maxQueueMs:0};`);
 const frames=[];
 for(let chunk=0;chunk<4;chunk++){
  game.run(`
   for(let i=${chunk*300};i<${(chunk+1)*300};i++){
    keys.d=i<300;keys.w=i>=300&&i<600;keys.a=i>=600&&i<900;keys.s=i>=900;
    if(i===300){orbitCamera(30,5);zoomCamera(.9)}if(i===600){orbitCamera(-60,-5);zoomCamera(1.2)}
    const began=__profileNow();update(1/60);replayMetrics.simulationMs+=__profileNow()-began;
    const queued=__profileNow();processResourceWork(2);replayMetrics.maxQueueMs=Math.max(replayMetrics.maxQueueMs,__profileNow()-queued);
   }
   {const began=__profileNow();render();replayMetrics.renders.push(__profileNow()-began)}
  `,120000);
  frames.push({step:(chunk+1)*300,pixels:hash(Buffer.from(game.run('gl.image.data')))});
 }
 game.run('keys={};persist();{const began=__profileNow();render();replayMetrics.renders.push(__profileNow()-began)}',60000);
 frames.push({step:1200,afterPersist:true,pixels:hash(Buffer.from(game.run('gl.image.data')))});
 result={scenario,mode,environment:'1200 deterministic steps, five CPU images; not 20 real browser seconds',
  metrics:game.json('replayMetrics'),frames,snapshot:snapshot(game),browserP95FrameMs:null};
}else throw Error('Unknown measurement mode');
fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({scenario,mode,activeMs:result.activeMs,maxRssBootKiB:result.maxRssBootKiB,callbacks:result.callbacks,frames:result.frames?.length}));
