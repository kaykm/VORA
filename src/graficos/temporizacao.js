function observeImageCadence(interval){const image=lighting?.image;if(image&&interval>4&&interval<35)image.refresh=Math.min(image.refresh,interval)}
function beginImageTiming(){
 const image=lighting?.image;if(!image?.timer||state.imageMode!=='auto'||frameCount<45||frameCount%15)return;
 const ext=image.timer,now=performance.now();
 if(image.pending.length){const q=image.pending[0];if(ext.getQueryObjectEXT(q,ext.QUERY_RESULT_AVAILABLE_EXT)){
  image.pending.shift();const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT),ms=ext.getQueryObjectEXT(q,ext.QUERY_RESULT_EXT)/1000000;ext.deleteQueryEXT(q);
  if(!disjoint&&Number.isFinite(ms)&&ms>0){
   image.average=image.average?image.average*.7+ms*.3:ms;
   const budget=Math.min(14.5,Math.max(4,image.refresh*.88));image.slow=image.average>budget*1.08?image.slow+1:0;image.fast=image.average<budget*.69?image.fast+1:0;
   if(now>image.cooldown&&(image.slow>=3||image.fast>=10)){
    const next=Math.max(.67,Math.min(.90,image.scale+(image.slow>=3?-.04:.02)));
    if(next!==image.scale){image.scale=Math.round(next*100)/100;updateImageViewport();image.cooldown=now+1500}image.slow=image.fast=0;
   }
  }
 }}
 if(image.pending.length<3){const q=ext.createQueryEXT();ext.beginQueryEXT(ext.TIME_ELAPSED_EXT,q);image.active=q}
}
function endImageTiming(){const image=lighting?.image;if(image?.active){image.timer.endQueryEXT(image.timer.TIME_ELAPSED_EXT);image.pending.push(image.active);image.active=null}}
