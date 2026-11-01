// Cache changes only when the actual caster silhouette changes. Zooming within
// one LOD keeps the map; crossing a LOD or completing a queued mesh refreshes it.
function shadowSceneLODKey(){
 let key=2166136261,index=0;
 const append=detail=>{key=Math.imul(key^((++index)*3+detail+1),16777619)};
 for(const prop of worldProps){
  if(!worldPropVisible(prop))continue;
  append(prop.type==='tree'?treeModelDetail(prop.p):prop.type==='bench'?benchModelDetail(prop.p):0);
 }
 for(const object of objects){
  if(object.worldProp||!object.alive)continue;
  const h=ASSET_METRICS[object.t].renderHeight;
  append(modelDetailAt(object.x,terrainElevationAt(object.x,object.y)+h*.5,object.y,h));
 }
 for(const tile of groundDetailsBatches||[]){
  const selected=vegetationMeshForView(tile);
  append(selected?(selected===tile.meshes[1]?1:0):-1);
 }
 return key;
}
