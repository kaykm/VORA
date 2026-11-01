const base={x:-150,y:-150};let saveAvailable=true,saved=null;try{saved=JSON.parse(localStorage.getItem('vora-v1'))}catch(e){saveAvailable=false}
function validSave(s){return s&&Number.isInteger(s.r)&&s.r>=0&&s.r<=RADIUS_MAX_LEVEL&&Number.isInteger(s.d)&&s.d>=0&&s.d<=DEPTH_MAX_LEVEL&&Number.isFinite(s.coins)&&s.coins>=0&&Number.isInteger(s.collected)&&s.collected>=0&&Number.isInteger(s.sold)&&s.sold>=0&&Array.isArray(s.cargo)&&s.cargo.length<400&&s.cargo.every(x=>Number.isInteger(x)&&x>=0&&x<ASSET_METRICS.length)}
let state=validSave(saved)?saved:{coins:120,r:0,d:0,cargo:[],collected:0,sold:0,reward1:false,reward2:false,sound:false,particles:true};
if(state.nativeDisplayDefaultsV1!==true){
 // Partidas existentes mantêm suas escolhas; os inicializadores validam o suporte.
 if(!validSave(saved)){state.imageMode='native';state.aaMode='off';state.outputMode='native';state.aoMode='off'}
 state.nativeDisplayDefaultsV1=true;
 // The completed boot persists defaults together with restored cargo and spawns.
}
