// Expanded park: shared prop templates, clustered planting, a distant forest belt.
const WORLD_PLAY_HALF=2300,WORLD_GROUND_HALF=14000,PARK_WORLD_SEED=713;
const OUTER_WALK={x:-40,z:-40,rx:1700,rz:1500,width:30};
const PARK_DISTRICTS=[
 {id:'coreto',x:1120,z:1050,kind:'gazebo',radius:130},
 {id:'jardim',x:-1180,z:-1180,kind:'pergola',radius:125},
 {id:'piquenique',x:-1250,z:800,kind:'picnic',radius:115},
 {id:'mirante',x:1330,z:-1150,kind:'lookout',radius:120}
];
let parkBackdrop=null;const parkPropMeshes=new Map();
// Compatibility wrappers share this drain; the loader advances the same builders
// a few steps per frame instead of blocking until the whole park is finished.
function finishWorldPreparation(iterator) {
 let step;
 while (!(step = iterator.next()).done) { /* Synchronous compatibility path. */ }
 return step.value;
}
function outerWalkFieldAt(x,z){const dx=x+40,dz=z+40,q=Math.hypot(dx/1700,dz/1500),g=Math.hypot(dx/2890000,dz/2250000);return 30-Math.abs(q-1)*q/Math.max(g,.000001)}
function paveColorAt(x,z){
 if(Math.max(Math.abs(x),Math.abs(z))<900)return paveCoreColorAt(x,z);
 const outer=outerWalkFieldAt(x,z),inner=roundedWalkUnion(primaryWalkFieldAt(x,z),meadowWalkFieldAt(x,z),24),t=smoothRange(-12,12,outer-inner);
 if(t<.001)return paveCoreColorAt(x,z);
 const dx=x+40,dz=z+40,q=Math.hypot(dx/1700,dz/1500),g=Math.max(Math.hypot(dx/2890000,dz/2250000),.000001),col=paveSlabJS(Math.atan2(dz/1500,dx/1700)*1600,(q-1)*q/g,x,z,24,58,109);
 if(t>.999)return col;const a=paveCoreColorAt(x,z);return a.map((v,i)=>v+(col[i]-v)*t);
}
function makeParkProp(kind,variant=0){
 if(kind==='barrel'||kind==='pallet'||kind==='crate'||kind==='gardenpot'||kind==='logpile')return makeResourceProp(kind,variant);
 const b=new ModelBuilder(),wood=[.43,.32,.21],lightWood=[.59,.46,.29],iron=[.20,.27,.23],stone=[.52,.55,.46],cream=[.70,.70,.59],green=[.23,.37,.24];
 const box=(x,y,z,w,h,d,c=wood)=>b.box(x,y,z,w,h,d,c,0,Math.min(.6,h*.1));
 if(kind==='lamp'){
  box(0,0,0,16,5,16,stone);box(0,5,0,5,130,5,iron);box(0,128,0,23,4,23,iron);box(0,132,0,17,20,17,[.76,.72,.49]);box(0,152,0,24,4,24,iron);
  for(const x of [-9,9])for(const z of [-9,9])box(x,131,z,2,23,2,iron);
 }else if(kind==='bin'){
  b.lathe([[0,0],[13,0],[15,3],[15,35],[16,37],[14,40],[11,40],[11,35]],green,0,12);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;box(Math.cos(a)*15,5,Math.sin(a)*15,2,28,2,iron)}
  box(0,40,-5,27,3,17,iron);
 }else if(kind==='sign'){
  // A framed panel clamped to its post. The arrow shares the panel center
  // and uses one continuous extrusion with no loose joints.
  box(0,0,-3.5,11,3,10,stone);
  box(0,3,-3.5,6.4,6,6.4,iron);
  box(0,4,-3.5,5,89,5,wood);
  box(0,92.8,-3.5,6.4,1.4,6.4,iron);
  box(0,67.5,0,64,28,4.8,lightWood);
  for(const y of [72,89])box(0,y,-3.25,13,2.2,2,iron);
  const arrow=[[-18,-2.25],[7,-2.25],[7,-7],[19,0],[7,7],[7,2.25],[-18,2.25]];
  for(const side of [-1,1]){
   box(0,70.5,side*2.6,58,22,.4,green);
   if(side>0){
    // A fan from the shaft/head junction stays inside this concave outline.
    const center=[7,81.5,3.2],back=2.78,front=3.2;
    for(let i=0;i<arrow.length;i++){
     const p=arrow[i],q=arrow[(i+1)%arrow.length];
     const P=[p[0],81.5+p[1],front],Q=[q[0],81.5+q[1],front];
     b.tri(center,P,Q,cream,0,[0,0,1]);
     b.quad([p[0],81.5+p[1],back],P,Q,[q[0],81.5+q[1],back],modelColor(cream,.87));
    }
   }
   for(const x of [-27,27])for(const y of [73.05,89.05])
    box(x,y,side*2.9,.9,.9,.2,iron);
  }
 }else if(kind==='picnic'){
  for(const x of [-39,39]){box(x,0,0,7,44,7);b.tube([[x,0,-32],[x,41,0],[x,0,32]],3.2,wood,0,4)}
  for(let i=0;i<6;i++)box(0,43,-20+i*8,110,4,7,lightWood);
  for(const side of [-1,1])for(let i=0;i<2;i++)box(0,23,side*(33+i*7),114,4,6,lightWood);
  for(const x of [-39,39])box(x,20,0,6,5,92,wood);
 }else if(kind==='gazebo'){
  b.lathe([[0,0],[91,0],[94,6],[92,10],[0,10]],stone,0,8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*76,z=Math.sin(a)*76;box(x,10,z,6,123,6);if(i%2===0){const c=a+Math.PI/4;b.tube([[x,45,z],[Math.cos(c)*76,45,Math.sin(c)*76]],2,wood,0,4)}}
  b.lathe([[0,182],[32,174],[101,133],[101,129],[82,129],[0,164]],[.25,.36,.27],0,8);
  b.lathe([[0,178],[5,178],[5,193],[0,193]],iron,0,8);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;box(Math.cos(a)*59,27,Math.sin(a)*59,38,4,16,lightWood)}
 }else if(kind==='pergola'){
  for(const x of [-80,80])for(const z of [-58,58])box(x,0,z,6,139,6);
  for(const z of [-65,65])box(0,135,z,183,8,6);
  for(let i=0;i<8;i++)box(-84+i*24,143,0,5,7,154,lightWood);
  for(const x of [-96,96]){box(x,0,0,21,21,123,[.54,.36,.24]);box(x,21,0,24,4,125,cream);box(x,24,0,17,4,115,[.29,.23,.16]);for(let j=0;j<5;j++)b.blob([x,34,-47+j*24],[13,17,16],j+variant,[.28,.43,.25],3,0)}
 }else if(kind==='lookout'){
  for(let j=0;j<12;j++)box(0,4,-69+j*12,176,5,11,lightWood);
  for(const x of [-84,84])for(const z of [-72,0,72])box(x,0,z,7,57,7);
  for(const x of [-84,84]){box(x,33,0,5,4,150);box(x,56,0,6,5,154)}
  box(0,56,-72,172,5,6);box(0,33,-72,172,4,5);
 }else if(kind==='fountain'){
  b.lathe([[0,0],[61,0],[64,5],[64,15],[58,19],[53,19],[53,7],[0,7]],stone,0,24);
  b.lathe([[0,8],[52,8],[52,9],[0,9]],[.28,.49,.46],1,28);
  b.lathe([[0,7],[12,7],[9,44],[27,47],[28,51],[24,55],[5,55],[4,74],[0,78]],cream,0,16);
  b.lathe([[0,52],[23,52],[0,52.4]],[.39,.60,.56],1,20);
 }else if(kind==='flowerbed'){
  const soil=[.29,.23,.15],petals=[[.78,.50,.57],[.88,.72,.39],[.68,.61,.80],[.83,.82,.65]][variant%4];
  box(0,0,-25,100,14,4,wood);box(0,0,25,100,14,4,wood);box(-48,0,0,4,14,46,wood);box(48,0,0,4,14,46,wood);box(0,0,0,92,10,46,soil);
  for(let j=0;j<3;j++)for(let i=0;i<5;i++){const x=-36+i*18,z=-16+j*16,y=23+3*Math.sin(i*1.7+j+variant);b.tube([[x,10,z],[x+2,y,z+1]],.85,green,3,4);b.blob([x+2,y,z+1],[4,2.8,4],i+j+variant,petals,0,0);b.tri([x,17,z],[x+7,19,z+2],[x+2,20,z+4],green,3)}
 }else if(kind==='boulder'){
  b.blob([0,16,0],[27+variant*3,23,24],variant+9,stone,0,1,true);
 }else if(kind==='log'){
  b.tube([[-51,10,0],[51,10,0]],[11,10],wood,0,9);b.tube([[-52,10,0],[-51,10,0]],9,[.65,.51,.32],0,9);
 }
 return b.bake();
}
function drawParkProp(p,offset=0,shrink=1){const key=p.kind+':'+(p.variant||0);let m=parkPropMeshes.get(key);if(!m){m=makeParkProp(p.kind,p.variant||0);parkPropMeshes.set(key,m)}const scale=(p.visualScale||1)*shrink;drawMesh(m,p.p[0],terrainElevationAt(p.p[0],p.p[1])+offset,p.p[1],scale*(p.stretch?.[0]||1),scale*(p.stretch?.[1]||1),scale*(p.stretch?.[2]||1),[1,1,1],14,p.rotation||0)}
// Continuous, deterministic planting across the expanded playable park.
function isGroundCover(kind){return kind==='groundcover'||kind==='meadow'||kind==='litter'}
function populateOuterVegetation(seed,reserved) {
 return finishWorldPreparation(populateOuterVegetationIncremental(seed,reserved));
}

function* populateOuterVegetationIncremental(seed,reserved){
 const rnd=k=>materialHash(k+seed*.173,62.41),span=128,occupied=new Map(),obstacles=new Map(),slots=new Map();
 const key=(x,z)=>Math.floor(x/span)+','+Math.floor(z/span);
 const put=(map,x,z,value)=>{const k=key(x,z);if(!map.has(k))map.set(k,[]);map.get(k).push(value)};
 const nearby=(map,x,z,r,blocked)=>{
  for(let iz=Math.floor((z-r)/span);iz<=Math.floor((z+r)/span);iz++)for(let ix=Math.floor((x-r)/span);ix<=Math.floor((x+r)/span);ix++)
   for(const p of map.get(ix+','+iz)||[])if(blocked(p))return true;
  return false;
 };
 let indexed = 0, planted = 0;
 for(const p of environmentDetails) {
  if(!isGroundCover(p.kind))put(occupied,p.x,p.z,p);
  if (++indexed % 128 === 0) yield {stage:'outer-index',label:'Organizando a vegetação'};
 }
 for(const p of worldProps){
  const r=p.type==='tree'?8:p.type==='scenery'?p.radius:48;
  put(obstacles,p.p[0],p.p[1],{x:p.p[0],z:p.p[1],r});
  if (++indexed % 128 === 0) yield {stage:'outer-index',label:'Organizando os obstáculos'};
 }
 for(const p of reserved){
  put(slots,p.x,p.y,{x:p.x,z:p.y,r:TYPES[p.t].size+14});
  if (++indexed % 128 === 0) yield {stage:'outer-index',label:'Organizando as áreas de coleta'};
 }
 const add=(x,z,kind,k,scale=1)=>{
  if(Math.max(Math.abs(x),Math.abs(z))<830||Math.abs(x)>WORLD_PLAY_HALF-45||Math.abs(z)>WORLD_PLAY_HALF-45)return false;
  const profile=PLANT_PROFILES[kind],size=meters(profile.height[0]+rnd(k+11)*(profile.height[1]-profile.height[0]))*scale;
  const low=isGroundCover(kind),nominal=size*profile.radius,distance=-walkFieldAt(x,z),spread=low?Math.min(1,(distance-6)/nominal):1,radius=nominal*spread;
  if(radius<4||distance<radius+5||stationDistanceAt(x,z)<radius+10)return false;
  const terrain=terrainAt(x,z);
  if(terrain==='pedra'||terrain==='areia'&&(!['tuft','grass','litter'].includes(kind)||rnd(k+12)>.28))return false;
  if(nearby(obstacles,x,z,radius+140,p=>Math.hypot(x-p.x,z-p.z)<radius+p.r))return false;
  if(!low&&nearby(slots,x,z,radius+60,p=>Math.hypot(x-p.x,z-p.z)<radius+p.r))return false;
  if(!low&&nearby(occupied,x,z,radius+65,p=>Math.hypot(x-p.x,z-p.z)<(radius+p.radius)*.44))return false;
  const p={x,z,size,radius,spread,kind,seed:k,variant:Math.floor(rnd(k+13)*PLANT_VARIANTS),rotation:rnd(k+14)*Math.PI*2,outer:true};
  environmentDetails.push(p);if(!low)put(occupied,x,z,p);return true;
 };
 // Overlapping low colonies fill every lawn, rather than isolated points near landmarks.
 for(let iz=-43;iz<=43;iz++)for(let ix=-43;ix<=43;ix++){
  if (++planted % 32 === 0) yield {stage:'outer-meadow',label:'Preparando os gramados',completed:planted,total:87*87};
  const k=(iz+44)*97+ix+44+31000,x=ix*52+(rnd(k)-.5)*18,z=iz*52+(rnd(k+1)-.5)*18;
  add(x,z,'meadow',k,.94+coherentNoise(x*.006,z*.006)*.2);
 }
 // Irregular taller islands sit on top of the continuous floor.
 for(let iz=-33;iz<=33;iz++)for(let ix=-33;ix<=33;ix++){
  if (++planted % 32 === 0) yield {stage:'outer-islands',label:'Preparando as plantas'};
  const k=(iz+34)*79+ix+34+43000,x=ix*67+(rnd(k)-.5)*40,z=iz*67+(rnd(k+1)-.5)*40;
  const moisture=coherentNoise(x*.008+7,z*.008-12),pick=rnd(k+2);
  if(pick>.45+moisture*.40)continue;
  const kind=pick<.28?'tuft':pick<.48?'grass':pick<.60?'broadleaf':pick<.68?'flower':'fern';
  add(x,z,kind,k,.70+rnd(k+3)*.35);
 }
 // Leaves and shade plants anchor the forest floor to its trees.
 const trees=worldProps.filter(p=>p.type==='tree'&&Math.max(Math.abs(p.p[0]),Math.abs(p.p[1]))>830);
 for(const [i,t]of trees.entries())for(let j=0;j<16;j++){
  if (++planted % 32 === 0) yield {stage:'outer-understory',label:'Preparando a vegetação dos bosques'};
  const k=58000+i*31+j,a=rnd(k)*Math.PI*2,r=25+Math.sqrt(rnd(k+1))*115,x=t.p[0]+Math.cos(a)*r,z=t.p[1]+Math.sin(a)*r;
  add(x,z,j<9?'litter':j<12?'fern':j<14?'broadleaf':'shrub',k,j<9?1.15:.78+rnd(k+2)*.3);
 }
 // Thick but discontinuous verges follow the complete outer circuit.
 for(let i=0;i<410;i++)for(const side of [-1,1]){
  if (++planted % 32 === 0) yield {stage:'outer-verges',label:'Preparando as margens dos caminhos'};
  const k=65000+i*3+(side+1)/2,a=i/410*Math.PI*2,nx=Math.cos(a)/1700,nz=Math.sin(a)/1500,L=Math.hypot(nx,nz),offset=side*(46+rnd(k)*28);
  add(-40+1700*Math.cos(a)+nx/L*offset,-40+1500*Math.sin(a)+nz/L*offset,i%5===0?'flower':i%3===0?'grass':'tuft',k,.75+rnd(k+1)*.2);
 }
}

function makeFloorPlantModel(b,kind,variant,detail){
 const rnd=k=>materialHash(k+variant*71.3,54.8),dry=kind==='litter';
 const green=[[.27,.54,.22],[.40,.61,.27],[.22,.50,.28],[.42,.58,.24],[.27,.56,.31],[.36,.53,.22]][variant];
 const colors=[[.52,.31,.16],[.64,.41,.20],[.59,.46,.24],[.39,.43,.20],[.70,.45,.23],[.50,.35,.18]];
 // Low-poly creased leaves: the same footprint in both LODs, curved tips up close.
 for(let i=0;i<(dry?10:20);i++){
  const x=(rnd(i*7)-.5)*1.8,z=(rnd(i*7+1)-.5)*1.8,a=rnd(i*7+2)*Math.PI*2,c=Math.cos(a),s=Math.sin(a),length=(dry?.28:.34)+rnd(i*7+3)*.22,w=length*(dry?.27:.31),y=.035+rnd(i*7+4)*.05;
  const point=(t,side=0,h=0)=>[x+c*length*t-s*side,y+Math.sin(t*Math.PI)*.035+h,z+s*length*t+c*side];
  const base=point(0),tip=point(1,0,detail?.025:0),left=point(.44,w),right=point(.44,-w),ridge=point(.46,0,dry?.025:.065),col=modelColor(dry?colors[Math.floor(rnd(i+130)*6)]:green,.88+rnd(i+90)*.22);
  b.tri(base,left,ridge,col,3);b.tri(base,ridge,right,modelColor(col,.92),3);
  if(detail){const end=point(.82,0,dry?.035:.055);b.tri(left,end,ridge,col,3);b.tri(right,ridge,end,modelColor(col,.92),3);b.tri(left,tip,end,col,3);b.tri(right,end,tip,modelColor(col,.92),3)}
  else{b.tri(left,tip,ridge,col,3);b.tri(right,ridge,tip,modelColor(col,.92),3)}
 }
}

function populateParkTrees(seed=PARK_WORLD_SEED) {
 return finishWorldPreparation(populateParkTreesIncremental(seed));
}

function* populateParkTreesIncremental(seed=PARK_WORLD_SEED){
 const rnd=k=>materialHash(k+seed*.271,81.19),reserved=[];
 for (const def of SPAWN_CATALOG) {
  reserved.push(...makeVegetationReserveSlots(def));
  yield {stage:'tree-clearings',label:'Preparando os espaços dos bosques'};
 }
 const existing=worldProps.filter(p=>p.type==='tree'),props=worldProps.filter(p=>p.type!=='tree');
 const newTrees=[],add=(x,z,k,young=false)=>{
  if(newTrees.length>=340||Math.max(Math.abs(x),Math.abs(z))<900||Math.abs(x)>WORLD_PLAY_HALF-110||Math.abs(z)>WORLD_PLAY_HALF-110)return false;
  if(walkFieldAt(x,z)>-34||stationDistanceAt(x,z)<140)return false;
  if(terrainAt(x,z)==='areia'&&rnd(k+19)>.20)return false;
  if(PARK_DISTRICTS.some(d=>Math.hypot(x-d.x,z-d.z)<d.radius+85))return false;
  if(props.some(p=>Math.hypot(x-p.p[0],z-p.p[1])<(p.type==='scenery'?p.radius:48)+48))return false;
  if(reserved.some(p=>Math.hypot(x-p.x,z-p.y)<TYPES[p.t].size+31))return false;
  const spacing=young?102:137+rnd(k+21)*28;
  if(existing.some(p=>Math.hypot(x-p.p[0],z-p.p[1])<spacing))return false;
  const pick=rnd(k+22),variant=young?6+Math.floor(rnd(k+23)*2):pick<.38?12+Math.floor(rnd(k+23)*2):pick<.66?8+Math.floor(rnd(k+23)*2):pick<.87?10+Math.floor(rnd(k+23)*2):Math.floor(rnd(k+23)*6);
  const height=meters(young?2.5+rnd(k+24)*1.2:4.1+rnd(k+24)*2.9);
  const p={id:'outer-tree-bosque-'+newTrees.length,type:'tree',p:[x,z,height,variant],futurePickup:true,age:young?'young':'mature'};
  worldProps.push(p);existing.push(p);newTrees.push(p);return true;
 };
 // Groves occupy the open outer lawns, with younger trees at their irregular edges.
 const groves=[[-1120,-390],[-1040,430],[1030,410],[1080,-460],[-470,1100],[450,1120],[-450,-1110],[420,-1130],[-1840,-1660],[-1890,-750],[-1900,220],[-1800,1120],[-1350,1780],[-480,1840],[470,1850],[1390,1770],[1880,1030],[1890,120],[1830,-730],[1760,-1650],[840,-1880],[-240,-1850],[-1150,-1810],[-1950,1820],[1970,1850]];
 let attempted = 0;
 for(const [g,c]of groves.entries())for(let j=0;j<40;j++){
  if (++attempted % 32 === 0) yield {stage:'park-groves',label:'Preparando os bosques'};
  const k=71000+g*61+j,a=rnd(k)*Math.PI*2,r=Math.sqrt(rnd(k+1))*290;
  add(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,k,j%7===0);
 }
 // Smaller groups connect the groves without turning the whole park into a closed canopy.
 for(let iz=-11;iz<=11;iz++)for(let ix=-11;ix<=11;ix++){
  if (++attempted % 32 === 0) yield {stage:'park-tree-groups',label:'Preparando as árvores'};
  const k=76000+(iz+12)*31+ix+12,x=ix*187+(rnd(k)-.5)*120,z=iz*187+(rnd(k+1)-.5)*120;
  if(rnd(k+2)<.75)add(x,z,k,rnd(k+3)<.24);
 }
 return newTrees;
}

function extendParkLayout(seed=PARK_WORLD_SEED) {
 return finishWorldPreparation(extendParkLayoutIncremental(seed));
}

function* extendParkLayoutIncremental(seed=PARK_WORLD_SEED){
 const rnd=k=>materialHash(k+(seed+.37),93.71),props=[],protectedPoints=SPAWN_CATALOG.flatMap(d=>d.points||[]);
 const add=(kind,x,z,rotation=0,variant=0)=>{const dims={gazebo:[135,193],pergola:[133,150],picnic:[90,48],lookout:[125,61],lamp:[18,158],bin:[22,42],sign:[35,98],fountain:[68,80],flowerbed:[57,32],boulder:[43,42],log:[60,24]},d=dims[kind];if(protectedPoints.some(p=>Math.hypot(x-p[0],z-p[1])<d[0]+22))return null;const p={id:'park-'+kind+'-'+props.length,type:'scenery',kind,p:[x,z,d[1]],radius:d[0],rotation,variant};props.push(p);worldProps.push(p);return p};
 for(const d of PARK_DISTRICTS){
  add(d.kind,d.x,d.z,d.kind==='picnic'?.3:0);
  yield {stage:'park-districts',label:'Preparando as áreas do parque'};
 }
 add('picnic',-1425,930,-.4);add('picnic',-1130,1010,.15);add('bin',-1360,700);add('bin',1240,920);
 add('fountain',110,1180);add('sign',65,830,.15);add('sign',-855,35,-Math.PI/2);add('sign',920,40,Math.PI/2);add('sign',35,-900,Math.PI);
 for(const [i,p]of [[-1320,-1390],[-1440,-1270],[-1110,-1470],[-1510,-1140],[1230,890],[1050,820]].entries()){
  add('flowerbed',p[0],p[1],i%2?.3:-.25,i%4);
  yield {stage:'park-flowers',label:'Preparando os canteiros'};
 }
 for(let axis=0;axis<2;axis++)for(const t of [-1870,-1360,-900,900,1390,1880]){
  const a=Array.from(walkRouteAt(t,axis)),side=(Math.floor(t/400)%2?1:-1),v=a[0]+side*(a[1]+14);
  add('lamp',axis?t:v,axis?v:t);
  yield {stage:'park-lamps',label:'Preparando os detalhes do parque'};
 }
 for(const [i,a]of [.27,.83,1.45,2.1,2.8,3.7,4.35,5.3].entries()){
  const x=-40+1700*Math.cos(a),z=-40+1500*Math.sin(a),nx=Math.cos(a)/1700,nz=Math.sin(a)/1500,L=Math.hypot(nx,nz),bx=x+nx/L*69,bz=z+nz/L*69;
  worldProps.push({id:'outer-bench-'+i,type:'bench',p:[bx,bz],rotation:Math.atan2(x-bx,z-bz),variant:i%3,futurePickup:true,footprint:[meters(1.8),meters(.66)]});
  yield {stage:'park-benches',label:'Preparando os bancos'};
 }
 for(let i=0;i<25;i++){
  const d=PARK_DISTRICTS[i%4],a=rnd(i+20)*6.283,r=d.radius+35+rnd(i+21)*75;
  add(i%5===0?'log':'boulder',d.x+Math.cos(a)*r,d.z+Math.sin(a)*r,rnd(i+22)*6.283,i%3);
  if (i%8===7) yield {stage:'park-props',label:'Preparando os objetos do parque'};
 }
 const reserved=[];
 for (const def of SPAWN_CATALOG) {
  reserved.push(...makeVegetationReserveSlots(def));
  yield {stage:'park-clearings',label:'Preparando as áreas de coleta'};
 }
 const clear=(x,z,r)=>Math.abs(x)<WORLD_PLAY_HALF-75&&Math.abs(z)<WORLD_PLAY_HALF-75&&walkFieldAt(x,z)<-r-7&&props.every(p=>Math.hypot(x-p.p[0],z-p.p[1])>p.radius+r)&&reserved.every(p=>Math.hypot(x-p.x,z-p.y)>r+TYPES[p.t].size+6);
 const clusters=[[-1400,-1450],[-1750,-550],[-1530,470],[-800,1580],[650,1630],[1640,550],[1580,-850],[610,-1600],[-620,-1640],[1870,1240],[-1830,1360],[1860,-1420]];
 const trees=[];
 let attempted = 0;
 for(const [g,c]of clusters.entries())for(let j=0;j<12;j++){
  if (++attempted % 16 === 0) yield {stage:'park-clusters',label:'Preparando os grupos de árvores'};
  const k=g*53+j,a=rnd(k+400)*6.283,r=Math.sqrt(rnd(k+401))*235,x=c[0]+Math.cos(a)*r,z=c[1]+Math.sin(a)*r,h=meters(3.5+rnd(k+402)*3.2);
  if(!clear(x,z,32)||worldProps.some(p=>Math.hypot(x-p.p[0],z-p.p[1])<(p.type==='tree'?90:65)))continue;
  const p={id:'outer-tree-'+g+'-'+j,type:'tree',p:[x,z,h,(g+j)%TREE_VARIANTS],futurePickup:true,age:'mature'};worldProps.push(p);trees.push(p);
 }
 const plant=(x,z,kind,key,scale=1)=>{
  if(Math.max(Math.abs(x),Math.abs(z))<870)return;
  const profile=PLANT_PROFILES[kind],size=meters(profile.height[0]+rnd(key+801)*(profile.height[1]-profile.height[0]))*scale,radius=size*profile.radius;
  if(!clear(x,z,kind==='groundcover'?radius*.6:radius)||terrainAt(x,z)!=='grama')return;
  if(kind!=='groundcover'&&environmentDetails.some(p=>Math.hypot(x-p.x,z-p.z)<(p.radius+radius)*.4))return;
  environmentDetails.push({x,z,size,radius,spread:1,kind,seed:key,variant:Math.floor(rnd(key+91)*PLANT_VARIANTS),rotation:rnd(key+92)*6.283,outer:true});
 };
 for(const [i,t]of trees.entries())for(let j=0;j<6;j++){
  const a=rnd(i*11+j+2000)*6.283,r=30+rnd(i*11+j+2001)*70;
  plant(t.p[0]+Math.cos(a)*r,t.p[1]+Math.sin(a)*r,['fern','groundcover','broadleaf','tuft','shrub','grass'][j],i*13+j+3000);
  if (++attempted % 16 === 0) yield {stage:'park-understory',label:'Preparando as plantas dos bosques'};
 }
 for(let g=0;g<4;g++){
  const d=PARK_DISTRICTS[g];
  for(let j=0;j<90;j++){
   const k=g*101+j,a=rnd(k+7000)*6.283,r=d.radius+25+rnd(k+7001)*150;
   plant(d.x+Math.cos(a)*r,d.z+Math.sin(a)*r,j%3?'flower':'groundcover',k+8000,.9);
   if (++attempted % 16 === 0) yield {stage:'park-gardens',label:'Preparando os jardins'};
  }
 }
 for(let i=0;i<(gl.isSoftware?280:850);i++){
  const x=(rnd(i+11000)-.5)*4400,z=(rnd(i+13000)-.5)*4400;
  plant(x,z,i%4?'tuft':'groundcover',i+15000);
  if (++attempted % 16 === 0) yield {stage:'park-outer-plants',label:'Preparando a vegetação externa'};
 }
 yield* populateOuterVegetationIncremental(seed,reserved);
 yield* populateParkTreesIncremental(seed);
 vegetationClearings=reserved.map(p=>({x:p.x,z:p.y,r:TYPES[p.t].size+meters(.025)}));
}
function buildParkBackdrop(seed=PARK_WORLD_SEED) {
 return finishWorldPreparation(buildParkBackdropIncremental(seed));
}

function* buildParkBackdropIncremental(seed=PARK_WORLD_SEED){
 const data=[],rnd=k=>materialHash(k+119.7+(seed-713)*.131,72.19),emit=(a,b,c,color)=>data.push(...triangle(a,b,c,[color[0],color[1],color[2]+6]));
 // Layered rolling ridges begin outside the playable footprint, not a vertical map wall.
 const count=gl.isSoftware?64:128;
 for(let band=0;band<2;band++){
  const rows=[];
  for(let r=0;r<4;r++){
   const row=[];
   for(let i=0;i<=count;i++){
    const a=i/count*Math.PI*2,c=Math.cos(a),s=Math.sin(a),edge=(WORLD_PLAY_HALF+260+band*720)/Math.max(Math.abs(c),Math.abs(s)),distance=edge+r*420,noise=.55+.22*Math.sin(a*5.0+band)+.14*Math.cos(a*9.0-1),h=r===0?0:r===3?150+band*70:(250+band*220)*noise*(r===2?1.2:1);
    row.push([c*distance,h,s*distance]);
    if (i%32===31) yield {stage:'backdrop-ridges',label:'Preparando a paisagem distante'};
   }
   rows.push(row);
  }
  for(let r=0;r<3;r++)for(let i=0;i<count;i++){
   const col=band?[.31,.43,.34]:[.29,.40,.25];
   emit(rows[r][i],rows[r+1][i+1],rows[r+1][i],col);
   emit(rows[r][i],rows[r][i+1],rows[r+1][i+1],col);
   if (i%32===31) yield {stage:'backdrop-ridges',label:'Preparando a paisagem distante'};
  }
 }
 const n=gl.isSoftware?44:280;
 for(let i=0;i<n;i++){
  const a=i/n*Math.PI*2+(rnd(i)-.5)*.014,c=Math.cos(a),s=Math.sin(a),edge=(WORLD_PLAY_HALF+180+rnd(i+1)*460)/Math.max(Math.abs(c),Math.abs(s)),x=c*edge,z=s*edge,h=210+rnd(i+2)*190,w=h*(.24+rnd(i+4)*.07),rot=rnd(i+8)*6.283;
  const local=(X,Y,Z)=>[x+Math.cos(rot)*X+Math.sin(rot)*Z,Y,z-Math.sin(rot)*X+Math.cos(rot)*Z];
  for(let j=0;j<6;j++){const u=j/6*6.283,v=(j+1)/6*6.283,A=local(Math.cos(u)*6,0,Math.sin(u)*6),B=local(Math.cos(v)*6,0,Math.sin(v)*6),C=local(Math.cos(v)*6,h*.55,Math.sin(v)*6),D=local(Math.cos(u)*6,h*.55,Math.sin(u)*6);emit(A,B,C,[.24,.26,.18]);emit(A,C,D,[.24,.26,.18])}
  // Rounded broadleaf crowns match the park's silhouette, even near an outer boundary.
  for(let layer=0;layer<3;layer++){const y=h*(.52+layer*.17),radius=w*(1-layer*.20),ry=h*(layer===2?.17:.23),col=[.19+layer*.025+rnd(i+3)*.035,.32+layer*.018,.205+layer*.012];for(const face of sphereModelFaces(0)){const points=face.map(p=>local(p[0]*radius,y+p[1]*ry,p[2]*radius));emit(...points,col)}}
  yield {stage:'backdrop-trees',label:'Preparando a floresta distante',completed:i+1,total:n};
 }
 return yield* partitionStaticMeshIncremental(data,512);
}
function drawParkBackdrop(){parkBackdrop??=buildParkBackdrop();drawMesh(parkBackdrop,0,0,0,1,1,1,[1,1,1],14)}
// Visible subtiles share the parent buffer; adjacent index ranges need only one draw.
function drawStaticRanges(parent,visible,x,y,z,sx,sy,sz,tint,material,rot){
 const ranges=parent.drawRanges??=[];let count=0,active=null;
 for(const part of visible){if(active&&active.first+active.count===part.first){active.count+=part.count;continue}active=ranges[count]??={buffer:parent.buffer,indexBuffer:parent.indexBuffer,geometry:parent,sphere:null};active.first=part.first;active.count=part.count;count++}
 for(let i=0;i<count;i++)drawMesh(ranges[i],x,y,z,sx,sy,sz,tint,material,rot);
}


