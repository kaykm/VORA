const VIEW_RANGES={very_low:.38,low:.55,reduced:.75,default:1,ultra:1.8};
function viewRangeFactor(){return VIEW_RANGES[state.viewRange]||1}
function initViewRange(){
 if(!Object.prototype.hasOwnProperty.call(VIEW_RANGES,state.viewRange))state.viewRange='default';
 const control=$('viewRange');control.value=state.viewRange;
 control.onchange=()=>{state.viewRange=Object.prototype.hasOwnProperty.call(VIEW_RANGES,control.value)?control.value:'default';pausedRenderStamp='';if(lighting?.image)lighting.image.historyValid=false;persist()};
}
