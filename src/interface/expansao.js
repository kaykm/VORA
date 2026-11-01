let expansionUIReady=false;
const UPGRADE_CARD_TEMPLATE=/* @text src/interface/componentes/melhoria-card.html */;
const UPGRADE_RULER_STEPS=20;
const UPGRADE_PRESENTATION={
 storage:{icon:'i-box',action:'Organizar'},compression:{icon:'i-depth',action:'Compactar'},
 regrowth:{icon:'i-spawns',action:'Acelerar'},trade:{icon:'i-coin',action:'Negociar'},
 unloading:{icon:'i-box',action:'Agilizar'},returning:{icon:'i-speed',action:'Aprimorar'}
};
function extraUpgradeMetric(key,level){
 const values={storage:[Math.round(CARGO_LITERS[state.d]*(1+level*.25)),'L'],
  compression:[Math.round(100/(1+level*.18)),'%'],regrowth:[level*5,'%'],trade:[level*8,'%'],
  unloading:[.9/(1+level*.2),'s'],returning:[level*12,'%']};
 const [value,unit]=values[key];return {value:met(value),unit};
}
function upgradeRulerMarkup(){
 return Array.from({length:UPGRADE_RULER_STEPS},(_,i)=>'<path d="M '+(1+i*5.5)+' 9 V '+(i%5?3:0)+'" pathLength="1"></path>').join('');
}
function refreshUniformRuler(element,level,max){
 if(element.dataset.steps!==String(UPGRADE_RULER_STEPS)){
  element.dataset.steps=String(UPGRADE_RULER_STEPS);element.setAttribute('viewBox','0 0 108 9');
  element.innerHTML=upgradeRulerMarkup();
 }
 element.dataset.levels=String(max);
 element.setAttribute('aria-label','Nível '+level+' de '+max);
 const filled=Math.round(level/Math.max(1,max)*UPGRADE_RULER_STEPS);
 for(const [i,path]of [...element.querySelectorAll('path')].entries())path.classList.toggle('is-earned',i<filled);
}
function createUnifiedUpgradeCard(spec){
 const oldButton=$(spec.button),oldSection=oldButton?.closest('.upgrade');
 const retained={value:$(spec.value),next:$(spec.next),ruler:$(spec.ruler),level:$(spec.level),status:$(spec.status),cost:$(spec.cost)};
 const section=document.createElement('section');section.className='upgrade';section.setAttribute('data-upgrade',spec.key);
 if(oldSection?.dataset.state)section.dataset.state=oldSection.dataset.state;
 section.innerHTML=UPGRADE_CARD_TEMPLATE;
 section.querySelector('.upgrade-title use').setAttribute('href','#'+spec.icon);
 const title=section.querySelector('.upgrade-title b');title.textContent=spec.title;if(spec.description)title.title=spec.description;
 // Keep the existing control nodes and their handlers; only their common frame changes.
 const adopt=(selector,node,id)=>{
  const slot=section.querySelector(selector);
  if(node){slot.after(node);slot.remove();}else node=slot;
  node.id=id;return node;
 };
 adopt('.upgrade-level',retained.level,spec.level).className='upgrade-level';
 adopt('.upgrade-current',retained.value,spec.value).className='upgrade-current';
 adopt('.next',retained.next,spec.next).className='next';
 const ruler=adopt('.level-ruler',retained.ruler,spec.ruler);ruler.setAttribute('class','level-ruler');ruler.style.width='';
 adopt('.upgrade-status',retained.status,spec.status).className='upgrade-status';
 const buttonSlot=section.querySelector('.upgrade-btn'),button=oldButton||buttonSlot;
 if(oldButton){oldButton.replaceChildren(...Array.from(buttonSlot.children));buttonSlot.after(oldButton);buttonSlot.remove();}
 button.id=spec.button;button.className='upgrade-btn';button.setAttribute('type','button');
 button.setAttribute('aria-label',spec.action+' — '+spec.title);button.setAttribute('aria-describedby',spec.status);
 button.querySelector('[data-upgrade-action]').innerHTML=spec.action+'<svg class="action-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-arrow"></use></svg>';
 const costSlot=button.querySelector('[data-upgrade-cost]');
 if(retained.cost){costSlot.after(retained.cost);costSlot.remove();retained.cost.id=spec.cost;}else costSlot.id=spec.cost;
 if(oldSection){oldSection.after(section);oldSection.remove();}
 else{
  const page=$('upgradePage-'+spec.page),last=[...page.querySelectorAll('.upgrade')].at(-1);
  if(last)last.after(section);else page.append(section);
 }
 return section;
}
function prepareUniformUpgradeCards(){
 for(const [key,prefix,title,icon,action,button,level,status,cost]of [
  ['r','radius','Raio','i-radius','Alargar','radiusBtn','radiusLevel','radiusStatus','radiusCost'],
  ['d','depth','Profundidade','i-depth','Aprofundar','depthBtn','depthLevel','depthStatus','depthCost'],
  ['s','spawn','Áreas de coleta','i-spawns','Expandir','spawnBtn','uniformLevel-spawn','spawnStatus','spawnCost'],
  ['v','speed','Velocidade','i-speed','Acelerar','speedBtn','uniformLevel-speed','speedStatus','speedCost'],
  ['depot','depot','Caixa de vendas','i-box','Ampliar caixa','depotUpgradeBtn','uniformLevel-depot','depotUpgradeStatus','depotCost']
 ]){
  createUnifiedUpgradeCard({key,title,icon,action,button,level,status,cost,value:prefix+'Val',next:prefix+'Next',ruler:prefix+'Ruler'});
 }
}
function refreshUniformUpgradeCards(){
 for(const [key,level,max,ruler]of [
  ['radius',state.r,RADIUS_MAX_LEVEL,'radiusRuler'],['depth',state.d,DEPTH_MAX_LEVEL,'depthRuler'],
  ['spawn',spawnLevel(),SPAWN_MAX_LEVEL,'spawnRuler'],['speed',speedLevel(),SPEED_MAX_LEVEL,'speedRuler'],
  ['depot',state.depotLevel,DEPOT_CAPACITIES.length,'depotRuler']
 ]){
  $(key==='radius'?'radiusLevel':key==='depth'?'depthLevel':'uniformLevel-'+key).textContent='Nível '+level+' / '+max;refreshUniformRuler($(ruler),level,max);
 }
 $('depotNext').textContent=state.depotLevel>=DEPOT_CAPACITIES.length?'Máximo':'→ '+DEPOT_CAPACITIES[state.depotLevel]+' L';
 $('spawnNext').textContent=spawnLevel()>=SPAWN_MAX_LEVEL?'Máximo':'→ '+spawnPointCount(spawnLevel()+1)+' pontos';
}
function refreshExtraUpgradeUI(){
 if(!expansionUIReady)return;
 refreshUniformUpgradeCards();
 for(const [key,d]of Object.entries(EXTRA_UPGRADES)){
  const level=extraLevel(key),max=level===d.max,button=$('extraBuy-'+key),cost=extraCost(key);
  const affordable=state.developer||state.coins>=cost,current=extraUpgradeMetric(key,level),next=extraUpgradeMetric(key,Math.min(d.max,level+1));
  $('extraLevel-'+key).textContent='Nível '+level+' / '+d.max;
  $('extraValue-'+key).innerHTML=current.value+'<small>'+current.unit+'</small>';
  $('extraNext-'+key).textContent=max?'Máximo':'→ '+next.value+' '+next.unit;
  $('extraCost-'+key).textContent=max?'MAX':fmt(cost);
  const status=$('extraStatus-'+key);status.textContent=max?'Nível máximo alcançado':affordable?'Disponível para melhorar':'Faltam '+fmt(Math.max(0,cost-state.coins))+' moedas';
  button.closest('.upgrade').dataset.state=max?'max':affordable?'ready':'locked';
  button.setAttribute('aria-describedby',status.id);button.title=(max?'Nível máximo':affordable?'Comprar melhoria por '+fmt(cost)+' moedas':status.textContent)+'. '+d.description;
  button.disabled=max||!affordable;refreshUniformRuler($('extraRuler-'+key),level,d.max);
 }
 const sectors=['Entrada e bosques','Jardim e piquenique','Pedreira e viveiro','Circuito e serraria','Grandes formações','Oficina e mirantes','Reserva'];
 $('areaProgress').innerHTML=sectors.map((name,i)=>'<div role="listitem"><b>'+(i<=spawnLevel()?'✓ ':'')+name+'</b><small>Nível '+i+' · '+(spawnPointCount(i)-(i?spawnPointCount(i-1):0))+' pontos'+(i<=spawnLevel()?' liberados':' para desbloquear')+'</small></div>').join('');
}
function openSkillTree(){
 closeMenu(false,true);clearGameInput();const menu=$('skillTreeModal');
 openMenu=menu;menuAnchor=$('skillTreeBtn');menuAnchor.setAttribute('aria-expanded','true');menu.show();menu.querySelector('.close').focus();
}
function initExpansionUI(){
 if(expansionUIReady)return;expansionUIReady=true;
 prepareUniformUpgradeCards();
 const sectors=document.createElement('div');sectors.id='areaProgress';sectors.className='area-progress';sectors.setAttribute('role','list');sectors.setAttribute('aria-label','Setores e pontos fixos');$('upgradePage-spawns').append(sectors);
 for(const [key,d]of Object.entries(EXTRA_UPGRADES)){
  const presentation=UPGRADE_PRESENTATION[key];
  createUnifiedUpgradeCard({key:'extra-'+key,page:d.page,title:d.name,description:d.description,icon:presentation.icon,action:presentation.action,
   button:'extraBuy-'+key,level:'extraLevel-'+key,value:'extraValue-'+key,next:'extraNext-'+key,ruler:'extraRuler-'+key,cost:'extraCost-'+key,status:'extraStatus-'+key});
  $('extraBuy-'+key).onclick=()=>{buyExtraUpgrade(key);placeMenu();};
 }
 setFpsCap(state.fpsCap??60);$('fpsCap').onchange=()=>{setFpsCap($('fpsCap').value);syncCustomPickers();persist();};
 $('skillTreeBtn').onclick=openSkillTree;refreshExtraUpgradeUI();syncCustomPickers();
 initObjectInspection();
}
