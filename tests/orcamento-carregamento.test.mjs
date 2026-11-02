import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;
function driver(clockStep,waiting=false){
 const g=createRuntime(html,null,{boot:'manual',clockStep});
 g.run(`globalThis.workDone=0;initializeVoraSteps=function*(){for(;;){workDone++;yield ${waiting?'{waiting:true}':'{}'};}};startVora();`);
 g.runAnimationFrame();assert.equal(g.run('workDone'),0,'a tela pode pintar antes da preparação');
 g.runAnimationFrame();return g;
}
test('etapas baratas aproveitam o quadro sem remover o limite de segurança',()=>{
 const g=driver(0);
 assert.ok(g.run('workDone')>64,'não deve esperar outro quadro após apenas 64 yields baratos');
 assert.ok(g.run('workDone')<=1024,'um relógio parado também precisa devolver o controle');
 assert.equal(g.run('gameLoading.ready'),false);
 assert.equal(g.storageWrites.length,0);
});
test('orçamento de 5 ms interrompe o lote antes do teto de etapas',()=>{
 const g=driver(1);
 assert.ok(g.run('workDone')>0&&g.run('workDone')<=5);
 const before=g.run('workDone');g.runAnimationFrame();
 assert.ok(g.run('workDone')>before&&g.run('workDone')<=before+5);
});
test('espera de compilação devolve o controle após uma única retomada',()=>{
 const g=driver(0,true);assert.equal(g.run('workDone'),1);
 g.runAnimationFrame();assert.equal(g.run('workDone'),2);
});
