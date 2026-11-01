function sceneryVisibleAt(p){
 if(p.kind==='boulder'&&p.resourceArea&&p.radius*H/Math.max(1,Math.hypot(p.p[0]-currentEye[0],p.p[1]-currentEye[2])*.776)<1.25)return false;
const h=p.type==='tree'||p.type==='scenery'?p.p[2]:meters(.9),radius=p.type==='scenery'?p.radius:p.type==='tree'?h*.85:meters(1.1);return Math.hypot(p.p[0]-camera.x,p.p[1]-camera.y)<1100*viewRangeFactor()+radius&&vegetationVisible(p.p[0],h*.5,p.p[1],radius)}
function vegetationMeshForView(tile,request=false,priority=0){
 const distance=Math.hypot(tile.center[0]-currentEye[0],tile.center[1]-currentEye[1],tile.center[2]-currentEye[2]);
 if(gl.isSoftware)tile.near=false;
 else if(tile.near===null)tile.near=distance<530;
 else if(distance<(tile.near?620:470))tile.near=true;
 else if(distance>620)tile.near=false;
 const detail=tile.near?1:0;
 if(request){
  requestVegetationResources(tile,0,priority+distance+100);
  if(detail)requestVegetationResources(tile,1,priority+distance);
 }
 return tile.meshes[detail]||tile.meshes[0]||tile.meshes[1];
}
function drawGroundDetails(){
 if(!groundDetailsBatches)return;const range=viewRangeFactor();
 for(const t of groundDetailsBatches){
  if(!vegetationVisible(...t.center,t.radius))continue;
  if(range<1&&Math.hypot(t.center[0]-camera.x,t.center[2]-camera.y)>1100*range+t.radius)continue;
  const distance=Math.hypot(t.center[0]-currentEye[0],t.center[1]-currentEye[1],t.center[2]-currentEye[2]);
  if(t.outer&&distance>1700*range+t.radius)continue;
  t.lastVisibleFrame=frameCount;
  const ready=vegetationMeshForView(t,true);
  if(ready){t.lastUsed=frameCount;drawMesh(ready,0,0,0,1,1,1,[1,1,1],15)}
 }
 // Resources remain cached until the byte budget needs space.
}
