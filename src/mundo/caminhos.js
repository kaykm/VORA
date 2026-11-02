function buildWalkMesh() {
 return finishWorldPreparation(buildWalkMeshIncremental());
}

function* buildWalkMeshIncremental(){
 // March a shared triangular lattice, then clip each cell once. No overlapping strips,
 // hidden internal curbs, coplanar surfaces or junction-specific fragment masks.
 const data=[],step=16,lo=-2320,hi=2320,n=Math.round((hi-lo)/step),values=new Float64Array((n+1)*(n+1));
 let sampled = 0, processedCells = 0;
 const sampleCount = (n + 1) * (n + 1), cellCount = n * n;
 for (let j=0; j<=n; j++) for (let i=0; i<=n; i++) {
  values[j*(n+1)+i] = walkFieldAt(lo+i*step, lo+j*step);
  if (++sampled % 128 === 0) yield {stage:'walk-samples',label:'Preparando os caminhos',completed:sampled,total:sampleCount};
 }
 // Fixed storage avoids temporary string keys. Hash collisions only evict an
 // entry: both original coordinates must match exactly before a value is reused.
 const fieldCache={
  x:new Float64Array(4096),z:new Float64Array(4096),value:new Float64Array(4096),
  valid:new Uint8Array(4096),point:new Float64Array(2),
  clear(){this.valid.fill(0)}
 };
 const pointBits=new Uint32Array(fieldCache.point.buffer);
 const sampleWalkField=(x,z)=>{
  fieldCache.point[0]=x;fieldCache.point[1]=z;
  const slot=(Math.imul(pointBits[0]^pointBits[1],0x9e3779b1)^Math.imul(pointBits[2]^pointBits[3],0x85ebca6b))>>>20;
  if(fieldCache.valid[slot]&&fieldCache.x[slot]===x&&fieldCache.z[slot]===z)return fieldCache.value[slot];
  const value=walkFieldAt(x,z);
  fieldCache.x[slot]=x;fieldCache.z[slot]=z;fieldCache.value[slot]=value;fieldCache.valid[slot]=1;
  return value;
 };
 const clip=(poly,threshold,above)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],A=above?a[2]>=threshold:a[2]<=threshold,B=above?b[2]>=threshold:b[2]<=threshold;if(A)out.push(a);if(A!==B){let lo=0,hi=1;for(let j=0;j<18;j++){const t=(lo+hi)/2,f=sampleWalkField(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);if((f>=threshold)===(a[2]>=threshold))lo=t;else hi=t}const t=(lo+hi)/2;out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,threshold])}}return out.filter((v,i)=>!i||Math.hypot(v[0]-out[i-1][0],v[1]-out[i-1][1])>1e-8)};
 const height=f=>WALK_BEVEL_HEIGHT+(WALK_HEIGHT-WALK_BEVEL_HEIGHT)*Math.max(0,Math.min(1,f/WALK_BEVEL_WIDTH));
 let tops=0,bevels=0,sides=0;const boundaries=[];
 const fan=(poly,bevel)=>{for(let i=1;i<poly.length-1;i++){const a=poly[0],b=poly[i],c=poly[i+1];if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-8)continue;const A=[a[0],height(a[2]),a[1]],B=[b[0],height(b[2]),b[1]],C=[c[0],height(c[2]),c[1]];let normal=[0,1,0];if(bevel){const x=(a[0]+b[0]+c[0])/3,z=(a[1]+b[1]+c[1])/3,gx=(sampleWalkField(x+.2,z)-sampleWalkField(x-.2,z))/.4,gz=(sampleWalkField(x,z+.2)-sampleWalkField(x,z-.2))/.4,k=(WALK_HEIGHT-WALK_BEVEL_HEIGHT)/WALK_BEVEL_WIDTH;normal=[-gx*k,1,-gz*k]}data.push(...triangle(A,C,B,[0,0,1],normal));if(bevel)bevels++;else tops++}};
 const cell=tri=>{if(tri.every(p=>p[2]<0))return;const surface=clip(tri,0,true);if(surface.length<3)return;fan(clip(surface,WALK_BEVEL_WIDTH,true),false);fan(clip(surface,WALK_BEVEL_WIDTH,false),true);
  for(let i=0;i<surface.length;i++){const a=surface[i],b=surface[(i+1)%surface.length];if(Math.abs(a[2])>1e-8||Math.abs(b[2])>1e-8||Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7)continue;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,normal=[sampleWalkField(x-.2,z)-sampleWalkField(x+.2,z),0,sampleWalkField(x,z-.2)-sampleWalkField(x,z+.2)],A=[a[0],0,a[1]],B=[b[0],0,b[1]],C=[b[0],WALK_BEVEL_HEIGHT,b[1]],D=[a[0],WALK_BEVEL_HEIGHT,a[1]];data.push(...triangle(A,B,C,[0,1,1],normal),...triangle(A,C,D,[0,1,1],normal));boundaries.push([a[0],a[1],b[0],b[1]]);sides+=2}
 };
 try {
  for (let j=0; j<n; j++) for (let i=0; i<n; i++) {
   if (i===0) fieldCache.clear();
   if (++processedCells % 4 === 0) yield {stage:'walk-cells',label:'Construindo os caminhos',completed:processedCells,total:cellCount};
   const x=lo+i*step, z=lo+j*step, k=j*(n+1)+i;
   const corners=[values[k],values[k+1],values[k+n+2],values[k+n+1]];
   if (corners.every(value=>value < -24)) continue;
   const nearJunction=(x+40)**2+(z+40)**2 < 130**2 ||
    (x-580)**2+(z+40)**2 < 120**2 || (x+40)**2+(z-460)**2 < 120**2;
   const refine=nearJunction && Math.min(...corners)<6 && Math.max(...corners)>-6 ? 4 : 1;
   const sub=step/refine, nodes=[];

   // The large lattice already contains all four corners. Each interior node of
   // a refined junction is evaluated once, rather than once per adjacent cell.
   for (let v=0; v<=refine; v++) for (let u=0; u<=refine; u++) {
    const X=x+u*sub, Z=z+v*sub;
    let field;
    if (u===0 && v===0) field=corners[0];
    else if (u===refine && v===0) field=corners[1];
    else if (u===refine && v===refine) field=corners[2];
    else if (u===0 && v===refine) field=corners[3];
    else field=sampleWalkField(X,Z);
    nodes.push([X,Z,field]);
   }
   for (let v=0; v<refine; v++) for (let u=0; u<refine; u++) {
    const index=v*(refine+1)+u;
    const a=nodes[index], b=nodes[index+1], c=nodes[index+refine+2], d=nodes[index+refine+1];
    cell([a,b,c]);
    cell([a,c,d]);
    if (refine>1) yield {stage:'walk-junction',label:'Preparando as junções'};
   }
  }
 } finally {
  fieldCache.clear();
  fieldCache.x.fill(0);fieldCache.z.fill(0);fieldCache.value.fill(0);fieldCache.point.fill(0);
 }
 walkMeshStats={tops,bevels,sides,boundaries,step};
 yield {stage:'walk-upload',label:'Preparando a geometria dos caminhos'};
 return yield* partitionStaticMeshIncremental(data,128);
}
function drawWalkways(){walkMesh??=buildWalkMesh();drawMesh(walkMesh,0,0,0,1,1,1,[1,1,1],13)}
function walkSurfaceVisibleAt(x,z,y){
 const coveredByStation=stationDistanceAt(x,z)<-.1&&y<=STATION.deck+.1;
 return !coveredByStation;
}
