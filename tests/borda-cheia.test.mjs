import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

test('pilha apoiada acima da abertura bloqueia coleta e avisa mesmo com litros livres; libera ao baixar',()=>{
 const g=createRuntime(html);
 g.run(`player.x=500;player.y=500;state.r=5;state.d=0;syncCavityMotion();
  state.cargo=[0];restoreCargoPhysics();
  globalThis.pile=cargoBodies[0];pile.z=0;pile.sleeping=true;pile.fallTime=2;
  globalThis.pickup={t:0,x:player.x,y:player.y,rot:0,alive:true,anim:0};
  updateCargoRim(.12);`);
 assert.equal(g.run('cargoRimFull()'),false,'um contato isolado não alterna o bloqueio');
 g.run('updateCargoRim(.12)');
 assert.equal(g.run('cargoRimFull()'),true);
 assert.ok(g.run('capacity()-used()')>7);
 assert.match(g.doc.getElementById('toastText').textContent,/Borda cheia/);
 assert.equal(g.doc.getElementById('detailsBtn').dataset.rimFull,'true');
 assert.equal(g.run('cargoCanFit(pickup)'),false);
 assert.equal(g.run('dossierAssessment(pickup).status'),'Borda cheia');
 g.run('collect(pickup)');
 assert.equal(g.run('pickup.alive'),true);
 assert.equal(g.run('state.cargo.length'),1);
 g.run('objects=[pickup];blockTimer=0;update(1/60)');
 assert.equal(g.run('pickup.alive'),true,'o loop de jogo também respeita o bloqueio');
 assert.match(g.doc.getElementById('toastText').textContent,/Borda cheia/);
 // More depth gives the same body room to fall below the opening.
 g.run('state.d=5;syncCavityMotion();for(let i=0;i<240;i++)stepCargoPhysics(1/120)');
 assert.equal(g.run('cargoRimFull()'),false);
 assert.equal(g.run('cargoCanFit(pickup)'),true);
 g.run('collect(pickup)');assert.equal(g.run('pickup.alive'),false);
});

test('objeto entrando, salto transitório e pilha abaixo da calçada não produzem borda cheia',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`state.r=5;state.d=5;syncCavityMotion();state.cargo=[0];restoreCargoPhysics();
  globalThis.pile=cargoBodies[0];pile.z=20;pile.contacts=0;pile.fallTime=2;
  updateCargoRim(1);`);
 assert.equal(g.run('cargoRimFull()'),false,'um objeto em queda não enche a borda');
 g.run('pile.contacts=1;pile.fallTime=.1;updateCargoRim(1)');
 assert.equal(g.run('cargoRimFull()'),false,'entrada recente com contato ainda pode cair');
 g.run(`pile.sleeping=true;pile.z=-20;updateCargoRim(1);`);
 assert.equal(g.run('cargoRimFull()'),false);
 // Curb height must be measured at the object, not assumed to be world Y=0.
 g.run(`terrainElevationAt=()=>10;pile.z=0;updateCargoRim(1);`);
 assert.equal(g.run('cargoRimFull()'),false);
});

test('bloqueio protege recursos do cenário e descarregar remove o limite sem perder lotes',()=>{
 const g=createRuntime(html);
 g.run(`state.r=20;state.d=10;syncCavityMotion();state.cargo=[0];restoreCargoPhysics();
  const b=cargoBodies[0];b.z=5;b.sleeping=true;b.fallTime=2;updateCargoRim(.3);
  globalThis.target=worldResourceObjects.find(o=>o.alive&&canSwallow(o));
  collect(target);`);
 assert.equal(g.run('target.alive'),true);
 assert.equal(g.run('state.cargo.length'),1);
 g.run('player.x=base.x;player.y=base.y;unloadDepot();stepCargoPhysics(1/60)');
 assert.equal(g.run('cargoRimFull()'),false);
 assert.equal(g.run('state.cargo.length'),0);
 assert.equal(g.run('state.depot.length'),1);
 assert.equal(g.doc.getElementById('detailsBtn').dataset.rimFull,'false');
});
