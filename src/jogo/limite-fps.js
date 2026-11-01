const FPS_CAPS=[60,75,90,120,144,180,0];
const frameLimiter={next:null};
function setFpsCap(value){
 const n=Number(value);state.fpsCap=FPS_CAPS.includes(n)?n:60;
 frameLimiter.next=null;resetFpsCounter();$('fpsCap').value=String(state.fpsCap);
}
function allowSceneFrame(now){
 const cap=FPS_CAPS.includes(state.fpsCap)?state.fpsCap:60;
 const interval=Math.max(cap?1000/cap:0,gl.isSoftware?45:0);
 if(!interval)return true;
 if(frameLimiter.next===null){frameLimiter.next=now+interval;return true;}
 if(now+.01<frameLimiter.next)return false;
 frameLimiter.next+=Math.max(1,Math.floor((now-frameLimiter.next)/interval)+1)*interval;
 return true;
}
