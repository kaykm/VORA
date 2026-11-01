// VORA model workshop. Each complete object is baked into one reusable mesh.
// The blue vertex channel also carries a discrete finish tag for the model shader.
const modelMeshes=new Map(),modelSphereFaces=new Map();
function modelVariantFromRotation(angle=0){return Math.abs(Math.floor(angle*997))%3}
function modelColor(c,k=1){return c.map(v=>Math.max(.025,Math.min(.98,v*k)))}
class ModelBuilder{
 constructor(){this.data=[]}
 tri(a,b,c,color,finish=0,normal){const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(cross[0]**2+cross[1]**2+cross[2]**2<1e-12)return;this.data.push(...triangle(a,b,c,[color[0],color[1],color[2]+finish*2],normal))}
 quad(a,b,c,d,color,finish=0,normal){this.tri(a,b,c,color,finish,normal);this.tri(a,c,d,color,finish,normal)}
 lathe(profile,color,finish=0,n=20,cx=0,cz=0,dent=0){
  for(let j=0;j<profile.length-1;j++){
   const P=profile[j],Q=profile[j+1],dr=Q[0]-P[0],dy=Q[1]-P[1],len=Math.hypot(dr,dy)||1;
   const point=(p,a)=>{const warp=1-dent*Math.exp(-(((p[1]-6)/3)**2))*Math.max(0,Math.cos(a-1.5))**6;return [cx+Math.cos(a)*p[0]*warp,p[1],cz+Math.sin(a)*p[0]*warp]};
   for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,m=(a+b)/2,normal=[dy*Math.cos(m)/len,-dr/len,dy*Math.sin(m)/len],col=modelColor(P[2]||color,.985+.025*Math.sin(i*1.7+j*.3));this.quad(point(P,a),point(Q,a),point(Q,b),point(P,b),col,P[3]??finish,normal)}
  }
 }
 box(x,y,z,w,h,d,color,finish=0,bevel=.45,tilt=0){
  const B=Math.min(bevel,w*.2,h*.22,d*.2),ring=(Y,inset)=>{const X=w/2-inset,Z=d/2-inset,C=Math.min(B,X*.4,Z*.4);return [[-X+C,-Z],[X-C,-Z],[X,-Z+C],[X,Z-C],[X-C,Z],[-X+C,Z],[-X,Z-C],[-X,-Z+C]].map(([a,b])=>[x+a,y+Y*Math.cos(tilt)-b*Math.sin(tilt),z+Y*Math.sin(tilt)+b*Math.cos(tilt)])},rings=[ring(0,B*.6),ring(B,0),ring(h-B,0),ring(h,B*.6)];
  for(let j=0;j<3;j++)for(let i=0;i<8;i++){const k=(i+1)%8;this.quad(rings[j][i],rings[j+1][i],rings[j+1][k],rings[j][k],modelColor(color,j===0?.86:j===2?1.055:1),finish)}
  for(let i=0;i<8;i++){const k=(i+1)%8;this.tri([x,y,z],rings[0][i],rings[0][k],modelColor(color,.82),finish,[0,-1,0]);this.tri([x,y+h*Math.cos(tilt),z+h*Math.sin(tilt)],rings[3][k],rings[3][i],modelColor(color,1.025),finish,[0,Math.cos(tilt),Math.sin(tilt)])}
 }
 tube(points,radii,color,finish=0,n=8){
  for(let j=0;j<points.length-1;j++){
   const a=points[j],b=points[j+1],v=b.map((c,k)=>c-a[k]),len=Math.hypot(...v)||1;for(let k=0;k<3;k++)v[k]/=len;
   let u=Math.abs(v[1])<.9?[v[2],0,-v[0]]:[v[1],-v[0],0];const ul=Math.hypot(...u);u=u.map(c=>c/ul);const q=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]],r0=Array.isArray(radii)?radii[j]:radii,r1=Array.isArray(radii)?radii[j+1]:radii,point=(p,r,t)=>p.map((c,k)=>c+r*(u[k]*Math.cos(t)+q[k]*Math.sin(t)));
   for(let i=0;i<n;i++){const t=i/n*Math.PI*2,s=(i+1)/n*Math.PI*2,m=(t+s)/2,normal=u.map((c,k)=>c*Math.cos(m)+q[k]*Math.sin(m));this.quad(point(a,r0,t),point(b,r1,t),point(b,r1,s),point(a,r0,s),color,finish,normal);if(j===0)this.tri(a,point(a,r0,s),point(a,r0,t),color,finish,v.map(c=>-c));if(j===points.length-2)this.tri(b,point(b,r1,t),point(b,r1,s),color,finish,v)}
  }
 }
 blob(center,scale,seed,color,finish=0,detail=1,flatten=false){
  for(const face of sphereModelFaces(detail)){
   const vertices=face.map(p=>{const r=1+.10*Math.sin(p[0]*5.8+seed)+.075*Math.cos(p[2]*6.4-p[1]*4+seed*1.7);return [center[0]+p[0]*scale[0]*r,center[1]+p[1]*scale[1]*r,center[2]+p[2]*scale[2]*r]}),mid=vertices[0].map((v,k)=>(v+vertices[1][k]+vertices[2][k])/3),shade=.94+.055*Math.sin(mid[0]*.41+mid[2]*.32+seed)+(mid[1]-center[1])/scale[1]*.055;
   if(flatten)for(const p of vertices)p[1]=Math.max(.15,p[1]);const start=this.data.length;this.tri(...vertices,modelColor(color,shade),finish);if(finish===3&&this.data.length>start){for(let i=0;i<3;i++){const k=start+i*9,p=vertices[i],s=p.map((v,j)=>(v-center[j])/(scale[j]*scale[j])),l=Math.hypot(...s)||1,n=s.map((v,j)=>v/l*.75+this.data[k+3+j]*.25),nl=Math.hypot(...n)||1;for(let j=0;j<3;j++)this.data[k+3+j]=n[j]/nl}}
  }
 }
 leaf(base,angle,length,reach,width,color,segments=5){
  const rows=[];for(let j=0;j<=segments;j++){const t=j/segments,bend=reach*(t*t*.72+t*.28),y=base[1]+length*(t-.22*t*t),w=width*Math.sin(Math.PI*Math.pow(t,.72))*.5,fold=Math.sin(Math.PI*t)*width*.12,cx=base[0]+Math.cos(angle)*bend,cz=base[2]+Math.sin(angle)*bend;rows.push([[-Math.sin(angle)*w+cx,y-fold,Math.cos(angle)*w+cz],[cx,y+fold,cz],[Math.sin(angle)*w+cx,y-fold,-Math.cos(angle)*w+cz]])}
  for(let j=0;j<segments;j++)for(let k=0;k<2;k++){const col=modelColor(color,(k?.96:1.06)*(1-j/segments*.05));this.quad(rows[j][k],rows[j+1][k],rows[j+1][k+1],rows[j][k+1],col,3)}
 }
 bake(scale=[1,1,1],floor=0){
  const data=this.data;for(let i=0;i<data.length;i+=9){data[i]*=scale[0];data[i+1]=(data[i+1]-floor)*scale[1];data[i+2]*=scale[2];let x=data[i+3]/scale[0],y=data[i+4]/scale[1],z=data[i+5]/scale[2],l=Math.hypot(x,y,z)||1;data[i+3]=x/l;data[i+4]=y/l;data[i+5]=z/l}
  const result=mesh(data),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i+=9)for(let k=0;k<3;k++){min[k]=Math.min(min[k],data[i+k]);max[k]=Math.max(max[k],data[i+k])}result.bounds={min,max};result.vertices=new Float32Array(data);return result;
 }
}
function sphereModelFaces(level){
 if(modelSphereFaces.has(level))return modelSphereFaces.get(level);
 const g=(1+Math.sqrt(5))/2,norm=p=>{const l=Math.hypot(...p);return p.map(v=>v/l)},v=[[-1,g,0],[1,g,0],[-1,-g,0],[1,-g,0],[0,-1,g],[0,1,g],[0,-1,-g],[0,1,-g],[g,0,-1],[g,0,1],[-g,0,-1],[-g,0,1]].map(norm),indices=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];let faces=indices.map(f=>f.map(i=>v[i]));
 for(let j=0;j<level;j++){const out=[];for(const [a,b,c]of faces){const ab=norm(a.map((v,k)=>(v+b[k])/2)),bc=norm(b.map((v,k)=>(v+c[k])/2)),ca=norm(c.map((v,k)=>(v+a[k])/2));out.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca])}faces=out}
 modelSphereFaces.set(level,faces);return faces;
}
function makeCanModel(variant,detail){
 const b=new ModelBuilder(),n=detail?24:12,aluminium=[.65,.68,.61],paint=[[.37,.46,.34],[.57,.36,.25],[.66,.64,.50]][variant],cream=[.81,.77,.62];
 b.lathe([[0,.15],[3.6,.15],[4.1,.45],[4.4,1.15],[4.5,2],[4.5,5],[4.5,7],[4.5,9.5],[4.2,10.5],[3.95,11],[4.12,11.5],[4.1,12],[3.6,12],[3.5,11.65],[0,11.65]],aluminium,1,n,0,0,.045);
 b.lathe([[4.535,2.05],[4.535,5],[4.535,7],[4.535,9.5]],paint,0,n,0,0,.045);
 for(const y of [2.2,8.7])b.lathe([[4.525,y],[4.525,y+.38]],cream,0,n);
 // Recessed opening, raised pull tab and the scored lid: real geometry.
 b.blob([.25,11.79,-1.45],[1.25,.06,1.45],2,[.16,.20,.17],0,0);
 const tab=[];for(let i=0;i<=12;i++){const a=i/12*Math.PI*2;tab.push([Math.cos(a)*.9,12.12,Math.sin(a)*1.45+.4])}b.tube(tab,.20,aluminium,1,detail?6:4);
 if(detail){b.lathe([[3.15,11.79],[3.28,11.82],[3.38,11.79]],modelColor(aluminium,.8),1,n);for(let i=0;i<3;i++)b.box(-1.2+i*1.1,4.1,4.42,.55,2.3+i*.5,.12,cream,0,.04)}
 return b.bake(ASSET_METRICS[0].scale,ASSET_METRICS[0].floor);
}
function makeRockModel(variant,detail){
 const b=new ModelBuilder(),c=[[.47,.505,.43],[.53,.49,.405],[.43,.475,.455]][variant];
 b.blob([-.3,4.3,.1],[8.2,5.3,6.8],4.1+variant*2.3,c,0,detail?2:1,true);
 if(detail){for(let i=0;i<4;i++){const x=-5+i*2.4,y=8.1-Math.abs(x)*.25,z=-1.2+i*.43;b.tube([[x,y,z],[x+1.9,y-.28,z+.7]],.10,modelColor(c,1.15),0,4)}}
 return b.bake(ASSET_METRICS[1].scale,ASSET_METRICS[1].floor);
}
function makeBoxModel(variant,detail){
 const b=new ModelBuilder(),card=modelColor([.64,.49,.31],.95+variant*.045),edge=modelColor(card,.87),tape=[.76,.65,.44],label=[.81,.785,.66],ink=[.30,.325,.27];
 b.box(0,0,0,32,25.4,30,card,0,.8);
 // Unequal closed flaps, exposed folds and tape wrapping down both faces.
 b.box(-8.05,25.35,0,15.8,.48,29.1,modelColor(card,1.04),0,.12);
 b.box(8.05,25.42,0,15.8,.45,29.1,modelColor(card,.98),0,.12);
 b.box(0,25.92,0,4.4,.12,29.6,tape,0,.035);
 for(const z of [-15.05,15.05])b.box(0,16.2,z,4.4,9.65,.14,tape,0,.035);
 b.box(-6.2,12,15.12,9.1,6.2,.12,label,0,.12);
 b.box(10,6.5,15.12,4.6,5.4,.12,modelColor(card,.88),0,.08);
 if(detail){
  for(const x of [-14.9,14.9])b.box(x,1,15.02,.35,22.5,.07,edge,0,.025);
  for(let i=0;i<5;i++)b.box(-9.5+i*.7,13.1,15.25,.20+(i%2)*.11,2.7,.035,ink,0,.01);
  b.box(-6.4,16.1,15.26,6.8,.22,.03,ink,0,.01);
  for(const x of [8.9,11.1]){b.tube([[x,7.4,15.25],[x,10.8,15.25]],.16,ink,0,4);b.tube([[x-.8,10,15.25],[x,10.9,15.25],[x+.8,10,15.25]],.16,ink,0,4)}
  b.box(-10,25.94,-3,5,.035,1.1,modelColor(card,.92),0,.02);
 }
 return b.bake(ASSET_METRICS[2].scale,ASSET_METRICS[2].floor);
}
function makePotModel(variant,detail){
 const b=new ModelBuilder(),n=detail?24:12,clay=modelColor([.65,.365,.235],.96+variant*.04),rim=modelColor(clay,1.10),inside=modelColor(clay,.64),soil=[.255,.225,.145];
 b.lathe([[0,.1],[10.6,.1],[11.1,.8],[11.2,2.0],[13.7,23.5],[15.8,24.0],[16.7,24.9],[16.7,27.6],[16.1,28.2],[14.6,28.2],[14.1,27.5],[13.3,24.4],[12.8,22.9],[0,22.9]],clay,2,n);
 b.lathe([[15.85,24.2,rim],[16.75,25,rim],[16.75,26.7,rim],[16.2,27.7,rim]],rim,2,n);
 b.lathe([[14.55,27.8,inside],[13.1,24,inside],[0,24,soil,0]],inside,2,n);
 b.lathe([[12.8,24.05],[0,24.05]],soil,0,n);
 // A small branched plant with alternate leaves on several stems, instead of an agave fan.
 const count=detail?7:5;for(let i=0;i<count;i++){const x=(i%3-1)*3.7+Math.sin(i+variant)*.7,z=(Math.floor(i/3)-.7)*4.2,h=26+(i%4)*3.0,tip=[x+Math.sin(i*1.8+variant)*2.0,24.2+h,z+Math.cos(i*1.5)*2.1];b.tube([[x,24.2,z],[x*.95,24.2+h*.55,z+.5],tip],[.32,.24,.10],[.28,.385,.205],3,detail?5:3);for(let j=0;j<(detail?5:4);j++){const t=.3+j*.14,P=[x+(tip[0]-x)*t,24.2+h*t,z+(tip[2]-z)*t],a=i*1.73+j*2.8+variant*.5,reach=4.2+(i%2)*.8,col=[[.29,.465,.245],[.35,.51,.28],[.27,.43,.26]][(i+j)%3];foliageLeaf(b,P,[P[0]+Math.cos(a)*reach,P[1]+2.5-j*.4,P[2]+Math.sin(a)*reach],1.9,col,detail,{rise:1.3,curl:.7,twist:.12})}foliageLeaf(b,[tip[0],tip[1]-4,tip[2]],[tip[0]+2,tip[1]+.5,tip[2]+2.0],1.4,[.36,.51,.28],detail,{rise:1,curl:.3})}

 if(detail){for(let i=0;i<6;i++){const a=i*2.4;b.blob([Math.cos(a)*8,24.1,Math.sin(a)*8],[.8,.45,.65],i,[.38,.32,.21],0,0)}}
 return b.bake(ASSET_METRICS[3].scale,ASSET_METRICS[3].floor);
}
function makeBenchModel(detail,variant=0){
 const b=new ModelBuilder(),iron=[.245,.29,.265],trim=[.36,.39,.32],timber=[[.52,.385,.245],[.46,.355,.235],[.56,.43,.28]][variant%3],bolt=[.57,.56,.45];
 for(const x of [-20.5,20.5]){
  for(const z of [-7,7])b.tube([[x,1,z*1.23],[x,8,z],[x,18,z*.85]],[2,1.65,1.55],iron,1,detail?8:6);
  b.tube([[x,13,-7],[x,18,-8],[x,32,-11],[x,44,-14]],[1.6,1.6,1.45,1.3],iron,1,detail?8:6);
  b.box(x,0,-8.5,7,1,5,trim,1,.35);b.box(x,0,8.5,7,1,5,trim,1,.35);
 }
 b.tube([[-22,13,-6],[22,13,-6]],1.1,iron,1,8);
 for(let j=0;j<4;j++)b.box(0,19.5,-8+j*5.15,57,2.7,4.35,modelColor(timber,1+(j%3-1)*.04),0,.45);
 for(let j=0;j<3;j++)b.box(0,28+j*5.6,-11-j*1.0,57,4.65,2.5,modelColor(timber,1.02-j*.025),0,.45,-.14);
 for(const x of [-25,25])b.tube([[x,21.5,8],[x,31,8],[x,32,3],[x,32,-6],[x,29,-10]],[.9,.9,1,1,.9],iron,1,detail?8:5);
 if(detail){
  for(const x of [-20.5,20.5])for(let j=0;j<4;j++)b.lathe([[0,22.22],[.48,22.22],[.48,22.4],[0,22.4]],bolt,1,8,x,-8+j*5.15);
  for(let j=0;j<4;j++)for(const x of [-12,7])b.tube([[x,22.25,-7+j*5.15],[x+8,22.25,-6.8+j*5.15]],.08,modelColor(timber,.86),0,4);
 }
 return b.bake(BENCH_METRICS.scale);
}
// Six baked silhouettes: spreading shade trees, upright crowns and open forked trees.
function makeTreeModel(variant,detail){
 if(variant>=6)return makeLayeredTreeModel(variant,detail);
 const b=new ModelBuilder(),family=variant%3,seed=variant*17.13+4.8,rnd=k=>fract(Math.sin(seed+k*127.1)*43758.5453),bark=[.36,.285,.20],leaf=[[.23,.50,.23],[.40,.59,.25],[.19,.44,.31]][family],lean=(rnd(1)-.5)*5,spread=[30,22,34][family],trunkTop=[55,70,48][family];
 b.tube([[0,-.3,0],[lean*.18,9,.5],[lean*.55,28,-1],[lean,trunkTop,1.5]],[2.7,2.15,1.6,.65],bark,0,detail?9:7);
 for(let i=0;i<4;i++){const angle=i*1.57+rnd(i+2);b.tube([[Math.cos(angle)*4,.1,Math.sin(angle)*4],[Math.cos(angle)*1.5,3,Math.sin(angle)*1.5],[0,6,0]],[.6,1,1.1],bark,0,5)}
 const branchCount=family===1?7:6;
 for(let i=0;i<branchCount;i++){
  const a=i*2.39996+rnd(3)*2,reach=spread*(.48+rnd(i+8)*.22),y=family===1?52+i*5:55+(i%3)*9,tip=[Math.cos(a)*reach,y,Math.sin(a)*reach],fork=[tip[0]*.52,32+i*3,tip[2]*.52];
  b.tube([[lean*.5,20+i*3,0],fork,tip],[1.25-i*.07,.85,.22],modelColor(bark,.94+rnd(i)*.12),0,detail?7:5);
  const ends=[];for(let j=0;j<2;j++){const aa=a+(j?1:-1)*(.35+rnd(i*5+j)*.35),end=[tip[0]+Math.cos(aa)*7,tip[1]+9+rnd(i+j+30)*8,tip[2]+Math.sin(aa)*7];b.tube([fork,tip,end],[.7,.4,.10],bark,0,5);ends.push(end)}
  for(let j=0;j<(detail?5:3);j++){
   const end=ends[j%2],aa=a+j*2.4,center=[end[0]+Math.cos(aa)*(j<2?0:5),end[1]+(j===4?7:0),end[2]+Math.sin(aa)*(j<2?0:5)],w=(11+rnd(i*9+j+40)*3)*(family===1?.8:1),h=(family===1?11:6.5)+rnd(i+j+22)*3;
   b.blob(center,[w,h,w*(.80+rnd(i+j+26)*.25)],seed+i*5+j,modelColor(leaf,.88+rnd(i*7+j+56)*.24),3,1);
  }
 }
 b.blob([lean,78,0],[15,9,14],seed+65,modelColor(leaf,.95),3,1);
 b.blob([lean, family===1?99:87,1],[family===1?11:14,family===1?15:9,12],seed+77,modelColor(leaf,1.04),3,1);
 return b.bake();
}
// Young leaders, multi-stem understory, narrow evergreens and mature shade crowns.
const TREE_VARIANTS=14;
function makeLayeredTreeModel(variant,detail){
 const b=new ModelBuilder(),family=Math.floor((variant-6)/2),seed=variant*23.91,rnd=k=>materialHash(seed+k*1.3,17.8),bark=[.345,.295,.225],green=[[.34,.59,.255],[.20,.51,.32],[.15,.40,.29],[.32,.54,.22]][family],angle=rnd(1)*6.28;
 const crown=(x,y,z,w,h,k)=>b.blob([x,y,z],[w,h,w*(.83+rnd(k+2)*.25)],seed+k,modelColor(green,.87+rnd(k)*.25),3,1);
 if(family===0){
  b.tube([[0,0,0],[1.2,32,-.8],[2.7,69,1.5],[1,98,2]],[1.4,1,.55,.10],bark,0,detail?7:5);
  for(let i=0;i<7;i++){const a=angle+i*2.4,y=39+i*7,reach=15*(1-i/10),end=[Math.cos(a)*reach,y+13,Math.sin(a)*reach];b.tube([[1,y-6,0],end],[.55,.10],bark,0,5);crown(...end,10+(i%2)*2,12,i+3)}
  crown(1,95,2,10,12,29);
 }else if(family===1){
  for(let i=0;i<3;i++){const a=angle+i*2.1,tip=[Math.cos(a)*18,68+(i%2)*14,Math.sin(a)*18];b.tube([[Math.cos(a)*2,0,Math.sin(a)*2],[tip[0]*.2,27,tip[2]*.2],tip],[1.7,1.1,.25],bark,0,detail?7:5);for(let j=0;j<3;j++){const aa=a+j*2.4;crown(tip[0]+Math.cos(aa)*12,tip[1]+j*6,tip[2]+Math.sin(aa)*12,17,12,i*5+j)}}
  crown(0,85,0,23,16,44);
 }else if(family===2){
  b.tube([[0,0,0],[1,55,-1],[0,109,1]],[2.1,1.1,.12],bark,0,7);
  for(let i=0;i<7;i++){const y=27+i*11,w=28-i*3.2,a=angle+i*2.4;crown(Math.cos(a)*3,y,Math.sin(a)*3,w,15+i*.4,i);if(detail)crown(Math.cos(a)*w*.45,y-2,Math.sin(a)*w*.45,w*.7,10,i+18)}
 }else{
  b.tube([[0,0,0],[-2,17,1],[2,38,0]],[4.4,3.5,2.1],bark,0,detail?10:7);
  for(let i=0;i<6;i++){const a=angle+i*2.4,reach=33+rnd(i)*10,tip=[Math.cos(a)*reach,62+rnd(i+20)*20,Math.sin(a)*reach];b.tube([[0,25,0],[tip[0]*.45,45,tip[2]*.45],tip],[2.0,1.1,.16],bark,0,detail?7:5);for(let j=0;j<3;j++){const aa=a+j*2.2;crown(tip[0]+Math.cos(aa)*12,tip[1]+j*5,tip[2]+Math.sin(aa)*12,23,14,i*4+j)}}
  crown(0,80,0,29,20,57);crown(1,96,0,25,13,64);
 }
 return b.bake();
}
function getModelMesh(type,variant=0,detail=1){const key=type+':'+variant+':'+detail;let m=modelMeshes.get(key);if(!m){m=type==='tree'?makeTreeModel(variant,detail):type==='bench'?makeBenchModel(detail,variant):[makeCanModel,makeRockModel,makeBoxModel,makePotModel,makeTimberModel][type](variant,detail);modelMeshes.set(key,m)}return m}
// Shadow and camera passes must use the same silhouette. A cheaper, differently
// shaped crown can otherwise project floating patches onto the detailed crown.
function modelDetailAt(x,y,z,size,threshold=48){const d=Math.hypot(x-currentEye[0],y-currentEye[1],z-currentEye[2]);return !gl.isSoftware&&size*H/Math.max(1,d*.776)>threshold?1:0}
function treeModelDetail(p){return modelDetailAt(p[0],p[2]*.5,p[1],p[2],230)}
function benchModelDetail(p){return modelDetailAt(p[0],meters(.45),p[1],meters(1.8),74)}
function drawObject(t,x,z,y=0,rotation=0,variant=modelVariantFromRotation(rotation)){
 const size=ASSET_METRICS[t].renderHeight,detail=modelDetailAt(x,y+size*.5,z,size);drawMesh(getModelMesh(t,variant,detail),x,y,z,1,1,1,[1,1,1],14,rotation);
}
function drawTree(p,offset=0,shrink=1){const [x,z,h]=p,variant=p[3]??Math.floor(materialHash(x,z)*6),detail=treeModelDetail(p),model=getModelMesh('tree',variant,detail),factor=h/model.bounds.max[1]*shrink;drawMesh(model,x,terrainElevationAt(x,z)+offset,z,factor,factor,factor,[1,1,1],14,x*.013+z*.021)}
function drawBench(p,rotation=0,variant=0,offset=0,shrink=1){const [x,z]=p,detail=benchModelDetail(p);drawMesh(getModelMesh('bench',variant,detail),x,terrainElevationAt(x,z)+offset,z,shrink,shrink,shrink,[1,1,1],14,rotation)}

function warmModelMeshes(){for(const detail of (gl.isSoftware?[0]:[0,1])){for(let t=0;t<4;t++)for(let v=0;v<3;v++)getModelMesh(t,v,detail);for(let v=0;v<TREE_VARIANTS;v++)getModelMesh('tree',v,detail);for(let v=0;v<3;v++)getModelMesh('bench',v,detail)}}

