// Administration is revealed deliberately; its tools are independent switches.
function syncAdminUI(){
const enabled=state.adminEnabled===true,b=$('adminBtn');b.hidden=!enabled;
$('settingsBtn').dataset.adminEnabled=String(enabled);
for(const [id,on]of [['infiniteMoneyToggle',state.developer===true],['spawnInspectorToggle',state.spawnInspector===true]]){
const button=$(id);button.classList.toggle('on',on);button.setAttribute('aria-checked',String(on));
}
b.dataset.money=String(state.developer===true);syncSpawnDebugUI();
}
function toggleAdminMode(){
state.adminEnabled=state.adminEnabled!==true;
if(!state.adminEnabled){state.developer=false;state.spawnInspector=false;if(openMenu===$('adminModal'))closeMenu(false,true)}
syncAdminUI();updateUI();persist();placeMenu();
if(state.adminEnabled)playUI($('adminBtn'),[{opacity:0,transform:'translateX(-8px) scale(.88)'},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:300});
toast(state.adminEnabled?'Modo ADM ativado':'Modo ADM desativado');
}
function initAdminControls(){
// Existing saves keep their active tools; older currency and inspection flags migrate once.
if(typeof state.adminEnabled!=='boolean')state.adminEnabled=state.developer===true||state.spawnInspector===true;
if(!state.adminEnabled){state.developer=false;state.spawnInspector=false}
$('adminBtn').onclick=e=>{if(state.adminEnabled)showModal('adminModal',e.currentTarget)};
$('infiniteMoneyToggle').onclick=()=>{if(!state.adminEnabled)return;state.developer=state.developer!==true;updateUI();persist()};
$('spawnInspectorToggle').onclick=toggleSpawnInspector;
$('adminDisable').onclick=()=>{if(state.adminEnabled){toggleAdminMode();$('settingsBtn').focus({preventScroll:true})}};
syncAdminUI();
}

