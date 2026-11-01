import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

test('todos os cartões mantêm a disposição compacta da referência e os botões já vinculados',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 const radiusButton=g.doc.getElementById('radiusBtn'),depotButton=g.doc.getElementById('depotUpgradeBtn');
 g.drainBoot();
 assert.equal(g.doc.getElementById('radiusBtn'),radiusButton);
 assert.equal(g.doc.getElementById('depotUpgradeBtn'),depotButton);
 const cards=g.doc.getElementById('upgradePanel').querySelectorAll('.upgrade');
 assert.equal(cards.length,11);
 const shape=el=>[el.tagName,el.className.replace(/\bis-earned\b/g,'').trim(),...el.children.map(shape)];
 const reference=shape(cards.find(card=>card.querySelector('#radiusBtn')));
 for(const card of cards){
  assert.deepEqual(card.children.map(n=>n.className),['upgrade-title','upgrade-stat','upgrade-btn','upgrade-status'],card.querySelector('b').textContent);
  assert.deepEqual(shape(card),reference,'mesma árvore visual, sem parágrafo entre o valor e o botão');
  assert.equal(card.querySelectorAll('.level-ruler path').length,20);
 }
 const before=g.run('state.coins');radiusButton.click();
 assert.equal(g.run('state.r'),1);assert.equal(g.run('state.coins'),before-70,'o controle preservado executa a compra');
});

test('réguas iguais representam níveis diferentes por proporção e os estados de compra se mantêm',()=>{
 const g=createRuntime(html);
 g.run('state.r=5;state.upgrades.storage=2;state.upgrades.returning=3;state.coins=0;updateUI()');
 assert.equal(g.doc.getElementById('radiusRuler').querySelectorAll('.is-earned').length,5);
 assert.equal(g.doc.getElementById('extraRuler-storage').querySelectorAll('.is-earned').length,5);
 assert.equal(g.doc.getElementById('extraRuler-returning').querySelectorAll('.is-earned').length,10);
 assert.equal(g.doc.getElementById('extraBuy-storage').disabled,true);
 assert.equal(g.doc.getElementById('extraBuy-storage').closest('.upgrade').dataset.state,'locked');
 g.run('state.developer=true;updateUI()');
 assert.equal(g.doc.getElementById('extraBuy-storage').disabled,false);
 assert.equal(g.doc.getElementById('extraBuy-storage').closest('.upgrade').dataset.state,'ready');
 g.run('state.upgrades.storage=8;updateUI()');
 assert.equal(g.doc.getElementById('extraRuler-storage').querySelectorAll('.is-earned').length,20);
 assert.equal(g.doc.getElementById('extraBuy-storage').disabled,true);
 assert.equal(g.doc.getElementById('extraCost-storage').textContent,'MAX');
});
