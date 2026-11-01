// Reproducible layered planting: canopy, understory, shrubs, herbs and ground cover.
let groundDetailsMesh=null,groundDetailsBatches=null,environmentDetails=[],vegetationPlanes=null,vegetationClearings=[];
const plantMeshes=new Map(),VEGETATION_TILE=224,PLANT_VARIANTS=6;
const PLANT_PROFILES={meadow:{height:[.045,.075],radius:12},litter:{height:[.012,.026],radius:24},shrub:{height:[.45,1.0],radius:.95},fern:{height:[.28,.57],radius:1.0},broadleaf:{height:[.26,.62],radius:.85},grass:{height:[.28,.65],radius:.62},tuft:{height:[.10,.23],radius:.75},groundcover:{height:[.045,.085],radius:10},flower:{height:[.25,.48],radius:.72}};
function clearVegetationBatches(){resetVegetationResourceCache();if(groundDetailsBatches)for(const t of groundDetailsBatches){for(const d of [0,1])if(t.meshes[d])deleteMesh(t.meshes[d]);if(t.shadowMesh)deleteMesh(t.shadowMesh)}if(lighting){lighting.key='';lighting.dynamicKey='';lighting.center=null;}groundDetailsMesh=null;groundDetailsBatches=null}
function buildParkLayout(){
 const iterator = buildParkLayoutIncremental();
 let step;
 while (!(step = iterator.next()).done) { /* Synchronous compatibility path. */ }
 return step.value;
}
function* buildParkLayoutIncremental(){
 clearVegetationBatches();worldProps=[];environmentDetails=[];let id=0;
 const random=k=>materialHash(k+417,83.1);
 for(const pad of BENCH_SITES){const yaw=Math.atan2(pad.target[0]-pad.x,pad.target[1]-pad.z);worldProps.push({id:'bench-'+pad.id,type:'bench',p:[pad.x,pad.z],rotation:yaw,variant:id++%3,lookAt:pad.target.slice(),futurePickup:true,footprint:[meters(1.8),meters(.66)]});yield {stage:'park-benches'};}
 const benches=worldProps.slice(),fixed=SPAWN_CATALOG.flatMap(z=>z.points||[]);
 const tree=(x,z,h,variant)=>{
  if(Math.abs(x)>830||Math.abs(z)>830||walkFieldAt(x,z)>-26||stationDistanceAt(x,z)<50||Math.hypot(x-100,z-70)<(h>meters(3)?160:115)||fixed.some(p=>Math.hypot(x-p[0],z-p[1])<34)||worldProps.some(p=>Math.hypot(x-p.p[0],z-p.p[1])<(p.type==='bench'?86:Math.max(40,Math.min(125,h*.19+p.p[2]*.14)))))return false;
  worldProps.push({id:'tree-'+id++,type:'tree',p:[x,z,h,variant],futurePickup:true,age:h<meters(3.2)?'young':h>meters(6)?'mature':'standard'});return true;
 };
 for(const [i,p]of [[-650,-610,7.4],[-620,620,6.9],[650,-580,7.8],[670,650,7.1]].entries()){
  tree(p[0],p[1],meters(p[2]),12+i%2);yield {stage:'park-trees'};
 }
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2+(random(i)-.5)*.17;tree(Math.cos(a)*(735+random(i+30)*65),Math.sin(a)*(705+random(i+70)*90),meters(4.1+random(i+20)*1.7),i%6);yield {stage:'park-trees'};}
 for(const [g,c]of [[-440,170],[420,400],[410,-360],[-415,-510],[70,600]].entries())for(let j=0;j<18;j++){const k=g*31+j,a=random(k+100)*Math.PI*2,r=40+random(k+110)*145;tree(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,meters(3.8+random(k+140)*1.9),(g+j)%6);if(j%4===3)yield {stage:'park-trees'};}
 for(const [g,c]of [[250,180],[155,380],[-280,305],[-340,-280],[340,-225],[-570,390],[570,120],[270,660]].entries())for(let j=0;j<7;j++){const k=g*37+j,a=random(k+600)*6.28,r=25+random(k+601)*90;tree(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,meters(1.45+random(k+660)*1.45),6+(g+j)%6);if(j%4===3)yield {stage:'park-trees'};}
 const reserved=[];
 for(const def of SPAWN_CATALOG){reserved.push(...makeVegetationReserveSlots(def));yield {stage:'park-clearings'};}
 vegetationClearings=reserved.map(p=>({x:p.x,z:p.y,r:TYPES[p.t].size+meters(.025)}));
 const plant=(x,z,kind,key,scale=1)=>{
  const profile=PLANT_PROFILES[kind],size=meters(profile.height[0]+random(key+800)*(profile.height[1]-profile.height[0]))*scale,carpet=kind==='groundcover',short=carpet||kind==='tuft',nominal=size*profile.radius,distance=-walkFieldAt(x,z),spread=carpet?Math.min(1,(distance-3.5)/nominal):1,radius=nominal*spread;
  if(radius<3||Math.abs(x)>845||Math.abs(z)>845||distance<radius+(carpet?3:6)||stationDistanceAt(x,z)<radius+(carpet?5:18)||(!short&&Math.hypot(x-100,z-70)<70)||fixed.some(p=>Math.hypot(x-p[0],z-p[1])<radius+(carpet?0:18)))return false;
  if(!carpet&&reserved.some(p=>Math.hypot(x-p.x,z-p.y)<radius+8))return false;
  if(benches.some(p=>Math.hypot(x-p.p[0],z-p.p[1])<radius+(carpet?12:short?37:62)))return false;
  if(!carpet&&worldProps.some(p=>p.type==='tree'&&Math.hypot(x-p.p[0],z-p.p[1])<radius*.55+5))return false;
  if(!carpet&&environmentDetails.some(p=>p.kind!=='groundcover'&&Math.hypot(x-p.x,z-p.z)<(radius+p.radius)*.55))return false;
  const terrain=terrainAt(x,z);if(carpet&&terrain!=='grama')return false;if(terrain==='areia'&&(!['grass','tuft'].includes(kind)||random(key+882)>.28))return false;
  const patch=coherentNoise(x*.009+4,z*.009-9),variant=Math.min(PLANT_VARIANTS-1,Math.floor(patch*PLANT_VARIANTS));
  environmentDetails.push({x,z,size,radius,spread,kind,seed:key,variant,rotation:random(key+341)*Math.PI*2});return true;
 };
 // Woodland floors use broad shade leaves and ferns, with clear spaces between groves.
 for(const [i,p]of worldProps.entries())if(p.type==='tree')for(let j=0;j<10;j++){const a=random(i*17+j+1200)*6.28,r=18+random(i*17+j+1201)*65,k=i*19+j;plant(p.p[0]+Math.cos(a)*r,p.p[1]+Math.sin(a)*r,['fern','groundcover','broadleaf','tuft','shrub'][j%5],k+1400);if(j%4===3)yield {stage:'park-understory'};}
 // Larger, irregular drifts mix plant silhouettes instead of evenly scattering identical bushes.
 const drifts=[[-330,110,130,65],[-500,270,130,100],[-310,350,125,90],[225,230,115,65],[160,390,100,85],[370,110,115,75],[255,-230,150,90],[500,-280,145,105],[-350,-470,140,100],[470,420,140,125],[160,665,165,80],[-640,-120,90,160],[-670,540,125,100],[635,345,100,135],[150,145,90,50],[355,620,120,80]];
 for(const [g,c]of drifts.entries())for(let j=0;j<75;j++){const k=g*113+j,a=random(k+4000)*6.28,r=Math.sqrt(random(k+4001)),x=c[0]+Math.cos(a)*r*c[2],z=c[1]+Math.sin(a)*r*c[3],kind=['shrub','grass','broadleaf','tuft','groundcover','grass','flower','groundcover'][Math.floor(random(k+4002)*8)];plant(x,z,kind,k+6000);if(j%8===7)yield {stage:'park-drifts'};}
 // Sparse low growth on the open lawns and thicker tufts along the verges.
 for(let i=0;i<1000;i++){const x=(random(i+10000)-.5)*1650,z=(random(i+11000)-.5)*1650;plant(x,z,i%3?'tuft':'groundcover',i+12000);if(i%16===15)yield {stage:'park-lawns'};}
 for(let axis=0;axis<2;axis++)for(let t=-770;t<780;t+=22){const r=Array.from(walkRouteAt(t,axis));for(const side of [-1,1]){const k=Math.floor(t)+axis*2010+side*997,offset=r[1]+14+random(k+16000)*35,x=axis?t:r[0]+side*offset,z=axis?r[0]+side*offset:t;plant(x,z,random(k+16001)>.28?'tuft':'grass',k+17000)}yield {stage:'park-verges'};}
 // Low mats overlap into a continuous floor; height, not large empty circles, keeps pickups legible.
 for(let z=-825;z<=825;z+=40){for(let x=-825;x<=825;x+=40){const k=Math.floor(x/36)*197+Math.floor(z/36)*397,noise=coherentNoise(x*.005+4,z*.005-8);plant(x+(random(k+21000)-.5)*24,z+(random(k+22000)-.5)*24,'groundcover',k+24000,.87+noise*.22)}yield {stage:'park-cover'};}

 yield* extendParkLayoutIncremental();
}
function makePlantModel(kind,variant,detail){
 const b=new ModelBuilder(),seed=variant*19.31+2.8,rnd=k=>materialHash(seed+k,41.7),green=[[.29,.55,.235],[.40,.62,.27],[.23,.51,.29],[.37,.58,.22],[.25,.56,.32],[.34,.54,.24]][variant],color=k=>modelColor(green,.92+rnd(k)*.16);
 const leaf=(base,tip,width,k,options={})=>foliageLeaf(b,base,tip,width,color(k),detail,options);
 const stem=(points,r=.012)=>{if(detail)b.tube(points,[r,r*.7,r*.3].slice(0,points.length),modelColor(green,.76),3,3)};
 if(kind==='meadow'||kind==='litter'){makeFloorPlantModel(b,kind,variant,detail)}else if(kind==='groundcover'){
  for(let i=0;i<6;i++){
   const x=(i%3-1)*.61+(rnd(i+2)-.5)*.35,z=(Math.floor(i/3)-1)*.55+(rnd(i+8)-.5)*.30,a=seed*.3+(rnd(i+4)-.5)*2.7,dx=Math.cos(a),dz=Math.sin(a),path=[];
   for(let j=0;j<5;j++){const t=j/4,X=x+dx*t*.64+Math.sin(t*3+i)*.12,Z=z+dz*t*.64,Y=.025+Math.sin(t*2+i)*.012;path.push([X,Y,Z]);if(j===4||(!detail&&j%2===1))continue;const side=j%2?1:-1,length=.38+rnd(i*7+j)*.10;
    leaf([X,Y,Z],[X-dz*side*length+dx*.14,.13+rnd(i*9+j)*.10,Z+dx*side*length+dz*.14],.115+rnd(i+j)*.025,i*7+j,{cover:true,rise:.045,twist:(rnd(i+12)-.5)*.4,curl:.025});
   }
   // Short petioles belong to nodes along creeping stems, not a central rosette.
   if(detail)for(let j=0;j<path.length-1;j++){const a=path[j],c=path[j+1];b.quad([a[0]-.008,a[1],a[2]],[c[0]-.008,c[1],c[2]],[c[0]+.008,c[1],c[2]],[a[0]+.008,a[1],a[2]],modelColor(green,.75),3,[0,1,0])}
   const tip=path[4];leaf(tip,[tip[0]+dx*.28,.17+rnd(i)*.08,tip[2]+dz*.28],.105,i+80,{cover:true,rise:.04});
  }
 }else if(kind==='fern'){
  for(let i=0;i<(detail?5:4);i++){
   const x=(rnd(i+2)-.5)*1.2,z=(rnd(i+7)-.5)*.9,a=seed*.17+(rnd(i+10)-.5)*2.6,dx=Math.cos(a),dz=Math.sin(a),h=.55+rnd(i)*.35,point=t=>[x+dx*t*.95,.08+h*Math.sin(t*2.6),z+dz*t*.95];
   stem([point(0),point(.5),point(1)],.018);
   for(let j=1;j<=(detail?7:5);j++){const t=j/(detail?8:6),P=point(t),w=Math.sin(Math.PI*t)*.27;for(const side of [-1,1])leaf(P,[P[0]-dz*w*side+dx*.13,P[1]-.025,P[2]+dx*w*side+dz*.13],w*.26,i+j,{rise:.025,twist:side*.12})}
  }
 }else if(kind==='shrub'||kind==='broadleaf'||kind==='flower'){
  const count=kind==='shrub'?5:kind==='flower'?3:4;
  for(let i=0;i<count;i++){
   const x=(rnd(i+1)-.5)*1.05,z=(rnd(i+9)-.5)*.9,h=.60+rnd(i+5)*.4,tip=[x+.23*(rnd(i+12)-.5),h,z+.12],start=[x,0,z];b.tube([start,[x*.95,h*.50,z+.04],tip],[.021,.014,.005],modelColor(green,.76),3,3);
   for(let j=0;j<(detail?5:3);j++){
    const t=.30+j*(detail?.14:.26),P=start.map((v,k)=>v+(tip[k]-v)*t),a=seed*.3+i*1.9+j*2.75,reach=kind==='shrub'?.30:.40,leafTip=[P[0]+Math.cos(a)*reach,P[1]+.09-j*.012,P[2]+Math.sin(a)*reach];leaf(P,leafTip,kind==='shrub'?.12:.18,i+j,{rise:.06,curl:.045,twist:.18*Math.sin(a)});
   }
   if(kind==='flower'){const c=[[.96,.75,.30],[.72,.47,.84],[.97,.88,.66],[.91,.39,.53],[.97,.63,.22],[.66,.74,.94]][variant%6];for(let j=0;j<5;j++){const a=j*1.256;foliageLeaf(b,tip,[tip[0]+Math.cos(a)*.09,h+.02,tip[2]+Math.sin(a)*.09],.04,c,0,{rise:.015,curl:0})}}
  }
 }else{
  const count=detail?14:8;
  for(let i=0;i<count;i++){
   const x=(rnd(i+1)-.5)*1.30,z=(rnd(i+11)-.5)*1.02,a=seed*.19+(rnd(i+4)-.5)*3.3,h=.55+rnd(i+7)*.5,reach=.30+rnd(i+15)*.35;
   leaf([x,0,z],[x+Math.cos(a)*reach,h*.55,z+Math.sin(a)*reach],kind==='tuft'?.040:.052,i,{rise:h*.49,curl:h*.11,twist:.20});
  }
 }
 let height=0,reach=0;for(let i=0;i<b.data.length;i+=9){height=Math.max(height,b.data[i+1]);reach=Math.max(reach,Math.hypot(b.data[i],b.data[i+2]))}const horizontal=PLANT_PROFILES[kind].radius*.93/reach,result=b.bake([horizontal,1/height,horizontal]);result.vertices=new Float32Array(b.data);return result;
}
function getPlantMesh(kind,variant,detail){const key=kind+':'+variant+':'+detail;if(!plantMeshes.has(key))plantMeshes.set(key,makePlantModel(kind,variant,detail));return plantMeshes.get(key)}
function bakePlantTile(plants,detail){
 // Allocate once per tile instead of a new array for every triangle.
 // Double precision is retained until partitioning, preserving the old clipping
 // decisions and tile boundaries before the final Float32 upload.
 const models = plants.map(p => getPlantMesh(p.kind, p.variant, detail));
 const capacity = models.reduce((sum, model) => sum + model.vertices.length, 0);
 const data = new Float64Array(capacity), triangle = new Float64Array(27);
 let used = 0;

 for (let plantIndex = 0; plantIndex < plants.length; plantIndex++) {
  const p = plants[plantIndex], raw = models[plantIndex].vertices;
  const c = Math.cos(p.rotation), s = Math.sin(p.rotation);
  const y = terrainElevationAt(p.x, p.z), spread = p.spread || 1;
  const clearings = isGroundCover(p.kind) ? vegetationClearings.filter(q =>
   Math.hypot(q.x - p.x, q.z - p.z) < p.radius + q.r) : [];

  for (let i = 0; i < raw.length; i += 27) {
   for (let j = 0; j < 27; j += 9) {
    const k = i + j, x = raw[k] * p.size * spread, z = raw[k + 2] * p.size * spread;
    const nx = raw[k + 3] / spread, ny = raw[k + 4], nz = raw[k + 5] / spread;
    const length = Math.hypot(nx, ny, nz) || 1;
    triangle[j] = p.x + c * x + s * z;
    triangle[j + 1] = y + raw[k + 1] * p.size;
    triangle[j + 2] = p.z - s * x + c * z;
    triangle[j + 3] = (c * nx + s * nz) / length;
    triangle[j + 4] = ny / length;
    triangle[j + 5] = (-s * nx + c * nz) / length;
    triangle[j + 6] = raw[k + 6];
    triangle[j + 7] = raw[k + 7];
    triangle[j + 8] = raw[k + 8];
   }
   const cx = (triangle[0] + triangle[9] + triangle[18]) / 3;
   const cz = (triangle[2] + triangle[11] + triangle[20]) / 3;
   if (clearings.some(q => Math.hypot(cx - q.x, cz - q.z) < q.r)) continue;
   data.set(triangle, used);
   used += 27;
  }
 }
 return partitionStaticMesh(data.subarray(0, used), 96);
}

function* bakePlantTileIncremental(plants, detail) {
 // Template creation is warmed during loading. A yield after each lookup also
 // bounds the work if a new kind/variant becomes necessary while streaming.
 const models = [];
 let capacity = 0;
 for (let i = 0; i < plants.length; i++) {
  const p = plants[i], model = getPlantMesh(p.kind, p.variant, detail);
  models.push(model);
  capacity += model.vertices.length;
  yield {stage:'plant-templates',completed:i+1,total:plants.length};
 }
 const data = new Float64Array(capacity), triangle = new Float64Array(27);
 let used = 0, processed = 0;

 for (let plantIndex = 0; plantIndex < plants.length; plantIndex++) {
  const p = plants[plantIndex], raw = models[plantIndex].vertices;
  const c = Math.cos(p.rotation), s = Math.sin(p.rotation);
  const y = terrainElevationAt(p.x, p.z), spread = p.spread || 1;
  const clearings = isGroundCover(p.kind) ? vegetationClearings.filter(q =>
   Math.hypot(q.x-p.x,q.z-p.z) < p.radius+q.r) : [];

  for (let i = 0; i < raw.length; i += 27) {
   for (let j = 0; j < 27; j += 9) {
    const k=i+j,x=raw[k]*p.size*spread,z=raw[k+2]*p.size*spread;
    const nx=raw[k+3]/spread,ny=raw[k+4],nz=raw[k+5]/spread;
    const length=Math.hypot(nx,ny,nz)||1;
    triangle[j]=p.x+c*x+s*z;
    triangle[j+1]=y+raw[k+1]*p.size;
    triangle[j+2]=p.z-s*x+c*z;
    triangle[j+3]=(c*nx+s*nz)/length;
    triangle[j+4]=ny/length;
    triangle[j+5]=(-s*nx+c*nz)/length;
    triangle[j+6]=raw[k+6];
    triangle[j+7]=raw[k+7];
    triangle[j+8]=raw[k+8];
   }
   const cx=(triangle[0]+triangle[9]+triangle[18])/3;
   const cz=(triangle[2]+triangle[11]+triangle[20])/3;
   if (!clearings.some(q=>Math.hypot(cx-q.x,cz-q.z)<q.r)) {
    data.set(triangle,used);
    used += 27;
   }
   // Count rejected triangles as work too: a fully cleared patch must still yield.
   if (++processed % 128 === 0) yield {stage:'plant-triangles',completed:plantIndex,total:plants.length};
  }
  yield {stage:'plants',completed:plantIndex+1,total:plants.length};
 }
 return yield* partitionStaticMeshIncremental(data.subarray(0,used),96);
}

function buildGroundDetails(){
 return finishWorldPreparation(buildGroundDetailsIncremental());
}
function* buildGroundDetailsIncremental(){
 const tiles=new Map();let indexed=0;
 for(const p of environmentDetails){
  const key=Math.floor(p.x/VEGETATION_TILE)+','+Math.floor(p.z/VEGETATION_TILE);
  if(!tiles.has(key))tiles.set(key,[]);tiles.get(key).push(p);
  if(++indexed%128===0)yield {stage:'vegetation-index'};
 }
 groundDetailsBatches=[];
 for(const plants of tiles.values()){
  let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity,maxY=0;
  for(const p of plants){minX=Math.min(minX,p.x-p.radius);maxX=Math.max(maxX,p.x+p.radius);minZ=Math.min(minZ,p.z-p.radius);maxZ=Math.max(maxZ,p.z+p.radius);maxY=Math.max(maxY,p.size+terrainElevationAt(p.x,p.z))}
  const center=[(minX+maxX)/2,maxY/2,(minZ+maxZ)/2],radius=Math.hypot(maxX-minX,maxZ-minZ,maxY)*.5;
  // Detailed world geometry is allocated only when this block is seen up close.
  groundDetailsBatches.push({meshes:[null,null],plants,center,radius,near:null,lastUsed:-1,outer:plants.every(p=>p.outer),count:plants.length});
  yield {stage:'vegetation-bounds'};
 }
 // Readiness marker only. Templates/geometry are created by visible tiles.
 groundDetailsMesh={tiles:groundDetailsBatches.length,plants:environmentDetails.length};return groundDetailsMesh;
}
function prepareVegetationView(m){vegetationPlanes=extractVisibilityPlanes(m,vegetationPlanes);}
function vegetationVisible(x,y,z,r){
 if(!vegetationPlanes)return true;
 for(let i=0;i<6;i++){const p=vegetationPlanes[i];if(p[0]*x+p[1]*y+p[2]*z+p[3]<-r)return false;}return true;
}
