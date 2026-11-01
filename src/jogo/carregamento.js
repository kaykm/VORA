function* loadingPhase(label,weight,iterator){
 const base=gameLoading.completed;updateLoadingScreen(label);
 let complete=false;
 try{
  for(;;){
   const result=iterator.next();if(result.done){complete=true;break}
   const fraction=result.value?.loadingFraction;
   if(Number.isFinite(fraction))gameLoading.progress=Math.max(gameLoading.progress,Math.min(99,(base+weight*Math.max(0,Math.min(1,fraction)))/gameLoading.total*100));
   updateLoadingScreen(result.value?.label||label);yield result.value;
  }
 }finally{
  if(!complete)iterator.return?.();
 }
 gameLoading.completed=base+weight;
 gameLoading.progress=Math.max(gameLoading.progress,Math.min(99,gameLoading.completed/gameLoading.total*100));
 updateLoadingScreen(label);yield {label};
}
function* initializeVoraWorldIncremental(){
 initProgression();initDepot();seed=61;objects=[];fallingItems=[];cargoBodies=[];
 yield* buildParkLayoutIncremental();
 initializeSpawns();yield* initializeWorldResourcesIncremental();yield {label:'Restaurando os objetos do parque'};
 restoreCargoPhysics();yield {label:'Restaurando a carga'};
}
function* warmVoraModelsIncremental(){
 const work=[];
 for(const detail of gl.isSoftware?[0]:[0,1]){
  for(let t=0;t<TYPES.length;t++)for(let variant=0;variant<3;variant++)work.push(()=>prepareObjectInstances(getModelMesh(t,variant,detail)));
  for(let variant=0;variant<TREE_VARIANTS;variant++)work.push(()=>prepareObjectInstances(getModelMesh('tree',variant,detail)));
  for(let variant=0;variant<3;variant++)work.push(()=>prepareObjectInstances(getModelMesh('bench',variant,detail)));
 }
 const plants=new Map();for(const p of environmentDetails)plants.set(p.kind+':'+p.variant,[p.kind,p.variant]);
 for(const [kind,variant]of plants.values())for(const detail of gl.isSoftware?[0]:[0,1])work.push(()=>getPlantMesh(kind,variant,detail));
 const props=new Set();
 for(const p of worldProps)if(p.type==='scenery'){
  const key=p.kind+':'+(p.variant||0);
  if(!props.has(key)){props.add(key);work.push(()=>{if(!parkPropMeshes.has(key))parkPropMeshes.set(key,makeParkProp(p.kind,p.variant||0));prepareObjectInstances(parkPropMeshes.get(key))})}
 }
 for(let i=0;i<work.length;i++){work[i]();yield {label:'Preparando modelos · '+(i+1)+' de '+work.length,loadingFraction:(i+1)/work.length}}
}
function* oneLoadingTask(callback){callback();yield;}
function* initializeVoraSteps(){
 yield* loadingPhase('Preparando o renderizador',40,initSceneProgramIncremental());
 yield* initOpaquePipelineIncremental();
 yield* loadingPhase('Preparando os controles',10,oneLoadingTask(()=>{migrateWorldScale();initMotionUI();initSpawnControls();initGameInput()}));
 yield* loadingPhase('Organizando o parque',160,initializeVoraWorldIncremental());
 yield* loadingPhase('Preparando modelos',120,warmVoraModelsIncremental());
 yield* loadingPhase('Preparando iluminação e imagem',140,initLightingIncremental());
 yield* loadingPhase('Restaurando suas configurações',30,oneLoadingTask(()=>{resize();updateUI();initViewRange();initShadowControls();initGraphicsPresets();initMenuInterface();initInsideView();initUIRedesign()}));
 yield* loadingPhase('Preparando os caminhos',140,(function*(){walkMesh=yield* buildWalkMeshIncremental()})());
 yield* loadingPhase('Preparando o horizonte',40,(function*(){parkBackdrop=yield* buildParkBackdropIncremental()})());
 yield* loadingPhase('Preparando a base',20,oneLoadingTask(()=>{stationMeshes??=buildStationMeshes();rebuildCavity()}));
 yield* loadingPhase('Preparando a vegetação',260,prepareVegetationInitial());
 yield* loadingPhase('Finalizando a cena',40,oneLoadingTask(()=>{if(!gl.isSoftware){render();gl.flush?.()}}));
}
function completeVoraLoading(){
 if(gameLoading.error||gameLoading.ready)return;
 gameLoading.ready=true;gameLoading.active=false;gameLoading.completed=gameLoading.total;gameLoading.progress=100;
 updateLoadingScreen('Tudo pronto');
 for(const tile of groundDetailsBatches||[])tile.initialProtected=false;
 $('loadingScreen').hidden=true;document.documentElement.removeAttribute('data-loading');
 clearGameInput();focusGameScene();last=performance.now();resetFpsCounter();persist();requestAnimationFrame(frame);
}
function startVora(){
 if(gameLoading.promise)return gameLoading.promise;
 $('loadingScreen').hidden=false;const iterator=initializeVoraSteps();
 gameLoading.promise=new Promise((resolve,reject)=>{
  const next=()=>{
   try{
    if(gameLoading.error){iterator.return?.();reject(gameLoading.error);return}
    const deadline=performance.now()+5;
    for(let count=0;count<64;count++){
     const began=performance.now(),result=iterator.next();gameLoading.steps++;
     gameLoading.maxStepMs=Math.max(gameLoading.maxStepMs,performance.now()-began);
     if(result.done){completeVoraLoading();resolve();return}
     if(result.value?.waiting||performance.now()>=deadline)break;
    }
    requestAnimationFrame(next);
   }catch(error){iterator.return?.();failVoraLoading(error);reject(error)}
  };
  // Yield two turns so the HTML overlay paints before expensive GPU work.
  requestAnimationFrame(()=>requestAnimationFrame(next));
 });
 gameLoading.promise.catch(()=>{});return gameLoading.promise;
}
