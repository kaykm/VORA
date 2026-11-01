let openMenu=null,menuAnchor=null;
function placeMenu(){positionSurfaceMenu()}
function closeMenu(restoreFocus=false,immediate=false){closeGraphicsPicker(false);const anchor=menuAnchor;const menu=openMenu;if(menu?.id==='objectCheckModal'){endObjectInspection();immediate=true;}if(menu?.id==='skillTreeModal')immediate=true;if(menu===$('upgradePanel'))finishUpgradePageMotion();if(menu===$('settingsModal'))setResetConfirmation(false);openMenu=null;menuAnchor=null;if(anchor)anchor.setAttribute('aria-expanded','false');closeMenuAnimated(menu,immediate);if(restoreFocus&&anchor?.isConnected)anchor.focus({preventScroll:true});keys={};joy={x:0,y:0};$('stick').style.transform='';last=performance.now()}
let activeUpgradePage='hole';const UPGRADE_PAGES=['hole','spawns','sales','speed'];
let upgradePageMotion=null;
function finishUpgradePageMotion(){
 const motion=upgradePageMotion;if(!motion)return;upgradePageMotion=null;
 for(const animation of motion.animations){activeUIAnimations.delete(animation);animation.cancel()}
 motion.wrapper.style.height='';delete motion.wrapper.dataset.moving;
 delete $('upgradePanel').dataset.pageTransition;
 for(const key of UPGRADE_PAGES){
  const page=$('upgradePage-'+key),selected=key===activeUpgradePage;
  page.hidden=!selected;page.inert=!selected;page.setAttribute('aria-hidden',String(!selected));
  for(const prop of ['position','left','right','top','pointerEvents'])page.style[prop]='';
 }
 placeMenu();
}
function setUpgradePage(key,focus=false){
 if(!UPGRADE_PAGES.includes(key))return;
 const previous=activeUpgradePage,menu=$('upgradePanel'),wrapper=menu.querySelector('.upgrade-pages');
 const tab=$('upgradeTab-'+key);menu.querySelector('.upgrade-tabs').style.setProperty('--upgrade-index',UPGRADE_PAGES.indexOf(key));
 if(previous===key){refreshUpgradePageLabels();if(focus)tab.focus();return}
 const from=$('upgradePage-'+previous),to=$('upgradePage-'+key),startHeight=wrapper.offsetHeight;
 const oldFrame=currentFrame(from);
 finishUpgradePageMotion();activeUpgradePage=key;refreshUpgradePageLabels();
 for(const name of UPGRADE_PAGES){
  const button=$('upgradeTab-'+name),page=$('upgradePage-'+name),selected=name===key;
  button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
  page.hidden=!selected;page.inert=!selected;page.setAttribute('aria-hidden',String(!selected));
 }
 if(focus)tab.focus();
 if(!menu.open||!motionAllowed()||!wrapper.animate||!from.animate||!to.animate){placeMenu();return}
 const endHeight=to.offsetHeight,direction=UPGRADE_PAGES.indexOf(key)>UPGRADE_PAGES.indexOf(previous)?1:-1;
 wrapper.style.height=startHeight+'px';wrapper.dataset.moving='true';menu.dataset.pageTransition='true';
 // The old page leaves as an overlay: it never adds its height to the new one.
 from.hidden=false;from.style.position='absolute';from.style.left='0';from.style.right='0';from.style.top='0';from.style.pointerEvents='none';
 const motion={wrapper,animations:[]};upgradePageMotion=motion;
 const animate=(node,frames,options)=>{
  const animation=node.animate(frames,{easing:MENU_EASE,fill:'both',...options});
  motion.animations.push(animation);activeUIAnimations.add(animation);return animation;
 };
 try{
  animate(wrapper,[{height:startHeight+'px'},{height:endHeight+'px'}],{duration:340});
  animate(from,[{opacity:oldFrame.opacity,transform:oldFrame.transform},{opacity:0,transform:'translateX('+(-direction*12)+'px)'}],{duration:125,easing:'cubic-bezier(.4,0,1,1)'});
  animate(to,[{opacity:0,transform:'translateX('+(direction*15)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:270,delay:45});
  Promise.all(motion.animations.map(a=>a.finished)).then(()=>{if(upgradePageMotion===motion)finishUpgradePageMotion()}).catch(()=>{if(upgradePageMotion===motion)finishUpgradePageMotion()});
 }catch(error){finishUpgradePageMotion()}
 placeMenu();
}
for(const name of UPGRADE_PAGES){
 const tab=$('upgradeTab-'+name);tab.onclick=()=>setUpgradePage(name);
 tab.onkeydown=e=>{
  const i=UPGRADE_PAGES.indexOf(name);let next;
  if(e.key==='ArrowRight')next=(i+1)%UPGRADE_PAGES.length;
  else if(e.key==='ArrowLeft')next=(i+UPGRADE_PAGES.length-1)%UPGRADE_PAGES.length;
  else if(e.key==='Home')next=0;else if(e.key==='End')next=UPGRADE_PAGES.length-1;else return;
  e.preventDefault();setUpgradePage(UPGRADE_PAGES[next],true);
 };
}

function showModal(id,trigger){if(id==='upgradePanel')setUpgradePage(activeUpgradePage);if(id==='adminModal'&&state.adminEnabled!==true)return;const menu=$(id),anchor=trigger||{cargoModal:$('detailsBtn'),settingsModal:$('settingsBtn'),adminModal:$('adminBtn'),upgradePanel:$('upgradeTab')}[id];if(openMenu===menu){closeMenu(true);return}closeMenu();if(id==='cargoModal')inventory();openMenu=menu;menuAnchor=anchor;anchor.setAttribute('aria-expanded','true');const motionFrom=prepareMenuMotion(menu);menu.style.visibility='hidden';if(!menu.open)menu.show();placeMenu();menu.style.visibility='';animateMenuOpen(menu,motionFrom);keys={};joy={x:0,y:0};$('stick').style.transform='';focusSurfaceMenu(menu)}
let insidePinned=false;function setInsidePinned(pinned){insidePinned=pinned;if(!pinned){insideView.pointers.clear();insideView.drag=null;insideView.pinch=0;}document.documentElement.setAttribute?.('data-inside-pinned',String(pinned));$('insideBtn').setAttribute('aria-expanded',String(pinned));if(pinned){closeMenu(false,true);$('insidePanel').hidden=false;fitInsidePanel()}animatePinnedPanel(pinned)}
$('insideBtn').onclick=()=>setInsidePinned(!insidePinned);$('insideUnpin').onclick=()=>setInsidePinned(false);
$('speedBtn').onclick=()=>{upgrade('v');placeMenu()};$('upgradeSalesBtn').onclick=()=>showModal('cargoModal',$('upgradeTab'));$('spawnBtn').onclick=()=>{upgrade('s');placeMenu()};$('radiusBtn').onclick=()=>{upgrade('r');placeMenu()};$('depthBtn').onclick=()=>{upgrade('d');placeMenu()};$('sellBtn').onclick=sell;$('modalSell').onclick=()=>{closeMenu();sell()};$('detailsBtn').onclick=e=>showModal('cargoModal',e.currentTarget);$('settingsBtn').onclick=e=>{if(!consumeSpawnHoldClick(e))showModal('settingsModal',e.currentTarget)};$('upgradeTab').onclick=e=>showModal('upgradePanel',e.currentTarget);
for(const [trigger,panel] of [['detailsBtn','cargoModal'],['settingsBtn','settingsModal'],['adminBtn','adminModal'],['upgradeTab','upgradePanel']]){const b=$(trigger);b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls',panel);b.setAttribute('aria-expanded','false')}
document.addEventListener('pointerdown',e=>{if(menuInterface.picker&&!customPickerContains(e.target)&&!menuInterface.picker.button.contains(e.target))closeGraphicsPicker(false);if(openMenu&&!customPickerContains(e.target)&&!openMenu.contains(e.target)&&!menuAnchor?.contains(e.target)&&!$('insidePanel').contains(e.target))closeMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openMenu){e.preventDefault();e.stopPropagation();closeMenu(true)}});window.addEventListener('resize',placeMenu);window.visualViewport?.addEventListener('resize',placeMenu);document.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(openMenu)placeMenu()}));
if(typeof ResizeObserver!=='undefined'){const menuObserver=new ResizeObserver(()=>{if(openMenu)placeMenu()});document.querySelectorAll('dialog').forEach(d=>menuObserver.observe(d))}
$('soundToggle').onclick=()=>{state.sound=!state.sound;updateUI();persist();sound()};$('particlesToggle').onclick=()=>{state.particles=state.particles===false;updateUI();persist()};$('motionToggle').onclick=()=>{state.motion=state.motion===false;if(!motionAllowed())finishVisualMotion();syncMotionPreference();updateUI();persist()};$('fpsToggle').onclick=()=>{state.showFps=state.showFps!==true;resetFpsCounter();updateUI();persist()};let resetConfirm=false;$('resetBtn').onclick=()=>setResetConfirmation(!resetConfirm);

document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeMenu(true));document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{if(!d.open&&openMenu===d){const anchor=menuAnchor;openMenu=null;menuAnchor=null;anchor?.setAttribute('aria-expanded','false')}keys={};last=performance.now()}));
