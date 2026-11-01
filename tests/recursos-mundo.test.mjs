import test from 'node:test';
import assert from 'node:assert/strict';
import {read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=read('dist/VORA.html');

test('parque tem novos recursos, pedras de seixos a blocos enormes e todas as árvores coletáveis',()=>{
 const g=createRuntime(html);
 assert.ok(g.run('objects.filter(o=>o.worldProp).length')>450);
 assert.equal(g.run('worldProps.filter(p=>p.type==="tree").every(p=>objects.some(o=>o.worldProp===p))'),true);
 assert.ok(g.run('worldProps.filter(p=>p.type==="bench").length')>=25);
 assert.ok(g.run('Math.min(...objects.filter(o=>o.worldProp?.kind==="boulder").map(pickupSize))')<2);
 assert.ok(g.run('Math.max(...objects.filter(o=>o.worldProp?.kind==="boulder").map(pickupSize))')>=172);
 g.run('globalThis.tree=objects.find(o=>o.worldProp?.type==="tree");globalThis.quarry=objects.find(o=>o.worldProp?.id==="resource-quarry-0")');
 assert.equal(g.run('canSwallow(quarry)'),false);
 g.run('state.r=RADIUS_MAX_LEVEL;state.d=DEPTH_MAX_LEVEL;syncCavityMotion()');
 assert.equal(g.run('canSwallow(quarry)'),true);
 g.run('player.x=tree.x;player.y=tree.y;update(1/60)');
 assert.equal(g.run('tree.alive'),false,'o loop real engole a árvore quando o buraco passa por ela');
});

test('engolir árvore produz madeira uma vez, persiste a remoção e permite descarregar e vender',()=>{
 const g=createRuntime(html);
 g.run(`state.r=RADIUS_MAX_LEVEL;state.d=DEPTH_MAX_LEVEL;syncCavityMotion();
  globalThis.tree=objects.find(o=>o.worldProp?.type==='tree');
  player.x=tree.x;player.y=tree.y;globalThis.resourceId=tree.worldProp.resourceId;
  globalThis.expected=tree.resourceAmount;collect(tree);collect(tree);`);
 assert.equal(g.run('state.cargo.length'),g.run('expected'));
 assert.equal(g.run('state.cargo.every(t=>t===4)'),true);
 assert.equal(g.run('state.collected'),1);
 assert.equal(g.run('tree.worldProp.consumed'),true);
 g.run('stepCargoPhysics(1/60);persist()');
 const save=JSON.parse(g.store.get('vora-v1')),id=g.run('resourceId');
 const restored=createRuntime(html,save);
 assert.equal(restored.run(`objects.find(o=>o.worldProp?.resourceId===${JSON.stringify(id)}).alive`),false);
 assert.equal(restored.run('state.cargo.length'),g.run('expected'));
 const coins=restored.run('state.coins');
 restored.run('player.x=base.x;player.y=base.y;unloadDepot();advanceDepot(5);sellDepot()');
 assert.equal(restored.run('state.cargo.length'),0);
 assert.equal(restored.run('state.depot.length'),0);
 assert.equal(restored.run('state.coins'),Math.round((coins+g.run('pickupPrice(tree)'))*100)/100);
 restored.run('reset()');
 assert.equal(restored.run('state.consumedWorld.length'),0);
});

test('carga cheia e buraco pequeno preservam o recurso inteiro; saves antigos continuam válidos',()=>{
 const g=createRuntime(html,{coins:900,r:0,d:0,cargo:[0,1],collected:3,sold:1,worldScaleVersion:2});
 assert.equal(g.run('state.coins'),900);
 g.run('globalThis.target=objects.find(o=>o.worldProp?.type==="tree");collect(target)');
 assert.equal(g.run('target.alive'),true);
 g.run('state.r=RADIUS_MAX_LEVEL;state.d=DEPTH_MAX_LEVEL;syncCavityMotion();state.cargo=Array(39).fill(4);restoreCargoPhysics();collect(target)');
 assert.equal(g.run('target.alive'),true);
 assert.equal(g.run('state.cargo.length'),39);
 assert.equal(g.run('state.consumedWorld.length'),0);
});
