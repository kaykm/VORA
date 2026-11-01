function migrateWorldScale(){
 if(state.worldScaleVersion===WORLD_SCALE_VERSION)return;
 const oldR=(.5+state.r*.2)*48,oldD=(.8+state.d*.4)*48,newR=meters(radius()),newD=meters(depth()),oldHalf=[6,5,13,14];
 if(Array.isArray(state.cargoPoses))for(const pose of state.cargoPoses){
  if(!pose||!Number.isInteger(pose.t)||!ASSET_METRICS[pose.t])continue;
  if(Number.isFinite(pose.x))pose.x*=newR/oldR;
  if(Number.isFinite(pose.z))pose.z*=newR/oldR;
  if(Number.isFinite(pose.y))pose.y=(pose.y+oldHalf[pose.t])*newD/oldD-ASSET_METRICS[pose.t].bodySize[1]/2;
 }
 state.worldScaleVersion=WORLD_SCALE_VERSION;
}


