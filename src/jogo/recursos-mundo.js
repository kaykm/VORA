// Renewable park resources have stable IDs, independently of loose-item slots.
// Scenery retains its mesh and physical dimensions while inside the hole.
let worldResourceFalls=[],worldResourceObjects=[],worldResourcesReady=false,worldResourceStep=0,worldResourceSpawnLevel=0;
function pickupSize(o){return o.pickupRadius??TYPES[o.t].size}
function pickupVolume(o){return pickupVolumeML(o)/1000}
function worldPropVisible(p){return !p.consumed&&!p.resourceLocked}

function initializeWorldResources(){return finishWorldPreparation(initializeWorldResourcesIncremental())}
function* initializeWorldResourcesIncremental(){
 worldResourceFalls=[];
 worldResourcesReady=false;worldResourceObjects=[];worldResourceStep=0;
 worldResourceSpawnLevel=spawnLevel();
 yield* buildResourceLayout();
 const consumed=new Set(Array.isArray(state.consumedWorld)?state.consumedWorld.filter(id=>typeof id==='string').slice(0,3000):[]);
 const validIds=new Set(),pending=new Map();
 const records=state.worldResourceSpawns?.pending;
 for(const entry of Array.isArray(records)?records.slice(0,4000):[]){
  if(typeof entry?.id==='string'&&Number.isFinite(entry.remaining)&&entry.remaining>=0&&entry.remaining<=7200)pending.set(entry.id,entry.remaining);
 }
 for(const [index,p]of worldProps.entries()){
  const tree=p.type==='tree',bench=p.type==='bench',rock=p.kind==='boulder';
  if(!tree&&!bench&&!rock&&!['log','bin','picnic',...RESOURCE_MODEL_KINDS].includes(p.kind))continue;
  if(p.kind==='bin'&&!p.lookAt){
   const [x,z]=p.p,a=Array.from(walkRouteAt(z,0)),b=Array.from(walkRouteAt(x,1));
   const angle=Math.atan2((z+40)/1500,(x+40)/1700);
   const targets=[[a[0],z],[x,b[0]],[-40+1700*Math.cos(angle),-40+1500*Math.sin(angle)]];
   targets.sort((a,b)=>Math.hypot(x-a[0],z-a[1])-Math.hypot(x-b[0],z-b[1]));
   p.lookAt=targets[0];p.rotation=Math.atan2(p.lookAt[0]-x,p.lookAt[1]-z);
  }
  const id=p.id||'legacy-prop-'+index;
  validIds.add(id);p.resourceId=id;p.consumed=consumed.has(id)||pending.has(id);p.resourceLocked=(p.spawnLevel||0)>spawnLevel();
  let radius;
  if(tree){
   const variant=p.p[3]??Math.floor(materialHash(p.p[0],p.p[1])*6),model=getModelMesh('tree',variant,0);
   const s=p.p[2]/model.bounds.max[1];
   radius=Math.hypot(Math.max(Math.abs(model.bounds.min[0]),Math.abs(model.bounds.max[0])),Math.max(Math.abs(model.bounds.min[2]),Math.abs(model.bounds.max[2])))*s;
  }else if(bench)radius=Math.hypot(meters(1.8),meters(.66))*.5;
  else{
   const key=p.kind+':'+(p.variant||0);
   if(!parkPropMeshes.has(key))parkPropMeshes.set(key,makeParkProp(p.kind,p.variant||0));
   const bounds=parkPropMeshes.get(key).bounds;
   if(p.resourceDiameter){
    p.visualScale=p.resourceDiameter/Math.max((bounds.max[0]-bounds.min[0])*(p.stretch?.[0]||1),(bounds.max[2]-bounds.min[2])*(p.stretch?.[2]||1));
    p.p[2]=bounds.max[1]*p.visualScale*(p.stretch?.[1]||1);
   }
   radius=Math.hypot(Math.max(Math.abs(bounds.min[0]),Math.abs(bounds.max[0]))*(p.stretch?.[0]||1),Math.max(Math.abs(bounds.min[2]),Math.abs(bounds.max[2]))*(p.stretch?.[2]||1))*(p.visualScale||1);
   p.radius=radius;
  }
  objects.push({x:p.p[0],y:p.p[1],t:rock?1:p.kind==='bin'||p.kind==='barrel'?0:p.kind==='gardenpot'?3:4,rot:p.rotation||0,
   alive:!p.consumed&&!p.resourceLocked,anim:0,worldProp:p,pickupRadius:radius,resourceAmount:1});
  const o=objects[objects.length-1],yieldInfo=resourceYield(o);
  o.resourceVolumeML=yieldInfo.volumeML;o.resourceValueCents=yieldInfo.valueCents;
  o.respawnRemaining=pending.get(id)??(p.consumed?resourceRespawnDelay(o):null);
  worldResourceObjects.push(o);
  if(index%24===0)yield {label:'Preparando árvores e objetos coletáveis'};
 }
 state.consumedWorld=[...consumed].filter(id=>validIds.has(id));
 worldResourcesReady=true;invalidateSpawnObstacles();
}

function collectWorldResource(o){
 if(!o.alive||o.anim||!canSwallow(o))return false;
 if(!cargoCanFit(o))return false;
 ensureCargoBodies();o.alive=false;o.anim=1;o.worldProp.consumed=true;o.respawnRemaining=resourceRespawnDelay(o);
 state.consumedWorld??=[];
 if(!state.consumedWorld.includes(o.worldProp.resourceId))state.consumedWorld.push(o.worldProp.resourceId);
 for(let i=0;i<o.resourceAmount;i++){
  const index=state.cargo.length;appendCargoLot(o.t,{volumeML:pickupVolumeML(o),valueCents:pickupBaseCents(o)});
  const b=createCargoBody(o.t,index,o.x-player.x,o.y-player.y,terrainElevationAt(o.x,o.y),o.rot,o.worldProp);
  b.v[0]=-cargoVelocityX;b.v[2]=-cargoVelocityZ;
  cargoBodies.push(b);fallingItems.push(b);
 }
 state.collected++;invalidateSpawnObstacles();
 if(lighting){lighting.key='';lighting.dynamicKey=''}
 missionCheck();updateUI();sound(280);persist();return true;
}
function resourceCargoModel(p){
 let model,scale,rotation=p.rotation||0;
 if(p.type==='tree'){
  const variant=p.p[3]??Math.floor(materialHash(p.p[0],p.p[1])*6);
  model=getModelMesh('tree',variant,0);
  const s=p.p[2]/model.bounds.max[1];scale=[s,s,s];
  rotation=p.p[0]*.013+p.p[1]*.021;
 }else if(p.type==='bench'){
  model=getModelMesh('bench',p.variant||0,0);scale=[1,1,1];
 }else{
  model=parkPropMeshes.get(p.kind+':'+(p.variant||0));
  const s=p.visualScale||1;scale=[0,1,2].map(i=>s*(p.stretch?.[i]||1));
 }
 return {mesh:model,scale,rotation};
}
function resourceCargoShape(p,t){
 const visual=resourceCargoModel(p),{min,max}=visual.mesh.bounds;
 const lo=min.map((v,i)=>v*visual.scale[i]),hi=max.map((v,i)=>v*visual.scale[i]);
 const size=hi.map((v,i)=>Math.max(.1,v-lo[i])),half=(lo[1]+hi[1])/2;
 // A bounded compound body, shared by every instance of this resource. Unlike
 // the old material proxy, this follows the dimensions of the swallowed mesh.
 const r=Math.min(...size)/4,spheres=[];
 for(const x of [lo[0]+r,(lo[0]+hi[0])/2,hi[0]-r])
  for(const y of [lo[1]+r,half,hi[1]-r])
   for(const z of [lo[2]+r,(lo[2]+hi[2])/2,hi[2]-r])spheres.push([x,y-half,z,r]);
 return {half,extent:Math.hypot(...size)/2,mass:Math.max(ASSET_METRICS[t].mass,size[0]*size[1]*size[2]/500),spheres,visual};
}
function tickWorldResourceFalls(dt){
 for(const fall of worldResourceFalls)fall.time+=dt;
 const count=worldResourceFalls.length;
 worldResourceFalls=worldResourceFalls.filter(f=>f.time<1.1);
 if(count!==worldResourceFalls.length&&lighting)lighting.dynamicKey='';
}
function drawWorldResourceFalls(){
 const previousReactive=reactiveDraw;reactiveDraw=true;
 try{
 for(const {p,time}of worldResourceFalls){
  const t=Math.min(1,time/1.1),s=Math.max(.001,1-t*t),offset=-(p.p[2]||40)*t*t-cavityDepth()*t;
  if(p.type==='tree')drawTree(p.p,offset,s);
  else if(p.type==='bench')drawBench(p.p,p.rotation,p.variant,offset,s);
  else drawParkProp(p,offset,s);
 }
 }finally{reactiveDraw=previousReactive}
}
function makeTimberModel(variant=0){
 const b=new ModelBuilder(),[w,h,d]=ASSET_METRICS[4].bodySize;
 for(let i=0;i<3;i++)b.box(0,i*h/3,0,w,h*.30,d,[.57+variant*.025,.36,.19],0,.2);
 for(const x of [-w*.28,w*.28])b.box(x,0,0,w*.06,h,d*1.03,[.25,.33,.29],1,0);
 return b.bake();
}

function resourceRespawnDelay(o,level=spawnLevel()){
 const p=o.worldProp;
 const base=p.type==='tree'?120+p.p[2]*.23:p.type==='bench'?90:p.kind==='boulder'?35+pickupSize(o)*.9:p.kind==='barrel'?70:55;
 return base*regrowthMultiplier(level);
}
function canWorldResourceRespawn(o){
 if(Math.hypot(o.x-player.x,o.y-player.y)<Math.max(100,physicalRadius()+pickupSize(o)+SPAWN_CLEARANCE))return false;
 if(worldResourceFalls.some(f=>f.p===o.worldProp))return false;
 // Leaves may overhang loose litter. Only the trunk occupies ground space;
 // the full crown radius above is still used to keep respawns off the player.
 const groundRadius=o.worldProp.type==='tree'?meters(.15):pickupSize(o);
 return !objects.some(p=>p!==o&&p.alive&&!p.worldProp&&Math.hypot(p.x-o.x,p.y-o.y)<groundRadius+pickupSize(p)+3);
}
function respawnWorldResource(o){
 o.alive=true;o.anim=0;o.respawnRemaining=null;o.worldProp.consumed=false;
 state.consumedWorld=state.consumedWorld.filter(id=>id!==o.worldProp.resourceId);
 invalidateSpawnObstacles();spawnDirty=true;
 if(lighting){lighting.key='';lighting.dynamicKey=''}
}
function unlockWorldResourceAreas(){
 if(!worldResourcesReady)return;
 const factor=regrowthMultiplier(spawnLevel())/regrowthMultiplier(worldResourceSpawnLevel);
 for(const o of worldResourceObjects)if(o.respawnRemaining!==null)o.respawnRemaining*=factor;
 worldResourceSpawnLevel=spawnLevel();
 for(const o of worldResourceObjects){
  if(!o.worldProp.resourceLocked||(o.worldProp.spawnLevel||0)>spawnLevel())continue;
  o.worldProp.resourceLocked=false;
  if(!o.worldProp.consumed){
   if(canWorldResourceRespawn(o))respawnWorldResource(o);
   else{o.worldProp.consumed=true;o.respawnRemaining=0;}
  }
 }
 spawnDirty=true;
}
function tickWorldResourceSpawns(dt){
 if(!worldResourcesReady)return;
 worldResourceStep+=dt;if(worldResourceStep<.5)return;
 const elapsed=worldResourceStep;worldResourceStep=0;
 for(const o of worldResourceObjects){
  if(o.alive||o.worldProp.resourceLocked||o.respawnRemaining===null)continue;
  o.respawnRemaining=Math.max(0,o.respawnRemaining-elapsed);
  if(o.respawnRemaining===0&&canWorldResourceRespawn(o))respawnWorldResource(o);
 }
}
function saveWorldResourceSpawns(){
 if(!worldResourcesReady)return;
 state.worldResourceSpawns={version:1,pending:worldResourceObjects.filter(o=>!o.alive&&o.respawnRemaining!==null)
  .map(o=>({id:o.worldProp.resourceId,remaining:o.respawnRemaining}))};
}
