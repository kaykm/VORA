// Bounded cache: retain recent resources instead of expiring after a camera turn.
const vegetationResources = {
 generation:0,nextId:0,entries:new Map(),bytes:0,
 limitBytes:(matchMedia('(pointer:coarse)').matches?48:128)*1024*1024,
 shadowDirty:false,shadowUpdatedAt:0
};
function resetVegetationResourceCache(){
 vegetationResources.generation++;
 cancelResourceWork(job=>job.vegetation===true);
 vegetationResources.entries.clear();vegetationResources.bytes=0;vegetationResources.shadowDirty=false;
}
function vegetationResourceKey(tile,detail){
 tile.resourceId??=++vegetationResources.nextId;
 return vegetationResources.generation+':'+tile.resourceId+':'+detail;
}
function releaseVegetationResource(entry){
 invalidateSceneFrame();
 if(!vegetationResources.entries.delete(entry.key))return;
 if(entry.detail==='shadow')entry.tile.shadowMesh=null;
 else entry.tile.meshes[entry.detail]=null;
 vegetationResources.bytes=Math.max(0,vegetationResources.bytes-(entry.mesh.byteLength||0));
 vegetationResources.shadowDirty=true;
 deleteMesh(entry.mesh);
}
function makeVegetationRoom(bytes,incomingTile){
 const cache=vegetationResources;
 if(cache.bytes+bytes<=cache.limitBytes)return true;
 const candidates=[...cache.entries.values()].filter(entry=>{
  if(entry.tile===incomingTile||entry.tile.initialProtected)return false;
  const visible=entry.tile.lastVisibleFrame>=frameCount-1;
  const displayed=entry.tile.meshes[entry.tile.near?1:0]||entry.tile.meshes[0]||entry.tile.meshes[1];
  return !visible||entry.detail==='shadow'||entry.mesh!==displayed;
 }).sort((a,b)=>a.usedAt-b.usedAt);
 for(const entry of candidates){
  releaseVegetationResource(entry);
  if(cache.bytes+bytes<=cache.limitBytes)return true;
 }
 return cache.bytes+bytes<=cache.limitBytes;
}
function installVegetationResource(tile,detail,mesh,key){
 if(!makeVegetationRoom(mesh.byteLength||0,tile)){
  deleteMesh(mesh);tile.retryResourcesAt=performance.now()+1500;return false;
 }
 const old=vegetationResources.entries.get(key);
 if(old)releaseVegetationResource(old);
 if(detail==='shadow')tile.shadowMesh=mesh;
 else tile.meshes[detail]=mesh;
 vegetationResources.shadowDirty=true;
 vegetationResources.entries.set(key,{key,tile,detail,mesh,usedAt:performance.now()});
 vegetationResources.bytes+=mesh.byteLength||0;invalidateSceneFrame();
 return true;
}
function requestVegetationResources(tile,detail,priority=100){
 tile.resourceWanted??={};tile.resourceWanted[detail]=frameCount;
 const key=vegetationResourceKey(tile,detail);
 const ready=detail==='shadow'?tile.shadowMesh:tile.meshes[detail];
 if(ready){const entry=vegetationResources.entries.get(key);if(entry)entry.usedAt=performance.now();return ready}
 if(performance.now()<(tile.retryResourcesAt||0))return null;
 const generation=vegetationResources.generation;
 queueResourceWork(key,()=>{
  const plants=tile.plants;
  return bakePlantTileIncremental(plants,detail==='shadow'?0:detail);
 },{
  vegetation:true,priority,isValid:()=>generation===vegetationResources.generation&&frameCount-tile.resourceWanted[detail]<120,
  onComplete:mesh=>installVegetationResource(tile,detail,mesh,key),
  onError:error=>{tile.retryResourcesAt=performance.now()+10000;console.warn('Preparação de vegetação adiada:',error)}
 });
 return null;
}
function maintainVegetationResources(now){
 if(vegetationResources.shadowDirty&&lighting&&(now-vegetationResources.shadowUpdatedAt>350||!resourceWork.jobs.size)){
  lighting.key='';vegetationResources.shadowDirty=false;vegetationResources.shadowUpdatedAt=now;
 }
 canvas.dataset.preparingResources=String(resourceWork.jobs.size);
 canvas.dataset.vegetationMemoryMiB=(vegetationResources.bytes/1048576).toFixed(1);
}
function* prepareVegetationInitial(){
 yield* buildGroundDetailsIncremental();prepareSceneCamera();
 const tiles=[...groundDetailsBatches].sort((a,b)=>Math.hypot(a.center[0]-camera.x,a.center[2]-camera.y)-Math.hypot(b.center[0]-camera.x,b.center[2]-camera.y));
 const work=[],scheduled=new Set();let estimated=0;
 const add=(tile,detail)=>{const key=vegetationResourceKey(tile,detail);if(!scheduled.has(key)){scheduled.add(key);work.push([tile,detail])}};
 for(const tile of tiles){
  const visible=vegetationVisible(...tile.center,tile.radius);tile.initialProtected=visible;
  if(gl.isSoftware&&!visible)continue;
  const bytes=tile.plants.reduce((sum,p)=>sum+getPlantMesh(p.kind,p.variant,0).vertices.length*4,0);
  if(!visible&&estimated+bytes>vegetationResources.limitBytes*.85)continue;
  add(tile,0);estimated+=bytes;
 }
 if(!gl.isSoftware)for(const tile of tiles){
  if(tile.initialProtected&&Math.hypot(tile.center[0]-currentEye[0],tile.center[1]-currentEye[1],tile.center[2]-currentEye[2])<530)add(tile,1);
  if(lighting?.valid&&state.shadowQuality!=='off'&&Math.hypot(tile.center[0]-camera.x,tile.center[2]-camera.y)<=shadowCasterRange()+tile.radius)add(tile,0);
 }
 for(let index=0;index<work.length;index++){
  const [tile,detail]=work[index],key=vegetationResourceKey(tile,detail);
  const mesh=yield* bakePlantTileIncremental(tile.plants,detail);
  installVegetationResource(tile,detail,mesh,key);
  yield {label:'Preparando o cenário · '+(index+1)+' de '+work.length,loadingFraction:(index+1)/work.length};
 }
}
