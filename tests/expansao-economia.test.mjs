import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble,read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

test('tamanho altera volume e valor; a medição atravessa coleta, save, caixa e venda',()=>{
 const g=createRuntime(html);
 g.run(`state.r=20;state.d=20;syncCavityMotion();
  globalThis.rocks=worldResourceObjects.filter(o=>o.alive&&o.worldProp.kind==='boulder').sort((a,b)=>pickupVolume(a)-pickupVolume(b));
  globalThis.small=rocks[0];globalThis.large=rocks.find(o=>pickupVolume(o)>8&&pickupVolume(o)<50);
  globalThis.volume=pickupVolume(large);globalThis.quote=pickupPrice(large);
  player.x=large.x;player.y=large.y;collect(large);persist();`);
 assert.ok(g.run('pickupVolume(large)>pickupVolume(small)*10'));
 assert.ok(g.run('pickupPrice(large)>pickupPrice(small)'));
 assert.equal(g.run('used()'),g.run('volume'));assert.equal(g.run('value()'),g.run('quote'));
 const restored=createRuntime(html,JSON.parse(g.store.get('vora-v1')));
 assert.equal(restored.run('used()'),g.run('volume'));assert.equal(restored.run('value()'),g.run('quote'));
 const before=restored.run('state.coins');
 restored.run('player.x=base.x;player.y=base.y;unloadDepot();advanceDepot(3)');
 assert.equal(restored.run('used()'),0);assert.equal(restored.run('depotUsed()'),g.run('volume'));
 assert.equal(restored.run('depotValue()'),g.run('quote'));
 restored.run('sellDepot()');assert.equal(restored.run('state.coins'),Math.round((before+g.run('quote'))*100)/100);
});

test('migração preserva volume, cotações e poses da carga antiga sem alterar moedas',()=>{
 const save={coins:431,r:2,d:5,cargo:[0,1],collected:12,sold:3,depotLevel:2,depot:[{t:2,variant:1}],
  nativeDisplayDefaultsV1:true,imageMode:'native',aaMode:'off',aoMode:'off',outputMode:'native',
  spawnWorld:{version:1,rng:123,zones:[{id:'lixo-gramado',remaining:7,objects:[{slot:0,t:0,rot:1}]}]}};
 const g=createRuntime(html,save);
 assert.equal(g.run('state.coins'),431);assert.equal(g.run('used()'),2);assert.equal(g.run('value()'),20);
 assert.equal(g.run('depotUsed()'),38.4);assert.equal(g.run('depotValue()'),30);
 assert.equal(g.run('state.economyVersion'),2);assert.equal(g.run('cargoBodies.length'),2);
 assert.equal(g.run('state.spawnWorld.version'),2);assert.equal(g.run('state.spawnWorld.rng'),123);
 assert.equal(g.run('spawnZones.find(z=>z.id==="lixo-gramado").count'),1);
 assert.equal(g.run('spawnZones.find(z=>z.id==="lixo-gramado").remaining'),7);
 const again=createRuntime(html,JSON.parse(g.store.get('vora-v1')));
 assert.deepEqual(again.json('state.cargoMeta'),g.json('state.cargoMeta'));
 assert.equal(again.run('depotValue()'),30);
});

test('seis novas melhorias têm efeito, preço crescente e limite; caixa tem oito níveis',()=>{
 const g=createRuntime(html);g.run('state.developer=true');
 const capacity=g.run('capacity()');g.run('buyExtraUpgrade("storage")');assert.ok(g.run('capacity()')>capacity);
 g.run('globalThis.target=worldResourceObjects.find(o=>o.alive);globalThis.beforeVolume=pickupVolume(target);buyExtraUpgrade("compression")');
 assert.ok(g.run('pickupVolume(target)<beforeVolume'));
 const quote=g.run('pickupPrice(target)');g.run('buyExtraUpgrade("trade")');assert.ok(g.run('pickupPrice(target)')>quote);
 g.run('target.alive=false;target.respawnRemaining=100;buyExtraUpgrade("regrowth")');assert.equal(g.run('target.respawnRemaining'),95);
 assert.equal(g.run('Object.keys(EXTRA_UPGRADES).length'),6);
 for(const key of ['storage','compression','trade','regrowth','unloading','returning']){
  g.run(`for(let i=0;i<20;i++)buyExtraUpgrade('${key}')`);
  assert.equal(g.run(`extraLevel('${key}')`),g.run(`EXTRA_UPGRADES['${key}'].max`));
 }
 g.run('for(let i=0;i<12;i++)upgradeDepot()');assert.equal(g.run('state.depotLevel'),8);assert.equal(g.run('depotCapacity()'),752);
 assert.equal(g.run('buyExtraUpgrade("constructor")'),false);
});

test('FPS limita a cadência sem deriva e preserva a preferência após reiniciar',()=>{
 const g=createRuntime(html);
 for(const cap of [60,75,90,120,144,180,0]){
  g.run(`gl.isSoftware=false;setFpsCap(${cap});globalThis.accepted=0;for(let i=0;i<2400;i++)if(allowSceneFrame(i*1000/240))accepted++`);
  assert.ok(Math.abs(g.run('accepted')-(cap?cap*10:2400))<=1,String(cap));
 }
 g.doc.getElementById('fpsCap').value='144';g.doc.getElementById('fpsCap').dispatchEvent({type:'change'});
 assert.equal(JSON.parse(g.store.get('vora-v1')).fpsCap,144);
 g.run('gl.isSoftware=true;reset()');assert.equal(g.run('state.fpsCap'),144);
 assert.deepEqual(g.doc.getElementById('fpsCap').options.map(o=>o.value),['60','75','90','120','144','180','0']);
});

test('cada ponto mantém tipo, posição e rotação após consumo, espera e recarga',()=>{
 const g=createRuntime(html);g.run(`globalThis.target=objects.find(o=>o.alive&&o.fixedSpawn&&o.t===0);
  globalThis.site=[target.x,target.y,target.t,target.rot];player.x=target.x;player.y=target.y;collect(target);
  globalThis.timer=target.respawnRemaining;player.x=-2250;player.y=-2250;tickSpawns(timer+1);persist();`);
 assert.equal(g.run('target.alive'),true);assert.deepEqual(g.json('[target.x,target.y,target.t,target.rot]'),g.json('site'));
 assert.equal(g.run('state.spawnWorld.version'),2);
 const restored=createRuntime(html,JSON.parse(g.store.get('vora-v1')));
 assert.deepEqual(restored.json(`objects.filter(o=>o.fixedSpawn).map(o=>[o.zoneId,o.slotIndex,o.x,o.y,o.t,o.rot])`),g.json(`objects.filter(o=>o.fixedSpawn).map(o=>[o.zoneId,o.slotIndex,o.x,o.y,o.t,o.rot])`));
 assert.ok(g.run('spawnPointCount(6)>spawnPointCount(0)'));
});

test('dossiê agrupa rotações e cores e mantém somente portes úteis',()=>{
 const g=createRuntime(html);g.run('refreshDossier()');
 assert.equal(g.run('dossierView.catalog.every(e=>e.samples.length<=3)'),true);
 assert.equal(g.run('dossierView.catalog.filter(e=>!e.id.includes("tree")&&!e.id.includes("boulder")).every(e=>e.samples.length===1)'),true);
 for(const e of g.json('dossierView.catalog.map(e=>e.id)')){
  g.run(`selectDossierEntry('${e}')`);assert.doesNotMatch(g.doc.getElementById('dossierVariant').textContent,/\d+\s*\/\s*\d+/);
 }
 assert.doesNotMatch(read('src/mundo/base.js'),/VENDAS|const glyphs/);
});

test('segurar por dois segundos seleciona a malha, mostra dados e restaura a câmera ao fechar',()=>{
 const g=createRuntime(html,null,{width:1000,height:800});
 g.run(`W=1000;H=800;canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:800});
  globalThis.target={x:100,y:70,t:0,rot:0,alive:true,anim:0};objects=[target];
  globalThis.projected=(()=>{const m=prepareSceneCamera().vp,x=100,y=ASSET_METRICS[0].renderHeight*.5+terrainElevationAt(100,70),z=70;
   const w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w*500+500,400-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*400];})();`);
 const [x,y]=g.json('projected'),world=g.doc.getElementById('world');
 assert.equal(g.run(`pickInspectableObject(${x},${y})===target`),true);
 world.dispatchEvent({type:'pointerdown',pointerType:'mouse',pointerId:1,button:0,clientX:x,clientY:y});
 assert.equal(g.run('openMenu'),null);assert.ok(g.run('!!objectInspection.hold'));
 world.dispatchEvent({type:'pointerup',pointerId:1});assert.equal(g.run('objectInspection.hold'),null);
 world.dispatchEvent({type:'pointerdown',pointerType:'mouse',pointerId:2,button:0,clientX:x,clientY:y});
 g.runTimer();assert.equal(g.run('openMenu.id'),'objectCheckModal');assert.equal(g.run('objectInspection.object===target'),true);
 const focus=g.run('viewDistance');g.run('tickSceneMotion(1)');assert.ok(Math.abs(g.run('viewDistance')-focus)<1e-8,'o foco persiste entre frames');
 assert.equal(g.doc.getElementById('objectCheckValue').textContent,'4 moedas');
 g.run('updateObjectHighlight(prepareSceneCamera().vp)');assert.equal(g.doc.getElementById('objectHighlight').hidden,false);
 g.run('closeMenu(false,true)');assert.equal(g.run('objectInspection.object'),null);assert.equal(g.doc.getElementById('objectHighlight').hidden,true);
 assert.deepEqual(g.json('cameraPan'),{x:0,y:0,z:0});
});

test('skill tree abre somente uma tela vazia, fecha e pausa sem gastar progresso',()=>{
 const g=createRuntime(html),before=g.run('JSON.stringify(state)');g.doc.getElementById('skillTreeBtn').click();
 assert.equal(g.run('openMenu.id'),'skillTreeModal');assert.equal(g.doc.getElementById('skillTreeModal').open,true);
 assert.equal(g.run('JSON.stringify(state)'),before);
 const css=read('src/interface/estilos/expansao.css');assert.match(css,/rgba\(0,0,0,\.8\)/);assert.match(css,/blur\(8px\)/);
 g.run('closeMenu(true)');assert.equal(g.run('openMenu'),null);assert.equal(g.doc.activeElement.id,'skillTreeBtn');
});
