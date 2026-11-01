let shapeContext=null;
const noiseScratchA=new Float64Array(3),noiseScratchB=new Float64Array(3),basinScratch=new Float64Array(3);
function cavityContext(distance=travelDistance){
 const r=physicalRadius(),d=cavityDepth(),level=cavityVisual.level;
 if(shapeContext&&shapeContext.r===r&&shapeContext.d===d&&shapeContext.level===level&&shapeContext.distance===distance&&shapeContext.x===player.x&&shapeContext.z===player.y&&shapeContext.elevation===cavityVisual.elevation)return shapeContext;
 const s=level*7.173+3.71,p=distance/26;
 return shapeContext={r,d,level,distance,s,x:player.x,z:player.y,elevation:cavityVisual.elevation,phase:distance/1800,cx:Math.sin(s)*.075,cz:Math.cos(s*1.37)*.07,qx:.93+.10*Math.sin(s),qz:1.05+.12*Math.cos(s),center:coherentNoise(s*2,-s*.7),rise:Math.min(d*.52,r*.65),a2:1.2*Math.sin(p*.31+.3),a3:Math.sin(p*.23+1.1),a4:.8*Math.sin(p*.19+2.2),angles:new Map()};
}
function apertureRadius(angle,distance=travelDistance,baseRadius=physicalRadius()){const p=distance/26,a2=1.2*Math.sin(p*.31+.3),a3=Math.sin(p*.23+1.1),a4=.8*Math.sin(p*.19+2.2);return baseRadius*(1+.040*Math.sin(2*angle+a2)+.026*Math.sin(3*angle+a3+.9)+.012*Math.sin(4*angle+a4+1.7))}
function pointInAperture(dx,dz,baseRadius=physicalRadius(),distance=travelDistance){const d2=dx*dx+dz*dz,r2=baseRadius*baseRadius;if(d2<r2*.849)return true;if(d2>r2*1.163)return false;const r=apertureRadius(Math.atan2(dz,dx),distance,baseRadius);return d2<r*r}
function angularProfile(angle,ctx=cavityContext()){
 let p=ctx.angles.get(angle);if(p)return p;
 const c=Math.cos(angle),s=Math.sin(angle),r=ctx.r,phase=ctx.distance/220,n=coherentNoise(c*1.6+phase*.9,s*1.6-phase*.6)-.5,n2=coherentNoise(c*3.1-phase*.4,s*3.1+phase*.3)-.5;
 const opening=r*(1+.040*Math.sin(2*angle+ctx.a2)+.026*Math.sin(3*angle+ctx.a3+.9)+.012*Math.sin(4*angle+ctx.a4+1.7));
 p={c,s,opening,width:Math.max(1.8,r*.25)*(1+n*.28+n2*.09),height:Math.min(2.6,.4+r*.025)*(1+n*.32+n2*.10),peak:Math.min(2.8,r*.08)*(1+n*.20),inset:Math.min(3.1,r*.065)*(1+n*.18),drop:Math.max(.7,Math.min(4,ctx.d*.075)),bend:n*.16};
 p.end=opening*(.62+coherentNoise(c*1.1+ctx.s,s*1.1-ctx.s)*.09);p.start=opening-p.inset;p.y0=-p.drop;
 sampleBasin(c*p.end,s*p.end,ctx,basinScratch);p.y3=basinScratch[0];p.endDX=basinScratch[1];p.endDZ=basinScratch[2];const slope=p.endDX*c+p.endDZ*s;
 p.r2=p.end+(p.start-p.end)*.42;p.y1=p.y0+(p.y3-p.y0)*(.54+.055*Math.sin(angle*3+1.7)+.03*Math.sin(angle*5+ctx.distance/900));p.y2=p.y3+slope*(p.r2-p.end);
 p.fold3=angle*3+ctx.distance/650;p.fold5=angle*5+1.3+ctx.distance/650*.6;p.amplitude=Math.min(3.2,(p.start-p.end)*.07);
 // Anchor each radial cut at its crest. Sampling a curb again on every inner row
 // used to fold the rolled lip back upwards as it crossed the pavement edge.
 const crest=p.opening+p.peak;p.surface=terrainElevationAt(ctx.x+c*crest,ctx.z+s*crest);
 p.blendDepth=Math.max(Math.min(12,ctx.d*.55),Math.abs(p.surface-ctx.elevation)*1.6+.001);
 if(ctx.angles.size>2048)ctx.angles.clear();ctx.angles.set(angle,p);return p;
}
function lipProfile(angle,distance=travelDistance){return angularProfile(angle,cavityContext(distance))}
function sampleBasin(x,z,ctx,out){
 const X=x/ctx.r-ctx.cx,Z=z/ctx.r-ctx.cz,q=X*X*ctx.qx+Z*Z*ctx.qz;
 const coarse=noiseSample(X*2.3+ctx.s+ctx.phase,Z*2.3-ctx.s+ctx.phase*.4,noiseScratchA),fine=noiseSample(X*6.2+ctx.s*2,Z*6.2-ctx.s*.7,noiseScratchB),fade=Math.exp(-q*9),a=1+(coarse[0]-.5)*.45,b=fine[0]-ctx.center;
 out[0]=-ctx.d+ctx.rise*(q*a+.09*b*(1-fade));
 const dqX=2*X*ctx.qx,dqZ=2*Z*ctx.qz;
 out[1]=ctx.rise/ctx.r*(dqX*a+q*.45*coarse[1]*2.3+.09*(fine[1]*6.2*(1-fade)+b*fade*9*dqX));
 out[2]=ctx.rise/ctx.r*(dqZ*a+q*.45*coarse[2]*2.3+.09*(fine[2]*6.2*(1-fade)+b*fade*9*dqZ));
 return out;
}
function basinHeight(x,z,distance=travelDistance){const ctx=cavityContext(distance),X=x/ctx.r-ctx.cx,Z=z/ctx.r-ctx.cz,q=X*X*ctx.qx+Z*Z*ctx.qz,coarse=coherentNoise(X*2.3+ctx.s+ctx.phase,Z*2.3-ctx.s+ctx.phase*.4),fine=coherentNoise(X*6.2+ctx.s*2,Z*6.2-ctx.s*.7);return-ctx.d+ctx.rise*(q*(1+(coarse-.5)*.45)+.09*(fine-ctx.center)*(1-Math.exp(-q*9)))}
function basinNormal(x,z,distance=travelDistance){const q=sampleBasin(x,z,cavityContext(distance),basinScratch),len=Math.hypot(q[1],1,q[2]);return[-q[1]/len,1/len,-q[2]/len]}
function basinRadius(angle,distance=travelDistance){return angularProfile(angle,cavityContext(distance)).end}
function sampleWall(p,u,out){
 const v=1-u,v2=v*v,u2=u*u,a=p.fold3+u*3.2,b=p.fold5-u*2.4,wave=p.amplitude*(Math.sin(a)*.62+Math.sin(b)*.38),envelope=16*u2*v2;
 out[0]=v2*v*p.start+3*v2*u*p.start+3*v*u2*p.r2+u2*u*p.end+envelope*wave;
 out[1]=v2*v*p.y0+3*v2*u*p.y1+3*v*u2*p.y2+u2*u*p.y3;
 if(out.length>2){out[2]=6*v*u*(p.r2-p.start)+3*u2*(p.end-p.r2)+32*u*v*(v-u)*wave+envelope*p.amplitude*(3.2*Math.cos(a)*.62-2.4*Math.cos(b)*.38);out[3]=3*v2*(p.y1-p.y0)+6*v*u*(p.y2-p.y1)+3*u2*(p.y3-p.y2)}
 return out;
}
const wallScratch=new Float64Array(2),wallGeometryScratch=new Float64Array(4);
function wallSection(angle,u,distance=travelDistance){return Array.from(sampleWall(angularProfile(angle,cavityContext(distance)),u,wallScratch))}
function liftCavityAt(y,p){const datum=cavityVisual.elevation||0;return y+datum+(y<=-p.blendDepth?0:(p.surface-datum)*(1-smoothRange(0,p.blendDepth,-y)))}
function surfaceVertex(angle,section,u,distance=travelDistance){const ctx=cavityContext(distance),p=angularProfile(angle,ctx);let rho,y;if(section==='outer'){rho=p.opening+p.width-(p.width-p.peak)*u;y=p.height*quintic(u)}else if(section==='roll'){const t=u*Math.PI/2;rho=p.opening+p.peak-(p.peak+p.inset)*Math.sin(t);y=p.height-(p.height+p.drop)*(1-Math.cos(t))}else if(section==='wall'){sampleWall(p,u,wallScratch);rho=wallScratch[0];y=wallScratch[1]}else{rho=p.end*(1-u);y=basinHeight(p.c*rho,p.s*rho,distance)}const x=p.c*rho,z=p.s*rho;return[x,section==='outer'?liftTerrainAt(player.x+x,player.y+z,y):liftCavityAt(y,p),z]}
function cavityBaseHeightAt(x,z){const inner=physicalRadius()*.571;if(x*x+z*z<=inner*inner)return basinHeight(x,z);const rho=Math.hypot(x,z),a=Math.atan2(z,x),p=angularProfile(a);if(rho<=p.end)return basinHeight(x,z);if(rho>=p.start)return 0;let lo=0,hi=1;for(let i=0;i<16;i++){const u=(lo+hi)*.5;if(sampleWall(p,u,wallScratch)[0]>rho)lo=u;else hi=u}return sampleWall(p,(lo+hi)*.5,wallScratch)[1]}
function cavityHeightAt(x,z){const y=cavityBaseHeightAt(x,z);return y>=0?liftTerrainAt(player.x+x,player.y+z,y):y<=-Math.max(Math.min(12,cavityVisual.d*.55),WALK_HEIGHT*1.6+.001)?y+(cavityVisual.elevation||0):liftCavityAt(y,angularProfile(Math.atan2(z,x)))}
