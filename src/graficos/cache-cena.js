// Retain the last presentation while the world is unchanged. Simulation, input,
// DOM menus and inspection particles continue at their normal cadence.
const sceneFrameCache={key:'',settling:0,vp:null,reusing:false,rendered:0,reused:0};
function invalidateSceneFrame(){sceneFrameCache.key='';sceneFrameCache.settling=12;}
function shouldRenderSceneFrame(){
 if(gl.isSoftware)return true;
 const cache=sceneFrameCache;cache.reusing=false;
 if(document.hidden){cache.reusing=true;cache.reused++;return false;}
 let world=2166136261,appearing=false;
 for(let i=0;i<objects.length;i++){
  const o=objects[i];if(!o.alive)continue;
  world=Math.imul(world^(i*7+o.t),16777619);
  if(o.spawnTime!==undefined&&o.spawnTime<1)appearing=true;
 }
 const moving=sceneMotionActive||appearing||fallingItems.length||depotFlights.length||saleGhosts.length||worldResourceFalls.length||
  (state.particles!==false&&particles.length)||cargoBodies.some(b=>!b.sleeping)||resourceWork.jobs.size;
 const key=[world,player.x,player.y,camera.x,camera.y,cameraPan.x,cameraPan.y,cameraPan.z,viewYaw,viewElevation,smoothZoom,
  physicalRadius(),cavityDepth(),cavityVisual.level,cavityVisual.elevation,travelDistance,objectInspection.screenLift,
  state.cargo.length,state.depot.length,state.depotLevel,depotPending.size,spawnLevel(),state.spawnInspector,
  state.imageMode,state.outputMode,state.aaMode,state.aoMode,state.shadowQuality,state.shadowDistance,state.viewRange,
  lighting?.image?.scale,W,H,canvas.width,canvas.height,vegetationResources.generation,vegetationResources.bytes].join(':');
 if(moving||key!==cache.key){cache.key=key;cache.settling=state.aaMode==='taa'?12:0;return true;}
 if(cache.settling>0||lighting?.image?.taaActive&&!lighting.image.historyValid){cache.settling=Math.max(0,cache.settling-1);return true;}
 cache.reusing=true;cache.reused++;return false;
}
function rememberSceneFrame(vp){
 sceneFrameCache.vp=vp;sceneFrameCache.reusing=false;sceneFrameCache.rendered++;
}
document.addEventListener('visibilitychange',invalidateSceneFrame);
