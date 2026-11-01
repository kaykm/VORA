// Small compound rigid bodies. Fixed substeps, sleeping and a 3D contact grid keep cargo affordable.
const BODY_IDENTITY=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const CARGO_SHAPES=ASSET_METRICS.map((a,t)=>{
 const [w,h,d]=a.bodySize,half=h/2,hx=w/2,hz=d/2;let spheres;
 if(t===0){const r=w/2;spheres=[[0,-half+r,0,r],[0,half-r,0,r]]}
 else if(t===1){const r=half;spheres=[[-hx+r,0,0,r],[hx-r,0,0,r],[0,-.15,hz-r,r*.94]]}
 else if(t===2||t===4){
  const r=Math.min(hx,half,hz)*.42;spheres=[[0,0,0,Math.min(hx,half,hz)]];
  for(const x of [-hx+r,hx-r])for(const y of [-half+r,half-r])for(const z of [-hz+r,hz-r])spheres.push([x,y,z,r]);
  for(const x of [-hx+r,hx-r])spheres.push([x,0,0,r]);for(const z of [-hz+r,hz-r])spheres.push([0,0,z,r]);
 }else{
  const bottom=w*.31,center=w*.32,rim=w*.07;spheres=[[0,-half+bottom,0,bottom],[0,half-center-.8,0,center]];
  for(let i=0;i<8;i++){const angle=i/8*Math.PI*2;spheres.push([Math.cos(angle)*(hx-rim),half-rim,Math.sin(angle)*(hz-rim),rim])}
 }
 return {half,mass:a.mass,spheres,extent:Math.hypot(w,h,d)/2};
});
let cargoPhysicsDirty=false,cargoLastSave=0;let cargoBodies=[],cargoVelocityX=0,cargoVelocityZ=0,cargoLastR=0,cargoLastD=0,cargoLastElevation=0,cargoLastTravel=0;
const cargoRim={blocked:false,filledFor:0,clearFor:0};
function cargoRimFull(){return cargoRim.blocked&&cargoBodies.length>0&&state.cargo.length>0}
function resetCargoRim(){cargoRim.blocked=false;cargoRim.filledFor=0;cargoRim.clearFor=0;}
function updateCargoRim(dt){
 const wasFull=cargoRim.blocked;
 if(!cargoBodies.length){resetCargoRim();}
 else{
  let protruding=false;
  const clearance=meters(cargoRim.blocked?.01:.03),radius=physicalRadius()*1.078;
  for(const b of cargoBodies){
   // Entering/free-falling objects pass through the opening normally. Only a
   // supported pile or a resting body can physically fill the rim.
   if(!b.sleeping&&(b.fallTime<.45||b.contacts===0))continue;
   const m=b.matrix;
   for(const p of b.spheres){
    const top=b.z+b.half+m[1]*p.ox+m[5]*p.oy+m[9]*p.oz+p.r;
    if(top<=clearance)continue;
    const x=b.lx+m[0]*p.ox+m[4]*p.oy+m[8]*p.oz;
    const z=b.ly+m[2]*p.ox+m[6]*p.oy+m[10]*p.oz;
    if(Math.hypot(x,z)>radius+p.r)continue;
    if(top>terrainElevationAt(player.x+x,player.y+z)+clearance){protruding=true;break;}
   }
   if(protruding)break;
  }
  cargoRim.filledFor=protruding?cargoRim.filledFor+dt:0;
  cargoRim.clearFor=protruding?0:cargoRim.clearFor+dt;
  if(cargoRim.filledFor>=.22)cargoRim.blocked=true;
  if(cargoRim.clearFor>=.18)cargoRim.blocked=false;
 }
 if(wasFull!==cargoRimFull()){
  if(gameLoading.ready){
   updateUI();
   if(cargoRimFull()){
    toast('Borda cheia. Descarregue a carga ou aumente a profundidade.');blockTimer=4;
   }
  }
 }
}
function bodyMatrix(b){const [x,y,z,w]=b.q,m=b.matrix;m[0]=1-2*(y*y+z*z);m[1]=2*(x*y+z*w);m[2]=2*(x*z-y*w);m[4]=2*(x*y-z*w);m[5]=1-2*(x*x+z*z);m[6]=2*(y*z+x*w);m[8]=2*(x*z+y*w);m[9]=2*(y*z-x*w);m[10]=1-2*(x*x+y*y);}
function createCargoBody(t,index,x,z,y=0,yaw=0,resource=null){const shape=resource?(resource.cargoShape??=resourceCargoShape(resource,t)):CARGO_SHAPES[t];if(resource)yaw=shape.visual.rotation;const extent=shape.extent,b={t,shape,resource,cargoIndex:index,modelVariant:modelVariantFromRotation(yaw),lx:x,ly:z,z:y,v:[0,0,0],w:[0,0,0],q:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],matrix:new Float32Array(BODY_IDENTITY),invMass:1/shape.mass,invI:1/(shape.mass*extent*extent*.4),half:shape.half,sleeping:false,quiet:0,contacts:0,fallTime:0,vz:0,fresh:true,inHold:true,spheres:shape.spheres.map(p=>({b:null,ox:p[0],oy:p[1],oz:p[2],r:p[3],x:0,y:0,z:0,dx:0,dy:0,dz:0}))};for(const p of b.spheres)p.b=b;bodyMatrix(b);return b}
function refreshBodySpheres(b){const m=b.matrix;for(const p of b.spheres){p.dx=m[0]*p.ox+m[4]*p.oy+m[8]*p.oz;p.dy=m[1]*p.ox+m[5]*p.oy+m[9]*p.oz;p.dz=m[2]*p.ox+m[6]*p.oy+m[10]*p.oz;p.x=b.lx+p.dx;p.y=b.z+b.half+p.dy;p.z=b.ly+p.dz}}
function saveCargoPhysics(){cargoPhysicsDirty=false;state.cargoPoses=cargoBodies.length===state.cargo.length?cargoBodies.map(b=>({t:b.t,x:b.lx,z:b.ly,y:b.z,q:b.q.slice(),variant:b.modelVariant,...(b.resource?{resourceId:b.resource.resourceId}:{})})):[]}
function restoreCargoPhysics(){
 resetCargoRim();
 cargoBodies=[];
 for(let i=0;i<state.cargo.length;i++){
  const t=state.cargo[i],pose=state.cargoPoses?.[i];
  const resource=typeof pose?.resourceId==='string'?worldResourceObjects.find(o=>
   o.t===t&&o.worldProp.resourceId===pose.resourceId)?.worldProp:null;
  const shape=resource?(resource.cargoShape??=resourceCargoShape(resource,t)):CARGO_SHAPES[t];
  const margin=resource?Math.max(30,shape.extent*2):30;
  const valid=pose?.t===t&&Array.isArray(pose.q)&&pose.q.length===4&&
   [pose.x,pose.z,pose.y,...pose.q].every(Number.isFinite)&&
   Math.hypot(pose.x,pose.z)<physicalRadius()*1.15&&
   pose.y>=-cavityDepth()-margin&&pose.y<Math.max(80,resource?shape.extent*2:0);
  let b;
  if(valid){
   b=createCargoBody(t,i,pose.x,pose.z,pose.y,0,resource);
   const len=Math.hypot(...pose.q);if(len>.1)b.q=pose.q.map(v=>v/len);
  }else{
   const [x,z]=cargoPosition(i,t);
   b=createCargoBody(t,i,x,z,cargoSupportHeight(x,z,t,i),i*2.39996,resource);
  }
  if(Number.isInteger(pose?.variant)&&pose.variant>=0&&pose.variant<3)b.modelVariant=pose.variant;
  bodyMatrix(b);cargoBodies.push(b);
 }
 fallingItems=cargoBodies.slice();cargoVelocityX=0;cargoVelocityZ=0;
 cargoLastR=physicalRadius();cargoLastD=cavityDepth();
 cargoLastElevation=cavityVisual.elevation||0;cargoLastTravel=travelDistance;
}
function ensureCargoBodies(){if(cargoBodies.length!==state.cargo.length||cargoBodies.some((b,i)=>b.t!==state.cargo[i]))restoreCargoPhysics()}
function wakeBody(b){b.sleeping=false;b.quiet=0}
function pointVelocity(b,x,y,z,out){out[0]=b.v[0]+b.w[1]*z-b.w[2]*y;out[1]=b.v[1]+b.w[2]*x-b.w[0]*z;out[2]=b.v[2]+b.w[0]*y-b.w[1]*x}
function impulseBody(b,x,y,z,jx,jy,jz){if(b.sleeping)return;b.v[0]+=jx*b.invMass;b.v[1]+=jy*b.invMass;b.v[2]+=jz*b.invMass;b.w[0]+=(y*jz-z*jy)*b.invI;b.w[1]+=(z*jx-x*jz)*b.invI;b.w[2]+=(x*jy-y*jx)*b.invI}
function impulseMass(b,x,y,z,nx,ny,nz){if(!b||b.sleeping)return 0;const cx=y*nz-z*ny,cy=z*nx-x*nz,cz=x*ny-y*nx;return b.invMass+b.invI*(cx*cx+cy*cy+cz*cz)}
const contactVA=new Float64Array(3),contactVB=new Float64Array(3);
function solveImpulse(a,b,ax,ay,az,bx,by,bz,nx,ny,nz){
 pointVelocity(a,ax,ay,az,contactVA);if(b)pointVelocity(b,bx,by,bz,contactVB);else contactVB.fill(0);
 let vx=contactVA[0]-contactVB[0],vy=contactVA[1]-contactVB[1],vz=contactVA[2]-contactVB[2],vn=vx*nx+vy*ny+vz*nz;
 if(b&&vn< -12){if(a.sleeping)wakeBody(a);if(b.sleeping)wakeBody(b)}
 if(vn>=0)return;const mass=impulseMass(a,ax,ay,az,nx,ny,nz)+(b?impulseMass(b,bx,by,bz,nx,ny,nz):0);if(mass<1e-8)return;
 if(!b&&vn< -24&&!a.hitSound){a.hitSound=true;sound(140);pulseUI('detailsBtn',.4)}const restitution=vn< -24?.14:0,j=-(1+restitution)*vn/mass;impulseBody(a,ax,ay,az,nx*j,ny*j,nz*j);if(b)impulseBody(b,bx,by,bz,-nx*j,-ny*j,-nz*j);
 pointVelocity(a,ax,ay,az,contactVA);if(b)pointVelocity(b,bx,by,bz,contactVB);
 vx=contactVA[0]-contactVB[0];vy=contactVA[1]-contactVB[1];vz=contactVA[2]-contactVB[2];const normalSpeed=vx*nx+vy*ny+vz*nz;let tx=vx-nx*normalSpeed,ty=vy-ny*normalSpeed,tz=vz-nz*normalSpeed,tl=Math.hypot(tx,ty,tz);if(tl<1e-6)return;tx/=tl;ty/=tl;tz/=tl;const tm=impulseMass(a,ax,ay,az,tx,ty,tz)+(b?impulseMass(b,bx,by,bz,tx,ty,tz):0),jt=Math.min(j*.65,tl/Math.max(tm,1e-8));impulseBody(a,ax,ay,az,-tx*jt,-ty*jt,-tz*jt);if(b)impulseBody(b,bx,by,bz,tx*jt,ty*jt,tz*jt);
}
function terrainBodyContact(p){
 const b=p.b;p.x=b.lx+p.dx;p.y=b.z+b.half+p.dy;p.z=b.ly+p.dz;const floor=cavityHeightAt(p.x,p.z),height=p.y-floor;if(height>p.r+1&&floor>=-.01)return;
 let nx=0,ny=1,nz=0;const rho=Math.hypot(p.x,p.z),inner=physicalRadius()*.57;
 if(floor< -.01){if(rho<inner){const n=basinNormal(p.x,p.z);nx=n[0];ny=n[1];nz=n[2]}else{const e=.35,dx=(cavityHeightAt(p.x+e,p.z)-cavityHeightAt(p.x-e,p.z))/(2*e),dz=(cavityHeightAt(p.x,p.z+e)-cavityHeightAt(p.x,p.z-e))/(2*e),len=Math.hypot(dx,1,dz);nx=-dx/len;ny=1/len;nz=-dz/len}}
 const penetration=p.r-height*ny;if(penetration<=0)return;b.contacts++;const push=Math.min(5,Math.max(0,penetration-.025)*.7);b.lx+=nx*push;b.z+=ny*push;b.ly+=nz*push;
 solveImpulse(b,null,p.dx-nx*p.r,p.dy-ny*p.r,p.dz-nz*p.r,0,0,0,nx,ny,nz);
}
const bodyGrid=new Map(),bodyGridPool=[],gridCell=28,bodyGridOffsets=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)bodyGridOffsets.push(x*16384+y*128+z);
function solveCargoPairs(){
 // A single rigid body can touch the terrain, but cannot collide with itself.
 // Keep sphere coordinates current without constructing/searching 27 grid cells.
 if (cargoBodies.length < 2) {
  bodyGrid.clear();
  if (cargoBodies.length) refreshBodySpheres(cargoBodies[0]);
  return;
 }
 bodyGrid.clear();let cellSize=gridCell;for(const b of cargoBodies)for(const p of b.spheres)cellSize=Math.max(cellSize,p.r*2);let id=0,poolIndex=0;for(const b of cargoBodies){refreshBodySpheres(b);for(const p of b.spheres){p.id=id++;p.cx=Math.floor(p.x/cellSize);p.cy=Math.floor(p.y/cellSize);p.cz=Math.floor(p.z/cellSize);const key=((p.cx+64)*128+p.cy+64)*128+p.cz+64;p.cellKey=key;let cell=bodyGrid.get(key);if(!cell){cell=bodyGridPool[poolIndex]??=[];bodyGridPool[poolIndex++]=cell;cell.length=0;bodyGrid.set(key,cell)}cell.push(p)}}
 for(const a of cargoBodies){if(a.sleeping)continue;for(const p of a.spheres)for(let neighbor=0;neighbor<27;neighbor++){const cell=bodyGrid.get(p.cellKey+bodyGridOffsets[neighbor]);if(!cell)continue;for(const q of cell){const b=q.b;if(b===a||(!b.sleeping&&q.id<p.id))continue;let dx=p.x-q.x,dy=p.y-q.y,dz=p.z-q.z;const radius=p.r+q.r,d2=dx*dx+dy*dy+dz*dz;if(d2>=radius*radius)continue;const dist=Math.sqrt(d2);if(dist<1e-5){dx=.01;dy=.03;dz=.02}const len=dist<1e-5?Math.hypot(dx,dy,dz):dist,nx=dx/len,ny=dy/len,nz=dz/len;a.contacts++;b.contacts++;
  solveImpulse(a,b,p.dx-nx*p.r,p.dy-ny*p.r,p.dz-nz*p.r,q.dx+nx*q.r,q.dy+ny*q.r,q.dz+nz*q.r,nx,ny,nz);
  const ma=a.sleeping?0:a.invMass,mb=b.sleeping?0:b.invMass,total=ma+mb;if(!total)continue;const correction=Math.min(3,Math.max(0,radius-dist-.05)*.32)/total;a.lx+=nx*correction*ma;a.z+=ny*correction*ma;a.ly+=nz*correction*ma;b.lx-=nx*correction*mb;b.z-=ny*correction*mb;b.ly-=nz*correction*mb;
 }}}
}
function stepCargoPhysics(dt,moveX=0,moveZ=0){
 ensureCargoBodies();if(!cargoBodies.length){updateCargoRim(dt);cargoVelocityX=moveX/dt;cargoVelocityZ=moveZ/dt;return}
 const vx=moveX/dt,vz=moveZ/dt,ax=(vx-cargoVelocityX)/dt,az=(vz-cargoVelocityZ)/dt,reshape=Math.abs(physicalRadius()-cargoLastR)>.005||Math.abs(cavityDepth()-cargoLastD)>.005||Math.abs((cavityVisual.elevation||0)-cargoLastElevation)>.002||Math.abs(travelDistance-cargoLastTravel)>.02;
 cargoVelocityX=vx;cargoVelocityZ=vz;cargoLastR=physicalRadius();cargoLastD=cavityDepth();cargoLastElevation=cavityVisual.elevation||0;cargoLastTravel=travelDistance;const steps=Math.max(1,Math.ceil(dt*120)),h=dt/steps,atStation=Math.abs(player.x-base.x)<STATION.halfX+physicalRadius()+24&&Math.abs(player.y-base.y)<STATION.halfZ+physicalRadius()+24;
 for(const b of cargoBodies){if(reshape||Math.hypot(ax,az)>220||atStation&&(moveX!==0||moveZ!==0))wakeBody(b);if(!b.sleeping&&!b.fresh){b.v[0]-=ax*dt*.55;b.v[2]-=az*dt*.55}b.fresh=false}
 if(cargoBodies.every(b=>b.sleeping)){fallingItems=[];updateCargoRim(dt);return}
 for(let step=0;step<steps;step++){
  for(const b of cargoBodies){b.contacts=0;if(b.sleeping)continue;b.fallTime+=h;b.v[1]-=470*h;const damp=Math.exp(-h*.12),angular=Math.exp(-h*1.9);b.v[0]*=damp;b.v[2]*=damp;for(let i=0;i<3;i++)b.w[i]*=angular;
   const speed=Math.hypot(...b.v);if(speed>430)for(let i=0;i<3;i++)b.v[i]*=430/speed;b.lx+=b.v[0]*h;b.z+=b.v[1]*h;b.ly+=b.v[2]*h;
   const [x,y,z,w]=b.q,[wx,wy,wz]=b.w,k=h*.5;b.q[0]+=k*(wx*w+wy*z-wz*y);b.q[1]+=k*(-wx*z+wy*w+wz*x);b.q[2]+=k*(wx*y-wy*x+wz*w);b.q[3]-=k*(wx*x+wy*y+wz*z);const qlen=Math.hypot(...b.q)||1;for(let i=0;i<4;i++)b.q[i]/=qlen;bodyMatrix(b);
  }
  for(let iteration=0;iteration<2;iteration++){for(const b of cargoBodies)if(!b.sleeping){refreshBodySpheres(b);for(const p of b.spheres){terrainBodyContact(p);if(atStation&&!b.inHold)stationBodyContact(p)}}solveCargoPairs()}
  for(const b of cargoBodies){if(b.sleeping)continue;if(b.contacts>0){const rolling=Math.exp(-h*4);for(let k=0;k<3;k++)b.w[k]*=rolling}const settled=b.contacts>0&&Math.hypot(...b.v)<meters(.06)&&Math.hypot(...b.w)*b.shape.extent<meters(.06);if(settled)b.quiet+=h;else b.quiet=0;if(b.quiet>.65){b.sleeping=true;b.v.fill(0);b.w.fill(0)}b.vz=b.v[1];if(!Number.isFinite(b.z)||b.z< -cavityDepth()-Math.max(80,b.resource?b.shape.extent*2:0)){const p=cargoPosition(b.cargoIndex,b.t);b.lx=p[0];b.ly=p[1];b.z=cargoSupportHeight(...p,b.t,b.cargoIndex);b.v.fill(0);b.w.fill(0);wakeBody(b)}}
 }
 fallingItems=cargoBodies.filter(b=>!b.sleeping);if(fallingItems.length)cargoPhysicsDirty=true;
 updateCargoRim(dt);
}
