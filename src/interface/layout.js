const menuInterface={density:window.matchMedia?.('(pointer:coarse)')?.matches?(devicePixelRatio||1):1,factor:1,picker:null,entries:[],popup:null,ready:false,typeahead:'',typedAt:0};
// VORA interface / stable layout, authored controls and independent focus.
const UI_WINDOW_FRAMES={settingsModal:[376,590],upgradePanel:[372,570],cargoModal:[360,520],adminModal:[360,430],dossierModal:[760,660]};
const UI_UPGRADE_COPY={hole:['Dimensões do buraco','Amplie a abertura e a capacidade de coleta.'],spawns:['Mais oportunidades','Libere novas áreas com objetos para coletar.'],sales:['Estrutura da base','Amplie a caixa e organize suas vendas.'],speed:['Ritmo de exploração','Percorra o parque com mais agilidade.']};
const SETTINGS_PAGES=['image','interface','game'];let activeSettingsPage='image';
function interfaceScroll(menu){return menu?.querySelector?.('.menu-scroll')||menu?.querySelector?.('.menu-body')}
function menuFrameFactor(menu){return menu?._uiFactor||menuInterface.factor||1}
function refreshUpgradePageLabels(){
 const copy=UI_UPGRADE_COPY[activeUpgradePage]||UI_UPGRADE_COPY.hole;
 $('upgradePageName').textContent=copy[0];$('upgradePageHint').textContent=copy[1];$('upgradePageIndex').textContent=String(UPGRADE_PAGES.indexOf(activeUpgradePage)+1).padStart(2,'0')+' / 04';
}
function refreshInterfaceHUD(){
 setAnimatedNumber('upgradeWallet',state.developer?'∞':state.coins);
 $('cargoUsage').textContent=met(used())+' / '+capacity()+' L';$('cargoUsageBar').style.width=Math.min(100,used()/capacity()*100)+'%';
 $('settingsSummary').textContent=interfaceScale()+'% · escala dos painéis';
 const options=[['radius','radiusBtn',state.r,RADIUS_MAX_LEVEL,costR()],['depth','depthBtn',state.d,DEPTH_MAX_LEVEL,costD()],['spawn','spawnBtn',spawnLevel(),SPAWN_MAX_LEVEL,costS()],['speed','speedBtn',speedLevel(),SPEED_MAX_LEVEL,costV()],['depotUpgrade','depotUpgradeBtn',state.depotLevel,DEPOT_CAPACITIES.length,depotUpgradeCost()]];
 for(const [prefix,id,level,max,cost]of options){
  const button=$(id),section=button.closest?.('[data-upgrade]'),status=$(prefix+'Status'),maxed=level>=max,affordable=state.developer||state.coins>=cost;
  const condition=maxed?'max':affordable?'ready':'locked';if(section)section.dataset.state=condition;
  status.textContent=maxed?'Nível máximo alcançado':affordable?'Disponível para melhorar':'Faltam '+fmt(Math.max(0,cost-state.coins))+' moedas';
  button.setAttribute('aria-describedby',status.id);
  button.title=maxed?'Nível máximo':affordable?'Comprar melhoria por '+fmt(cost)+' moedas':status.textContent;
 }
 refreshUpgradePageLabels();refreshExtraUpgradeUI();
}
function setResetConfirmation(show,restoreFocus=false){
 resetConfirm=!!show;const panel=$('resetConfirmation'),button=$('resetBtn');panel.hidden=!show;button.setAttribute('aria-expanded',String(!!show));button.textContent='Recomeçar progresso';
 if(show){button.dataset.confirm='true';playUI(panel,[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180});
  requestAnimationFrame(()=>{if(!resetConfirm||!$('settingsModal').open)return;const scroller=interfaceScroll($('settingsModal'));if(!scroller)return;const delta=panel.getBoundingClientRect().bottom-scroller.getBoundingClientRect().bottom+12;if(delta>0)scroller.scrollTop+=delta/menuFrameFactor($('settingsModal'))});
 }else delete button.dataset.confirm;
 if(restoreFocus)button.focus({preventScroll:true});
}
function selectSettingsPage(page,focus=false){
 if(!SETTINGS_PAGES.includes(page))return;
 const menu=$('settingsModal'),scroll=interfaceScroll(menu),old=activeSettingsPage;
 menuInterface.settingsScroll??={};if(scroll)menuInterface.settingsScroll[old]=scroll.scrollTop||0;
 if(old!==page)uiAnimations.get($('settingsPage-'+old))?.cancel();activeSettingsPage=page;
 if(page!=='game')setResetConfirmation(false);
 closeGraphicsPicker(false);
 for(const key of SETTINGS_PAGES){const active=page===key,panel=$('settingsPage-'+key);panel.hidden=!active;panel.inert=!active;panel.setAttribute('aria-hidden',String(!active));$('settingsTab-'+key).setAttribute('aria-selected',String(active));$('settingsTab-'+key).tabIndex=active?0:-1}
 if(scroll)scroll.scrollTop=menuInterface.settingsScroll[page]||0;
 if(old!==page)playUI($('settingsPage-'+page),[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:200});
 if(focus)$('settingsTab-'+page).focus({preventScroll:true});
}
function interfaceFocusable(root){
 return Array.from(root?.querySelectorAll?.('button:not(:disabled),input:not(:disabled),summary,[tabindex]')||[]).filter(n=>n.tabIndex>=0&&!n.hidden&&!n.closest?.('[hidden],[inert]')&&n.getAttribute?.('aria-hidden')!=='true');
}
function focusSurfaceMenu(menu){
 const tab=menu.querySelector?.('[role="tab"][aria-selected="true"]');(tab||menu.querySelector?.('.close')||menu).focus?.({preventScroll:true});
}
function movePickerTab(entry,backward=false){
 closeGraphicsPicker(false);const root=entry.button.closest?.('dialog')||$('settingsModal'),nodes=interfaceFocusable(root),index=nodes.indexOf(entry.button);
 const next=nodes.length?nodes[(index+(backward?-1:1)+nodes.length)%nodes.length]:entry.button;next?.focus({preventScroll:true});
}
function readInterfaceInsets(){
 const node=$('safeInsets');if(!node||typeof getComputedStyle!=='function')return;
 const c=getComputedStyle(node);menuInterface.safe={top:parseFloat(c.paddingTop)||0,right:parseFloat(c.paddingRight)||0,bottom:parseFloat(c.paddingBottom)||0,left:parseFloat(c.paddingLeft)||0};
}
function initUIRedesign(){
 initDossier();initExpansionUI();
 $('resetBtn').onclick=()=>setResetConfirmation(!resetConfirm);
 $('resetCancel').onclick=()=>setResetConfirmation(false,true);
 $('resetConfirmBtn').onclick=()=>{if(!resetConfirm)return;setResetConfirmation(false);reset();focusGameScene()};
 $('detailsBtn').title='Carga · C';$('upgradeTab').title='Melhorias · I';$('settingsBtn').title='Configurações · O';
 document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.isComposing)return;
  if(e.key==='Escape'){
   if(menuInterface.picker)closeGraphicsPicker();else if(openMenu)closeMenu(true);else if(insidePinned)setInsidePinned(false);else return;
   e.preventDefault();e.stopPropagation();return;
  }
  if(e.key==='Tab'&&openMenu&&!menuInterface.picker&&openMenu.contains(e.target)){
   const nodes=interfaceFocusable(openMenu),first=nodes[0],last=nodes.at(-1);if(!first)return;
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}return;
  }
  if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||editableGameTarget(e.target)||menuInterface.picker)return;
  const key=(e.key||'').toLowerCase(),menus={i:['upgradePanel','upgradeTab'],c:['cargoModal','detailsBtn'],o:['settingsModal','settingsBtn']},target=menus[key];if(!target)return;
  e.preventDefault();e.stopPropagation();showModal(target[0],$(target[1]));
 },{capture:true});
 for(const page of SETTINGS_PAGES){$('settingsPage-'+page).inert=page!==activeSettingsPage;$('settingsPage-'+page).setAttribute('aria-hidden',String(page!==activeSettingsPage))}
 for(const page of UPGRADE_PAGES){$('upgradePage-'+page).inert=page!==activeUpgradePage;$('upgradePage-'+page).setAttribute('aria-hidden',String(page!==activeUpgradePage))}
 refreshInterfaceHUD();
}

function interfaceScale(){return Math.max(40,Math.min(160,Number(state.menuScale)||100))}
function interfaceBounds(){
 const v=window.visualViewport,s=menuInterface.safe||{top:0,right:0,bottom:0,left:0};
 return {x:(v?.offsetLeft||0)+s.left,y:(v?.offsetTop||0)+s.top,width:Math.max(1,(v?.width||innerWidth)-s.left-s.right),height:Math.max(1,(v?.height||innerHeight)-s.top-s.bottom)};
}
function applyMenuFrame(menu){
 let base=UI_WINDOW_FRAMES[menu.id];if(!base)return;
 const bounds=interfaceBounds(),pad=12/Math.max(1,(devicePixelRatio||1)*(window.visualViewport?.scale||1));
 if(menu.id==='dossierModal'){
  const compact=bounds.width<600*menuInterface.factor;
  menu.dataset.compact=String(compact);if(compact)base=[360,760];
 }
 const f=Math.max(.01,Math.min(menuInterface.factor,(bounds.width-pad*2)/base[0],(bounds.height-pad*2)/base[1]));
 menu._uiFactor=f;menu.style.setProperty('--menu-factor',f);menu.style.width=(base[0]*f)+'px';menu.style.height=(base[1]*f)+'px';menu.style.maxHeight=menu.style.height;
 if(menu.id==='dossierModal'&&menu.open)scheduleDossierDraw();
}
function applyInterfaceScale(){
 readInterfaceInsets();
 // DPR includes desktop page zoom; visualViewport.scale adds pinch zoom.
 // Touch screens keep their natural density; desktop frames use screen pixels.
 menuInterface.factor=(interfaceScale()/100)*menuInterface.density/Math.max(.1,(devicePixelRatio||1)*(window.visualViewport?.scale||1));
 document.documentElement.style.setProperty('--menu-factor',menuInterface.factor);
 for(const menu of document.querySelectorAll('dialog.surface-menu'))applyMenuFrame(menu);
 const slider=$('menuScale'),value=$('menuScaleValue');if(slider)slider.value=interfaceScale();if(value)value.textContent=interfaceScale()+'%';const sliderFill=$('menuScale');if(sliderFill){const fill=(interfaceScale()-40)/120*100;sliderFill.style.background='linear-gradient(90deg,#aeca98 '+fill+'%,#40533d '+fill+'%)'}if($('settingsSummary'))$('settingsSummary').textContent=interfaceScale()+'% · escala dos painéis';
 placeMenu();
 if(insideView.ready)fitInsidePanel();
}
function setInterfaceScale(value){
 closeGraphicsPicker(false);finishUpgradePageMotion();
 state.menuScale=Math.max(40,Math.min(160,Math.round(Number(value)||100)));
 applyInterfaceScale();persist();
}
function positionSurfaceMenu(){
 if(!openMenu?.open||!menuAnchor?.isConnected)return;
 if(openMenu.id==='skillTreeModal'||openMenu.id==='objectCheckModal')return;
 const menu=openMenu,bounds=interfaceBounds(),pad=12/Math.max(1,(devicePixelRatio||1)*(window.visualViewport?.scale||1));
 applyMenuFrame(menu);
 const a=menuAnchor.getBoundingClientRect(),width=parseFloat(menu.style.width)||menu.offsetWidth,height=parseFloat(menu.style.height)||menu.offsetHeight,gap=8*menuFrameFactor(menu);
 const above=a.top-bounds.y-pad-gap,below=bounds.y+bounds.height-a.bottom-pad-gap;
 const side=above>=height?'above':below>=height?'below':above>=below?'above':'below';
 const left=Math.max(bounds.x+pad,Math.min(bounds.x+bounds.width-width-pad,a.right-width));
 const top=Math.max(bounds.y+pad,Math.min(bounds.y+bounds.height-height-pad,side==='above'?a.top-gap-height:a.bottom+gap));
 menu.style.left=left+'px';menu.style.top=top+'px';menu.dataset.side=side;
 refreshMenuEtching(menu,width,height,(a.left+a.right)/2-left,side);
}
