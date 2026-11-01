import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';

// These tests exercise preferences, UI wiring and resource ownership in the real
// program. The deterministic DOM/SoftwareGL does not prove image quality or FPS.
const html=assemble().html;
const saved={coins:731,r:2,d:3,cargo:[0,1],collected:17,sold:2,reward1:true,reward2:false,
 worldScaleVersion:2,nativeDisplayDefaultsV1:true,imageMode:'native',aaMode:'off',aoMode:'off',
 outputMode:'native',viewRange:'default'};
const profiles=['off','low','balanced','high','ultra'];

test('sombras têm padrão compatível, seletor próprio e validação de preferências antigas',()=>{
 const fresh=createRuntime(html);
 assert.equal(fresh.run('state.shadowQuality'),'high');
 assert.deepEqual(fresh.json('Object.keys(SHADOW_PROFILES)'),profiles);
 assert.deepEqual(fresh.json('[state.imageMode,state.outputMode,state.aaMode,state.aoMode]'),['native','native','off','off']);
 const control=fresh.doc.getElementById('shadowQuality');
 assert.ok(control);
 assert.equal(control.disabled,true,'a preferência existe, mas não promete sombras no fallback CPU');
 assert.deepEqual(control.options.map(option=>option.value),profiles);
 assert.equal(fresh.doc.getElementById('graphicsAdvanced').contains(control),false,'sombras ficam acessíveis fora dos ajustes avançados');
 const game=createRuntime(html,{...saved,shadowQuality:'ultra'});
 assert.equal(game.run('state.shadowQuality'),'ultra','uma preferência válida sobrevive à carga do save');
 for(const value of [...profiles,'constructor','__proto__','toString','inexistente']){
  game.run(`state.shadowQuality=${JSON.stringify(value)};initShadowControls()`);
  assert.equal(game.run('state.shadowQuality'),profiles.includes(value)?value:'high',value);
  assert.equal(game.run('state.coins'),saved.coins,'validar sombras preserva progresso');
  assert.deepEqual(game.json('state.cargo'),saved.cargo);
  assert.equal(game.run(`shadowProfile(${JSON.stringify(value)})===SHADOW_PROFILES[${JSON.stringify(profiles.includes(value)?value:'high')}]`),true);
 }
 const invalid=createRuntime(html,{...saved,shadowQuality:'constructor'});
 assert.equal(invalid.run('state.shadowQuality'),'high','uma preferência inválida no save recebe o padrão compatível');
});

test('assinatura gráfica antiga migra sem reaplicar predefinição nem perder preferências',()=>{
 const signature='native|off|off|native|default';
 const game=createRuntime(html,{...saved,graphicsPreset:'default',graphicsPresetSignature:signature});
 assert.equal(game.run('state.graphicsPreset'),'default');
 assert.equal(game.run('state.graphicsPresetSignature'),signature+'|high|high');
 assert.deepEqual(game.json('GRAPHICS_KEYS'),['imageMode','aaMode','aoMode','outputMode','viewRange','shadowQuality','shadowDistance']);
 const control=game.doc.getElementById('shadowQuality');
 control.value='low';control.dispatchEvent({type:'change'});
 assert.equal(game.run('state.shadowQuality'),'low');
 assert.equal(game.run('state.graphicsPreset'),'custom','o ajuste individual marca Personalizada');
 assert.equal(game.run('state.graphicsPresetSignature'),signature+'|low|high');
 assert.equal(JSON.parse(game.store.get('vora-v1')).shadowQuality,'low');
 game.run('reset()');
 assert.equal(game.run('state.shadowQuality'),'low','recomeçar progresso mantém a escolha visual');
 assert.equal(game.run('state.coins'),120);
 assert.equal(game.run('state.r'),0);
});

test('cada predefinição escolhe sombras coerentes sem vincular o ajuste de AO',()=>{
 const game=createRuntime(html);
 const expected={default:'high',extreme_low:'off',very_low:'low',low:'low',medium:'balanced',
  high:'high',very_high:'high',extreme_high:'ultra',ultra:'ultra'};
 for(const [preset,shadow] of Object.entries(expected)){
  game.run(`applyGraphicsPreset(${JSON.stringify(preset)})`);
  assert.equal(game.run('state.shadowQuality'),shadow,preset);
  assert.equal(game.doc.getElementById('shadowQuality').value,shadow,preset+' atualiza o seletor');
  assert.equal(game.run('state.graphicsPresetSignature'),game.run('graphicsSignature()'));
 }
 game.run('state.aoMode="balanced";setShadowQuality("off")');
 assert.equal(game.run('state.aoMode'),'balanced','desligar a sombra solar preserva a opção de AO');
});

test('alvos respeitam orçamento móvel e os limites de textura e depth buffer',()=>{
 const game=createRuntime(html);
 game.run(`
  gl.MAX_TEXTURE_SIZE=3379;gl.MAX_RENDERBUFFER_SIZE=34024;
  let testTextureLimit=8192,testDepthLimit=8192,testMobile=false;
  gl.getParameter=name=>name===gl.MAX_TEXTURE_SIZE?testTextureLimit:name===gl.MAX_RENDERBUFFER_SIZE?testDepthLimit:0;
  matchMedia=()=>({matches:testMobile});
 `);
 assert.deepEqual(game.json('shadowTargetSizes(SHADOW_PROFILES.high)'),{fixed:2048,moving:1024});
 assert.deepEqual(game.json('shadowTargetSizes(SHADOW_PROFILES.ultra)'),{fixed:4096,moving:2048});
 game.run('testMobile=true');
 assert.deepEqual(game.json('shadowTargetSizes(SHADOW_PROFILES.high)'),{fixed:1024,moving:512});
 assert.deepEqual(game.json('shadowTargetSizes(SHADOW_PROFILES.ultra)'),{fixed:2048,moving:1024});
 game.run('testMobile=false;testTextureLimit=3000;testDepthLimit=1500');
 assert.deepEqual(game.json('shadowTargetSizes(SHADOW_PROFILES.ultra)'),{fixed:1500,moving:1500});
 game.run('testTextureLimit=256;testDepthLimit=512');
 for(const profile of profiles){
  const sizes=game.json(`shadowTargetSizes(SHADOW_PROFILES[${JSON.stringify(profile)}])`);
  assert.ok(sizes.fixed>=1&&sizes.fixed<=256&&sizes.moving>=1&&sizes.moving<=256,profile);
 }
});

function queuedGame(){
 const game=createRuntime(html);
 game.run(`
  cancelResourceWork();gl.isSoftware=false;
  gl.uniform1i=()=>{};
  gl.getParameter=()=>8192;matchMedia=()=>({matches:false});
  const shadowAllocated=[],shadowReleased=[],shadowUniformValues=[];
  let nextShadowId=0,invalidShadowSize=0;
  gl.deleteFramebuffer=value=>shadowReleased.push(value);
  gl.deleteRenderbuffer=value=>shadowReleased.push(value);
  gl.deleteTexture=value=>shadowReleased.push(value);
  gl.uniform1f=(location,value)=>{if(location===uniforms.shadowEnabled)shadowUniformValues.push(value)};
  makeShadowTarget=size=>{
   const id=++nextShadowId,target={size,valid:size!==invalidShadowSize,fbo:'f'+id,depth:'d'+id,texture:'t'+id};
   shadowAllocated.push(target);return target;
  };
  lighting={fixed:makeShadowTarget(2048),moving:makeShadowTarget(1024),size:1024,valid:true};
 `);
 return game;
}

test('trocas de qualidade são incrementais, mantêm alvos prontos e cancelam o pedido anterior',()=>{
 const game=queuedGame();
 game.run('setShadowQuality("ultra")');
 assert.equal(game.run('shadowAllocated.length'),2,'a mudança de menu apenas agenda trabalho');
 assert.equal(game.run('resourceWork.jobs.size'),1);
 game.run('processResourceWork(3)');
 assert.deepEqual(game.json('shadowAllocated.map(target=>target.size)'),[2048,1024,4096]);
 assert.deepEqual(game.json('[lighting.fixed.size,lighting.moving.size]'),[2048,1024],'o par anterior continua válido durante a preparação');
 game.run('setShadowQuality("low");setShadowQuality("balanced")');
 assert.equal(game.run('resourceWork.jobs.size'),1,'a escolha final substitui os pedidos anteriores');
 assert.deepEqual(game.json('shadowReleased'),['f3','d3','t3'],'cancelar libera o alvo parcial');
 game.run('processResourceWork(3);processResourceWork(3);processResourceWork(3)');
 assert.deepEqual(game.json('[lighting.fixed.size,lighting.moving.size]'),[1024,512]);
 assert.deepEqual(game.json('shadowAllocated.map(target=>target.size)'),[2048,1024,4096,1024,512],'a escolha intermediária não chega a alocar');
 assert.equal(game.run('shadowSettingsPending'),false);
 assert.equal(game.run('resourceWork.jobs.size'),0);
 assert.equal(game.run('shadowReleased.length'),9,'par antigo e alvo cancelado são liberados uma única vez');
 game.run('setShadowQuality("off");let disabledShadowPasses=0;renderShadowLayer=()=>disabledShadowPasses++;updateSunShadows()');
 assert.equal(game.run('shadowUniformValues.at(-1)'),0);
 assert.equal(game.run('disabledShadowPasses'),0,'Desligadas não executa passes solares');
 assert.equal(game.doc.getElementById('shadowQuality').disabled,false,'o suporte da GPU mantém o seletor disponível');
 game.run('processResourceWork(3);processResourceWork(3);processResourceWork(3)');
 assert.deepEqual(game.json('[lighting.fixed.size,lighting.moving.size]'),[1,1],'Desligadas libera os mapas grandes');
 game.run('setShadowQuality("high");updateSunShadows()');
 assert.equal(game.run('shadowUniformValues.at(-1)'),0,'reativar não deve amostrar o placeholder de um pixel');
 assert.equal(game.run('disabledShadowPasses'),0);
 game.run('processResourceWork(3);processResourceWork(3)');
 assert.equal(game.run('shadowUniformValues.at(-1)'),0,'sombras aguardam o par completo');
 game.run('processResourceWork(3)');
 assert.deepEqual(game.json('[lighting.fixed.size,lighting.moving.size]'),[2048,1024]);
 assert.equal(game.run('shadowUniformValues.at(-1)'),1,'sombras reativam quando os mapas já existem');
});

test('falha de alocação conserva os mapas anteriores e libera recursos incompletos',()=>{
 const game=queuedGame();
 game.run('const shadowWarnings=[];console={...console,warn:(...args)=>shadowWarnings.push(args.map(String).join(" "))};invalidShadowSize=4096;setShadowQuality("ultra");processResourceWork(3);processResourceWork(3);processResourceWork(3)');
 assert.deepEqual(game.json('[lighting.fixed.size,lighting.moving.size]'),[2048,1024]);
 assert.equal(game.run('lighting.valid'),true);
 assert.equal(game.run('resourceWork.jobs.size'),0);
 assert.equal(game.run('shadowSettingsPending'),false);
 assert.equal(game.run('shadowReleased.length'),6,'somente os dois alvos novos são liberados');
 assert.match(game.doc.getElementById('shadowInfo').textContent,/anteriores|menor/);
 assert.equal(game.run('shadowWarnings.length'),1,'a falha continua disponível para diagnóstico');
});
