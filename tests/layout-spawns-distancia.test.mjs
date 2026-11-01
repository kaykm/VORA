import test from 'node:test';
import assert from 'node:assert/strict';
import {read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=read('dist/VORA.html');

test('objetos seguem regiões, orientação dos caminhos e circulação livre',()=>{
 const g=createRuntime(html);
 assert.ok(g.run('worldResourceObjects.length')>450);
 assert.ok(g.run('worldResourceObjects.filter(o=>o.alive).length')>350);
 assert.equal(g.run(`worldProps.filter(p=>p.placement==='path-verge'||p.placement==='circuit-verge').every(p=>{
  const dx=p.lookAt[0]-p.p[0],dz=p.lookAt[1]-p.p[1];
  return (Math.sin(p.rotation)*dx+Math.cos(p.rotation)*dz)/Math.hypot(dx,dz)>.999;
 })`),true,'bancos devem olhar para a passagem');
 assert.ok(g.run('new Set(worldProps.filter(p=>p.type==="bench").map(p=>p.rotation.toFixed(2))).size')>20);
 assert.equal(g.run('worldResourceObjects.filter(o=>o.worldProp.placement==="stone-bed").every(o=>walkFieldAt(o.x,o.y)<-pickupSize(o))'),true,'pedras fora dos caminhos');
 for(const kind of ['crate','barrel','pallet','gardenpot','logpile'])assert.ok(g.run(`worldProps.filter(p=>p.kind==='${kind}').length`)>0,kind);
});

test('melhorias de spawn desbloqueiam estoques e aceleram também reposições pendentes',()=>{
 const g=createRuntime(html);
 const before=g.run('worldResourceObjects.filter(o=>o.alive).length'),areas=g.run('spawnAreaCount()');
 g.run(`state.r=RADIUS_MAX_LEVEL;state.d=DEPTH_MAX_LEVEL;syncCavityMotion();
  globalThis.tree=worldResourceObjects.find(o=>o.alive&&o.worldProp.type==='tree');
  player.x=tree.x;player.y=tree.y;collect(tree);globalThis.remaining=tree.respawnRemaining;
  state.developer=true;upgrade('s');`);
 assert.ok(g.run('spawnAreaCount()')>areas);
 assert.ok(g.run('worldResourceObjects.filter(o=>o.alive).length')>before);
 assert.ok(g.run('Math.abs(tree.respawnRemaining-remaining*.95)')<1e-8);
 g.run('tickWorldResourceFalls(2);tickWorldResourceSpawns(7200)');
 assert.equal(g.run('tree.alive'),false,'reposição não aparece dentro do buraco');
 g.run('player.x=0;player.y=-2200;tickWorldResourceSpawns(1)');
 assert.equal(g.run('tree.alive'),true);
 assert.equal(g.run('state.consumedWorld.includes(tree.worldProp.resourceId)'),false);
 g.run('state.s=6;unlockWorldResourceAreas()');
 assert.equal(g.run('worldResourceObjects.some(o=>o.worldProp.resourceLocked)'),false);
 assert.ok(Math.abs(g.run('resourceRespawnDelay(tree,6)/resourceRespawnDelay(tree,0)')-.7)<1e-12);
});

test('save preserva contagem regressiva e migra recursos consumidos da versão anterior',()=>{
 const g=createRuntime(html);
 g.run(`state.r=RADIUS_MAX_LEVEL;state.d=DEPTH_MAX_LEVEL;syncCavityMotion();
  globalThis.target=worldResourceObjects.find(o=>o.alive&&o.worldProp.type==='tree');
  player.x=target.x;player.y=target.y;collect(target);tickWorldResourceSpawns(7);persist();`);
 const id=g.run('target.worldProp.resourceId'),remaining=g.run('target.respawnRemaining');
 const save=JSON.parse(g.store.get('vora-v1')),restored=createRuntime(html,save);
 assert.equal(restored.run(`worldResourceObjects.find(o=>o.worldProp.resourceId==='${id}').respawnRemaining`),remaining);
 delete save.worldResourceSpawns;
 const legacy=createRuntime(html,save);
 assert.ok(legacy.run(`worldResourceObjects.find(o=>o.worldProp.resourceId==='${id}').respawnRemaining`)>0);
 assert.equal(legacy.run('state.coins'),save.coins);
});

test('seis distâncias de sombras são independentes, persistem e migram assinaturas antigas',()=>{
 const save={coins:120,r:0,d:0,cargo:[],collected:0,sold:0,nativeDisplayDefaultsV1:true,
  imageMode:'native',aaMode:'off',aoMode:'off',outputMode:'native',viewRange:'default',shadowQuality:'high',
  graphicsPreset:'default',graphicsPresetSignature:'native|off|off|native|default|high'};
 const g=createRuntime(html,save),profiles=['very_low','low','medium','high','very_high','ultra'];
 assert.deepEqual(g.doc.getElementById('shadowDistance').options.map(o=>o.value),profiles);
 assert.equal(g.run('state.graphicsPreset'),'default');
 assert.equal(g.run('state.graphicsPresetSignature'),save.graphicsPresetSignature+'|high');
 let previous=0;
 for(const value of profiles){g.run(`setShadowDistance('${value}')`);const distance=g.run('shadowDistanceRange()');assert.ok(distance>previous);previous=distance;assert.equal(g.run('state.shadowQuality'),'high');}
 const control=g.doc.getElementById('shadowDistance');control.value='low';control.dispatchEvent({type:'change'});
 assert.equal(g.run('state.graphicsPreset'),'custom');
 assert.equal(JSON.parse(g.store.get('vora-v1')).shadowDistance,'low');
 g.run('reset()');assert.equal(g.run('state.shadowDistance'),'low');
 g.run('setShadowDistance("constructor")');assert.equal(g.run('state.shadowDistance'),'high');
 // The cached map must retain a caster still inside the camera's active range,
 // even before its center follows the camera. Distant casters remain culled.
 g.run(`state.shadowDistance='very_low';lighting={center:[0,0]};
  camera.x=70;camera.y=0;cameraPan.x=cameraPan.z=0;
  worldProps=[{type:'scenery',kind:'boulder',p:[280,0,40]},{type:'scenery',kind:'boulder',p:[400,0,40]}];
  objects=[];groundDetailsBatches=null;globalThis.capturedCasters=[];
  drawWalkways=drawWorldBase=()=>{};drawParkProp=p=>capturedCasters.push(p.p[0]);drawStaticShadowCasters();`);
 assert.deepEqual(g.json('capturedCasters'),[280],'a câmera pode andar sem abrir falhas na sombra armazenada');
 g.run(`lighting.size=1024;globalThis.depthClips=[];
  for(const key of Object.keys(SHADOW_DISTANCES)){
   state.shadowDistance=key;shadowProjection(0,0,shadowMapExtent());const m=lighting.matrix,r=shadowDistanceRange();
   for(let i=0;i<32;i++)for(const height of [0,meters(12)]){
    const a=i*Math.PI/16,z=m[2]*Math.cos(a)*r+m[6]*height+m[10]*Math.sin(a)*r+m[14];
    if(Math.abs(z)>1)depthClips.push(key);
   }
  }`);
 assert.deepEqual(g.json('depthClips'),[],'o maior alcance mantém chão e copas altas dentro da projeção');
});
