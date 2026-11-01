const GRAPHICS_PRESETS={
 default:{title:'Padrão',imageMode:'native',aaMode:'off',aoMode:'off',outputMode:'native',viewRange:'default',shadowQuality:'high',shadowDistance:'high',note:'Resolução nativa e sombras suaves, sem pós-processamento adicional.'},
 extreme_low:{title:'Extremamente baixa',imageMode:'performance',aaMode:'fxaa_fast',aoMode:'off',outputMode:'balanced',viewRange:'very_low',shadowQuality:'off',shadowDistance:'very_low',note:'Prioriza a fluidez com alcance mínimo, menos pixels e sombras solares desligadas.'},
 very_low:{title:'Muito baixa',imageMode:'performance',aaMode:'fxaa_fast',aoMode:'off',outputMode:'balanced',viewRange:'low',shadowQuality:'low',shadowDistance:'very_low',note:'Menos carga gráfica, sombras leves e alcance curto.'},
 low:{title:'Baixa',imageMode:'balanced',aaMode:'fxaa',aoMode:'off',outputMode:'balanced',viewRange:'reduced',shadowQuality:'low',shadowDistance:'low',note:'Imagem leve, com mais alcance e definição.'},
 medium:{title:'Média',imageMode:'quality',aaMode:'fxaa',aoMode:'fast',outputMode:'native',viewRange:'default',shadowQuality:'balanced',shadowDistance:'medium',note:'Equilibra definição, alcance e sombras de contato.'},
 high:{title:'Alta',imageMode:'ultra_quality',aaMode:'fxaa_high',aoMode:'balanced',outputMode:'native',viewRange:'default',shadowQuality:'high',shadowDistance:'high',note:'Mais definição e sombras suaves com contatos discretos.'},
 very_high:{title:'Muito alta',imageMode:'native',aaMode:'smaa_high',aoMode:'balanced',outputMode:'native',viewRange:'ultra',shadowQuality:'high',shadowDistance:'very_high',note:'Resolução nativa, bordas suaves e alcance máximo.'},
 extreme_high:{title:'Extremamente alta',imageMode:'native',aaMode:'smaa_ultra',aoMode:'high',outputMode:'native',viewRange:'ultra',shadowQuality:'ultra',shadowDistance:'ultra',note:'Sombras de maior resolução e oclusão com contatos mais precisos.'},
 ultra:{title:'Ultra',imageMode:'native',aaMode:'msaa4_smaa',aoMode:'high',outputMode:'native',viewRange:'ultra',shadowQuality:'ultra',shadowDistance:'ultra',note:'Multiamostragem e sombras de maior resolução. Maior custo gráfico.'}
};
const GRAPHICS_KEYS=['imageMode','aaMode','aoMode','outputMode','viewRange','shadowQuality','shadowDistance'];
let graphicsPresetsReady=false,applyingGraphicsPreset=false;
function graphicsSignature(){return GRAPHICS_KEYS.map(key=>state[key]).join('|')}
function hasGraphicsPreset(key){return Object.prototype.hasOwnProperty.call(GRAPHICS_PRESETS,key)}
function refreshGraphicsPresetUI(){
 if(!graphicsPresetsReady)return;
 const key=state.graphicsPreset,profile=hasGraphicsPreset(key)?GRAPHICS_PRESETS[key]:null;
 let text=profile?profile.note:'Seus ajustes de imagem, definidos individualmente.';
 if(profile&&GRAPHICS_KEYS.some(key=>state[key]!==profile[key]))text+=' Adaptada ao suporte deste aparelho.';
 if(gl.isSoftware||!lighting?.image)text='Modo de compatibilidade: os efeitos disponíveis são limitados. A distância de visão continua ajustável.';
 $('graphicsPresetInfo').textContent=text;
 $('graphicsCompatibility').hidden=!!lighting?.image;
 if(canvas.width&&canvas.height)$('imageInfo').textContent=canvas.width+' × '+canvas.height+(lighting?.image?' · renderização '+Math.round(imageScale()*100)+'%':' · modo de compatibilidade');
}
function applyGraphicsPreset(key){
 if(!hasGraphicsPreset(key))return;
 const profile=GRAPHICS_PRESETS[key];applyingGraphicsPreset=true;
 try{
  for(const field of GRAPHICS_KEYS)state[field]=profile[field];
  if(!lighting?.image){state.imageMode='native';state.aaMode='off'}
  else if(!aaSupported(state.aaMode))state.aaMode=['smaa_ultra','smaa_high','fxaa_high','fxaa','off'].find(aaSupported)||'off';
  if(!lighting?.ao)state.aoMode='off';
  state.graphicsPreset=key;pausedRenderStamp='';
  if(lighting?.image)configureImageSettings('preset');else resize();
  refreshAmbientControls();setShadowQuality(state.shadowQuality);setShadowDistance(state.shadowDistance);
  $('viewRange').value=state.viewRange;$('imageMode').value=state.imageMode;$('aaMode').value=state.aaMode;$('outputMode').value=state.outputMode;
  state.graphicsPresetSignature=graphicsSignature();
 }finally{applyingGraphicsPreset=false}
 $('graphicsPreset').value=key;refreshGraphicsPresetUI();syncCustomPickers();persist();
}
function initGraphicsPresets(){
 const signature=graphicsSignature(),defaults=GRAPHICS_KEYS.map(key=>GRAPHICS_PRESETS.default[key]).join('|');
 // Extend a valid legacy signature without reapplying a preset over individual preferences.
 const legacySignatures=[5,6].map(length=>GRAPHICS_KEYS.slice(0,length).map(key=>state[key]).join('|'));
 if(legacySignatures.includes(state.graphicsPresetSignature))state.graphicsPresetSignature=signature;
 if(!hasGraphicsPreset(state.graphicsPreset)||state.graphicsPresetSignature!==signature)state.graphicsPreset=signature===defaults?'default':'custom';
 state.graphicsPresetSignature=signature;graphicsPresetsReady=true;
 $('graphicsPreset').onchange=()=>applyGraphicsPreset($('graphicsPreset').value);
 for(const key of GRAPHICS_KEYS){
  const control=$(key),applyIndividual=control.onchange;
  control.onchange=event=>{
   if(applyIndividual)applyIndividual.call(control,event);
   if(applyingGraphicsPreset||state.graphicsPresetSignature===graphicsSignature())return;
   state.graphicsPreset='custom';state.graphicsPresetSignature=graphicsSignature();$('graphicsPreset').value='custom';refreshGraphicsPresetUI();syncCustomPickers();persist();
  };
 }
 $('graphicsAdvancedToggle').onclick=()=>{
  const panel=$('graphicsAdvanced'),button=$('graphicsAdvancedToggle'),show=panel.hidden,pickerInPanel=menuInterface.picker&&panel.contains(menuInterface.picker.button);
  closeGraphicsPicker(false);panel.hidden=!show;panel.inert=!show;button.setAttribute('aria-expanded',String(show));
  if(!show&&(pickerInPanel||panel.contains(document.activeElement)))button.focus();
  if(show)playUI(panel,[{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:160});
  placeMenu();
 };
 $('graphicsPreset').value=state.graphicsPreset;refreshGraphicsPresetUI();
}

