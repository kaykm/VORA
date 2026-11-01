// A world-size cutaway proxy, not a fixed-size inventory icon.
function drawSmallCargo(c,t,x,y,unitsToPixels=1){
 const a=ASSET_METRICS[t],w=a.bodySize[0],h=a.bodySize[1],r=w/2;c.save();c.translate(x,y);c.scale(unitsToPixels,unitsToPixels);
 if(t===0){c.fillStyle='#83907b';c.fillRect(-r,-h,w,h);c.fillStyle='#bec5a8';c.fillRect(-r,-h,w*.25,h);c.fillStyle='#aeb69c';c.beginPath();c.ellipse(0,-h,r,r*.25,0,0,Math.PI*2);c.fill()}
 else if(t===1){c.fillStyle='#88917a';c.beginPath();c.moveTo(-r,-h*.2);c.lineTo(-r*.5,-h);c.lineTo(r*.6,-h*.85);c.lineTo(r,-h*.25);c.lineTo(r*.5,0);c.lineTo(-r*.6,0);c.closePath();c.fill()}
 else if(t===4){c.fillStyle='#a8733c';c.fillRect(-r,-h,w,h);c.fillStyle='#435448';c.fillRect(-w*.30,-h,w*.06,h);c.fillRect(w*.24,-h,w*.06,h)}
 else if(t===2){c.fillStyle='#a38458';c.fillRect(-r,-h,w,h);c.fillStyle='#c4a875';c.fillRect(-r,-h,w,h*.15);c.fillStyle='#816748';c.fillRect(0,-h*.85,r,h*.85);c.fillStyle='#c4a875';c.fillRect(-w*.055,-h,w*.11,h)}
 else{c.fillStyle='#b47b59';c.beginPath();c.moveTo(-r,-h);c.lineTo(r,-h);c.lineTo(r*.68,0);c.lineTo(-r*.68,0);c.closePath();c.fill();c.fillStyle='#6f854b';for(const side of [-1,0,1]){c.beginPath();c.moveTo(-r*.12,-h*.9);c.lineTo(side*r*.8,-a.renderHeight+(side?meters(.06):0));c.lineTo(r*.16,-h*.9);c.closePath();c.fill()}}
 c.restore();
}
function drawSoilSection(c,w,h,large=false){
 c.clearRect(0,0,w,h);const top=large?47:25,scaleM=Math.min(large?145:68,(w*.6)/(radius()*2),(h-top-35)/depth()),rx=radius()*scaleM,dep=depth()*scaleM,ry=Math.max(6,rx*.22),cx=w*.46,bottom=top+dep,br=rx*.86,left=large?22:9,right=w-(large?25:12),soilBottom=Math.min(h-18,bottom+ry+22);c.save();
 for(let xx=left;xx<right;xx+=3){const wx=player.x+(xx-cx)/scaleM*WORLD_UNITS_PER_METER;const soil=c.createLinearGradient(0,top,0,soilBottom);soil.addColorStop(0,materialCSS(wx,player.y,-3,meters(depth())));soil.addColorStop(1,materialCSS(wx,player.y,-meters(depth()),meters(depth())));c.fillStyle=soil;c.fillRect(xx,top,3,soilBottom-top)}
 c.save();c.beginPath();c.rect(left,top,right-left,soilBottom-top);c.clip();for(let i=0;i<5;i++){let y=top+10+i*(soilBottom-top)/5;c.strokeStyle=['#c49e674d','#3e2e2155','#ac815544'][i%3];c.lineWidth=2;c.beginPath();c.moveTo(left,y);for(let x=left;x<=right;x+=12)c.lineTo(x,y+Math.sin(x*.035+i)*2);c.stroke()}for(let i=0;i<65;i++){let x=left+((i*.618)%1)*(right-left),y=top+((i*.379)%1)*(soilBottom-top);c.fillStyle=i%3?'#c6a67c35':'#30271a66';c.beginPath();c.ellipse(x,y,1.5+i%2,1,i,0,Math.PI*2);c.fill()}c.restore();
 for(let x=left;x<right;x+=3){const wx=player.x+(x-cx)/scaleM*WORLD_UNITS_PER_METER;c.fillStyle=materialCSS(wx,player.y,0,meters(depth()));c.fillRect(x,top-5,3,6);if(terrainAt(wx,player.y)==='grama'){c.strokeStyle='#929c66';c.lineWidth=1;c.beginPath();c.moveTo(x,top-3);c.lineTo(x-1,top-8-Math.sin(x)*2);c.stroke()}}
 // Match the actual tapered cavity and procedural bottom in the cutaway.
 const sectionPoint=(angle,kind,u)=>{const p=surfaceVertex(angle,kind,u);return[cx+p[0]/WORLD_UNITS_PER_METER*scaleM,top-p[1]/WORLD_UNITS_PER_METER*scaleM]},traceSection=(angle,kind,reverse=false)=>{for(let i=0;i<=24;i++){const [x,y]=sectionPoint(angle,kind,reverse?1-i/24:i/24);c.lineTo(x,y)}};
 c.beginPath();c.moveTo(cx-rx,top);c.bezierCurveTo(cx-rx,top-ry*1.3,cx+rx,top-ry*1.3,cx+rx,top);traceSection(0,'roll');traceSection(0,'wall');traceSection(0,'floor');traceSection(Math.PI,'floor',true);traceSection(Math.PI,'wall',true);traceSection(Math.PI,'roll',true);c.closePath();c.save();c.clip();for(let xx=cx-rx-2;xx<cx+rx+2;xx+=3)for(let yy=top-ry-2;yy<bottom+ry+3;yy+=3){const wx=player.x+(xx-cx)/scaleM*WORLD_UNITS_PER_METER,wy=-Math.max(0,yy-top)/scaleM*WORLD_UNITS_PER_METER;c.fillStyle=materialCSS(wx,player.y,wy,meters(depth()));c.fillRect(xx,yy,3,3)}
 // The textured floor follows the same relief rather than a flat ellipse.
 for(let i=0;i<80;i++){const x=-physicalRadius()*.68+i/80*physicalRadius()*1.36,nx=x+physicalRadius()*1.36/80,y=cavityHeightAt(x,0),ny=cavityHeightAt(nx,0);c.strokeStyle=materialCSS(player.x+x,player.y,y,meters(depth()),true);c.lineWidth=3;c.beginPath();c.moveTo(cx+x/WORLD_UNITS_PER_METER*scaleM,top-y/WORLD_UNITS_PER_METER*scaleM);c.lineTo(cx+nx/WORLD_UNITS_PER_METER*scaleM,top-ny/WORLD_UNITS_PER_METER*scaleM);c.stroke()}
 state.cargo.slice(-14).forEach((t,i)=>{const [x,z]=cargoPosition(i,t),y=cargoSupportHeight(x,z,t,i);drawSmallCargo(c,t,cx+x/WORLD_UNITS_PER_METER*scaleM,top-y/WORLD_UNITS_PER_METER*scaleM,scaleM/WORLD_UNITS_PER_METER)});
 c.restore();
 c.strokeStyle='#c1a578';c.lineWidth=2;c.beginPath();c.ellipse(cx,top,rx,ry,0,Math.PI,Math.PI*2);c.stroke();c.strokeStyle='#ad8758';c.lineWidth=2;c.beginPath();c.moveTo(...sectionPoint(Math.PI,'wall',0));traceSection(Math.PI,'wall');traceSection(Math.PI,'floor');traceSection(0,'floor',true);traceSection(0,'wall',true);c.stroke();
 const bx=Math.min(w-14,cx+rx+(large?30:15));c.strokeStyle='#d6c2a0';c.lineWidth=1;c.beginPath();c.moveTo(bx-4,top);c.lineTo(bx+4,top);c.moveTo(bx,top);c.lineTo(bx,bottom);c.moveTo(bx-4,bottom);c.lineTo(bx+4,bottom);c.stroke();c.fillStyle='#ead9bc';c.font=(large?'12':'9')+'px system-ui';c.textAlign='left';let label=met(depth())+' m';if(bx+45>w){c.textAlign='right';c.fillText(label,bx-7,top+dep*.55)}else c.fillText(label,bx+7,top+dep*.55);
 if(large){c.fillStyle='#bcb69f';c.font='10px system-ui';c.textAlign='left';c.fillText('SUPERFÍCIE',left,top-21);c.textAlign='center';c.fillText('FUNDO',cx,Math.min(h-5,soilBottom+15));c.fillStyle='#a59e8a';c.font='10px system-ui';c.textAlign='right';c.fillText('Raio: '+met(radius())+' m',w-18,22)}c.restore()
}
// A true orthographic cutaway. The section samples the live hole; cargo uses its rigid-body pose.
// Cached terrain + screen-size LOD keep this inspector independent of the main WebGL frame budget.
const insideView={mode:'cut',yaw:Math.PI/4,zoom:1,expanded:false,factor:1,width:332,height:300,ratio:1,drawAt:-Infinity,staticAt:-Infinity,key:'',pose:'',staticLayer:null,frontLayer:null,projection:null,palette:null,paletteKey:'',models:new Map(),drag:null,pointers:new Map(),pinch:0,revision:0,ready:false};
function fitInsidePanel(){
 const panel=$('insidePanel'),b=interfaceBounds(),zoom=Math.max(1,(devicePixelRatio||1)*(window.visualViewport?.scale||1)),pad=12/zoom;
 const large=insideView.expanded,baseW=large?520:360,baseH=large?560:460;
 const requested=menuInterface.factor||1,coarse=window.matchMedia?.('(pointer:coarse)')?.matches;
 const topInset=Math.min(86*requested,b.height*.16),bottom=coarse?Math.min(132*requested,b.height*.25):pad;
 const f=Math.max(.02,Math.min(requested,(b.width-pad*2)/baseW,(b.height-topInset-bottom-pad)/baseH));
 const width=baseW*f,height=baseH*f;
 panel.style.setProperty('--inside-factor',f);panel.style.setProperty('--inside-width',baseW+'px');panel.style.setProperty('--inside-height',baseH+'px');
 panel.style.width=width+'px';panel.style.height=height+'px';panel.style.left=(b.x+pad)+'px';panel.style.top=Math.max(b.y+pad,b.y+b.height-height-bottom)+'px';
 panel.style.borderRadius=(18*f)+'px';
 insideView.factor=f;insideView.width=baseW-28;insideView.height=baseH-160;
 const ratio=Math.max(1.5,Math.min(2.5,(devicePixelRatio||1)*f)),canvas=$('insideCanvas'),pw=Math.round(insideView.width*ratio),ph=Math.round(insideView.height*ratio);
 if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;insideView.key='';insideView.pose=''}
 insideView.ratio=pw/insideView.width;insideView.revision++;
 if(!panel.hidden){refreshPinnedEtching();drawInside(performance.now(),true)}
}
function setInsideMode(mode){
 insideView.mode=mode==='xray'?'xray':'cut';state.insideViewMode=insideView.mode;insideView.key='';insideView.pose='';
 for(const m of ['cut','xray'])$('insideMode-'+m).setAttribute('aria-pressed',String(insideView.mode===m));
 drawInside(performance.now(),true);persist();
}
function turnInside(angle){insideView.yaw=Math.atan2(Math.sin(insideView.yaw+angle),Math.cos(insideView.yaw+angle));insideView.key='';insideView.pose='';drawInside(performance.now(),true)}
function zoomInside(factor,force=true){insideView.zoom=Math.max(1,Math.min(8,insideView.zoom*factor));insideView.key='';insideView.pose='';$('insideZoomOut').disabled=insideView.zoom<=1;$('insideZoomIn').disabled=insideView.zoom>=8;drawInside(performance.now(),force)}
function initInsideView(){
 if(insideView.ready)return;insideView.ready=true;insideView.mode=state.insideViewMode==='xray'?'xray':'cut';
 for(const mode of ['cut','xray']){const b=$('insideMode-'+mode);b.setAttribute('aria-pressed',String(insideView.mode===mode));b.onclick=()=>setInsideMode(mode)}
 $('insideTurnLeft').onclick=()=>turnInside(-Math.PI/6);$('insideTurnRight').onclick=()=>turnInside(Math.PI/6);
 $('insideResetView').onclick=()=>{insideView.yaw=Math.PI/4;insideView.zoom=1;insideView.key='';insideView.pose='';$('insideZoomOut').disabled=true;$('insideZoomIn').disabled=false;drawInside(performance.now(),true)};
 $('insideZoomIn').onclick=()=>zoomInside(1.35);$('insideZoomOut').onclick=()=>zoomInside(1/1.35);$('insideZoomOut').disabled=true;
 $('insideExpand').onclick=()=>{insideView.expanded=!insideView.expanded;const button=$('insideExpand'),label=insideView.expanded?'Reduzir janela do interior':'Ampliar janela do interior';button.setAttribute('aria-pressed',String(insideView.expanded));button.setAttribute('aria-label',label);button.title=label;button.querySelector('use')?.setAttribute('href',insideView.expanded?'#i-contract':'#i-expand');fitInsidePanel()};
 const canvas=$('insideCanvas');
 const distance=()=>{const p=[...insideView.pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0};
 canvas.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;clearGameInput();canvas.focus?.({preventScroll:true});insideView.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});insideView.drag={id:e.pointerId,x:e.clientX};insideView.pinch=distance();canvas.setPointerCapture?.(e.pointerId);e.preventDefault()});
 canvas.addEventListener('pointermove',e=>{if(!insideView.pointers.has(e.pointerId))return;insideView.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(insideView.pointers.size===2){const next=distance();if(insideView.pinch>0)zoomInside(next/insideView.pinch,false);insideView.pinch=next;return}const d=insideView.drag;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x;d.x=e.clientX;insideView.yaw+=dx*.012/Math.max(.4,insideView.factor);insideView.key='';insideView.pose='';drawInside(performance.now())});
 const finish=e=>{if(!insideView.pointers.has(e.pointerId))return;insideView.pointers.delete(e.pointerId);insideView.pinch=0;const first=insideView.pointers.entries().next().value;insideView.drag=first?{id:first[0],x:first[1].x}:null;drawInside(performance.now(),true)};
 canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',finish);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoomInside(Math.exp(-e.deltaY*.002),false)},{passive:false});
 canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','+','=','-','Escape'].includes(e.key))e.stopPropagation();if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();turnInside((e.key==='ArrowLeft'?-1:1)*Math.PI/12)}else if(e.key==='Home'){e.preventDefault();$('insideResetView').onclick()}else if(['+','=','-'].includes(e.key)){e.preventDefault();zoomInside(e.key==='-'?1/1.2:1.2)}else if(e.key==='Escape'){e.preventDefault();setInsidePinned(false)}});
 window.addEventListener('resize',fitInsidePanel);window.visualViewport?.addEventListener('resize',fitInsidePanel);fitInsidePanel();
}
function insidePolygon(c,points,fill,stroke=null,width=.55){
 if(points.length<2)return;c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.closePath();if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}
}
function insideLine(c,points,color,width=1,dash=null){
 if(points.length<2)return;c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.strokeStyle=color;c.lineWidth=width;if(dash)c.setLineDash(dash);c.stroke();if(dash)c.setLineDash([]);
}
function insideRGB(color,shade=1,alpha=1){return 'rgba('+color.map(v=>Math.round(Math.max(0,Math.min(255,v*shade)))).join(',')+','+alpha+')'}
function insidePalette(r,d){
 const key=[Math.floor(player.x/24),Math.floor(player.y/24),Math.round(r),Math.round(d),state.d].join(':');
 if(insideView.paletteKey===key&&insideView.palette)return insideView.palette;
 const layers=[];for(let i=0;i<=16;i++)layers.push(interiorColorAt(player.x+r*.6,player.y,-d*i/16,d,false,[-.6,.25,.75]));
 const ground=groundColorAt(player.x+r*.7,player.y).map(v=>v*255);
 return insideView.palette=(insideView.paletteKey=key,{layers,ground});
}
function insideColorAt(palette,t){const q=Math.max(0,Math.min(16,t*16)),i=Math.min(15,Math.floor(q)),f=q-i;return palette.layers[i].map((v,k)=>v+(palette.layers[i+1][k]-v)*f)}
function insideProjection(r,d,w,h){
 const yaw=insideView.yaw,c=Math.cos(yaw),s=Math.sin(yaw),se=1/Math.sqrt(3),ce=Math.sqrt(2/3),vertical=Math.max(r*.70,Math.min(r*2.4,d))/d,datum=cavityVisual.elevation||0;
 const raw=p=>[c*p[0]-s*p[2],se*(s*p[0]+c*p[2])-ce*p[1]*vertical,ce*(s*p[0]+c*p[2])+se*p[1]*vertical];
 const extent=r*1.40,bottom=-d-r*.12,probes=[];
 for(const x of [-extent,extent])for(const z of [-extent,extent])for(const y of [r*.035,bottom])probes.push(raw([x,y,z]));
 const minX=Math.min(...probes.map(p=>p[0])),maxX=Math.max(...probes.map(p=>p[0])),minY=Math.min(...probes.map(p=>p[1])),maxY=Math.max(...probes.map(p=>p[1]));
 const scale=Math.min((w-62)/(maxX-minX),(h-62)/(maxY-minY)),ox=(w-22)*.5-(minX+maxX)*.5*scale,oy=29-minY*scale;
 const zoom=insideView.zoom,anchor=raw([0,-d*.9,0]),ax=ox+anchor[0]*scale,ay=oy+anchor[1]*scale,t=1-1/zoom,tx=ax+(w*.47-ax)*t,ty=ay+(h*.58-ay)*t;
 return {scale:scale*zoom,vertical,datum,c,s,extent,bottom,near:Math.PI/2-yaw,project:p=>{const q=raw(p);return[tx+(ox+q[0]*scale-ax)*zoom,ty+(oy+q[1]*scale-ay)*zoom,q[2]]},normal:n=>{const y=n[1]/vertical,l=Math.hypot(n[0],y,n[2])||1;return[n[0]/l,y/l,n[2]/l]}};
}
function buildInsideSection(now){
 const v=insideView,w=v.width,h=v.height,r=physicalRadius(),d=cavityDepth(),P=insideProjection(r,d,w,h),palette=insidePalette(r,d),ratio=v.ratio;
 if(!v.staticLayer)v.staticLayer=document.createElement('canvas');if(!v.frontLayer)v.frontLayer=document.createElement('canvas');
 const layer=v.staticLayer,front=v.frontLayer;layer.width=front.width=$('insideCanvas').width;layer.height=front.height=$('insideCanvas').height;
 const c=layer.getContext('2d'),f=front.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);f.setTransform(ratio,0,0,ratio,0,0);
 const bg=c.createRadialGradient(w*.48,h*.33,0,w*.48,h*.45,w*.8);bg.addColorStop(0,'#26382d');bg.addColorStop(.55,'#1a2922');bg.addColorStop(1,'#111d18');c.fillStyle=bg;c.fillRect(0,0,w,h);
 // Quiet stage grid and a soft grounding shadow.
 const center=P.project([0,P.bottom,0]);c.save();c.globalAlpha=.12;for(let i=-4;i<=4;i++){insideLine(c,[-2,2].map(k=>P.project([i*r*.4,P.bottom,k*r])), '#76917a',.5);insideLine(c,[-2,2].map(k=>P.project([k*r,P.bottom,i*r*.4])), '#76917a',.5)}c.restore();
 c.save();c.translate(center[0],center[1]);c.scale(1,.30);const sh=c.createRadialGradient(0,0,0,0,0,r*P.scale*1.4);sh.addColorStop(0,'#040b0855');sh.addColorStop(1,'#040b0800');c.fillStyle=sh;c.beginPath();c.arc(0,0,r*P.scale*1.4,0,Math.PI*2);c.fill();c.restore();
 const faces=[],frontFloor=[],gap=Math.PI*.72,start=P.near+gap*.5,span=Math.PI*2-gap,N=72;
 const outerRadius=a=>P.extent/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)));
 const topColor=p=>({grama:[121,146,76],pedra:[164,164,143],terra:[148,108,69],areia:[198,177,126]})[terrainAt(player.x+p[0],player.y+p[2])];
 const local=(a,section,u)=>{const p=surfaceVertex(a,section,u);return[p[0],p[1]-P.datum,p[2]]};
 const add=(vertices,color,normal,alpha=1)=>{const q=vertices.map(P.project),n=P.normal(normal),light=Math.max(0,n[0]*-.42+n[1]*.83+n[2]*.36),shade=.66+light*.40;faces.push({points:q,z:q.reduce((a,p)=>a+p[2],0)/q.length,color:insideRGB(color,shade,alpha)})};
 for(let i=0;i<N;i++){
  const a=start+i/N*span,b=start+(i+1)/N*span,m=(a+b)/2,pa=angularProfile(a),pb=angularProfile(b),outerA=outerRadius(a),outerB=outerRadius(b);
  const squareA=[Math.cos(a)*outerA,0,Math.sin(a)*outerA],squareB=[Math.cos(b)*outerB,0,Math.sin(b)*outerB];
  add([squareA,squareB,local(b,'outer',0),local(a,'outer',0)],topColor(squareA),[0,1,0]);
  // Visible exterior stone/soil edge; it is not a solid curtain over the cutaway.
  const exteriorNormal=Math.abs(Math.cos(m))>Math.abs(Math.sin(m))?[Math.sign(Math.cos(m)),0,0]:[0,0,Math.sign(Math.sin(m))];
  if(exteriorNormal[0]*P.s+exteriorNormal[2]*P.c>0){for(let j=0;j<12;j++){const y0=-d*j/12,y1=j===11?P.bottom:-d*(j+1)/12;add([[Math.cos(a)*outerA,y0,Math.sin(a)*outerA],[Math.cos(b)*outerB,y0,Math.sin(b)*outerB],[Math.cos(b)*outerB,y1,Math.sin(b)*outerB],[Math.cos(a)*outerA,y1,Math.sin(a)*outerA]],insideColorAt(palette,(j+.5)/12),exteriorNormal)}}
  for(const [section,rows] of [['outer',3],['roll',6],['wall',10]])for(let j=0;j<rows;j++){
   const pts=[local(a,section,j/rows),local(b,section,j/rows),local(b,section,(j+1)/rows),local(a,section,(j+1)/rows)],y=pts.reduce((s,p)=>s+p[1],0)/4;
   const isTop=y>-.5;let normal;
   if(section==='outer')normal=[0,1,0];else{const dr=Math.hypot(pts[3][0],pts[3][2])-Math.hypot(pts[0][0],pts[0][2]),dy=pts[3][1]-pts[0][1],len=Math.hypot(dr,dy)||1;normal=[Math.cos(m)*dy/len,-dr/len,Math.sin(m)*dy/len]}
   add(pts,isTop?topColor(pts[0]):insideColorAt(palette,-y/d),normal);
  }
 }
 // The whole basin stays visible in section, including objects behind the removed wall.
 for(let i=0;i<72;i++){const a=i/72*Math.PI*2,b=(i+1)/72*Math.PI*2,isFront=Math.abs(Math.atan2(Math.sin((a+b)/2-P.near),Math.cos((a+b)/2-P.near)))<gap/2;for(let j=0;j<8;j++){const pts=[local(a,'floor',j/8),local(b,'floor',j/8),local(b,'floor',(j+1)/8),local(a,'floor',(j+1)/8)],mid=pts.reduce((s,p)=>s+p[1],0)/4;add(pts,insideColorAt(palette,-mid/d),[0,1,0]);if(isFront)frontFloor.push(faces[faces.length-1])}}
 faces.sort((a,b)=>a.z-b.z);for(const face of faces)insidePolygon(c,face.points,face.color,face.color,.45);
 // Two real radial cut faces: the contour follows the same lip, wall and basin as collision.
 for(const a of [start,start+span]){
  const p=angularProfile(a),outer=outerRadius(a),contour=[[Math.cos(a)*outer,0,Math.sin(a)*outer],local(a,'outer',0)];
  for(const [section,steps] of [['outer',8],['roll',12],['wall',18],['floor',14]])for(let j=1;j<=steps;j++)contour.push(local(a,section,j/steps));
  const shape=contour.concat([[0,P.bottom,0],[Math.cos(a)*outer,P.bottom,Math.sin(a)*outer]]).map(P.project);
  c.save();insidePolygon(c,shape,'#534536');c.clip();
  for(let j=0;j<32;j++){const y0=-d*j/32,y1=j===31?P.bottom:-d*(j+1)/32,shade=a===start?.84:1.04;insidePolygon(c,[[0,y0,0],[Math.cos(a)*outer,y0,Math.sin(a)*outer],[Math.cos(a)*outer,y1,Math.sin(a)*outer],[0,y1,0]].map(P.project),insideRGB(insideColorAt(palette,(j+.5)/32),shade))}
  for(let j=1;j<8;j++){const y=-d*j/8,pts=[];for(let k=0;k<=16;k++){const rho=outer*k/16;pts.push(P.project([Math.cos(a)*rho,y+Math.sin(k*.8+j)*r*.012,Math.sin(a)*rho]))}insideLine(c,pts,j%2?'#e6c59320':'#1a211a44',.7)}
  for(let i=0;i<145;i++){const rho=outer*((i*.618033989)%1),y=-d*((i*.38196601)%1),q=P.project([Math.cos(a)*rho,y,Math.sin(a)*rho]);c.fillStyle=i%3?'#e4c69c20':'#141e1b4d';c.beginPath();c.ellipse(q[0],q[1],.48+(i%3)*.13,.34,i,0,Math.PI*2);c.fill()}
  c.restore();insideLine(c,contour.map(P.project),'#e3c19799',1.05);insideLine(c,[shape[0],shape[shape.length-1],shape[shape.length-2]],'#b6a17b55',.7);
 }
 // The cut removes the front wall, never the support under the stored objects.
 // Restore the near basin after the radial cut faces so the section cannot hide it.
 frontFloor.sort((a,b)=>a.z-b.z);for(const face of frontFloor)insidePolygon(c,face.points,face.color,face.color,.45);
 const basinEdge=[];for(let i=0;i<=64;i++)basinEdge.push(P.project(local(P.near-gap*.5+i/64*gap,'floor',0)));insideLine(c,basinEdge,'#b5bb9a55',.65);
 // Sparse turf fibers make the top read as ground, without a heavy texture or asset download.
 for(let i=0;i<90;i++){
  const a=start+((i*.618033989)%1)*span,p=angularProfile(a),min=p.opening+p.width*.55,max=outerRadius(a),rho=min+(max-min)*((i*.38196601)%1),x=Math.cos(a)*rho,z=Math.sin(a)*rho;
  if(terrainAt(player.x+x,player.y+z)!=='grama')continue;
  const q=P.project([x,r*.006,z]),tip=P.project([x+r*.012*Math.sin(i),r*(.02+i%3*.004),z]);insideLine(c,[q,tip],i%3?'#b4c68a66':'#485f3866',.65);
 }
 const back=[],ghost=[];for(let i=0;i<=96;i++){const a=P.near+gap*.5+i/96*span;back.push(P.project(local(a,'outer',1)));const g=P.near-gap*.5+i/96*gap;ghost.push(P.project(local(g,'outer',1)))}
 insideLine(c,back,'#c3ce9d99',1);insideLine(c,ghost,'#bfcba742',.8,[3,4]);
 if(v.mode==='xray'){
  f.save();f.globalAlpha=.12;for(let i=0;i<30;i++){const a=P.near-gap*.5+i/30*gap,b=P.near-gap*.5+(i+1)/30*gap;for(let j=0;j<10;j++)insidePolygon(f,[local(a,'wall',j/10),local(b,'wall',j/10),local(b,'wall',(j+1)/10),local(a,'wall',(j+1)/10)].map(P.project),'#7ebcae')};f.restore();
  for(const u of [.0,.25,.5,.75,1]){const pts=[];for(let i=0;i<=50;i++)pts.push(P.project(local(P.near-gap*.5+i/50*gap,'wall',u)));insideLine(f,pts,'#9ed5be45',.65,[2,3])}
  for(let j=0;j<=6;j++){const a=P.near-gap*.5+j/6*gap,pts=[];for(let i=0;i<=20;i++)pts.push(P.project(local(a,'wall',i/20)));insideLine(f,pts,'#9ed5be35',.65)}
 }
 // Dimension marks use real meters even when a very thin/deep hole needs a readable schematic scale.
 if(v.zoom<=1.01){const topY=19,left=P.project([-P.c*r,0,P.s*r])[0],right=P.project([P.c*r,0,-P.s*r])[0];
 insideLine(c,[[left,topY+4],[left,topY-2],[left,topY+1],[right,topY+1],[right,topY-2],[right,topY+4]],'#c3b28b66',.75);
 const label='Ø '+met(r*2/WORLD_UNITS_PER_METER)+' m';c.font='500 10px system-ui';c.textAlign='center';c.fillStyle='#e0d0ac';const tw=c.measureText(label).width;c.fillStyle='#1c2c22';c.fillRect((left+right-tw)/2-5,topY-7,tw+10,13);c.fillStyle='#e0d0ac';c.fillText(label,(left+right)/2,topY+3);
 const x=w-19,y0=P.project([0,0,0])[1],y1=P.project([0,-d,0])[1];insideLine(c,[[x-3,y0],[x+3,y0],[x,y0],[x,y1],[x-3,y1],[x+3,y1]],'#d3b98977',.8);
 c.save();c.translate(x+10,(y0+y1)*.5);c.rotate(-Math.PI/2);c.font='9px system-ui';c.textAlign='center';c.fillStyle='#e3cba0';c.fillText(met(d/WORLD_UNITS_PER_METER)+' m',0,0);c.restore();}
 else{c.font='500 9px system-ui';c.textAlign='left';c.fillStyle='#ddcead';c.fillText('Inspeção da carga · '+v.zoom.toFixed(1).replace('.',',')+'×',11,19)}
 if(Math.abs(P.vertical-1)>.02){c.font='8px system-ui';c.textAlign='left';c.fillStyle='#a6b69a';c.fillText('Escala vertical adaptada',11,h-28)}
 v.projection=P;v.staticAt=now;v.stats={surfaceFaces:faces.length};
}
function getInsideCargoModel(t,variant=0){
 const key=t+':'+variant;if(insideView.models.has(key))return insideView.models.get(key);
 const b=new ModelBuilder(),a=ASSET_METRICS[t],[w,h,d]=a.bodySize,r=w/2;
 if(t===0){
  const metal=[.72,.75,.67],paint=[[.38,.50,.36],[.64,.36,.25],[.65,.64,.48]][variant%3];
  b.lathe([[0,0],[r*.82,0],[r,.08*h],[r,.88*h],[r*.87,h],[0,h]],metal,1,16);
  b.lathe([[r*1.008,h*.18],[r*1.008,h*.78]],paint,0,16);b.lathe([[r*1.01,h*.72],[r*1.01,h*.78]],[.85,.80,.62],0,16);
  b.box(0,h*1.005,0,w*.12,h*.018,d*.30,[.27,.33,.27],0,0);
 }else if(t===1)b.blob([0,h*.47,0],[w*.51,h*.53,d*.51],4.1+variant*2.3,[.53,.57,.49],0,1,true);
 else if(t===4){b.box(0,0,0,w,h,d,[.61,.40,.22],0,.15);for(const x of [-w*.28,w*.28])b.box(x,0,0,w*.06,h,d*1.02,[.27,.34,.29],0,0)}
 else if(t===2){b.box(0,0,0,w,h,d,[.69,.53,.34],0,Math.min(w,h)*.028);b.box(0,h+.015,0,w*.14,.025,d*.96,[.87,.73,.50],0,0);b.box(-w*.15,h*.40,d*.502,w*.32,h*.28,.025,[.89,.85,.69],0,0)}
 else{
  b.lathe([[0,0],[r*.65,0],[r*.70,h*.08],[r*.90,h*.85],[r,h*.88],[r,h],[r*.80,h],[r*.77,h*.85],[0,h*.85]],[.72,.40,.25],2,16);
  for(let i=0;i<4;i++){const q=i*2.4,x=Math.cos(q)*w*.10,z=Math.sin(q)*d*.10,tip=[x+w*.08*Math.cos(q),a.renderHeight*(.78+i*.055),z+d*.08*Math.sin(q)];b.tube([[x,h*.88,z],tip],[w*.016,w*.007],[.33,.47,.25],0,4);for(let j=0;j<2;j++)b.leaf([tip[0],h+(tip[1]-h)*(.45+j*.2),tip[2]],q+j*2.6,w*.30,w*.28,w*.13,[.38,.59,.30],2)}
 }
 const result=new Float32Array(b.data);insideView.models.set(key,result);return result;
}
function drawInsideCargo(c){
 const v=insideView,P=v.projection;if(!P)return;ensureCargoBodies();const faces=[],tiny=[],r=physicalRadius(),d=cavityDepth();let detailed=0;
 const ordered=cargoBodies.map(b=>({b,pixels:(b.resource?b.shape.extent*2:Math.max(...ASSET_METRICS[b.t].bodySize))*P.scale})).sort((a,b)=>b.pixels-a.pixels);
 for(const {b,pixels} of ordered){
  const center=[b.lx,b.z-P.datum+b.half/P.vertical,b.ly],q=P.project(center),a=ASSET_METRICS[b.t],M=b.matrix;
  if(pixels<3.3||faces.length>6000){tiny.push({q,t:b.t,size:Math.max(1.1,pixels*.65)});continue}
  const floor=cavityHeightAt(b.lx,b.ly)-P.datum,contact=P.project([b.lx,floor+.05,b.ly]),radius=Math.max(1,(b.resource?b.shape.extent:a.footprint)*P.scale),lift=Math.max(0,b.z-P.datum-floor),opacity=.22/(1+lift/Math.max(1,b.half));
  c.save();c.translate(contact[0],contact[1]);c.scale(1,1/Math.sqrt(3));const shadow=c.createRadialGradient(0,0,0,0,0,radius*1.25);shadow.addColorStop(0,'rgba(3,10,7,'+opacity+')');shadow.addColorStop(1,'#030a0700');c.fillStyle=shadow;c.beginPath();c.arc(0,0,radius*1.25,0,Math.PI*2);c.fill();c.restore();
  const visual=b.resource?b.shape.visual:null,data=visual?visual.mesh.vertices:getInsideCargoModel(b.t,b.modelVariant??0),modelScale=visual?.scale||[1,1,1],scale=pixels<6?.96:1;
  for(let i=0;i<data.length;i+=27){
   const points=[];for(let j=0;j<3;j++){const k=i+j*9,x=data[k]*scale*modelScale[0],y=data[k+1]*scale*modelScale[1]-b.half,z=data[k+2]*scale*modelScale[2];points.push(P.project([center[0]+M[0]*x+M[4]*y+M[8]*z,center[1]+(M[1]*x+M[5]*y+M[9]*z)/P.vertical,center[2]+M[2]*x+M[6]*y+M[10]*z]))}
   const area=(points[1][0]-points[0][0])*(points[2][1]-points[0][1])-(points[1][1]-points[0][1])*(points[2][0]-points[0][0]);if(Math.abs(area)<.10)continue;
   const nx=M[0]*data[i+3]+M[4]*data[i+4]+M[8]*data[i+5],ny=M[1]*data[i+3]+M[5]*data[i+4]+M[9]*data[i+5],nz=M[2]*data[i+3]+M[6]*data[i+4]+M[10]*data[i+5];
   // Stored normals, rather than winding, also handle the plant's two-sided leaves.
   if(nx*P.s*.8165+ny*.57735+nz*P.c*.8165<-.06)continue;
   const lit=.62+Math.max(0,-nx*.42+ny*.83+nz*.36)*.42,finish=Math.floor(data[i+8]*.5+.001),col=[data[i+6]*255,data[i+7]*255,(data[i+8]-finish*2)*255];
   faces.push({points,z:(points[0][2]+points[1][2]+points[2][2])/3,color:insideRGB(col,lit)});
  }
  detailed++;
 }
 faces.sort((a,b)=>a.z-b.z);for(const face of faces)insidePolygon(c,face.points,face.color,face.color,.32);
 tiny.sort((a,b)=>a.q[2]-b.q[2]);for(const o of tiny){c.fillStyle=['#c1c8a3','#a2b49b','#c39a64','#bf825d'][o.t];c.beginPath();c.ellipse(o.q[0],o.q[1],o.size*.52,Math.max(.7,o.size*.43),0,0,Math.PI*2);c.fill()}
 v.stats.cargoFaces=faces.length;v.stats.cargoObjects=cargoBodies.length;v.stats.detailedCargo=detailed;
}
function drawInside(now=performance.now(),force=false){
 const v=insideView;if($('insidePanel').hidden)return;if(!force&&now-v.drawAt<40)return;
 const r=physicalRadius(),d=cavityDepth(),key=[v.width,v.height,v.ratio,v.mode,v.yaw.toFixed(3),v.zoom.toFixed(3),player.x.toFixed(1),player.y.toFixed(1),r.toFixed(2),d.toFixed(2),cavityVisual.level.toFixed(3),cavityVisual.elevation.toFixed(2),Math.floor(travelDistance*2)].join(':');
 const moving=cargoBodies.some(b=>!b.sleeping),pose=state.cargo.join(',')+':'+(moving?cargoBodies.map(b=>[b.t,b.modelVariant,b.lx.toFixed(2),b.ly.toFixed(2),b.z.toFixed(2),...b.q.map(q=>q.toFixed(3))].join(',')).join(';'):'rest');
 if(!force&&v.key===key&&v.pose===pose)return;
 const rebuild=force||!v.projection||v.key!==key&&(now-v.staticAt>70||v.drag||sceneMotionActive);
 if(rebuild){buildInsideSection(now);v.key=key}
 const canvas=$('insideCanvas'),c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(v.staticLayer,0,0);c.setTransform(v.ratio,0,0,v.ratio,0,0);drawInsideCargo(c);
 if(v.mode==='xray'){c.setTransform(1,0,0,1,0,0);c.drawImage(v.frontLayer,0,0);c.setTransform(v.ratio,0,0,v.ratio,0,0)}
 if(!state.cargo.length){const q=v.projection.project([0,-d*.72,0]);c.font='10px system-ui';c.textAlign='center';c.fillStyle='#d9c9aa';c.fillText('Sem carga',q[0],q[1])}
 $('insideRadiusValue').textContent=met(r/WORLD_UNITS_PER_METER)+' m';$('insideDepthValue').textContent=met(d/WORLD_UNITS_PER_METER)+' m';$('insideLoadValue').textContent=fmt(used())+' / '+fmt(capacity())+' L';
 $('insideObjectCount').textContent=state.cargo.length+' '+(state.cargo.length===1?'objeto':'objetos');
 v.drawAt=now;v.pose=pose;
}


