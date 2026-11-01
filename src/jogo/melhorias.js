function missionCheck(){if(!state.reward1&&state.collected>=8){state.reward1=true;state.coins+=60;toast('+60 moedas de bônus')}if(!state.reward2&&state.sold>=1&&state.reward1){state.reward2=true;state.coins+=40;toast('+40 moedas de bônus')}}
function upgrade(which){
 if(!['r','d','s','v'].includes(which))return;
 const c=which==='r'?costR():which==='d'?costD():which==='s'?costS():costV();
 const limit=which==='s'?SPAWN_MAX_LEVEL:which==='v'?SPEED_MAX_LEVEL:which==='r'?RADIUS_MAX_LEVEL:DEPTH_MAX_LEVEL;
 if((state[which]||0)>=limit||(!state.developer&&state.coins<c))return;
 // Keep the player's framing: the radius-dependent default camera otherwise
 // pulls back on purchase and cancels the visible growth at larger levels.
 const cameraDistanceBefore=defaultCameraDistance()*cameraZoomFactor;
 if(!state.developer)state.coins-=c;
 state[which]=(state[which]||0)+1;
 if(which==='r')cameraZoomFactor=cameraDistanceBefore/defaultCameraDistance();
 if(which==='s'){
  rescaleSpawnTimers(regrowthMultiplier()/regrowthMultiplier(spawnLevel()-1),false);
  unlockSpawnAreas();
 }
 sound(720);
 toast(which==='r'?'Raio ampliado':which==='d'?'Profundidade aumentada':which==='v'?
  'Velocidade ampliada para '+speedKmh().toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' km/h':
  'Novas áreas, mais objetos e reposição melhorada');
 updateUI();upgradeFeedback(which);persist();
}
