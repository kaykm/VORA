import test from 'node:test';
import assert from 'node:assert/strict';
import {read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=read('dist/VORA.html');
const legacy={coins:1000,r:2,d:3,s:1,v:2,cargo:[0,1],collected:12,sold:1,reward1:true,reward2:true,worldScaleVersion:2,imageMode:'quality',aaMode:'fxaa_high',outputMode:'balanced',aoMode:'balanced',viewRange:'ultra',menuScale:125};
test('inicialização real, padrões de partida nova, oito qualidades e recursos offline',()=>{
 const g=createRuntime(html);assert.equal(g.run('gl.isSoftware'),true);
 assert.deepEqual(g.json('[state.imageMode,state.aaMode,state.outputMode,state.aoMode]'),['native','off','native','off']);
 assert.equal(g.run('Object.keys(GRAPHICS_PRESETS).length'),9);assert.equal(g.run('Object.keys(IMAGE_PROFILES).length'),8);assert.equal(g.run('Object.keys(AA_PROFILES).length'),14);
 assert.ok(g.run('worldProps.length')>450);assert.equal(g.run('environmentDetails.length'),11804);assert.ok(g.run('objects.filter(o=>o.worldProp).length')>450);
 assert.equal(g.doc.getElementById('graphicsAdvanced').hidden,true);assert.ok(g.store.get('vora-v1'));
});
test('save antigo mantém progresso e preferências válidas; persistência/restauração da carga',()=>{
 const g=createRuntime(html,legacy);for(const k of ['coins','r','d','imageMode','aaMode','outputMode','aoMode','viewRange','menuScale'])assert.equal(g.run('state.'+k),legacy[k],k);
 assert.deepEqual(g.json('state.cargo'),legacy.cargo);assert.equal(g.run('cargoBodies.length'),2);
 g.run('stepCargoPhysics(1/60);persist()');const saved=JSON.parse(g.store.get('vora-v1'));
 const restored=createRuntime(html,saved);assert.deepEqual(restored.json('state.cargo'),legacy.cargo);assert.equal(restored.run('cargoBodies.length'),2);assert.equal(restored.run('state.coins'),1000);
 assert.deepEqual(restored.json('state.spawnWorld'),saved.spawnWorld);
});
test('save inválido e armazenamento bloqueado não impedem a inicialização',()=>{
 const invalid=createRuntime(html,{...legacy,r:999});assert.equal(invalid.run('state.r'),0);assert.equal(invalid.run('state.coins'),120);
 const blocked=createRuntime(html,null,{storageBlocked:true});assert.equal(blocked.run('saveAvailable'),false);assert.match(blocked.doc.getElementById('saveStatus').textContent,/sessão/);
});
test('coleta, capacidade, queda, depósito, venda e melhorias não duplicam valores',()=>{
 const g=createRuntime(html);g.run(`state.particles=false;const target=objects.find(o=>o.alive&&o.t===0);collect(target);collect(target)`);
 assert.equal(g.run('state.cargo.length'),1);assert.equal(g.run('state.collected'),1);assert.equal(g.run('cargoBodies.length'),1);
 const volume=g.run('used()');assert.equal(volume,.4);
 g.run('for(let i=0;i<120;i++)stepCargoPhysics(1/60)');assert.equal(g.run('cargoBodies.every(b=>[b.lx,b.ly,b.z,...b.q].every(Number.isFinite))'),true);
 g.run('player.x=base.x;player.y=base.y;unloadDepot();advanceDepot(5)');assert.equal(g.run('state.cargo.length'),0);assert.equal(g.run('state.depot.length'),1);
 const before=g.run('state.coins');g.run('sellDepot();sellDepot()');assert.equal(g.run('state.coins'),before+4);assert.equal(g.run('state.depot.length'),0);
 g.run('state.coins=1000;upgrade("r")');assert.equal(g.run('state.r'),1);assert.equal(g.run('state.coins'),930);
 g.run('state.coins=0;upgrade("d")');assert.equal(g.run('state.d'),0);
});
test('teclado, pausa dos menus, joystick, câmera e limites do mundo',()=>{
 const g=createRuntime(html);const start=g.json('[player.x,player.y]');
 g.event('keydown',{code:'KeyD'});g.run('update(.25)');g.event('keyup',{code:'KeyD'});assert.notDeepEqual(g.json('[player.x,player.y]'),start);assert.equal(g.run('!!keys.d'),false);
 g.run('showModal("settingsModal")');const position=g.json('[player.x,player.y]');g.event('keydown',{code:'KeyW'});g.run('update(.25)');assert.deepEqual(g.json('[player.x,player.y]'),position);
 g.run('closeMenu(false,true);joystick({clientX:230,clientY:200});update(.25)');assert.notDeepEqual(g.json('[player.x,player.y]'),position);
 g.run('releaseJoy({pointerId:joyId});orbitCamera(10,10);zoomCamera(.8);panCamera(2,3);resetCamera()');assert.equal(g.run('viewYaw'),.5);
 g.run('player.x=1e9;player.y=-1e9;update(.01)');assert.ok(g.run('Math.abs(player.x)')<3000);assert.ok(g.run('Math.abs(player.y)')<3000);
});
test('escala 40–160%, interior em corte/X-ray, ADM e qualidade compatível',()=>{
 const g=createRuntime(html);for(const scale of [40,100,160]){g.run('setInterfaceScale('+scale+')');assert.equal(g.run('interfaceScale()'),scale)}
 g.run('setInterfaceScale(999)');assert.equal(g.run('interfaceScale()'),160);
 g.run('setInsidePinned(true);setInsideMode("xray");turnInside(.2);zoomInside(1.2);drawInside(1000,true)');assert.equal(g.run('insideView.mode'),'xray');assert.equal(g.doc.getElementById('insidePanel').hidden,false);
 g.run('setInsideMode("cut");drawInside(1100,true);setInsidePinned(false);toggleAdminMode()');assert.equal(g.run('state.adminEnabled'),true);
 g.doc.getElementById('infiniteMoneyToggle').click();assert.equal(g.run('state.developer'),true);
 g.run('toggleSpawnInspector()');assert.equal(g.run('state.spawnInspector'),true);
 g.run('toggleAdminMode()');assert.equal(g.run('state.developer'),false);assert.equal(g.run('state.spawnInspector'),false);
 for(const preset of g.json('Object.keys(GRAPHICS_PRESETS)')){g.run('applyGraphicsPreset('+JSON.stringify(preset)+')');assert.equal(g.run('state.graphicsPreset'),preset)}
});
