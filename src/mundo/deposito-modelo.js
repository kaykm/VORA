// The floor and usable volume retain the depotSlots contract. Rails meet end to
// end instead of crossing with coplanar top faces at the four crate corners.
function buildDepotCrate(){
 const [w,d,h]=depotDimensions(),b=new ModelBuilder();
 const wood=[.64,.43,.245],iron=[.19,.37,.37],bolt=[.88,.68,.36];
 const z=13,y=STATION.deck+.3,post=1.2,rail=1.5;
 b.box(0,y,z,w,.8,d,iron,0,.2);
 for(const x of [-w/2,w/2])for(const Z of [z-d/2,z+d/2])
  b.box(x,y,Z,post,h,post,iron,0,.16);
 const bottom=y+1.35,top=y+h-.65,gap=.7,plank=(top-bottom-2*gap)/3;
 for(let row=0;row<3;row++){
  const Y=bottom+row*(plank+gap),color=modelColor(wood,1+(row-1)*.025);
  for(const x of [-w/2,w/2])b.box(x,Y,z,1,plank,d-post,color,0,.12);
  for(const Z of [z-d/2,z+d/2])b.box(0,Y,Z,w-post,plank,1,color,0,.12);
 }
 for(const x of [-w/2,w/2])b.box(x,y+h,z,rail,.8,d+rail,iron,0,.14);
 for(const Z of [z-d/2,z+d/2])b.box(0,y+h,Z,w-rail,.8,rail,iron,0,.14);
 for(const x of [-w/2,w/2])for(const Z of [z-d/2-.64,z+d/2+.64])
  for(const Y of [y+2,y+h-1.2])b.box(x,Y,Z,.42,.42,.12,bolt,0,0);
 // A small parcel badge identifies the stock box without covering its contents.
 const badgeY=y+h*.47,badgeZ=z+d/2+.57,ink=[.17,.31,.30];
 b.box(0,badgeY,badgeZ,8,2.8,.15,[.88,.80,.59],0,0);
 const mark=(x0,y0,x1,y1)=>b.quad([x0,badgeY+y0,badgeZ+.09],[x1,badgeY+y0,badgeZ+.09],
  [x1,badgeY+y1,badgeZ+.09],[x0,badgeY+y1,badgeZ+.09],ink,0,[0,0,1]);
 mark(-2,.55,2,.70);mark(-2,2.05,2,2.20);mark(-2,.55,-1.85,2.20);mark(1.85,.55,2,2.20);mark(-.08,1.4,.08,2.20);
 return b.bake();
}
function buildDepotPile(){const data=[],slots=depotSlots();for(let i=0;i<state.depot.length;i++){if(depotPending.has(i))continue;const e=state.depot[i],raw=getModelMesh(e.t,e.variant,0).vertices,p=slots[i];for(let k=0;k<raw.length;k+=9)data.push(raw[k]+p.x,raw[k+1]+p.y,raw[k+2]+p.z,...raw.subarray(k+3,k+9))}return mesh(data)}
function drawDepot(){const previousReactive=reactiveDraw;reactiveDraw=previousReactive||(depotFlights.length>0);try{if(!depotCrates.has(state.depotLevel))depotCrates.set(state.depotLevel,buildDepotCrate());drawMesh(depotCrates.get(state.depotLevel),base.x,0,base.y,1,1,1,[1,1,1],14);depotMesh??=buildDepotPile();drawMesh(depotMesh,base.x,0,base.y,1,1,1,[1,1,1],14);
 for(const f of depotFlights){if(!f.visible||f.time<f.delay)continue;const t=Math.min(1,(f.time-f.delay)/unloadingDuration()),u=t*t*(3-2*t),P=f.target,x=f.start[0]+(base.x+P.x-f.start[0])*u,z=f.start[2]+(base.y+P.z-f.start[2])*u,y=t<.38?f.start[1]+(Math.max(STATION.deck+meters(.45),P.y+meters(.20))-f.start[1])*(1-Math.pow(1-t/.38,3)):Math.max(STATION.deck+meters(.45),P.y+meters(.20))+(P.y-Math.max(STATION.deck+meters(.45),P.y+meters(.20)))*smoothRange(.38,1,t)+Math.sin((t-.38)/.62*Math.PI)*meters(.12),q=f.q.map((v,i)=>v*(1-u)+(i===3?u:0)),l=Math.hypot(...q)||1,tmp={q:q.map(v=>v/l),matrix:f.matrix};bodyMatrix(tmp);setBodyRotation(f.matrix);setBodyPivot(x,y+f.half,z);drawObject(f.entry.t,x,z,y,0,f.entry.variant)}gl.uniformMatrix4fv(uniforms.bodyRotation,false,BODY_IDENTITY)}finally{reactiveDraw=previousReactive}}

