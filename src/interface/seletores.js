function syncCustomPickers(){
 refreshGraphicsPresetUI();
 for(const entry of menuInterface.entries){
  const label=entry.select.selectedOptions?.[0]?.textContent||entry.select.options?.[entry.select.selectedIndex]?.textContent||'Selecionar';
  if(entry.text.textContent!==label)entry.text.textContent=label;
  entry.button.disabled=entry.select.disabled;entry.button.title=label;
 }
}
function closeGraphicsPicker(restoreFocus=true){
 const entry=menuInterface.picker;if(!entry)return;
 menuInterface.picker=null;menuInterface.popup.hidden=true;
 entry.button.setAttribute('aria-expanded','false');
 if(restoreFocus&&$('settingsModal').open)entry.button.focus({preventScroll:true});
}
function customPickerContains(node){return !!menuInterface.picker&&menuInterface.popup.contains(node)}
function placeGraphicsPicker(){
 const entry=menuInterface.picker;if(!entry)return;
 const pop=menuInterface.popup,b=interfaceBounds(),r=entry.button.getBoundingClientRect(),f=menuFrameFactor(entry.button.closest?.('dialog')||$('settingsModal')),pad=8*f,gap=6*f;
 const above=r.top-b.y-pad-gap,below=b.y+b.height-r.bottom-pad-gap,content=48+Array.from(entry.select.options).length*39+entry.select.querySelectorAll('optgroup').length*27;
 const wanted=Math.min(330,content)*f,side=below>=Math.min(wanted,150*f)||below>=above?'below':'above',available=Math.max(0,side==='below'?below:above);
 const height=Math.max(1,Math.min(wanted,b.height-pad*2,available||b.height-pad*2)),width=Math.max(1,Math.min(Math.max(r.width,264*f),b.width-pad*2));
 pop.style.setProperty('--menu-factor',f);pop.style.width=width+'px';pop.style.height=height+'px';
 pop.style.left=Math.max(b.x+pad,Math.min(r.left,b.x+b.width-pad-width))+'px';
 pop.style.top=Math.max(b.y+pad,Math.min(b.y+b.height-height-pad,side==='below'?r.bottom+gap:r.top-gap-height))+'px';
}
function openGraphicsPicker(entry,last=false){
 if(entry.select.disabled)return;
 if(menuInterface.picker===entry){closeGraphicsPicker();return}
 closeGraphicsPicker(false);syncCustomPickers();menuInterface.picker=entry;
 const popup=menuInterface.popup,list=popup.querySelector('.picker-list');list.replaceChildren();
 popup.querySelector('.picker-title').textContent=entry.title;list.setAttribute('aria-label',entry.title);
 const addOption=option=>{
  const button=document.createElement('button');button.type='button';button.className='picker-option';button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===entry.select.value));button.disabled=option.disabled||option.parentElement.disabled===true;button.tabIndex=-1;button.dataset.value=option.value;
  const text=document.createElement('span');text.textContent=option.textContent;
  const check=document.createElement('span');check.className='picker-check';check.setAttribute('aria-hidden','true');check.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-check"></use></svg>';button.append(text,check);
  button.onclick=()=>{entry.select.value=option.value;closeGraphicsPicker();entry.select.dispatchEvent(new Event('change',{bubbles:true}));syncCustomPickers()};
  list.append(button);
 };
 for(const child of entry.select.children){
  if(child.tagName==='OPTGROUP'){
   const label=document.createElement('div');label.className='picker-group';label.setAttribute('role','presentation');label.textContent=child.label;list.append(label);
   for(const option of child.children)addOption(option);
  }else if(child.tagName==='OPTION')addOption(child);
 }
 popup.hidden=false;entry.button.setAttribute('aria-expanded','true');placeGraphicsPicker();
 const options=Array.from(list.querySelectorAll('.picker-option:not(:disabled)'));
 const selected=list.querySelector('.picker-option[aria-selected="true"]:not(:disabled)');
 const target=last?options.at(-1):selected||options[0];target?.focus({preventScroll:true});if(target)list.scrollTop=Math.max(0,target.offsetTop-list.clientHeight*.4);
 playUI(popup,[{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:150});
}
function initMenuInterface(){
 const pop=document.createElement('div');pop.id='graphicsPicker';pop.className='graphics-picker-popup';pop.hidden=true;
 pop.innerHTML='<div class="picker-inner"><div class="picker-heading"><b class="picker-title"></b><button type="button" class="picker-close" aria-label="Fechar opções"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-close"></use></svg></button></div><div class="picker-list" role="listbox"></div></div>';
 document.body.append(pop);menuInterface.popup=pop;
 pop.querySelector('.picker-close').onclick=()=>closeGraphicsPicker();
 pop.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeGraphicsPicker();return}
  if(e.key==='Tab'){const entry=menuInterface.picker;if(entry)movePickerTab(entry,e.shiftKey);e.preventDefault();e.stopPropagation();return}
  const list=pop.querySelector('.picker-list'),items=Array.from(list.querySelectorAll('.picker-option:not(:disabled)'));if(!items.length)return;
  const i=items.indexOf(document.activeElement);let index;
  if(e.key==='ArrowDown')index=(i+1)%items.length;else if(e.key==='ArrowUp')index=(i-1+items.length)%items.length;
  else if(e.key==='Home')index=0;else if(e.key==='End')index=items.length-1;
  else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&e.key!==' '){
   const now=performance.now();menuInterface.typeahead=now-menuInterface.typedAt>650?e.key:menuInterface.typeahead+e.key;menuInterface.typedAt=now;
   index=items.findIndex(x=>x.textContent.toLocaleLowerCase().startsWith(menuInterface.typeahead.toLocaleLowerCase()));
  }else return;
  e.preventDefault();e.stopPropagation();if(index>=0){items[index].focus({preventScroll:true});items[index].scrollIntoView({block:'nearest'})}
 });
 for(const select of document.querySelectorAll('select.image-mode')){
  const label=document.querySelector('label[for="'+select.id+'"]'),button=document.createElement('button');button.type='button';button.className='graphics-picker-button';button.id=select.id+'Picker';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',pop.id);
  const text=document.createElement('span');text.className='picker-value';text.id=select.id+'Choice';const chevron=document.createElement('span');chevron.className='picker-chevron';chevron.setAttribute('aria-hidden','true');chevron.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-chevron"></use></svg>';button.append(text,chevron);
  if(label){label.id=select.id+'Label';label.htmlFor=button.id;button.setAttribute('aria-labelledby',label.id+' '+text.id)}else button.setAttribute('aria-label',select.getAttribute('aria-label')||'Opções');
  if(select.getAttribute('aria-describedby'))button.setAttribute('aria-describedby',select.getAttribute('aria-describedby'));
  select.hidden=true;select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.after(button);
  const entry={select,button,text,title:label?.textContent||select.getAttribute('aria-label')||'Opções'};menuInterface.entries.push(entry);
  button.onclick=()=>openGraphicsPicker(entry);button.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();openGraphicsPicker(entry,e.key==='ArrowUp')}};
  select.addEventListener('change',syncCustomPickers);
  if(typeof MutationObserver==='function')new MutationObserver(syncCustomPickers).observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled']});
 }
 const settingsPages=SETTINGS_PAGES;
 for(const page of settingsPages){
  const tab=$('settingsTab-'+page);tab.onclick=()=>selectSettingsPage(page);
  tab.onkeydown=e=>{const i=settingsPages.indexOf(page);let next;if(e.key==='ArrowRight')next=(i+1)%3;else if(e.key==='ArrowLeft')next=(i+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();selectSettingsPage(settingsPages[next]);$('settingsTab-'+settingsPages[next]).focus()};
 }
 const slider=$('menuScale');slider.oninput=()=>$('menuScaleValue').textContent=slider.value+'%';slider.onchange=()=>setInterfaceScale(slider.value);
 $('menuScaleLess').onclick=()=>setInterfaceScale(interfaceScale()-5);$('menuScaleMore').onclick=()=>setInterfaceScale(interfaceScale()+5);$('menuScaleReset').onclick=()=>setInterfaceScale(100);
 interfaceScroll($('settingsModal')).addEventListener('scroll',()=>closeGraphicsPicker(false),{passive:true});
 const resized=()=>{closeGraphicsPicker(false);finishUpgradePageMotion();applyInterfaceScale()};
 window.addEventListener('resize',resized);window.visualViewport?.addEventListener('resize',resized);window.visualViewport?.addEventListener('scroll',()=>{closeGraphicsPicker(false);placeMenu()},{passive:true});
 const watchResolution=()=>{const query=window.matchMedia?.('(resolution: '+(devicePixelRatio||1)+'dppx)');query?.addEventListener?.('change',()=>{resized();watchResolution()},{once:true})};watchResolution();
 menuInterface.ready=true;syncCustomPickers();applyInterfaceScale();
}

