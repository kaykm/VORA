// A compact receiving yard. Static parts are baked once into three GPU batches.
// The permanent solid foundation continues below every playable excavation level.
const STATION_DEPTH=meters(15),STATION_COUNTER_SCALE=meters(.94)/(23.5-.35),STATION_UPPER_SCALE=meters(2.35-.94)/(54.5-23.5);
function stationHeight(y){if(y<=.35)return -STATION_DEPTH+(y+STATION_DEPTH)*(STATION_DEPTH+WALK_HEIGHT)/(STATION_DEPTH+.35);if(y<=23.5)return WALK_HEIGHT+(y-.35)*STATION_COUNTER_SCALE;return WALK_HEIGHT+meters(.94)+(y-23.5)*STATION_UPPER_SCALE}
const STATION={halfX:62,halfZ:55,chamfer:8,depth:STATION_DEPTH,deck:WALK_HEIGHT,receipt:{x:27,z:-31,y:stationHeight(25)},supports:[[-44,-37,3,3.5,52],[44,-37,3,3.5,52],[12,-32,29,7.5,21,2],[-32,-32,8,9,10,.8]].map(s=>[s[0],s[1],s[2],s[3],stationHeight(s[4]),s[5]===undefined?-STATION_DEPTH:stationHeight(s[5])])};
let stationMeshes=null;
function stationDistanceAt(x,z){const a=Math.abs(x-base.x),b=Math.abs(z-base.y);return Math.max(a-STATION.halfX,b-STATION.halfZ,(a+b-STATION.halfX-STATION.halfZ+STATION.chamfer)/Math.SQRT2)}
function stationBlendAt(x,z,height=0){return (1-smoothRange(-.7,.7,stationDistanceAt(x,z)))*smoothRange(-STATION.depth-1,-STATION.depth+1,height)}
function stationSurfaceAt(x,z){const n=coherentNoise(x*.055,z*.055),g=coherentNoise(x*.17,z*.17);return [.55,.545,.475].map(v=>v*(.94+n*.09+(g-.5)*.035))}
// The pinned section shows the same unexcavated block as the main 3D view.
function drawStationSection(c,top,scale,cx,w,h){
 const z=Math.abs(player.y-base.y);if(z>=STATION.halfZ)return;
 const half=Math.min(STATION.halfX,STATION.halfX+STATION.halfZ-STATION.chamfer-z),left=cx+(base.x-half-player.x)*scale,right=cx+(base.x+half-player.x)*scale;
 if(right<0||left>w)return;const a=Math.max(0,left),b=Math.min(w,right),y=top-STATION.deck*scale,g=c.createLinearGradient(0,y,0,h);g.addColorStop(0,'#85816e');g.addColorStop(1,'#44483d');c.fillStyle=g;c.fillRect(a,y,b-a,Math.min(h-y,STATION.depth*scale));
 c.strokeStyle='#c4bda277';c.lineWidth=1;c.beginPath();c.moveTo(a,y);c.lineTo(b,y);if(left>0){c.moveTo(left,y);c.lineTo(left,h)}if(right<w){c.moveTo(right,y);c.lineTo(right,h)}c.stroke();
}
function stationConcreteAt(x,z,height,normal=[0,1,0]){const d=Math.max(0,-height),n=normal.map(v=>Math.pow(Math.abs(v),4)),sum=n.reduce((a,b)=>a+b,0)||1,c=[0,0,0];for(let j=0;j<3;j++)if(n[j]/sum>.001){const uv=j===0?[z,d]:j===1?[x,z]:[x,d],a=sampleInteriorTexture(uv[0],uv[1],'pedra',d,j===1);for(let k=0;k<3;k++)c[k]+=a[k]*n[j]/sum*.89}return c}
function buildStationMeshes(){
 const foundation=[],floor=[],solid=[],details=new ModelBuilder();
 const cream=[.90,.82,.63],iron=[.14,.31,.32],edge=[.29,.47,.44];
 const wood=[.64,.43,.245],olive=[.80,.73,.55],dark=[.105,.22,.235];
 const terracotta=[.69,.32,.205],gold=[.89,.65,.28];
 function quad(out,a,b,c,d,col,flip=false){out.push(...(flip?triangle(a,c,b,col):triangle(a,b,c,col)),...(flip?triangle(a,d,c,col):triangle(a,c,d,col)))}
 function box(out,x,y,z,w,h,d,col,ry=0,rz=0,rx=0){
  const ca=Math.cos(ry),sa=Math.sin(ry),cb=Math.cos(rz),sb=Math.sin(rz),cc=Math.cos(rx),sc=Math.sin(rx);
  const p=(X,Y,Z)=>{X*=w;Y*=h;Z*=d;let a=X*cb-Y*sb,b=X*sb+Y*cb,c=Z;const v=b*cc-c*sc;c=b*sc+c*cc;b=v;return[x+a*ca+c*sa,y+b,z-a*sa+c*ca]};
  for(const f of [[[-.5,0,-.5],[.5,0,-.5],[.5,1,-.5],[-.5,1,-.5]],[[.5,0,.5],[-.5,0,.5],[-.5,1,.5],[.5,1,.5]],[[-.5,0,.5],[-.5,0,-.5],[-.5,1,-.5],[-.5,1,.5]],[[.5,0,-.5],[.5,0,.5],[.5,1,.5],[.5,1,-.5]],[[-.5,1,-.5],[.5,1,-.5],[.5,1,.5],[-.5,1,.5]],[[-.5,0,.5],[.5,0,.5],[.5,0,-.5],[-.5,0,-.5]]])quad(out,...f.map(v=>p(...v)),col,true);
 }
 function beam(out,a,b,w,col){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz),v=[dx/length,dy/length,dz/length],u=Math.abs(v[1])<.95?[v[2],0,-v[0]]:[1,0,0],l=Math.hypot(...u);for(let k=0;k<3;k++)u[k]*=w/(2*l);const q=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]],ring=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>p.map((c,k)=>c+u[k]*s+q[k]*t)),A=ring(a),B=ring(b);for(let k=0;k<4;k++)quad(out,A[k],A[(k+1)%4],B[(k+1)%4],B[k],col);quad(out,...A,col,true);quad(out,...B,col)}
 function cylinder(out,x,y,z,r,h,col,n=12){for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,A=[x+Math.cos(a)*r,y,z+Math.sin(a)*r],B=[x+Math.cos(b)*r,y,z+Math.sin(b)*r],C=[B[0],y+h,B[2]],D=[A[0],y+h,A[2]];quad(out,A,B,C,D,col,true);out.push(...triangle([x,y+h,z],D,C,col,[0,1,0]))}}
 // Eight-sided footing with a small bevel, not a paper-thin floating tile.
 const outline=[[-54,-55],[54,-55],[62,-47],[62,47],[54,55],[-54,55],[-62,47],[-62,-47]];
 for(let i=0;i<8;i++){const a=outline[i],b=outline[(i+1)%8],A=[a[0],-STATION.depth,a[1]],B=[b[0],-STATION.depth,b[1]],C=[b[0],-.7,b[1]],D=[a[0],-.7,a[1]],E=[b[0]*.985,.35,b[1]*.985],F=[a[0]*.985,.35,a[1]*.985];quad(foundation,A,B,C,D,[.49,.485,.425],true);quad(foundation,D,C,E,F,[.61,.59,.50],true);foundation.push(...triangle([0,.35,0],F,E,[.55,.545,.475],[0,1,0]));}
 // A low curb only behind the workbench; the receiving apron stays open.
 box(solid,0,-5,-50,99,8,3,[.49,.475,.40]);
 // Heights in model space; metricMesh applies the station's vertical scale.
 const weighbridgeEdgeY=.98,floorDetailY=1.05;
 box(floor,0,.55,-33,96,.12,32,[.57,.56,.47]);
 // Steel weighbridge, inset flush with the apron. Its cuts follow the hole.
 box(floor,0,.8,13,62,.32,44,dark);
 for(let i=0;i<7;i++)box(floor,-26.1+i*8.7,1.13,13,8.1,.22,40,[.36+i%2*.025,.46+i%2*.022,.43+i%2*.018]);
 for(const x of [-31.7,31.7])box(floor,x,weighbridgeEdgeY,13,1.1,.45,45,edge);
 for(const z of [-9.6,35.6])box(floor,0,weighbridgeEdgeY,z,65,.45,1.1,edge);
 // Four worn paint corners frame the loading space without a giant marker.
 for(const x of [-43,43])for(const z of [-9,40]){box(floor,x,floorDetailY,z,8,.035,1.2,gold);box(floor,x+Math.sign(x)*3.4,floorDetailY,z-Math.sign(z)*3,1.2,.035,7,gold)}
 // Drain channels and three broad expansion joints, all stable in world space.
 for(let i=0;i<10;i++)box(floor,50,floorDetailY,-9+i*4.5,3.6,.06,1.2,[.28,.31,.27]);
 for(const x of [-49,45])box(floor,x,floorDetailY,2,.38,.025,91,[.39,.40,.34]);
 box(floor,0,floorDetailY,-16,95,.025,.4,[.39,.40,.34]);
 // Rear work bay: two load-bearing piles stay embedded far below the slab.
 for(const x of [-44,44]){
  for(let i=0;i<18;i++){const y=-STATION.depth+i*40,v=(i%3-1)*.008;box(solid,x,y,-37,6,40,7,[.43+v,.435+v,.365+v])}
  box(solid,x,0,-37,6,2.3,7,[.43,.435,.365]);
  box(solid,x,2.3,-37,3,50,3,iron);box(solid,x,2.3,-37,8,.9,8,edge);
  for(const dx of [-2.8,2.8])for(const dz of [-2.8,2.8])cylinder(solid,x+dx,3.2,-37+dz,.45,.45,cream,6);
  beam(solid,[x,39,-37],[x-Math.sign(x)*11,52,-37],1.5,edge);
 }
 // Unequal cabinets, recessed toe kick, doors, rails and a real timber top.
 for(const z of [-39,-25])box(solid,0,.8,z,91,1.5,2,iron);
 for(const x of [-44,0,44])box(solid,x,.8,-32,2,1.5,16,iron);
 box(solid,12,2,-32,58,19,15,olive);box(solid,12,2,-23.95,54,2,1,dark);
 for(const x of [-2,26]){
  box(solid,x,5,-24.25,26,14,.7,iron);
  for(let j=0;j<4;j++)box(solid,x-8.55+j*5.7,6,-23.86,5.2,12,.08,
   [.255+j%2*.018,.49+j%2*.018,.445+j%2*.015]);
  box(solid,x+8,14,-23.5,4,.7,1.2,gold);
 }
 box(solid,12,22.75,-32,62,.65,18,wood);
 box(solid,12,22.75,-22.88,62,.32,.26,gold);
 for(const z of [-37.6,-31.8,-26])box(solid,12,23.4,z,60,.025,.16,[.35,.255,.16]);
 box(solid,12,23.4,-40.55,62,3.7,.9,wood);
 // Receiving pan and a small mechanical dial, rather than a blank block.
 box(solid,27,23.5,-31,16,.8,11,[.50,.61,.58]);
 for(const x of [19.3,34.7])box(solid,x,24.3,-31,.6,1.8,11,edge);
 box(solid,27,24.3,-36.2,14.8,1.8,.6,edge);
 // Precision details use final world units: the dial, ticks and pointer share
 // one circular coordinate system instead of being stretched by stationHeight.
 const dial={x:4,y:stationHeight(30.1),z:-33.08,r:2.7};
 const dialBottom=dial.y-3.4,counterTop=stationHeight(23.5);
 details.box(dial.x,counterTop,-35,2,dial.y-counterTop,2,iron,0,.12);
 details.box(dial.x,dialBottom,-33.6,7.4,6.8,.8,iron,0,.2);
 details.box(dial.x,dial.y+3.4,-33.6,8,.6,1.6,iron,0,.12);
 for(let i=0;i<24;i++){
  const a=i/24*Math.PI*2,c=(i+1)/24*Math.PI*2;
  details.tri([dial.x,dial.y,dial.z],
   [dial.x+Math.cos(a)*dial.r,dial.y+Math.sin(a)*dial.r,dial.z],
   [dial.x+Math.cos(c)*dial.r,dial.y+Math.sin(c)*dial.r,dial.z],cream,0,[0,0,1]);
 }
 for(let i=0;i<7;i++){
  const a=.3+i*(Math.PI-.6)/6;
  details.tube([[dial.x+Math.cos(a)*2.05,dial.y+Math.sin(a)*2.05,dial.z+.05],
   [dial.x+Math.cos(a)*2.4,dial.y+Math.sin(a)*2.4,dial.z+.05]],.065,dark,0,4);
 }
 details.tube([[dial.x,dial.y,dial.z+.13],[dial.x-1.4,dial.y+1.3,dial.z+.13]],.11,dark,0,4);
 details.box(dial.x,dial.y-.16,dial.z+.15,.32,.32,.12,terracotta,0,0);
 // An open sorting crate with a few pieces left inside, not a sealed cube.
 box(solid,-32,.8,-32,16,1.2,18,[.42,.415,.34]);
 box(solid,-32,2,-32,17,1,19,dark);
 for(const x of [-40.2,-23.8])box(solid,x,3,-32,1.2,7,19,wood);
 for(const z of [-41,-23])for(let i=0;i<3;i++)box(solid,-32,3+i*2.4,z,16,1.9,1,wood);
 for(const x of [-38,-26])box(solid,x,3,-22.4,1.1,7,.6,edge);
 for(const p of [[-36,-34,2.9],[-30,-28,3.1],[-27,-36,2.6]]){cylinder(solid,p[0],3,p[1],meters(.033),p[2],[.52,.56,.46],10);cylinder(solid,p[0],3+p[2],p[1],meters(.031),.12,[.32,.37,.31],10)}
 // One reusable packing box and a folded tally sheet on the worktop.
 box(solid,-8,23.5,-33,10,6,8,[.72,.51,.30]);box(solid,-8,29.5,-33,1.2,.04,8,[.89,.76,.49]);
 box(solid,12,23.55,-28.7,7,.12,4.8,[.88,.83,.69],-.12);
 for(let i=0;i<3;i++){
  const offset=-.9+i*.8,angle=-.12;
  box(solid,12+Math.sin(angle)*offset,23.67,-28.7+Math.cos(angle)*offset,4,.025,.15,[.39,.40,.33],angle);
 }
 // Sloping standing-seam roof, with fascia, gutter and downpipe.
 const roofAngle=-.095,roofY=z=>52.3-(z+35)*Math.tan(roofAngle);
 box(solid,0,52.3,-35,103,.7,37,terracotta,0,0,roofAngle);
 for(let i=0;i<13;i++)box(solid,-46.8+i*7.8,53,-35,.7,.55,36,[.79,.43,.27],0,0,roofAngle);
 box(solid,0,roofY(-16.5)-2.3,-16.5,105,3,1.5,iron);
 box(solid,0,roofY(-16.5)-.25,-15.70,103,.4,.16,cream);
 box(solid,0,roofY(-53)-1.4,-53,105,2.1,1.4,edge);
 // Drain the low rear edge; both bends now touch the gutter and the slab.
 beam(solid,[-48,roofY(-53)-.8,-53],[-48,3,-53],1.4,edge);
 beam(solid,[-48,3,-53],[-45,1,-50],1.4,edge);
 // Dark fascia plaque, hand-set geometric lettering, two visible fasteners.
 const plaque={width:54,height:11.2,y:stationHeight(roofY(-16.5)-1.1)-11.2,z:-15.34};
 details.box(0,plaque.y,plaque.z,plaque.width,plaque.height,.85,dark,0,.25);
 details.box(0,plaque.y+.7,plaque.z+.46,50,.32,.12,gold,0,0);
 for(const x of [-25,25])details.box(x,plaque.y+plaque.height/2-.25,plaque.z+.48,.5,.5,.16,gold,0,0);
 // Broad scuffs on the approach, no tiny random flecks or floating decoration.
 for(const [x,z,w,l]of [[-16,44,3,5],[13,46,2,4],[-45,20,2,6],[40,31,3,4]])box(floor,x,floorDetailY,z,w,.02,l,[.49,.49,.42],.15);
 function metricMesh(data,extra=[]){
  for(let i=0;i<data.length;i+=9)data[i+1]=stationHeight(data[i+1]);
  for(let i=0;i<data.length;i+=27){const ax=data[i+9]-data[i],ay=data[i+10]-data[i+1],az=data[i+11]-data[i+2],bx=data[i+18]-data[i],by=data[i+19]-data[i+1],bz=data[i+20]-data[i+2];let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,l=Math.hypot(nx,ny,nz)||1;if(nx*data[i+3]+ny*data[i+4]+nz*data[i+5]<0)l=-l;for(let j=0;j<3;j++){data[i+j*9+3]=nx/l;data[i+j*9+4]=ny/l;data[i+j*9+5]=nz/l}}
  return mesh(data.concat(extra));
 }
 return {foundation:metricMesh(foundation),floor:metricMesh(floor),solid:metricMesh(solid,details.data)};
}
function drawWorldBase(){stationMeshes??=buildStationMeshes();for(const [key,material]of [['foundation',11],['floor',0],['solid',0]])drawMesh(stationMeshes[key],base.x,0,base.y,1,1,1,[1,1,1],material)}

