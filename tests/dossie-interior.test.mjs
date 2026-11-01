import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

test('interior fica no canto inferior esquerdo com escala, ampliação e área segura',()=>{
 const g=createRuntime(html,null,{width:1920,height:1080});
 for(const scale of [40,100,160])for(const expanded of [false,true]){
  g.run(`state.menuScale=${scale};insideView.expanded=${expanded};applyInterfaceScale();fitInsidePanel()`);
  const frame=g.json(`({left:parseFloat($('insidePanel').style.left),top:parseFloat($('insidePanel').style.top),
   width:parseFloat($('insidePanel').style.width),height:parseFloat($('insidePanel').style.height)})`);
  assert.equal(frame.left,12);
  assert.ok(Math.abs(frame.top+frame.height-1068)<1e-8,'borda inferior a 12 px da área segura');
  assert.ok(frame.top>=12&&frame.left+frame.width<=1908);
 }
 g.run(`innerWidth=390;innerHeight=844;window.visualViewport.width=390;window.visualViewport.height=844;
  matchMedia=()=>({matches:true});menuInterface.safe={top:24,right:0,bottom:20,left:4};
  state.menuScale=100;menuInterface.factor=1;fitInsidePanel()`);
 const mobile=g.json(`({left:parseFloat($('insidePanel').style.left),top:parseFloat($('insidePanel').style.top),height:parseFloat($('insidePanel').style.height)})`);
 assert.equal(mobile.left,16);assert.equal(mobile.top+mobile.height,692,'espaço para o joystick sem sair da área segura');
});

test('Carga abre o dossiê, volta à carga e fecha por Escape sem alterar progresso',()=>{
 const g=createRuntime(html,null,{width:1440,height:900});
 const saved=g.run('JSON.stringify(state)'),writes=g.storageWrites.length;
 g.doc.getElementById('detailsBtn').click();
 g.doc.getElementById('cargoDossierBtn').click();
 assert.equal(g.run('openMenu.id'),'dossierModal');
 assert.equal(g.doc.getElementById('dossierModal').open,true);
 assert.equal(g.run('dossierView.catalog.length'),16);
 assert.ok(g.doc.getElementById('dossierCatalog').querySelectorAll('button').length>10);
 assert.equal(g.run('JSON.stringify(state)'),saved);assert.equal(g.storageWrites.length,writes);
 g.doc.getElementById('dossierBack').click();
 assert.equal(g.run('openMenu.id'),'cargoModal');assert.equal(g.doc.activeElement.id,'cargoDossierBtn');
 g.doc.getElementById('cargoDossierBtn').click();
 g.doc.dispatchEvent({type:'keydown',key:'Escape',target:g.doc.getElementById('dossierCanvas')});
 assert.equal(g.run('openMenu'),null);assert.equal(g.doc.activeElement.id,'detailsBtn');
 g.run('innerWidth=390;window.visualViewport.width=390;showModal("dossierModal",$("detailsBtn"))');
 assert.equal(g.doc.getElementById('dossierModal').dataset.compact,'true');
 assert.ok(parseFloat(g.doc.getElementById('dossierModal').style.width)<=366);
});

test('parecer usa a coleta real: raio, carga total, desbloqueio e reposição',()=>{
 const g=createRuntime(html);
 g.run('refreshDossier();globalThis.canExample=dossierView.catalog[0].samples[0]');
 assert.equal(g.run('dossierAssessment(canExample).ready'),true);
 g.run('state.cargo=Array(20).fill(0)');
 assert.equal(g.run('canSwallow(canExample)'),true);
 assert.equal(g.run('dossierAssessment(canExample).condition'),'capacity');
 g.run('state.cargo=[];globalThis.treeExample=worldResourceObjects.find(o=>o.alive&&o.worldProp.type==="tree")');
 assert.equal(g.run('dossierAssessment(treeExample).fits'),g.run('canSwallow(treeExample)'));
 assert.equal(g.run('dossierAssessment(treeExample).condition'),'grow');
 g.run('state.r=RADIUS_MAX_LEVEL;state.d=DEPTH_MAX_LEVEL;syncCavityMotion()');
 for(const entry of g.json('dossierView.catalog.map(e=>e.id)')){
  assert.equal(g.run(`dossierView.catalog.find(e=>e.id==='${entry}').samples.every(o=>dossierAssessment(o).fits===canSwallow(o))`),true);
 }
 g.run('globalThis.lockedExample=worldResourceObjects.find(o=>o.worldProp.resourceLocked)');
 assert.equal(g.run('dossierAssessment(lockedExample).condition'),'locked');
 g.run('lockedExample.worldProp.resourceLocked=false;lockedExample.alive=false;lockedExample.respawnRemaining=42');
 assert.equal(g.run('dossierAssessment(lockedExample).condition'),'waiting');
 assert.match(g.run('dossierAvailability(lockedExample)'),/42 s/);
 g.run('lockedExample.alive=true');assert.equal(g.run('dossierAssessment(lockedExample).ready'),true);
});

test('modelos do dossiê são as mesmas malhas, variantes e escalas usadas no mundo',()=>{
 const g=createRuntime(html);
 g.run(`refreshDossier();globalThis.modelMismatches=[];
  drawMesh=(mesh,x,y,z,sx,sy,sz,tint,material,rotation=0)=>{globalThis.actualModel={mesh,scale:[sx,sy,sz],rotation};};
  for(const entry of dossierView.catalog)for(const o of [entry.samples[0],entry.samples.at(-1)]){
   const preview=dossierModel(o),p=o.worldProp;
   if(!p)drawObject(o.t,0,0,0,0,o.modelVariant);
   else if(p.type==='tree')drawTree(p.p);
   else if(p.type==='bench')drawBench(p.p,p.rotation,p.variant);
   else drawParkProp(p);
   if(preview.mesh!==actualModel.mesh||preview.vertices!==actualModel.mesh.vertices||
      preview.scale.some((s,i)=>Math.abs(s-actualModel.scale[i])>1e-9)||Math.abs(preview.rotation-actualModel.rotation)>1e-9)modelMismatches.push(entry.id);
  }`);
 assert.deepEqual(g.json('modelMismatches'),[]);
});

test('filtros mostram exemplares coerentes e prévia só desenha quando solicitada',()=>{
 const g=createRuntime(html,null,{width:1440,height:900});
 g.doc.getElementById('cargoDossierBtn').click();
 g.doc.getElementById('dossierFilter-grow').click();
 assert.equal(g.run('dossierAssessment(dossierCurrent().object).fits'),false);
 g.doc.getElementById('dossierNext').click();
 assert.equal(g.run('dossierAssessment(dossierCurrent().object).fits'),false);
 g.doc.getElementById('dossierFilter-ready').click();
 assert.equal(g.run('dossierAssessment(dossierCurrent().object).ready'),true);
 const search=g.doc.getElementById('dossierSearch');search.value='arvore';search.dispatchEvent({type:'input'});
 assert.equal(g.doc.getElementById('dossierDetail').hidden,true,'árvores não cabem no buraco inicial');
 g.doc.getElementById('dossierFilter-all').click();
 assert.equal(g.run('dossierCurrent().entry.id'),'prop-tree','busca ignora acentos');
 g.run(`globalThis.dossierFrames=[];requestAnimationFrame=fn=>{dossierFrames.push(fn);return dossierFrames.length;};
  dossierView.drawRequest=null;for(let i=0;i<20;i++)scheduleDossierDraw();`);
 assert.equal(g.run('dossierFrames.length'),1,'pedidos do mesmo frame são compartilhados');
 g.run('dossierFrames.shift()(performance.now())');
 assert.equal(g.run('dossierFrames.length'),0,'a prévia não mantém um loop próprio');
 assert.ok(Number(g.doc.getElementById('dossierCanvas').dataset.triangles)>100);
 assert.ok(g.run('dossierView.renderer.zbuffer.filter(z=>z<1).length')>100,'a malha gera pixels visíveis com teste de profundidade');
 const yaw=g.run('dossierView.yaw');
 g.doc.getElementById('dossierCanvas').dispatchEvent({type:'keydown',key:'ArrowRight'});
 assert.ok(g.run('dossierView.yaw')>yaw);
 g.run('closeMenu(false,true);dossierFrames.shift()(performance.now())');
 assert.equal(g.run('dossierFrames.length'),0);
});
