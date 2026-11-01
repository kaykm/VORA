// Fixed anchors in groves, rock beds, path verges and maintenance yards.
// A placement check rejects obstructions; respawns never reroll a location.
const WORLD_RESOURCE_AREAS=[
 {id:'alamedas',name:'Alamedas centrais',group:'amenity',level:0},
 {id:'encostas',name:'Encostas e taludes',group:'stone',level:0},
 {id:'apoio',name:'Pátio de manutenção',group:'service',level:0},
 {id:'bosques',name:'Bordas dos bosques',group:'grove',level:0},
 {id:'jardim',name:'Apoio do jardim',group:'service',level:1},
 {id:'piquenique',name:'Descanso do piquenique',group:'amenity',level:1},
 {id:'pedreira-leste',name:'Pedreira leste',group:'stone',level:2},
 {id:'viveiro',name:'Viveiro do bosque',group:'grove',level:2},
 {id:'circuito',name:'Circuito externo',group:'amenity',level:3},
 {id:'serraria',name:'Depósito de madeira',group:'service',level:3},
 {id:'pedreiras',name:'Grandes formações',group:'stone',level:4},
 {id:'bosque-norte',name:'Bosque norte',group:'grove',level:4},
 {id:'oficina',name:'Oficina do mirante',group:'service',level:5},
 {id:'mirantes',name:'Áreas dos mirantes',group:'amenity',level:5},
 {id:'reserva',name:'Reserva de recursos',group:'grove',level:6}
];
const RESOURCE_MODEL_KINDS=['barrel','pallet','crate','gardenpot','logpile'];

function resourcePathFrame(axis,t,side=1){
 const a=Array.from(walkRouteAt(t,axis)),b=Array.from(walkRouteAt(t+1,axis));
 const tangent=axis?[1,b[0]-a[0]]:[b[0]-a[0],1],length=Math.hypot(...tangent);
 tangent[0]/=length;tangent[1]/=length;
 const normal=[-tangent[1]*side,tangent[0]*side],center=axis?[t,a[0]]:[a[0],t];
 return {center,tangent,normal,width:a[1],rotation:Math.atan2(-normal[0],-normal[1])};
}

function* buildResourceLayout(){
 const rnd=k=>materialHash(k+9173.6,131.27),serial=new Map();
 // Repair older decorative rocks/logs that landed on circulation routes.
 for(const p of worldProps){
  if(p.type!=='scenery'||!['boulder','log'].includes(p.kind)||walkFieldAt(p.p[0],p.p[1])<-(p.radius||60)-8)continue;
  const [ox,oz]=p.p,r=p.radius||60;
  for(let i=0;i<120;i++){
   const a=i*2.39996323,d=r*2.5+30+Math.floor(i/24)*35,x=ox+Math.cos(a)*d,z=oz+Math.sin(a)*d;
   if(Math.max(Math.abs(x),Math.abs(z))>WORLD_PLAY_HALF-r-35||walkFieldAt(x,z)>-r-10||stationDistanceAt(x,z)<r+35)continue;
   if(objects.some(o=>Math.hypot(x-o.x,z-o.y)<r+TYPES[o.t].size+6))continue;
   if(worldProps.some(q=>q!==p&&Math.hypot(x-q.p[0],z-q.p[1])<r+(q.type==='tree'?9:q.radius??48)+5))continue;
   p.p[0]=x;p.p[1]=z;p.rotation=rnd(x+z)*6.283;break;
  }
 }
 const occupied=new Map(),cell=100;
 const index=(p,r)=>{
  const x=p.p[0],z=p.p[1];
  for(let a=Math.floor((x-r)/cell);a<=Math.floor((x+r)/cell);a++)for(let b=Math.floor((z-r)/cell);b<=Math.floor((z+r)/cell);b++){
   const key=a+','+b;if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push({x,z,r});
  }
 };
 for(const p of worldProps)index(p,p.type==='tree'?9:p.radius??48);
 const free=(x,z,r)=>{
  if(Math.max(Math.abs(x),Math.abs(z))>WORLD_PLAY_HALF-r-35||stationDistanceAt(x,z)<r+30||Math.hypot(x-100,z-70)<r+24)return false;
  if(objects.some(o=>Math.hypot(x-o.x,z-o.y)<r+TYPES[o.t].size+5))return false;
  for(let a=Math.floor((x-r-4)/cell);a<=Math.floor((x+r+4)/cell);a++)for(let b=Math.floor((z-r-4)/cell);b<=Math.floor((z+r+4)/cell);b++)
   if((occupied.get(a+','+b)||[]).some(p=>Math.hypot(x-p.x,z-p.z)<r+p.r+22))return false;
  return true;
 };
 function add(kind,x,z,r,rotation,area,options={}){
  if(!free(x,z,r))return null;
  const n=serial.get(kind)||0;serial.set(kind,n+1);
  const p={id:'resource-'+kind+'-'+n,type:kind==='tree'?'tree':kind==='bench'?'bench':'scenery',kind,
   p:[x,z,options.height||40],radius:r,rotation,variant:Math.floor(rnd(x*.13+z*.27)*3),resourceArea:area,...options};
  if(kind==='tree')p.p.push(Math.floor(rnd(x+z*2.7)*TREE_VARIANTS));
  const level=WORLD_RESOURCE_AREAS.find(a=>a.id===area).level;
  // Existing regions gain denser stocks as the same spawn upgrade improves.
  p.spawnLevel=level;
  worldProps.push(p);index(p,r);return p;
 }
 // Fixed seating stops, well apart, facing the actual circulation route.
 for(let axis=0;axis<2;axis++)for(const [i,t]of [-1580,-1120,-680,-300,240,660,1080,1540].entries()){
  const f=resourcePathFrame(axis,t,(i+axis)%2?1:-1),offset=f.width+42;
  const x=f.center[0]+f.normal[0]*offset,z=f.center[1]+f.normal[1]*offset;
  if(walkFieldAt(x,z)<-26){
   const p=add('bench',x,z,46,f.rotation,Math.abs(t)<850?'alamedas':'circuito',{lookAt:f.center.slice(),placement:'path-verge'});
   if(p)add('bin',x+f.tangent[0]*91,z+f.tangent[1]*91,21,f.rotation,p.resourceArea,{placement:'seating-bin'});
  }yield {label:'Definindo pontos de descanso'};
 }
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8+.08,x=-40+1700*Math.cos(a),z=-40+1500*Math.sin(a);
  const nx=Math.cos(a)/1700,nz=Math.sin(a)/1500,l=Math.hypot(nx,nz),bx=x+nx/l*83,bz=z+nz/l*83;
  const seat=add('bench',bx,bz,46,Math.atan2(x-bx,z-bz),'circuito',{lookAt:[x,z],placement:'circuit-verge'});
  if(seat)add('gardenpot',bx+nz/l*120,bz-nx/l*120,17,0,'circuito',{placement:'rest-stop-planter'});
  yield {label:'Definindo o circuito de descanso'};
 }
 const beds=[[390,260,'encostas'],[-520,-390,'encostas'],[620,540,'encostas'],[-670,220,'encostas'],
  [1480,-920,'pedreira-leste'],[1470,1220,'pedreira-leste'],[-620,1330,'reserva']];
 const stoneSlots=[[-180,-95,.06,.3],[-65,-150,.12,1.6],[125,-100,.25,2.8],[-140,70,.5,.9],[20,55,.9,2.1],[160,150,1.6,.6],[230,-220,2.6,1.8]];
 for(const [cx,cz,area]of beds)for(const [dx,dz,width,yaw]of stoneSlots){
  const x=cx+dx,z=cz+dz,r=meters(width)*.74;
  if(walkFieldAt(x,z)<-r-14)add('boulder',x,z,r,yaw,area,{resourceDiameter:meters(width),placement:'stone-bed'});
  yield {label:'Definindo pedras em pontos permanentes'};
 }
 for(const [i,[x,z]]of [[-1750,-1750],[1750,-1750],[-1750,1750],[1750,1750]].entries()){
  const width=i<2?7.2:4.8,r=meters(width)*.74;
  worldProps=worldProps.filter(p=>p.type!=='tree'||Math.hypot(x-p.p[0],z-p.p[1])>r+35);
  worldProps.push({id:'resource-quarry-'+i,type:'scenery',kind:'boulder',p:[x,z,meters(width)*.65],radius:r,
   resourceArea:'pedreiras',spawnLevel:4,resourceDiameter:meters(width),rotation:.37+i*1.13,variant:i%3,placement:'quarry'});
  yield {label:'Definindo as formações rochosas'};
 }
 const groves=[[-440,170,'bosques'],[420,400,'bosques'],[410,-360,'bosques'],[-415,-510,'bosques'],
  [-1060,420,'viveiro'],[1030,-460,'viveiro'],[-480,1840,'bosque-norte'],[1390,1770,'reserva']];
 for(const [g,[cx,cz,area]]of groves.entries())for(const [j,[dx,dz]]of [[-180,-100],[100,-150],[-120,160],[170,140]].entries()){
  const x=cx+dx,z=cz+dz,height=meters([1.6,2.8,4.5,3.6][j]);
  if(walkFieldAt(x,z)<-65){
   if(j===3)add('log',x,z,61,.7+g*.32,area,{placement:'fallen-timber'});
   else add('tree',x,z,Math.max(35,height*.2),0,area,{height,placement:'grove-edge'});
  }yield {label:'Definindo árvores e madeira nas bordas do bosque'};
 }
 const yards=[[-340,-360,0,'apoio'],[-440,-95,Math.PI/2,'apoio'],[-1380,-970,.18,'jardim'],
  [-1070,1280,-.25,'serraria'],[1490,-1100,Math.PI*.5,'oficina']];
 const workSlots=[[-150,-120,'crate'],[30,-145,'pallet'],[155,20,'barrel'],[-130,90,'gardenpot'],[25,120,'logpile'],[175,160,'crate']];
 for(const [cx,cz,yaw,area]of yards)for(const [X,Z,kind]of workSlots){
  const x=cx+X*Math.cos(yaw)+Z*Math.sin(yaw),z=cz-X*Math.sin(yaw)+Z*Math.cos(yaw);
  const r=kind==='logpile'?32:kind==='pallet'?27:kind==='crate'?22:17;
  if(walkFieldAt(x,z)<-r-16)add(kind,x,z,r,yaw,area,{placement:'service-yard'});
  yield {label:'Definindo os pontos de apoio separados dos caminhos'};
 }
 invalidateSpawnObstacles();
}

function makeResourceProp(kind,variant=0){
 const b=new ModelBuilder(),wood=[.58+variant*.025,.39,.22],iron=[.25,.34,.32],light=[.74,.57,.34];
 if(kind==='barrel'){
  b.lathe([[0,0],[12,0],[14,3],[14,32],[12,36],[0,36]],[.32,.43,.39],1,12);
  for(const y of [5,27])b.lathe([[14.3,y],[14.3,y+2]],iron,1,12);
  b.box(4,36,-3,3,.6,3,iron,1,0);
 }else if(kind==='pallet'){
  for(const x of [-17,0,17])b.box(x,0,0,6,6,34,wood,0,.25);
  for(let i=0;i<5;i++)b.box(0,6,-14+i*7,43,2.5,6,light,0,.2);
 }else if(kind==='crate'){
  b.box(0,0,0,28,25,26,wood,0,.4);
  for(const x of [-12,12])for(const z of [-13.2,13.2])b.box(x,1,z,2,23,.6,light,0,.1);
  for(const y of [2,20])b.box(0,y,13.4,27,2,.5,light,0,.1);
 }else if(kind==='gardenpot'){
  b.lathe([[0,0],[8,0],[11,18],[12,19],[12,22],[10,22],[9,18],[0,18]],[.71,.40,.25],2,12);
 }else if(kind==='logpile'){
  for(const [y,z]of [[8,-9],[8,9],[22,0]]){
   b.tube([[-28,y,z],[28,y,z]],8,wood,0,8);
   b.tube([[-28.2,y,z],[-28,y,z]],6.6,light,0,8);
  }
 }
 return b.bake();
}
