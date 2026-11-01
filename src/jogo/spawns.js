// Authored item sites. Respawns preserve their position, item type and facing.
const SPAWN_MAX_LEVEL=6,SPEED_MAX_LEVEL=8;
const SPAWN_GROUPS={litter:{name:'Lixo',types:[0],color:'#e0bd7e'},stones:{name:'Pedras',types:[1],color:'#b6c5c2'},boxes:{name:'Caixas',types:[2],color:'#cea782'},pots:{name:'Vasos',types:[3],color:'#a4bf89'}};
const SPAWN_CATALOG=[
 {id:'lixo-gramado',group:'litter',name:'Gramado',level:0,center:[150,140],radius:[110,75],seconds:[6,11],max:8,initial:6},
 {id:'lixo-alameda',group:'litter',name:'Alameda',level:0,center:[150,-30],radius:[125,48],seconds:[8,15],max:7,initial:4},
 {id:'pedras-talude-leste',group:'stones',name:'Talude leste',level:0,center:[390,260],radius:[100,78],seconds:[12,22],max:5,initial:3},
 {id:'vasos-entrada',group:'pots',name:'Passeio de entrada',level:0,line:{axis:0,from:140,to:305,side:1,step:55},seconds:[20,35],max:3,initial:3},
 {id:'caixas-recebimento',group:'boxes',name:'Recebimento',level:0,points:[[-252,-110],[-252,-154],[-252,-198],[-290,-110],[-290,-154],[-290,-198]],seconds:[18,30],max:3,initial:2},
 {id:'pedras-areal',group:'stones',name:'Areal',level:0,center:[-410,-300],radius:[100,75],seconds:[15,25],max:6,initial:3},
 {id:'lixo-bancos',group:'litter',name:'Clareira dos bancos',level:1,center:[-280,225],radius:[75,55],seconds:[7,13],max:7},
 {id:'vasos-oeste',group:'pots',name:'Passeio oeste',level:1,line:{axis:1,from:-420,to:-255,side:1,step:55},seconds:[22,36],max:3},
 {id:'pedras-encosta',group:'stones',name:'Encosta',level:2,center:[620,280],radius:[95,80],seconds:[11,20],max:7},
 {id:'caixas-manutencao',group:'boxes',name:'Manutenção',level:2,points:[[260,-270],[300,-270],[340,-270],[260,-310],[300,-310],[340,-310]],seconds:[20,32],max:3},
 {id:'lixo-areal',group:'litter',name:'Trilha do areal',level:3,center:[-490,-440],radius:[110,72],seconds:[7,14],max:8},
 {id:'vasos-leste',group:'pots',name:'Passeio leste',level:3,line:{axis:1,from:280,to:445,side:1,step:55},seconds:[22,38],max:3},
 {id:'pedras-oeste',group:'stones',name:'Encosta oeste',level:4,center:[-660,-390],radius:[95,75],seconds:[12,21],max:7},
 {id:'lixo-sul',group:'litter',name:'Alameda sul',level:4,center:[-5,545],radius:[85,95],seconds:[6,12],max:8},
 {id:'caixas-apoio',group:'boxes',name:'Apoio de jardinagem',level:5,points:[[335,590],[375,590],[335,630],[375,630],[415,590],[415,630]],seconds:[20,34],max:3},
 {id:'pedras-sul',group:'stones',name:'Barranco sul',level:5,center:[440,650],radius:[105,80],seconds:[11,19],max:8},
 {id:'vasos-norte',group:'pots',name:'Passeio norte',level:6,line:{axis:0,from:-590,to:-425,side:-1,step:55},seconds:[20,34],max:3},
 {id:'lixo-trilha-leste',group:'litter',name:'Trilha leste',level:6,center:[625,530],radius:[110,90],seconds:[6,11],max:9}
];
SPAWN_CATALOG.push(
 {id:'exp-piquenique',group:'litter',name:'Bosque de piquenique',level:0,center:[-1050,850],radius:[100,95],seconds:[10,18],max:5,initial:3},
 {id:'exp-coreto',group:'litter',name:'Clareira do coreto',level:0,center:[900,1050],radius:[105,80],seconds:[11,19],max:5,initial:3},
 {id:'exp-mirante',group:'stones',name:'Pedreiras do mirante',level:0,center:[1480,-920],radius:[130,95],seconds:[15,25],max:5,initial:3},
 {id:'exp-jardim',group:'pots',name:'Jardim das flores',level:0,points:[[-1390,-1030],[-1340,-1030],[-1290,-1030],[-1390,-980]],seconds:[24,36],max:3,initial:2},
 {id:'exp-apoio',group:'boxes',name:'Apoio do bosque',level:0,center:[-1100,1300],radius:[95,70],seconds:[24,36],max:3,initial:2},
 {id:'exp-pedras-leste',group:'stones',name:'Jardim de pedras',level:0,center:[1450,1200],radius:[120,95],seconds:[16,27],max:5,initial:3},
 {id:'exp-alameda-norte',group:'litter',name:'Alameda do bosque',level:0,center:[450,-1500],radius:[120,95],seconds:[12,21],max:4,initial:2},
 {id:'exp-jardim-sul',group:'pots',name:'Jardim sul',level:0,points:[[120,1580],[170,1580],[120,1630],[170,1630]],seconds:[25,39],max:3,initial:2}
);
const PLANTER_CURB_INSET=ASSET_METRICS[3].footprint+meters(.07);
let spawnZones=[],spawnRng=1,spawnDirty=false,spawnStepTime=0,spawnSaveTime=0,spawnHold=null,spawnClickGuard=0,spawnDebugSize='';
function spawnLevel(){return Number.isInteger(state.s)&&state.s>=0&&state.s<=SPAWN_MAX_LEVEL?state.s:0}
function spawnAreaCount(level=spawnLevel()){return SPAWN_CATALOG.filter(z=>z.level<=level).length+(worldResourcesReady?WORLD_RESOURCE_AREAS.filter(z=>z.level<=level).length:0)}
function costS(){return Math.round(150*1.45**spawnLevel())}
function speedLevel(){return Number.isInteger(state.v)&&state.v>=0&&state.v<=SPEED_MAX_LEVEL?state.v:0}
function costV(){return Math.round(110*1.35**speedLevel())}
function spawnRandom(){let x=spawnRng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;spawnRng=x>>>0||1;return spawnRng/4294967296}
function spawnDelay(z){return z.seconds[0]+spawnRandom()*(z.seconds[1]-z.seconds[0])}
function spawnSeed(id){let h=2166136261;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);return h>>>0}
// Broad phase for static obstacles. World generation only appends to these arrays;
// rebuilding a world replaces them. The exact distance tests remain unchanged.
const spawnObstacles = {
 cellSize: 128, cells: new Map(), plants: null, props: null,
 plantCount: 0, propCount: 0
};

function invalidateSpawnObstacles() {
 invalidateSceneFrame();
 invalidatePickupIndex();
 spawnObstacles.plants = null;
 spawnObstacles.props = null;
 spawnObstacles.cells.clear();
}

function nearbySpawnObstacles(x, z) {
 const index = spawnObstacles;
 if (index.plants !== environmentDetails || index.props !== worldProps ||
     index.plantCount > environmentDetails.length || index.propCount > worldProps.length) {
  index.cells.clear();
  index.plants = environmentDetails;
  index.props = worldProps;
  index.plantCount = index.propCount = 0;
 }

 const padding = (Math.max(...TYPES.map(t => t.size)) + meters(.06)) * .35;
 const insert = obstacle => {
  const radius = obstacle.radius + padding;
  const left = Math.floor((obstacle.x - radius) / index.cellSize);
  const right = Math.floor((obstacle.x + radius) / index.cellSize);
  const bottom = Math.floor((obstacle.z - radius) / index.cellSize);
  const top = Math.floor((obstacle.z + radius) / index.cellSize);
  for (let cx = left; cx <= right; cx++) for (let cz = bottom; cz <= top; cz++) {
   const key = cx + ',' + cz;
   let cell = index.cells.get(key);
   if (!cell) index.cells.set(key, cell = []);
   cell.push(obstacle);
  }
 };

 for (; index.plantCount < environmentDetails.length; index.plantCount++) {
  const p = environmentDetails[index.plantCount];
  if (!isGroundCover(p.kind)) insert({x: p.x, z: p.z, radius: p.radius, margin: .30});
 }
 for (; index.propCount < worldProps.length; index.propCount++) {
  const p = worldProps[index.propCount];
  if(p.consumed||p.resourceLocked)continue;
  const radius = p.type === 'scenery' ? p.radius : p.type === 'bench' ?
   Math.hypot(meters(1.8), meters(.66)) * .5 : p.p[2] * .045;
  insert({x: p.p[0], z: p.p[1], radius, margin: .35});
 }
 return index.cells.get(Math.floor(x / index.cellSize) + ',' + Math.floor(z / index.cellSize)) || [];
}

function spawnSlotAllowed(x,z,group){
 const types=SPAWN_GROUPS[group].types,margin=Math.max(...types.map(t=>TYPES[t].size))+meters(.06);
 if(Math.abs(x)>WORLD_PLAY_HALF-100||Math.abs(z)>WORLD_PLAY_HALF-100||stationDistanceAt(x,z)<margin)return false;
 for (const obstacle of nearbySpawnObstacles(x, z)) {
  if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + margin * obstacle.margin) return false;
 }
 if(group==='stones'&&(walkFieldAt(x,z)>-13||!['terra','areia'].includes(terrainAt(x,z))))return false;
 if(group==='boxes'&&walkFieldAt(x,z)>-23)return false;
 return true;
}
// Preserve the established vegetation clearings independently of collectible slots.
function makeVegetationReserveSlots(def){
 const result=[],seed=spawnSeed(def.id),group=SPAWN_GROUPS[def.group],add=(x,z)=>{if(spawnSlotAllowed(x,z,def.group))result.push({x,y:z,t:group.types[0],rot:0,alive:false,anim:0,spawnTime:1,zoneId:def.id,slotIndex:result.length})};
 if(def.points)for(const [x,z]of def.points)add(x,z);
 else if(def.line)for(let t=def.line.from;t<=def.line.to+.01;t+=def.line.step){const r=walkRouteAt(t,def.line.axis),side=r[0]+def.line.side*(r[1]-PLANTER_CURB_INSET);add(def.line.axis?t:side,def.line.axis?side:t)}
 else for(let i=0;i<900&&result.length<def.max*2;i++){
  const a=materialHash(seed%997+i*1.7,i+3.1)*Math.PI*2,r=Math.sqrt(materialHash(i+seed%619,21.3)),x=def.center[0]+Math.cos(a)*r*def.radius[0],z=def.center[1]+Math.sin(a)*r*def.radius[1],spacing=def.group==='stones'?24:19;
  if(result.every(o=>Math.hypot(o.x-x,o.y-z)>spacing))add(x,z);
 }
 return result;
}

// Every slot has one authored position, item and facing. No runtime reroll.
function makeSpawnSlots(def){
 const group=SPAWN_GROUPS[def.group],result=[];
 const offsets=[[-65,-38],[-12,-50],[48,-24],[-48,31],[16,42],[70,35],[-85,2],[80,-58],[-5,80]];
 const add=(x,z)=>{
  if(!spawnSlotAllowed(x,z,def.group))return;
  const vertical=walkRouteAt(z,0),horizontal=walkRouteAt(x,1);
  const rot=def.group==='boxes'?(Math.abs(x-vertical[0])<Math.abs(z-horizontal[0])?0:Math.PI/2):
   def.group==='pots'?0:materialHash(x,z)*Math.PI*2;
  result.push({x,y:z,t:group.types[0],rot,alive:false,anim:0,spawnTime:1,zoneId:def.id,slotIndex:result.length,respawnRemaining:null,fixedSpawn:true});
 };
 if(def.points)for(const [x,z]of def.points)add(x,z);
 else if(def.line)for(let t=def.line.from;t<=def.line.to+.01;t+=def.line.step){
  const r=walkRouteAt(t,def.line.axis),side=r[0]+def.line.side*(r[1]-PLANTER_CURB_INSET);
  add(def.line.axis?t:side,def.line.axis?side:t);
 }
 else for(const [x,z]of offsets.slice(0,def.max))add(def.center[0]+x,def.center[1]+z);
 return result;
}
function spawnZoneOutline(z){
 if(z.center)return Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return [z.center[0]+Math.cos(a)*z.radius[0],z.center[1]+Math.sin(a)*z.radius[1]]});
 if(z.line){const l=z.line,a=[],b=[];for(let i=0;i<=20;i++){const t=l.from-20+(l.to-l.from+40)*i/20,r=walkRouteAt(t,l.axis),center=r[0]+l.side*(r[1]-PLANTER_CURB_INSET);a.push(l.axis?[t,center-20]:[center-20,t]);b.push(l.axis?[t,center+20]:[center+20,t])}return a.concat(b.reverse())}
 const x=z.points.map(p=>p[0]),y=z.points.map(p=>p[1]),loX=Math.min(...x)-20,hiX=Math.max(...x)+20,loZ=Math.min(...y)-20,hiZ=Math.max(...y)+20;return [[loX,loZ],[hiX,loZ],[hiX,hiZ],[loX,hiZ]];
}
function canSpawnNow(o){
 if(Math.hypot(o.x-player.x,o.y-player.y)<=physicalRadius()+TYPES[o.t].size+SPAWN_CLEARANCE)return false;
 return !objects.some(p=>p!==o&&p.alive&&Math.hypot(p.x-o.x,p.y-o.y)<
  (p.worldProp?.type==='tree'?meters(.15):pickupSize(p))+TYPES[o.t].size+meters(.045));
}
function spawnOne(z,initial=false){
 const o=z.slots.find(o=>!o.alive&&(initial||o.respawnRemaining===0)&&canSpawnNow(o));
 if(!z.active||!o)return false;
 o.alive=true;o.anim=0;o.spawnTime=initial?1:0;o.respawnRemaining=null;z.count++;spawnDirty=true;return true;
}
function fixedSpawnDelay(z){return (z.seconds[0]+z.seconds[1])*.5*regrowthMultiplier();}
function initializeSpawns(){
 state.s=spawnLevel();const saved=state.spawnWorld,restore=[1,2].includes(saved?.version)&&Array.isArray(saved.zones);
 spawnRng=restore&&Number.isInteger(saved.rng)?saved.rng:61;objects=[];spawnStepTime=spawnSaveTime=0;
 spawnZones=SPAWN_CATALOG.map(def=>{
  const slots=makeSpawnSlots(def),z={...def,slots,max:slots.length,active:def.level<=state.s,count:0,remaining:null,blocked:false};
  z.outline=spawnZoneOutline(def);objects.push(...slots);return z;
 });
 for(const z of spawnZones){
  const record=restore?saved.zones.find(s=>s?.id===z.id):null;
  if(z.active&&record&&Array.isArray(record.objects))for(const item of record.objects){
   const o=z.slots[item.slot]&&!z.slots[item.slot].alive?z.slots[item.slot]:z.slots.find(o=>!o.alive);
   if(!o)break;o.alive=true;o.spawnTime=1;z.count++;
  }
  if(z.active&&!record)for(let i=0;i<Math.min(z.initial||0,z.max);i++)spawnOne(z,true);
  for(const o of z.slots)if(!o.alive){
   const old=record?.slots?.find(s=>s.slot===o.slotIndex);
   o.respawnRemaining=Number.isFinite(old?.remaining)&&old.remaining>=0?Math.min(7200,old.remaining):
    Number.isFinite(record?.remaining)&&record.remaining>=0?record.remaining:fixedSpawnDelay(z)*(1+o.slotIndex*.15);
  }
  z.remaining=z.slots.some(o=>!o.alive)?Math.min(...z.slots.filter(o=>!o.alive).map(o=>o.respawnRemaining)):null;
 }
 spawnDirty=true;syncSpawnDebugUI();
}
function unlockSpawnAreas(){
 unlockWorldResourceAreas();for(const z of spawnZones)if(!z.active&&z.level<=spawnLevel()){
  z.active=true;for(const o of z.slots)if(!o.alive)o.respawnRemaining=fixedSpawnDelay(z);z.blocked=false;
 }spawnDirty=true;
}
function rescaleSpawnTimers(factor,includeWorld=true){for(const o of objects)if((includeWorld||!o.worldProp)&&Number.isFinite(o.respawnRemaining))o.respawnRemaining*=factor;}
function notifySpawnCollected(o){
 const z=spawnZones.find(z=>z.id===o.zoneId);if(!z)return;
 z.count=Math.max(0,z.count-1);o.respawnRemaining=fixedSpawnDelay(z);z.remaining=o.respawnRemaining;z.blocked=false;spawnDirty=true;
}
function tickSpawns(dt){
 tickWorldResourceSpawns(dt);spawnStepTime+=dt;spawnSaveTime+=dt;
 if(spawnSaveTime>=5)spawnDirty=true;if(spawnStepTime<.2)return;
 const elapsed=spawnStepTime;spawnStepTime=0;
 for(const z of spawnZones){
  if(!z.active)continue;z.blocked=false;
  for(const o of z.slots)if(!o.alive){
   o.respawnRemaining=Math.max(0,(o.respawnRemaining??fixedSpawnDelay(z))-elapsed);
   if(o.respawnRemaining===0){
    if(canSpawnNow(o)){o.alive=true;o.anim=0;o.spawnTime=0;o.respawnRemaining=null;spawnDirty=true;}
    else z.blocked=true;
   }
  }
  z.count=z.slots.filter(o=>o.alive).length;
  z.remaining=z.count<z.max?Math.min(...z.slots.filter(o=>!o.alive).map(o=>o.respawnRemaining)):null;
 }
}
function saveSpawnWorld(){
 if(!spawnZones.length)return;state.s=spawnLevel();
 state.spawnWorld={version:2,rng:spawnRng,zones:spawnZones.map(z=>({id:z.id,remaining:z.remaining,
  objects:z.slots.filter(o=>o.alive).map(o=>({slot:o.slotIndex,t:o.t,rot:o.rot})),
  slots:z.slots.map(o=>({slot:o.slotIndex,remaining:o.respawnRemaining}))}))};
 spawnDirty=false;spawnSaveTime=0;
}
function spawnPointCount(level=spawnLevel()){
 return spawnZones.filter(z=>z.level<=level).reduce((n,z)=>n+z.slots.length,0)+worldResourceObjects.filter(o=>(o.worldProp.spawnLevel||0)<=level).length;
}
