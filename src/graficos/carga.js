function drawPhysicalCargo(b){
 const previousReactive=reactiveDraw;
 reactiveDraw=previousReactive||(!b.sleeping||lighting?.image?.excavationMoving);
 try{
  setBodyRotation(b.matrix);setBodyPivot(player.x+b.lx,b.z+b.half,player.y+b.ly);
  if(b.resource){
   const {mesh,scale}=b.shape.visual;
   drawMesh(mesh,player.x+b.lx,b.z,player.y+b.ly,...scale,[1,1,1],14);
  }else drawObject(b.t,player.x+b.lx,player.y+b.ly,b.z,0,b.modelVariant);
 }finally{reactiveDraw=previousReactive}
}
function drawStored(){ensureCargoBodies();for(const b of cargoBodies)drawPhysicalCargo(b);setBodyRotation(BODY_IDENTITY)}

