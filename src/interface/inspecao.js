// Transient inspection: never modifies the object, its spawn or the saved game.
const INSPECTION_HOLD_SECONDS=2,INSPECTION_MASK_SIDE=512;
const objectInspection={
 hold:null,object:null,model:null,savedView:null,focus:null,transition:null,
 age:0,clock:0,screenLift:0,pointer:{x:0,y:0,smoothX:0,smoothY:0},
 projection:null,projectionKey:'',projectionPending:false,lastProjection:-Infinity,raster:null,maskCanvas:null,context:null
};
function cancelObjectHold(){
 if(objectInspection.hold)clearTimeout(objectInspection.hold.timer);
 objectInspection.hold=null;
 if(!objectInspection.object){$('objectHighlight').hidden=true;$('objectHoldHint').hidden=true;}
}
function objectName(o){
 const p=o.worldProp;if(!p)return TYPES[o.t].singular;
 return DOSSIER_PROP_NAMES[p.type==='tree'||p.type==='bench'?p.type:p.kind]?.[0]||TYPES[o.t].singular;
}
function inspectionRay(clientX,clientY){
 const {target}=prepareSceneCamera(),rect=canvas.getBoundingClientRect(),eye=currentEye.slice();
 const f=target.map((v,i)=>v-eye[i]),len=Math.hypot(...f);for(let i=0;i<3;i++)f[i]/=len;
 const rl=Math.hypot(f[0],f[2])||1,right=[-f[2]/rl,0,f[0]/rl];
 const up=[right[1]*f[2]-right[2]*f[1],right[2]*f[0]-right[0]*f[2],right[0]*f[1]-right[1]*f[0]];
 const nx=((clientX-rect.left)/rect.width*2-1)*Math.tan(.37)*(W/H);
 const ny=(1-(clientY-rect.top)/rect.height*2-objectInspection.screenLift)*Math.tan(.37);
 const direction=f.map((v,i)=>v+right[i]*nx+up[i]*ny),dl=Math.hypot(...direction);
 return {eye,direction:direction.map(v=>v/dl)};
}
function rayModelHit(ray,o,model){
 const origin=[o.x,terrainElevationAt(o.x,o.y),o.y],c=Math.cos(model.rotation),s=Math.sin(model.rotation);
 const transform=(p,point)=>{
  const x=p[0]-(point?origin[0]:0),y=p[1]-(point?origin[1]:0),z=p[2]-(point?origin[2]:0);
  return [(c*x-s*z)/model.scale[0],y/model.scale[1],(s*x+c*z)/model.scale[2]];
 };
 const O=transform(ray.eye,true),D=transform(ray.direction,false),v=model.vertices;let best=Infinity;
 for(let i=0;i<v.length;i+=27){
  const ax=v[i],ay=v[i+1],az=v[i+2],ex=v[i+9]-ax,ey=v[i+10]-ay,ez=v[i+11]-az;
  const fx=v[i+18]-ax,fy=v[i+19]-ay,fz=v[i+20]-az;
  const px=D[1]*fz-D[2]*fy,py=D[2]*fx-D[0]*fz,pz=D[0]*fy-D[1]*fx,det=ex*px+ey*py+ez*pz;
  if(Math.abs(det)<1e-9)continue;
  const tx=O[0]-ax,ty=O[1]-ay,tz=O[2]-az,u=(tx*px+ty*py+tz*pz)/det;if(u<0||u>1)continue;
  const qx=ty*ez-tz*ey,qy=tz*ex-tx*ez,qz=tx*ey-ty*ex,w=(D[0]*qx+D[1]*qy+D[2]*qz)/det;
  if(w<0||u+w>1)continue;const t=(fx*qx+fy*qy+fz*qz)/det;if(t>2&&t<best)best=t;
 }return best;
}
function pickInspectableObject(clientX,clientY){
 const ray=inspectionRay(clientX,clientY);let best=Infinity,selected=null;
 for(const o of objects){
  if(!o.alive||o.anim)continue;
  const height=o.worldProp?.p[2]||ASSET_METRICS[o.t].renderHeight;
  const center=[o.x,terrainElevationAt(o.x,o.y)+height*.5,o.y],delta=center.map((v,i)=>v-ray.eye[i]);
  const along=delta.reduce((n,v,i)=>n+v*ray.direction[i],0),bound=Math.hypot(pickupSize(o),height*.5);
  if(along+bound<2||along-bound>best||delta.reduce((n,v,i)=>n+(v-ray.direction[i]*along)**2,0)>bound*bound)continue;
  const hit=rayModelHit(ray,o,dossierModel(o));if(hit<best){best=hit;selected=o;}
 }return selected;
}
function inspectionRenderModel(o){
 const p=o.worldProp,ground=terrainElevationAt(o.x,o.y);let detail=gl.isSoftware?0:1;
 if(!p)detail=modelDetailAt(o.x,ground+ASSET_METRICS[o.t].renderHeight*.5,o.y,ASSET_METRICS[o.t].renderHeight);
 else if(p.type==='tree')detail=modelDetailAt(p.p[0],p.p[2]*.5,p.p[1],p.p[2],230);
 else if(p.type==='bench')detail=modelDetailAt(p.p[0],meters(.45),p.p[1],meters(1.8),74);
 return dossierModel(o,detail);
}

function inspectionCameraView(){
 return {pan:{...cameraPan},distance:viewDistance,zoom:smoothZoom,factor:cameraZoomFactor,
  yaw:viewYaw,elevation:viewElevation,lift:objectInspection.screenLift};
}
function inspectionIsCompact(){return interfaceBounds().width<700*menuInterface.factor;}
function inspectionFocusView(o,model){
 const [width,height,depth]=model.dimensions,aspect=W/H,elevation=Math.max(.45,Math.min(1.12,viewElevation));
 const yaw=viewYaw+.12,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),compact=inspectionIsCompact();
 const horizontal=width*c+depth*s,along=width*s+depth*c;
 const vertical=height*Math.cos(elevation)+along*Math.sin(elevation);
 const distance=Math.min(CAMERA_MAX_DISTANCE,Math.max(meters(.5),
  vertical/(2*Math.tan(.37)*(compact?.34:.46)),horizontal/(2*Math.tan(.37)*aspect*(compact?.65:.40)))+along*.4);
 return {pan:{x:o.x-camera.x,z:o.y-camera.y,
  y:terrainElevationAt(o.x,o.y)+height*.45+Math.min(cavityDepth()*.18,meters(.65))},
  distance,zoom:distance,factor:distance/defaultCameraDistance(),yaw,elevation,lift:compact?.43:0};
}
function startInspectionCamera(to,restoring=false){
 objectInspection.transition={from:inspectionCameraView(),to,elapsed:0,duration:restoring?.65:.95,restoring};
 if(!motionAllowed())tickObjectInspection(0);
}
function cancelInspectionCameraReturn(){
 if(objectInspection.transition?.restoring)objectInspection.transition=null;
}
function inspectObject(o){
 if(!o?.alive||o.anim)return false;
 cancelObjectHold();cameraDrag=null;touches.clear();gesture=null;clearGameInput();closeMenu(false,true);
 const previous=objectInspection.transition?.restoring?objectInspection.transition.to:inspectionCameraView();
 objectInspection.savedView=previous;objectInspection.object=o;objectInspection.model=dossierModel(o);
 objectInspection.focus=inspectionFocusView(o,objectInspection.model);objectInspection.age=0;
 Object.assign(objectInspection.pointer,{x:0,y:0,smoothX:0,smoothY:0});invalidateInspectionProjection();
 const p=o.worldProp,a=dossierAssessment(o),model=objectInspection.model;
 $('objectCheckTitle').textContent=objectName(o);$('objectCheckStatus').textContent=a.status;$('objectCheckReason').textContent=a.reason;
 $('objectCheckValue').textContent=fmt(pickupPrice(o))+' moedas';$('objectCheckVolume').textContent=met(pickupVolume(o))+' L';
 $('objectCheckSize').textContent=model.dimensions.map(v=>met(v/WORLD_UNITS_PER_METER)).join(' × ')+' m';
 $('objectCheckRadius').textContent=met(a.requiredRadius/WORLD_UNITS_PER_METER)+' m';$('objectCheckMaterial').textContent=TYPES[o.t].name;
 $('objectCheckSpawn').textContent=p?dossierAvailability(o):spawnZones.find(z=>z.id===o.zoneId)?.name||'Ponto fixo do parque';
 const menu=$('objectCheckModal');menu.dataset.ready=String(a.ready);menu.style.setProperty('--inspection-reveal','0');
 openMenu=menu;menuAnchor=$('detailsBtn');menuAnchor.setAttribute('aria-expanded','true');
 menu.inert=false;if(!menu.open)menu.show();placeMenu();menu.querySelector('.close').focus({preventScroll:true});
 startInspectionCamera(objectInspection.focus);pausedRenderStamp='';return true;
}
function endObjectInspection(){
 const previous=objectInspection.savedView;
 objectInspection.object=null;objectInspection.model=null;objectInspection.savedView=null;objectInspection.focus=null;
 $('objectHighlight').hidden=true;$('objectHoldHint').hidden=true;invalidateInspectionProjection();
 if(previous)startInspectionCamera(previous,true);
 pausedRenderStamp='';
}
function tickObjectInspection(dt){
 const inspection=objectInspection,moving=motionAllowed();inspection.clock+=dt;
 const hold=inspection.hold;
 if(hold){
  if(!hold.object.alive||hold.object.anim||openMenu)cancelObjectHold();
  else{hold.elapsed+=dt;hold.progress=Math.min(1,Math.max(hold.elapsed,(performance.now()-hold.started)/1000)/INSPECTION_HOLD_SECONDS);}
 }
 if(inspection.object){
  if(!inspection.object.alive){closeMenu(false,true);return;}
  inspection.age+=dt;
  const reveal=moving?Math.min(1,inspection.age/.65):1;
  $('objectCheckModal').style.setProperty('--inspection-reveal',String(1-(1-reveal)**3));
  if(reveal<1)sceneMotionActive=true;
 }
 const transition=inspection.transition;
 if(transition){
  transition.elapsed+=dt;
  const t=moving?Math.min(1,transition.elapsed/transition.duration):1,k=t*t*t*(10+t*(-15+6*t));
  const {from,to}=transition,lerp=(a,b)=>a+(b-a)*k;
  for(const axis of ['x','y','z'])cameraPan[axis]=lerp(from.pan[axis],to.pan[axis]);
  viewDistance=lerp(from.distance,to.distance);smoothZoom=lerp(from.zoom,to.zoom);
  cameraZoomFactor=viewDistance/defaultCameraDistance();viewYaw=lerp(from.yaw,to.yaw);viewElevation=lerp(from.elevation,to.elevation);
  inspection.screenLift=lerp(from.lift||0,to.lift||0);
  if(t===1){cameraZoomFactor=to.factor;inspection.transition=null;}else sceneMotionActive=true;
 }else if(inspection.object&&inspection.focus){
  const pointer=inspection.pointer,k=moving?1-Math.exp(-dt*3.8):1;
  pointer.smoothX+=((moving?pointer.x:0)-pointer.smoothX)*k;pointer.smoothY+=((moving?pointer.y:0)-pointer.smoothY)*k;
  if(Math.abs(pointer.x-pointer.smoothX)<.0005)pointer.smoothX=moving?pointer.x:0;
  if(Math.abs(pointer.y-pointer.smoothY)<.0005)pointer.smoothY=moving?pointer.y:0;
  const yaw=inspection.focus.yaw+pointer.smoothX*.035,elevation=inspection.focus.elevation-pointer.smoothY*.022;
  if(Math.abs(yaw-viewYaw)+Math.abs(elevation-viewElevation)>.00001)sceneMotionActive=true;
  viewYaw=yaw;viewElevation=elevation;
 }else if(inspection.screenLift!==0){
  inspection.screenLift*=moving?Math.exp(-dt*10):0;
  if(Math.abs(inspection.screenLift)<.0001)inspection.screenLift=0;
  sceneMotionActive=true;
 }
 if(inspection.object&&inspection.age<.85)sceneMotionActive=true;
 if(inspection.projectionPending)sceneMotionActive=true;
}

// Project production triangles, rather than their bounding box. The same union is
// used for the outline and the endpoints of the explanatory leader lines.
function projectInspectionMesh(o,model,vp,rect){
 const v=model.vertices,points=new Float32Array(v.length/9*2),c=Math.cos(model.rotation),s=Math.sin(model.rotation);
 const ground=terrainElevationAt(o.x,o.y);let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(let i=0,j=0;i<v.length;i+=9,j+=2){
  const x=v[i]*model.scale[0],y=v[i+1]*model.scale[1]+ground,z=v[i+2]*model.scale[2];
  const wx=c*x+s*z+o.x,wz=-s*x+c*z+o.y,w=vp[3]*wx+vp[7]*y+vp[11]*wz+vp[15];
  if(w<=2){points[j]=points[j+1]=NaN;continue;}
  const px=rect.left+((vp[0]*wx+vp[4]*y+vp[8]*wz+vp[12])/w*.5+.5)*rect.width;
  const py=rect.top+(.5-(vp[1]*wx+vp[5]*y+vp[9]*wz+vp[13])/w*.5)*rect.height;
  points[j]=px;points[j+1]=py;left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
 }
 if(!Number.isFinite(left)||right<rect.left||left>rect.left+rect.width||bottom<rect.top||top>rect.top+rect.height)return null;
 left=Math.max(rect.left,left-4);top=Math.max(rect.top,top-4);right=Math.min(rect.left+rect.width,right+4);bottom=Math.min(rect.top+rect.height,bottom+4);
 return {points,left,top,right,bottom,width:right-left,height:bottom-top,cx:(left+right)*.5,cy:(top+bottom)*.5};
}
function rasterizeInspectionMesh(projection,cache={}){
 const side=INSPECTION_MASK_SIDE,scale=Math.min(1,(side-2)/Math.max(1,projection.width,projection.height));
 const width=Math.min(side,Math.ceil(projection.width*scale)+2),height=Math.min(side,Math.ceil(projection.height*scale)+2);
 const mask=cache.mask??=new Uint8Array(side*side),pixels=cache.pixels??=new Uint8ClampedArray(side*side*4);
 mask.fill(0);pixels.fill(0);
 const points=projection.points;
 for(let i=0;i<points.length;i+=6){
  const ax=(points[i]-projection.left)*scale+1,ay=(points[i+1]-projection.top)*scale+1;
  const bx=(points[i+2]-projection.left)*scale+1,by=(points[i+3]-projection.top)*scale+1;
  const cx=(points[i+4]-projection.left)*scale+1,cy=(points[i+5]-projection.top)*scale+1;
  if(!Number.isFinite(ax+ay+bx+by+cx+cy))continue;
  const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(height-1,Math.floor(Math.max(ay,by,cy)-.5));
  for(let y=y0;y<=y1;y++){
   const scan=y+.5;let lo=Infinity,hi=-Infinity;
   if((ay<=scan&&by>scan)||(by<=scan&&ay>scan)){const x=ax+(scan-ay)*(bx-ax)/(by-ay);lo=Math.min(lo,x);hi=Math.max(hi,x);}
   if((by<=scan&&cy>scan)||(cy<=scan&&by>scan)){const x=bx+(scan-by)*(cx-bx)/(cy-by);lo=Math.min(lo,x);hi=Math.max(hi,x);}
   if((cy<=scan&&ay>scan)||(ay<=scan&&cy>scan)){const x=cx+(scan-cy)*(ax-cx)/(ay-cy);lo=Math.min(lo,x);hi=Math.max(hi,x);}
   if(lo>hi)continue;
   const start=Math.max(0,Math.ceil(lo-.5)),end=Math.min(width-1,Math.floor(hi-.5));
   if(end>=start)mask.fill(1,y*side+start,y*side+end+1);
  }
 }
 // Eight neighbours dilate by one sample; subtracting the union removes internal
 // triangle edges and leaves the real silhouette, including gaps in benches.
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*side+x;if(mask[i])continue;
  if(!(mask[i-1]||mask[i+1]||mask[i-side]||mask[i+side]||mask[i-side-1]||mask[i-side+1]||mask[i+side-1]||mask[i+side+1]))continue;
  const p=i*4;pixels[p]=211;pixels[p+1]=244;pixels[p+2]=184;pixels[p+3]=235;
 }
 Object.assign(cache,{width,height,scale,left:projection.left-1/scale,top:projection.top-1/scale});return cache;
}
function invalidateInspectionProjection(){objectInspection.projection=null;objectInspection.projectionKey='';objectInspection.projectionPending=false;objectInspection.lastProjection=-Infinity;}
function inspectionSurfaceAnchor(side,fraction){
 const r=objectInspection.raster,p=objectInspection.projection,stride=INSPECTION_MASK_SIDE;
 if(!r||!p)return null;
 const row=Math.max(1,Math.min(r.height-2,Math.round(r.height*fraction)));
 for(let offset=0;offset<r.height;offset++)for(const y of offset?[row-offset,row+offset]:[row]){
  if(y<1||y>=r.height-1)continue;
  for(let n=1;n<r.width-1;n++){
   const x=side==='left'?n:r.width-1-n;
   if(r.mask[y*stride+x])return {x:r.left+x/r.scale,y:r.top+y/r.scale};
  }
 }return {x:p.cx,y:p.cy};
}
function drawInspectionAtoms(ctx,p,progress){
 const moving=motionAllowed(),clock=objectInspection.clock;
 const radius=Math.max(24,Math.min(150,Math.max(p.width,p.height)*.65+22));
 ctx.save();ctx.strokeStyle='#e3f4bd';ctx.lineWidth=1.4;
 const ringY=p.cy+Math.min(12,p.height*.12);
 ctx.globalAlpha=.20;ctx.beginPath();ctx.ellipse(p.cx,ringY,radius,radius*.38,-.25,0,Math.PI*2);ctx.stroke();
 ctx.globalAlpha=.9;ctx.beginPath();ctx.ellipse(p.cx,ringY,radius,radius*.38,-.25,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();
 if(moving)for(let i=0;i<24;i++){
  const phase=(clock*.75+i/24)%1,angle=i*2.39996+clock*(i%2?-1:1)*1.5;
  const distance=radius*(1.45-phase)*(1-progress*.45),tilt=i%3*.95-.95;
  ctx.beginPath();
  for(let t=0;t<5;t++){
   const a=angle-t*.055,d=distance+t*2,x=p.cx+Math.cos(a)*d,y=p.cy+Math.sin(a)*d*.58+Math.cos(a)*d*tilt*.3;
   if(t===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.globalAlpha=Math.sin(phase*Math.PI)*.35;ctx.stroke();
  ctx.globalAlpha=.45+Math.sin(phase*Math.PI)*.5;ctx.fillStyle=i%3?'#e2efbd':'#f4d4a0';
  ctx.beginPath();ctx.arc(p.cx+Math.cos(angle)*distance,p.cy+Math.sin(angle)*distance*.58+Math.cos(angle)*distance*tilt*.3,i%4?1.6:2.4,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
function drawInspectionPop(ctx,p){
 if(!motionAllowed()||objectInspection.age>.8)return;
 const t=Math.min(1,objectInspection.age/.8),r=Math.max(p.width,p.height)*.45+14+t*36;
 ctx.save();ctx.strokeStyle='#f1f8d6';ctx.lineWidth=1.5;ctx.globalAlpha=(1-t)**2*.8;
 ctx.beginPath();ctx.ellipse(p.cx,p.cy,r,r*.58,0,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8;ctx.beginPath();ctx.moveTo(p.cx+Math.cos(a)*r,p.cy+Math.sin(a)*r*.58);
  ctx.lineTo(p.cx+Math.cos(a)*(r+6*(1-t)),p.cy+Math.sin(a)*(r+6*(1-t))*.58);ctx.stroke();
 }ctx.restore();
}
function layoutInspectionAnnotations(ctx){
 const menu=$('objectCheckModal'),bounds=interfaceBounds(),p=objectInspection.projection;
 const compact=inspectionIsCompact(),f=Math.min(menuInterface.factor,bounds.width/350,bounds.height/320),pad=24*f;
 menu.dataset.compact=String(compact);menu.style.setProperty('--inspection-scale',String(f));
 const reveal=motionAllowed()?Math.min(1,objectInspection.age/.65):1;
 const nodes=[$('inspectionIdentity'),$('inspectionLoad'),$('inspectionValue'),$('inspectionFit')];
 ctx.save();ctx.globalAlpha=reveal*.75;ctx.strokeStyle='#d6e9c4';ctx.fillStyle='#e1f1c7';ctx.lineWidth=1;
 nodes.forEach((node,i)=>{
  const side=i<2?'left':'right',upper=i%2===0,width=Math.min(240*f,bounds.width*.25-pad);
  let x,y;
  if(compact){
   node.style.left='';node.style.top='';node.style.width='';
   const r=node.getBoundingClientRect();x=side==='left'?r.right:r.left;y=r.top+8*f;
  }else{
   node.style.width=width+'px';
   const left=side==='left'?Math.max(bounds.x+pad,p.left-width-40*f):Math.min(bounds.x+bounds.width-pad-width,p.right+40*f);
   const wanted=p.cy+(upper?-135:48)*f;
   const top=Math.max(bounds.y+pad+42*f,Math.min(bounds.y+bounds.height-pad-node.offsetHeight,wanted));
   node.style.left=left+'px';node.style.top=top+'px';
   x=side==='left'?left+width:left;y=top+9*f;
  }
  const anchor=inspectionSurfaceAnchor(side,upper?.30:.72);if(!anchor)return;
  const direction=side==='left'?-1:1,elbow=anchor.x+direction*Math.min(32*f,Math.abs(x-anchor.x)*.3);
  ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(elbow,anchor.y);ctx.lineTo(x-direction*12*f,y);ctx.lineTo(x,y);ctx.stroke();
  ctx.beginPath();ctx.arc(anchor.x,anchor.y,2.3*f,0,Math.PI*2);ctx.fill();
 });ctx.restore();
}
function updateObjectHighlight(vp){
 const inspection=objectInspection,hold=inspection.hold,o=inspection.object||hold?.object;
 const overlay=$('objectHighlight'),hint=$('objectHoldHint');
 if(!o){overlay.hidden=true;hint.hidden=true;return;}
 const rect=canvas.getBoundingClientRect(),width=innerWidth,height=innerHeight;
 const model=inspectionRenderModel(o),oldModel=inspection.model||hold.model;
 if(model.mesh!==oldModel.mesh){
  if(inspection.object){inspection.model=model;$('objectCheckSize').textContent=model.dimensions.map(v=>met(v/WORLD_UNITS_PER_METER)).join(' × ')+' m';}
  else hold.model=model;
  invalidateInspectionProjection();
 }
 if(!inspection.context){
  inspection.context=overlay.getContext('2d');inspection.maskCanvas=document.createElement('canvas');
  inspection.maskCanvas.width=inspection.maskCanvas.height=INSPECTION_MASK_SIDE;
  const image=inspection.maskCanvas.getContext('2d').createImageData(INSPECTION_MASK_SIDE,INSPECTION_MASK_SIDE);
  inspection.raster={image,pixels:image.data};
 }
 const ratio=Math.min(1.5,devicePixelRatio||1,Math.sqrt(3000000/Math.max(1,width*height))),ctx=inspection.context;
 if(overlay.width!==Math.round(width*ratio)||overlay.height!==Math.round(height*ratio)){
  overlay.width=Math.round(width*ratio);overlay.height=Math.round(height*ratio);invalidateInspectionProjection();
 }
 ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
 // Only the selected mesh is sampled, at most 30 times/s, into a fixed 512² mask.
 const key=Array.from(vp,v=>v.toFixed(5)).join(',')+':'+rect.width+':'+rect.height+':'+rect.left+':'+rect.top;
 if(key!==inspection.projectionKey&&inspection.clock-inspection.lastProjection>=1/30){
  inspection.projection=projectInspectionMesh(o,inspection.model||hold.model,vp,rect);
  inspection.projectionKey=key;inspection.lastProjection=inspection.clock;
  if(inspection.projection){
   rasterizeInspectionMesh(inspection.projection,inspection.raster);
   inspection.maskCanvas.getContext('2d').putImageData(inspection.raster.image,0,0,0,0,inspection.raster.width,inspection.raster.height);
  }
 }
 inspection.projectionPending=key!==inspection.projectionKey;
 const p=inspection.projection;if(!p){overlay.hidden=true;hint.hidden=true;return;}
 overlay.hidden=false;
 const r=inspection.raster;ctx.save();ctx.globalAlpha=hold?.38:.92;ctx.shadowColor='#c6e99e';ctx.shadowBlur=hold?4:9;
 ctx.drawImage(inspection.maskCanvas,0,0,r.width,r.height,r.left,r.top,r.width/r.scale,r.height/r.scale);ctx.restore();
 if(hold){
  drawInspectionAtoms(ctx,p,hold.progress);hint.hidden=false;
  hint.style.left=Math.max(90,Math.min(width-90,p.cx))+'px';hint.style.top=Math.max(16,Math.min(height-65,p.bottom+28))+'px';
  $('objectHoldProgress').textContent=Math.floor(hold.progress*100)+'%';
 }else{hint.hidden=true;drawInspectionPop(ctx,p);layoutInspectionAnnotations(ctx);}
}
function initObjectInspection(){
 canvas.addEventListener('pointerdown',e=>{
  cancelObjectHold();if(openMenu||!gameLoading.ready||e.button>0||touches.size>1)return;
  const object=pickInspectableObject(e.clientX,e.clientY);if(!object)return;
  const hold={id:e.pointerId,x:e.clientX,y:e.clientY,object,model:dossierModel(object),timer:0,started:performance.now(),elapsed:0,progress:0};
  objectInspection.hold=hold;invalidateInspectionProjection();
  hold.timer=setTimeout(()=>{if(objectInspection.hold===hold&&!openMenu)inspectObject(hold.object);},INSPECTION_HOLD_SECONDS*1000);
  updateObjectHighlight(prepareSceneCamera().vp);
 });
 canvas.addEventListener('pointermove',e=>{
  const h=objectInspection.hold;if(h&&h.id===e.pointerId&&Math.hypot(e.clientX-h.x,e.clientY-h.y)>8)cancelObjectHold();
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture','wheel'])canvas.addEventListener(event,cancelObjectHold);
 window.addEventListener('pointermove',e=>{
  if(!objectInspection.object||e.pointerType==='touch')return;
  const b=interfaceBounds(),pointer=objectInspection.pointer;
  pointer.x=Math.max(-1,Math.min(1,(e.clientX-b.x)/b.width*2-1));pointer.y=Math.max(-1,Math.min(1,(e.clientY-b.y)/b.height*2-1));
 });
 const leave=()=>{cancelObjectHold();objectInspection.pointer.x=objectInspection.pointer.y=0;};
 window.addEventListener('blur',leave);document.addEventListener('visibilitychange',leave);
 document.addEventListener('pointerleave',leave);
 window.addEventListener('resize',()=>{
  invalidateInspectionProjection();
  if(objectInspection.object){objectInspection.focus=inspectionFocusView(objectInspection.object,objectInspection.model);startInspectionCamera(objectInspection.focus);}
 });
 const annotations=$('objectCheckModal').querySelector('.inspection-annotations');
 annotations.addEventListener('scroll',()=>{pausedRenderStamp='';});
 $('objectCheckModal').addEventListener('close',()=>{if(objectInspection.object)endObjectInspection();});
}
