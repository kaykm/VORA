// Read-only catalogue. World examples retain references to the actual pickup
// objects; no inventory, spawn or save is copied back from this interface.
const DOSSIER_PROP_NAMES={
 tree:['Árvores','Natureza'],bench:['Bancos','Mobiliário'],boulder:['Pedras do cenário','Natureza'],
 log:['Troncos caídos','Natureza'],bin:['Lixeiras','Mobiliário'],picnic:['Mesas de piquenique','Mobiliário'],
 barrel:['Barris','Apoio'],pallet:['Paletes','Apoio'],crate:['Caixas de madeira','Apoio'],
 gardenpot:['Vasos de terracota','Apoio'],logpile:['Pilhas de troncos','Apoio']
};
const dossierView={ready:false,catalog:[],selected:'item-0',indices:new Map(),filter:'all',query:'',
 yaw:.6,elevation:.42,zoom:1,model:null,renderer:null,drag:null,drawRequest:null,draws:0};

function dossierAssessment(o){
 const fits=canSwallow(o),volume=pickupVolume(o),room=cargoCanFit(o);
 const locked=!!o.worldProp?.resourceLocked,waiting=!!o.worldProp&&!o.alive&&!locked;
 const requiredRadius=(pickupSize(o)+PICKUP_CLEARANCE)/.922;
 const level=HOLE_RADII.findIndex(r=>meters(r)>=requiredRadius);
 let status='Pode engolir',reason='A abertura e o espaço livre comportam este item.',condition='ready';
 if(!fits){condition='grow';status='Abertura pequena';reason=level<0?'Este exemplar ultrapassa o raio máximo do buraco.':
  'Aumente o raio até pelo menos '+met(requiredRadius/WORLD_UNITS_PER_METER)+' m (nível '+level+').';}
 else if(!room&&cargoRimFull()){condition='capacity';status='Borda cheia';reason='A pilha alcançou a abertura. Descarregue a carga ou aumente a profundidade para continuar coletando.';}
 else if(!room){condition='capacity';status='Sem espaço na carga';reason='Libere '+met(Math.max(0,used()+volume-capacity()))+' L ou melhore a profundidade.';}
 else if(locked){condition='locked';status='Cabe · spawn bloqueado';reason='Seu buraco comporta este exemplar. Libere o nível '+o.worldProp.spawnLevel+' de áreas de coleta para encontrá-lo.';}
 else if(waiting){condition='waiting';status='Cabe · aguardando reposição';reason='Seu buraco comporta este exemplar. Ele está se recuperando no mapa.';}
 return {fits,room,locked,waiting,ready:fits&&room&&!locked&&!waiting,volume,requiredRadius,level,status,reason,condition};
}

function buildDossierCatalog(){
 const result=TYPES.map((type,t)=>({id:'item-'+t,name:type.singular,category:t===4?'Material obtido':'Objetos',
  samples:[{t,alive:true,anim:0,modelVariant:0}]}));
 for(const [kind,[name,category]]of Object.entries(DOSSIER_PROP_NAMES)){
  const all=worldResourceObjects.filter(o=>(o.worldProp.type==='tree'||o.worldProp.type==='bench'?o.worldProp.type:o.worldProp.kind)===kind);
  const groups=new Map();
  for(const o of all){
   const size=kind==='tree'?o.worldProp.p[2]/WORLD_UNITS_PER_METER:pickupSize(o)*2/WORLD_UNITS_PER_METER;
   const tier=kind==='tree'?(size<3?0:size<6?1:2):kind==='boulder'?(size<.4?0:size<2?1:2):0;
   if(!groups.has(tier))groups.set(tier,[]);groups.get(tier).push(o);
  }
  const samples=[...groups].sort((a,b)=>a[0]-b[0]).map(([tier,items])=>{
   const active=items.filter(o=>o.alive),pool=active.length?active:items;
   pool.sort((a,b)=>pickupSize(a)-pickupSize(b));return pool[Math.floor(pool.length/2)];
  });
  if(samples.length)result.push({id:'prop-'+kind,name,category,samples});
 }
 return result;
}
function dossierCurrent(){
 const entry=dossierView.catalog.find(e=>e.id===dossierView.selected);
 if(!entry)return null;
 const index=Math.min(entry.samples.length-1,dossierView.indices.get(entry.id)||0);
 return {entry,index,object:entry.samples[index]};
}
function dossierMatches(entry){
 const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(!normalize(entry.name+' '+entry.category).includes(normalize(dossierView.query.trim())))return false;
 return entry.samples.some(dossierSampleMatches);
}
function dossierSampleMatches(o){
 const a=dossierAssessment(o);
 return dossierView.filter==='all'||(dossierView.filter==='ready'?a.ready:!a.fits);
}
function renderDossierCatalog(){
 const list=$('dossierCatalog');list.replaceChildren();
 const entries=dossierView.catalog.filter(dossierMatches);
 if(!entries.some(e=>e.id===dossierView.selected))dossierView.selected=entries[0]?.id||'';
 for(const entry of entries){
  const button=document.createElement('button'),name=document.createElement('b'),hint=document.createElement('small');
  button.type='button';button.className='dossier-entry';button.dataset.entry=entry.id;
  button.setAttribute('aria-current',String(entry.id===dossierView.selected));
  name.textContent=entry.name;hint.textContent=entry.category;
  button.append(name,hint);button.onclick=()=>selectDossierEntry(entry.id);list.append(button);
 }
 $('dossierCount').textContent=entries.length+' de '+dossierView.catalog.length+' tipos';
 $('dossierEmpty').hidden=entries.length>0;$('dossierDetail').hidden=!entries.length;
 if(entries.length)selectDossierEntry(dossierView.selected,false);
 else{dossierView.model=null;scheduleDossierDraw();}
}
function refreshDossier(){
 dossierView.catalog=buildDossierCatalog();
 $('dossierHole').textContent='Raio '+met(physicalRadius()/WORLD_UNITS_PER_METER)+' m · profundidade '+met(depth())+' m';
 $('dossierCapacity').textContent=met(Math.max(0,capacity()-used()))+' / '+capacity()+' L livres';
 renderDossierCatalog();
}
function selectDossierEntry(id,resetView=true){
 const entry=dossierView.catalog.find(e=>e.id===id);if(!entry)return;
 const changed=dossierView.selected!==id;dossierView.selected=id;
 if(changed||!entry.samples[dossierView.indices.get(id)]||!dossierSampleMatches(entry.samples[dossierView.indices.get(id)])){
  const preferred=entry.samples.findIndex(o=>dossierSampleMatches(o)&&(dossierView.filter!=='all'||dossierAssessment(o).ready));
  const matching=entry.samples.findIndex(dossierSampleMatches);
  dossierView.indices.set(id,preferred<0?Math.max(0,matching):preferred);
 }
 if(resetView){dossierView.yaw=.6;dossierView.elevation=.42;dossierView.zoom=1;}
 for(const b of $('dossierCatalog').querySelectorAll('button'))b.setAttribute('aria-current',String(b.dataset.entry===id));
 updateDossierDetail();
}
function changeDossierExample(step){
 const current=dossierCurrent();if(!current)return;
 let next=current.index;
 do{next=(next+step+current.entry.samples.length)%current.entry.samples.length;}while(next!==current.index&&!dossierSampleMatches(current.entry.samples[next]));
 dossierView.indices.set(current.entry.id,next);updateDossierDetail();
}

function dossierModel(o,detail=gl.isSoftware?0:1){
 const p=o.worldProp;
 let model,scale=[1,1,1],rotation=0;
 if(!p){model=getModelMesh(o.t,o.modelVariant??modelVariantFromRotation(o.rot||0),detail);rotation=o.rot||0;}
 else if(p.type==='tree'){
  const variant=p.p[3]??Math.floor(materialHash(p.p[0],p.p[1])*6);
  model=getModelMesh('tree',variant,detail);
  scale=scale.map(()=>p.p[2]/model.bounds.max[1]);rotation=p.p[0]*.013+p.p[1]*.021;
 }else if(p.type==='bench'){
  model=getModelMesh('bench',p.variant||0,detail);rotation=p.rotation||0;
 }else{
  const key=p.kind+':'+(p.variant||0);model=parkPropMeshes.get(key);
  if(!model){model=makeParkProp(p.kind,p.variant||0);parkPropMeshes.set(key,model);}
  scale=scale.map((_,i)=>(p.visualScale||1)*(p.stretch?.[i]||1));rotation=p.rotation||0;
 }
 const dimensions=model.bounds.max.map((v,i)=>(v-model.bounds.min[i])*scale[i]);
 return {mesh:model,vertices:model.vertices,scale,rotation,dimensions,
  center:model.bounds.min.map((v,i)=>(v+model.bounds.max[i])*.5*scale[i])};
}
function dossierAvailability(o){
 const p=o.worldProp;
 if(!p)return o.t===4?'Material produzido ao consumir árvores e objetos de madeira.':'Encontrado nos spawns de objetos do parque.';
 const area=WORLD_RESOURCE_AREAS.find(a=>a.id===p.resourceArea)?.name||'Parque';
 if(p.resourceLocked)return area+' · desbloqueia no nível '+p.spawnLevel+' de áreas.';
 if(!o.alive)return area+' · reposição em '+Math.ceil(o.respawnRemaining||0)+' s; aguarda espaço livre.';
 return area+' · presente no mapa · reposição após a coleta.';
}
function updateDossierDetail(){
 const current=dossierCurrent();if(!current)return;
 const {entry,index,object:o}=current,a=dossierAssessment(o),model=dossierModel(o);
 dossierView.model=model;
 $('dossierItemName').textContent=entry.name;$('dossierCategory').textContent=entry.category;
 $('dossierVariant').textContent=entry.samples.length>1?['Porte pequeno','Porte médio','Porte grande'][index]:'Modelo do item';
 $('dossierStatus').textContent=a.status;$('dossierReason').textContent=a.reason;$('dossierVerdict').dataset.state=a.condition;
 $('dossierDimensions').textContent=model.dimensions.map(v=>met(v/WORLD_UNITS_PER_METER)).join(' × ')+' m';
 $('dossierRadius').textContent=met(a.requiredRadius/WORLD_UNITS_PER_METER)+' m'+(a.level<0?' · acima do máximo':' · nível '+a.level);
 $('dossierMaterial').textContent=o.worldProp?'Lote de '+TYPES[o.t].name.toLowerCase():'1 × '+TYPES[o.t].singular;
 $('dossierVolume').textContent=met(a.volume)+' L · '+fmt(pickupPrice(o))+' moedas';
 $('dossierSpawn').textContent=dossierAvailability(o);
 $('dossierCanvas').setAttribute('aria-label','Modelo de '+entry.name+'. '+a.status+'. Arraste ou use as setas para girar.');
 $('dossierPrevious').disabled=$('dossierNext').disabled=entry.samples.filter(dossierSampleMatches).length<2;
 scheduleDossierDraw();
}

// Render one production mesh on demand with the game's existing depth-tested
// SoftwareGL. This keeps intersecting details correct without another GPU context.
function scheduleDossierDraw(){
 if(dossierView.drawRequest!==null)return;
 dossierView.drawRequest=requestAnimationFrame(()=>{dossierView.drawRequest=null;if($('dossierModal').open)drawDossierModel();});
}
function drawDossierModel(){
 const v=dossierView,model=v.model,canvas=$('dossierCanvas');if(!model)return;
 const rect=canvas.getBoundingClientRect(),factor=menuFrameFactor($('dossierModal'));
 const width=Math.max(1,rect.width/factor||400),height=Math.max(1,rect.height/factor||218);
 const ratio=Math.min(2,Math.max(1.5,(devicePixelRatio||1)*factor));
 const pw=Math.round(width*ratio),ph=Math.round(height*ratio);
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
 const renderer=v.renderer??=new SoftwareGL(canvas);
 if(renderer.width!==pw||renderer.height!==ph)renderer.viewport(0,0,pw,ph);
 const yaw=v.yaw-model.rotation,co=Math.cos(yaw),si=Math.sin(yaw),se=Math.sin(v.elevation),ce=Math.cos(v.elevation);
 const raw=p=>[co*p[0]-si*p[2],se*(si*p[0]+co*p[2])-ce*p[1],ce*(si*p[0]+co*p[2])+se*p[1]];
 const probes=[];
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])probes.push(raw([x*model.dimensions[0]/2,y*model.dimensions[1]/2,z*model.dimensions[2]/2]));
 const minX=Math.min(...probes.map(p=>p[0])),maxX=Math.max(...probes.map(p=>p[0]));
 const minY=Math.min(...probes.map(p=>p[1])),maxY=Math.max(...probes.map(p=>p[1]));
 const scale=Math.min((width-48)/Math.max(.001,maxX-minX),(height-54)/Math.max(.001,maxY-minY))*v.zoom;
 const ox=width*.5-(minX+maxX)*.5*scale,oy=height*.5-(minY+maxY)*.5*scale;
 const cameraCos=Math.cos(v.yaw),cameraSin=Math.sin(v.yaw),depthScale=1/Math.max(1,Math.hypot(...model.dimensions)*2);
 const projection=new Float32Array([
  2*scale/width*cameraCos,-2*scale/height*se*cameraSin,-depthScale*ce*cameraSin,0,
  0,2*scale/height*ce,-depthScale*se,0,
  -2*scale/width*cameraSin,-2*scale/height*se*cameraCos,-depthScale*ce*cameraCos,0,
  ox*2/width-1,1-oy*2/height,0,1
 ]);
 const mc=Math.cos(model.rotation),ms=Math.sin(model.rotation),center=model.center;
 renderer.u={viewProjection:projection,scale:model.scale,rotation:model.rotation,
  origin:[-mc*center[0]-ms*center[2],-center[1],ms*center[0]-mc*center[2]],
  tint:[1,1,1],material:14,hole:[100000,100000,0],depth:0,eye:[0,0,0]};
 renderer.bound={data:model.vertices};renderer.clearColor(.094,.176,.133,1);renderer.clear();
 renderer.drawArrays(renderer.TRIANGLES,0,model.vertices.length/9);renderer.present();
 v.draws++;canvas.dataset.triangles=String(model.vertices.length/27);
}
function zoomDossier(factor){dossierView.zoom=Math.max(.6,Math.min(2.5,dossierView.zoom*factor));scheduleDossierDraw();}
function initDossier(){
 if(dossierView.ready)return;dossierView.ready=true;
 $('cargoDossierBtn').onclick=()=>{refreshDossier();showModal('dossierModal',$('detailsBtn'));scheduleDossierDraw();};
 $('dossierBack').onclick=()=>{showModal('cargoModal',$('detailsBtn'));$('cargoDossierBtn').focus({preventScroll:true});};
 $('dossierSearch').oninput=()=>{dossierView.query=$('dossierSearch').value;renderDossierCatalog();};
 for(const filter of ['all','ready','grow'])$('dossierFilter-'+filter).onclick=()=>{
  dossierView.filter=filter;
  for(const key of ['all','ready','grow'])$('dossierFilter-'+key).setAttribute('aria-pressed',String(key===filter));
  renderDossierCatalog();
 };
 $('dossierPrevious').onclick=()=>changeDossierExample(-1);$('dossierNext').onclick=()=>changeDossierExample(1);
 $('dossierTurn').onclick=()=>{dossierView.yaw+=Math.PI/6;scheduleDossierDraw();};
 $('dossierZoomOut').onclick=()=>zoomDossier(1/1.2);$('dossierZoomIn').onclick=()=>zoomDossier(1.2);
 $('dossierReset').onclick=()=>{dossierView.yaw=.6;dossierView.elevation=.42;dossierView.zoom=1;scheduleDossierDraw();};
 const canvas=$('dossierCanvas');
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  dossierView.drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);canvas.focus({preventScroll:true});e.preventDefault();
 });
 canvas.addEventListener('pointermove',e=>{
  const drag=dossierView.drag;if(!drag||drag.id!==e.pointerId)return;
  const factor=Math.max(.2,menuFrameFactor($('dossierModal')));
  dossierView.yaw+=(e.clientX-drag.x)*.012/factor;
  dossierView.elevation=Math.max(-.2,Math.min(1.2,dossierView.elevation+(e.clientY-drag.y)*.008/factor));
  drag.x=e.clientX;drag.y=e.clientY;scheduleDossierDraw();
 });
 const finish=e=>{if(dossierView.drag?.id===e.pointerId)dossierView.drag=null;};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,finish);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoomDossier(Math.exp(-e.deltaY*.002));},{passive:false});
 canvas.addEventListener('keydown',e=>{
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key)){
   e.preventDefault();e.stopPropagation();
   if(e.key==='Home')$('dossierReset').onclick();
   else if(['+','=','-'].includes(e.key))zoomDossier(e.key==='-'?1/1.2:1.2);
   else if(e.key==='ArrowLeft'||e.key==='ArrowRight')dossierView.yaw+=(e.key==='ArrowLeft'?-1:1)*Math.PI/12;
   else dossierView.elevation=Math.max(-.2,Math.min(1.2,dossierView.elevation+(e.key==='ArrowUp'?.1:-.1)));
   scheduleDossierDraw();
  }
 });
 $('dossierModal').addEventListener('close',()=>{dossierView.drag=null;});
 window.addEventListener('resize',scheduleDossierDraw);window.visualViewport?.addEventListener('resize',scheduleDossierDraw);
}
