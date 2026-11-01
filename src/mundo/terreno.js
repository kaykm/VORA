// One continuous pavement domain. Geometry, collision and excavation sample this same field.
const WALK_HEIGHT=meters(.11),WALK_BEVEL_HEIGHT=meters(.092),WALK_BEVEL_WIDTH=1.8,walkScratch=new Float64Array(2);
const MEADOW_WALK={x:-40,z:-40,rx:620,rz:500,width:36};
let walkMesh=null,walkMeshStats=null;
let walkRouteTable=null;
function walkRouteFormula(t,axis,out=walkScratch){const q=t+40;if(Math.abs(q)<=(axis?100:160)){out[0]=-40;out[1]=45;return out}const e=smoothRange(axis?100:160,axis?320:340,Math.abs(q));out[0]=-40+e*(18*Math.sin(q*.0045+.4+axis*.8)+9*Math.sin(q*.009-1));out[1]=45+e*3*Math.sin(q*.006+1.2);return out}
function walkRouteAt(t,axis,out=walkScratch){
 if(Math.abs(t+40)<=(axis?100:160)){out[0]=-40;out[1]=45;return out}
 if(!walkRouteTable){walkRouteTable=new Float64Array(2801*4);for(let i=0;i<=2800;i++)for(let a=0;a<2;a++){walkRouteFormula(i-1400,a,out);walkRouteTable[i*4+a*2]=out[0];walkRouteTable[i*4+a*2+1]=out[1]}}
 if(t< -1400||t>=1400)return walkRouteFormula(t,axis,out);
 const u=t+1400,i=Math.floor(u),f=u-i,k=i*4+axis*2;out[0]=walkRouteTable[k]+(walkRouteTable[k+4]-walkRouteTable[k])*f;out[1]=walkRouteTable[k+1]+(walkRouteTable[k+5]-walkRouteTable[k+1])*f;return out;
}
function junctionRadiusAt(){return 30}
function roundedWalkUnion(a,b,r){return Math.min(-r,Math.max(a,b))+Math.hypot(Math.max(r+a,0),Math.max(r+b,0))}
function primaryWalkFieldAt(x,z){const a=walkRouteAt(z,0),vertical=a[1]-Math.abs(x-a[0]),b=walkRouteAt(x,1),horizontal=b[1]-Math.abs(z-b[0]);return roundedWalkUnion(vertical,horizontal,30)}
// A single quarter circuit returns to the two avenues at perpendicular T junctions.
function meadowWalkFieldAt(x,z){const dx=x+40,dz=z+40;if(dx<0)return 36-Math.hypot(dx,dz-500);if(dz<0)return 36-Math.hypot(dx-620,dz);const q=Math.hypot(dx/620,dz/500),g=Math.hypot(dx/(620*620),dz/(500*500));return 36-Math.abs(q-1)*q/Math.max(g,.000001)}
function walkFieldAt(x,z){const inner=roundedWalkUnion(primaryWalkFieldAt(x,z),meadowWalkFieldAt(x,z),24);return Math.max(Math.abs(x),Math.abs(z))<900?inner:roundedWalkUnion(inner,outerWalkFieldAt(x,z),20)}
function terrainElevationAt(x,z){
 if(Math.max(Math.abs(x),Math.abs(z))<900&&Math.abs(x+40)>80&&Math.abs(z+40)>80){if(x< -80||z< -80)return 0;const q=((x+40)/620)**2+((z+40)/500)**2;if(q<.76||q>1.26)return 0}
 const f=walkFieldAt(x,z);return WALK_BEVEL_HEIGHT*smoothRange(-.12,.12,f)+(WALK_HEIGHT-WALK_BEVEL_HEIGHT)*Math.max(0,Math.min(1,f/WALK_BEVEL_WIDTH))}
function liftTerrainAt(x,z,y){const datum=cavityVisual.elevation||0,blendDepth=Math.min(12,cavityVisual.d*.55);if(y<=-blendDepth)return y+datum;const local=terrainElevationAt(x,z);if(y>=0)return y+local;return y+datum+(local-datum)*(1-smoothRange(0,blendDepth,-y))}
function topWeightsAt(x,z){const w=surfaceWeightsAt(x,z),old=w[1],p=smoothRange(-.16,.16,walkFieldAt(x,z)),sum=1-old;if(sum>.00001){for(const i of [0,2,3])w[i]=w[i]/sum*(1-p)}else{w[0]=1-p;w[2]=w[3]=0}w[1]=p;return w}
// Benches occupy the grass verge. No paving circles or disconnected concrete islands.
const BENCH_SITES=[];
for(const [id,axis,t,side]of [['west',1,-385,1],['entry',0,225,-1],['north',0,-435,1],['east',1,295,-1]]){const r=Array.from(walkRouteFormula(t,axis)),offset=r[1]+31;BENCH_SITES.push({id,x:axis?t:r[0]+side*offset,z:axis?r[0]+side*offset:t,target:axis?[t,r[0]]:[r[0],t]})}
for(const [i,a]of [.30,.77,1.20].entries()){const cx=-40+620*Math.cos(a),cz=-40+500*Math.sin(a),gx=Math.cos(a)/620,gz=Math.sin(a)/500,L=Math.hypot(gx,gz);BENCH_SITES.push({id:'meadow-'+i,x:cx+gx/L*70,z:cz+gz/L*70,target:[cx,cz]})}
function regionFieldsAt(x,z){
 const n=(coherentNoise(x*.009+23,z*.009-7)-.5)*36,m=(coherentNoise(x*.008-17,z*.008+4)-.5)*42,core=[100-Math.hypot(Math.max(345-x,0),Math.max(220-z,0))+n,145-Math.hypot(Math.max(405+x,0),Math.max(325+z,0))+m],t=Math.max(Math.abs(x),Math.abs(z))<880?0:smoothRange(1240,1550,Math.hypot(x,z)+n*2);
 if(t===0)return core;
 const dirt=Math.max(260-Math.hypot(x-1460,z+980),280-Math.hypot(x-1430,z-1220),210-Math.hypot(x+1150,z-1300))+n,sand=280-Math.hypot(x+1400,z+1180)+m;
 return [core[0]+(dirt-core[0])*t,core[1]+(sand-core[1])*t];
}
function trailWeightAt(x,z){const center=205+32*Math.sin(z*.006-.2),width=5+2*Math.sin(z*.013+.8),d=Math.abs(x-center)-width;return (1-smoothRange(-1,2,d))*smoothRange(25,70,z)*(1-smoothRange(540,620,z))}
// Broad, filtered leaf-shaped turf detail joins the 3D colonies without adding more meshes.
function turfFoliageAt(x,z){let coverage=0,light=0;for(let layer=0;layer<2;layer++){const X=(x+layer*4.3)/8.5,Z=(z+layer*5.7)/8.5,ix=Math.floor(X),iz=Math.floor(Z),f=[fract(X)-.5,fract(Z)-.5],h=materialHash(ix+layer*11.3,iz-7.1),a=h*6.283,c=Math.cos(a),sn=Math.sin(a),u=(f[0]*c+f[1]*sn)/.64,v=(-f[0]*sn+f[1]*c)/.34,r=Math.hypot(u,v),leaf=1-smoothRange(.80,1.03,r);if(leaf>coverage){coverage=leaf;light=(h-.5)*.045+(1-Math.min(1,Math.abs(v)))*.025}}return[coverage,light]}
function paveSlabJS(along,across,x,z,cw,L,seed){
 const u=across/cw+.5,col=Math.floor(u),fc=u-col;
 const v=along/L+(((col%2)+2)%2)*.5,row=Math.floor(v),fr=v-row;
 const joint=Math.min(Math.min(fc,1-fc)*cw,Math.min(fr,1-fr)*L),cell=materialHash(col+seed,row+seed*1.7);
 const seam=1-smoothRange(.12,.65,joint),bevel=1-smoothRange(.35,1.25,joint);
 const mineral=coherentNoise((x+cell*31)*.18,(z+seed)*.18),grit=coherentNoise(x*.85,z*.85);
 const weather=coherentNoise(x*.014,z*.014),vein=coherentNoise(along*.025+mineral*.25,across*.075);
 const clay=smoothRange(.84,.98,cell)*.22,flecks=smoothRange(.67,.84,grit);
 return [.735,.715,.640].map((base,i)=>{
  let color=(base+([.68,.53,.39][i]-base)*clay)*(1+(cell-.5)*.065+(weather-.5)*.045+(mineral-.5)*.045+(vein-.5)*.025);
  color*=1+([.78,.80,.81][i]-1)*flecks*.18;
  return (color+([.43,.435,.385][i]-color)*seam*.56)*(1-bevel*.045);
 });
}
function paveCoreColorAt(x,z){
 const a=Array.from(walkRouteAt(z,0)),b=Array.from(walkRouteAt(x,1)),dx=x+40,dz=z+40,ex=dx/620,ez=dz/500,q=Math.hypot(ex,ez),g=Math.max(Math.hypot(dx/384400,dz/250000),.000001),clamp=v=>Math.max(-60,Math.min(60,v));
 let wV=Math.exp(clamp(a[1]-Math.abs(x-a[0]))*.3),wH=Math.exp(clamp(b[1]-Math.abs(z-b[0]))*.3),wM=Math.exp(clamp(36-Math.abs(q-1)*q/g)*.3);const sum=wV+wH+wM;wV/=sum;wH/=sum;wM/=sum;
 const c=[0,0,0];let ws=0;const add=(col,w)=>{for(let i=0;i<3;i++)c[i]+=col[i]*w;ws+=w};
 if(wV>.01){const m=(walkRouteAt(z+1,0)[0]-walkRouteAt(z-1,0)[0])*.5,t=x-a[0];add(paveSlabJS(z+m*t,t*45/a[1],x,z,30,64,0),wV)}
 if(wH>.01){const m=(walkRouteAt(x+1,1)[0]-walkRouteAt(x-1,1)[0])*.5,t=z-b[0];add(paveSlabJS(x+m*t,t*45/b[1],x,z,30,64,31),wH)}
 if(wM>.01)add(paveSlabJS(Math.atan2(ez,ex)*560,(q-1)*q/g,x,z,24,52,67),wM);
 const edge=1-smoothRange(1.4,3.7,walkFieldAt(x,z)),base=c.map(v=>v/Math.max(ws,.001));
 return base.map((v,i)=>v+([.80,.78,.69][i]-v)*edge*.38);
}
function terrainMaterialAt(x,z,type){
 const macro=coherentNoise(x*.014,z*.014),n=coherentNoise(x*.035,z*.035),grain=coherentNoise(x*.23,z*.23);let c;
 if(type==='pedra')return paveColorAt(x,z);
 if(type==='grama'){
  const macro2=coherentNoise(x*.0065+3.1,z*.0065-7.4),meso=coherentNoise(x*.022-11,z*.022+5),dry=smoothRange(.50,.78,coherentNoise(x*.011+41,z*.011+9)),trail=trailWeightAt(x,z),mixc=(p,q,t)=>p.map((v,i)=>v+(q[i]-v)*t);
  let c=mixc([.155,.335,.13],[.37,.575,.235],smoothRange(.18,.8,meso*.6+n*.4));
  c=mixc(c,[.43,.62,.25],smoothRange(.45,.9,macro2)*.55);c=mixc(c,[.56,.62,.30],dry*.26);
  c=mixc(c,[.22,.54,.29],smoothRange(.62,.80,coherentNoise(x*.045-4,z*.045+19))*.35);
  const mowed=.5+.5*smoothRange(.3,.6,coherentNoise(x*.004+13,z*.004-5)),stripe=smoothRange(-.35,.35,Math.sin((x*.8+z*.6)/46*Math.PI)),k=(1+(stripe-.5)*.08*mowed)*(1+(coherentNoise(x*.14,z*.14)-.5)*.14)*(1+(grain-.5)*.07);
  c=c.map(v=>v*k);
  const foot=trail*(.22+.25*coherentNoise(x*.075,z*.075))*smoothRange(.28,.68,coherentNoise(x*.032+11,z*.032-3));c=mixc(c,[.48,.33,.19],foot);
  const wf=walkFieldAt(x,z),contact=(1-smoothRange(.35,2.3,Math.abs(wf)))*.10+(wf<=0?(1-smoothRange(0,14,-wf))*.05:0);return c.map(v=>v*(1-contact));
 }
 const sand=type==='areia',lo=sand?[.77,.655,.445]:[.46,.295,.185],hi=sand?[.89,.79,.59]:[.65,.455,.295];
 const drift=coherentNoise(x*.018+z*.007,z*.07),fine=coherentNoise(x*.32,z*.32),pores=smoothRange(.70,.86,coherentNoise(x*1.1,z*1.1));
 return lo.map((v,i)=>(v+(hi[i]-v)*(n*.72+drift*.28)+(fine-.5)*.035)*(1-pores*(sand?.045:.10)));
}
