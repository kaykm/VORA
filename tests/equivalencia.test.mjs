import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {read,ROOT,expand} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
import {png} from './png.mjs';
import {changedShaders} from './contratos.mjs';
const original=read('backup/VORA-original-17.html'),distribution=read('dist/VORA.html');
// Isolate the newly authorized world-content system; its behavior has its own tests.
const final=distribution.replaceAll('initializeWorldResources();','').replaceAll('yield* initializeWorldResourcesIncremental();','');
const loadingComponent=expand(read('src/interface/componentes/carregamento.html'));
const expansionComponent=expand(read('src/interface/componentes/expansao.html'));
const skillButton=read('src/interface/componentes/hud.html').match(/<button type="button" class="base-btn glass" id="skillTreeBtn"[\s\S]*?<\/button>/)[0];
const dossierComponent=expand(read('src/interface/componentes/dossie.html'));
const dossierButton=read('src/interface/componentes/carga.html').match(/<button type="button" id="cargoDossierBtn"[\s\S]*?<\/button>/)[0];
// Isolate only the explicitly authorized controls and catalogue component.
const withoutShadowField=html=>html.replace(/<div class="graphics-field"><label class="graphics-label" for="(?:shadowQuality|shadowDistance)">[\s\S]*?<\/div>/g,'');
const normalize=html=>withoutShadowField(html).replace(loadingComponent,'').replace(dossierComponent,'').replace(expansionComponent,'').replace(skillButton,'').replace(/<div class="graphics-field" data-expansion-field="fps">[\s\S]*?<\/div>/,'').replace(dossierButton,'').replace(/(<html\b[^>]*?) data-loading="true"/,'$1').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/\r\n/g,'\n').replace(/>\s+</g,'><').trim();
function historicalState(state){
 const {shadowQuality,shadowDistance,fpsCap,cargoMeta,economyVersion,upgrades,spawnWorld,...result}=state;
 if(shadowQuality!==undefined&&typeof result.graphicsPresetSignature==='string'){
  const parts=result.graphicsPresetSignature.split('|');
  assert.equal(parts.length,7,'a assinatura mantém os cinco campos históricos e acrescenta as duas preferências de sombras');
  assert.equal(parts[5],shadowQuality);assert.equal(parts[6],shadowDistance);
  result.graphicsPresetSignature=parts.slice(0,5).join('|');
 }
 return result;
}
test('HTML da interface, CSS, ícones e fontes preservados',()=>{
 assert.equal(final.split(loadingComponent).length-1,1,'o componente de carregamento aprovado aparece uma única vez');
 assert.equal((final.match(/id="shadowQuality"/g)||[]).length,1,'somente um seletor de sombras é acrescentado');
 assert.equal(final.split(dossierComponent).length-1,1,'um único dossiê autorizado');
 assert.equal(final.split(dossierButton).length-1,1,'um único acesso ao dossiê em Carga');
 assert.equal(normalize(final),normalize(original));
 const styles=h=>[...h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1].replace(/\r\n/g,'\n').replace(/url\("(data:[^"\n]+)"\)/g,'url($1)'));
 const beforeStyles=styles(original),afterStyles=styles(final);
 assert.equal(afterStyles.length,beforeStyles.length+3,'estilos adicionais de carregamento e dossiê');
 assert.deepEqual(afterStyles.slice(0,beforeStyles.length),beforeStyles,'estilos do jogo original permanecem idênticos');
 assert.match(afterStyles.at(-3),/#loadingScreen/);assert.match(afterStyles.at(-2),/#dossierModal/);
 const data=original.match(/url\(data:font\/woff;base64,([^)]+)\)/)[1];assert.deepEqual(fs.readFileSync(path.join(ROOT,'assets/fontes/vora-ui.woff')),Buffer.from(data,'base64'));
});
test('paridade de terreno, vegetação, física e quadro CPU fora da malha low poly autorizada',()=>{
 // Um mesmo save válido evita a migração de preferências que foi corrigida de propósito.
 const save={coins:120,r:0,d:0,cargo:[],collected:0,sold:0,reward1:false,reward2:false,sound:false,particles:false,nativeDisplayDefaultsV1:true,imageMode:'native',aaMode:'off',aoMode:'off',outputMode:'native'};
 const historical=createRuntime(original,save),after=createRuntime(final,save);
 // Palette functions must be installed before boot, when tree/plant meshes are
 // baked. The separate geometry contract verifies that their RGB changes do
 // not move vertices, change normals or alter material tags.
 const paletteFunctions=['paveSlabJS','paveCoreColorAt','terrainMaterialAt','makeTreeModel','makeLayeredTreeModel','makePlantModel','makeFloorPlantModel'];
 let referenceWithApprovedPalette=original;
 for(const name of paletteFunctions){
  const oldSource=historical.run(name+'.toString()'),newSource=after.run(name+'.toString()');
  assert.equal(referenceWithApprovedPalette.split(oldSource).length-1,1,name+' deve ter uma única declaração na referência');
  referenceWithApprovedPalette=referenceWithApprovedPalette.replace(oldSource,()=>newSource);
 }
 const before=createRuntime(referenceWithApprovedPalette,save);
 const systems='({state,worldProps,environmentDetails,metrics:ASSET_METRICS.slice(0,4)})';
 const oldSystems=before.json(systems),newSystems=after.json(systems);
 newSystems.state=historicalState(newSystems.state);oldSystems.state=historicalState(oldSystems.state);
 assert.deepEqual(newSystems,oldSystems);
 for(const name of ['ModelBuilder','modelColor','makeCanModel','makeRockModel','makeBoxModel','makePotModel','makeBenchModel','walkFieldAt','terrainElevationAt','regionFieldsAt','surfaceWeightsAt','topWeightsAt','trailWeightAt'])
  assert.equal(after.run(name+'.toString()'),historical.run(name+'.toString()'),name+' não faz parte da alteração de paleta');
 for(const name of ['stationHeight','stationDistanceAt','stationBlendAt','stationSurfaceAt','stationConcreteAt','drawStationSection','drawWorldBase','buildDepotPile','depotSlots'])
  assert.equal(after.run(name+'.toString()'),before.run(name+'.toString()'),name+' preservado fora da revisão dos modelos');
 assert.deepEqual(after.json('STATION'),before.json('STATION'),'a fundação, apoios físicos e ponto de recebimento permanecem idênticos');
 // Keep the reference renderer and geometry, installing the authorized models,
 // palette and the same loose-item positions to isolate the spawn redesign.
 const withoutSign=source=>source.replace(" if(kind==='barrel'||kind==='pallet'||kind==='crate'||kind==='gardenpot'||kind==='logpile')return makeResourceProp(kind,variant);\n",'').replace(/else if\(kind==='sign'\)\{[\s\S]*?(?=\}else if\(kind==='picnic'\))/,"else if(kind==='sign'){");
 assert.equal(withoutSign(after.run('makeParkProp.toString()')),withoutSign(before.run('makeParkProp.toString()')),'os outros objetos do parque permanecem idênticos');
 before.run(`
  buildStationMeshes=${after.run('buildStationMeshes.toString()')};stationMeshes=buildStationMeshes();
  buildDepotCrate=${after.run('buildDepotCrate.toString()')};depotCrates.clear();
  const referenceParkProp=makeParkProp,approvedParkProp=${after.run('makeParkProp.toString()')};
  makeParkProp=(kind,variant=0)=>kind==='sign'?approvedParkProp(kind,variant):referenceParkProp(kind,variant);
  for(const key of parkPropMeshes.keys())if(key.startsWith('sign:'))parkPropMeshes.delete(key);
 `);
 for(const id of ['TERRAIN_FIELD_GLSL','TERRAIN_ALBEDO_GLSL','vertexSource','fragmentSource','FSR_EASU_SOURCE','FSR_RCAS_SOURCE','AA_PRESENT_SOURCE','AA_DOWNSAMPLE_SOURCE','AA_TEMPORAL_SOURCE','SMAA_LIBRARY','SMAA_LOOKUPS','AO_HORIZON_SOURCE','AO_DENOISE_SOURCE']){
  if(changedShaders.has(id))assert.notEqual(after.run(id),before.run(id),id+' corrigido para névoa/AO');
  else assert.deepEqual(after.json(id),before.json(id),id);
 }
 // The hole's tessellation and face lighting deliberately changed. Compare the
 // rest of the frame intact; its profile and reduced mesh have their own test.
 for(const g of [before,after])g.run('rebuildCavity=()=>{};rimMesh=wallMesh=floorMesh=null');
 const frame=g=>{
  const start=performance.now();
  g.run('let verificationDrawCalls=0,verificationTriangles=0;const verificationDraw=gl.drawArrays.bind(gl);gl.drawArrays=(mode,start,count)=>{verificationDrawCalls++;verificationTriangles+=count/3;verificationDraw(mode,start,count)};render()',60000);
  const ms=performance.now()-start,pixels=g.run('gl.image.data'),width=g.run('canvas.width'),height=g.run('canvas.height');
  return {pixels,report:{initializationMs:g.startupMs,firstCpuFrameMs:ms,drawCalls:g.run('verificationDrawCalls'),submittedTriangles:g.run('verificationTriangles'),width,height,pixelSha256:crypto.createHash('sha256').update(pixels).digest('hex')}};
 };
 before.run('objects='+JSON.stringify(after.json('objects')));
 const a=frame(before),b=frame(after);assert.deepEqual(b.pixels,a.pixels);assert.equal(b.report.drawCalls,a.report.drawCalls);assert.equal(b.report.submittedTriangles,a.report.submittedTriangles);
 const oldWalk=before.run('walkMesh.buffer.data'),newWalk=after.run('walkMesh.buffer.data');
 assert.deepEqual(Buffer.from(newWalk.buffer,newWalk.byteOffset,newWalk.byteLength),Buffer.from(oldWalk.buffer,oldWalk.byteOffset,oldWalk.byteLength),'bytes exatos da malha dos caminhos');
 const trace='keys.d=true;for(let i=0;i<30;i++)update(1/60);keys.d=false;state.coins=1000;upgrade("r");persist()';before.run(trace);after.run(trace);const oldState=historicalState(before.json('state')),newState=historicalState(after.json('state'));assert.equal(newState.coins,oldState.coins+10,'primeiro raio passou de 80 para 70 moedas');delete oldState.coins;delete newState.coins;assert.deepEqual(newState,oldState);assert.deepEqual(after.json('player'),before.json('player'));
 const dir=path.join(ROOT,'tests/resultados');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'original-cpu.png'),png(a.report.width,a.report.height,a.pixels));fs.writeFileSync(path.join(dir,'vora-cpu.png'),png(b.report.width,b.report.height,b.pixels));
 fs.writeFileSync(path.join(dir,'comparacao.json'),JSON.stringify({environment:'Node.js '+process.version+'; DOM simulado; renderizador SoftwareGL original; sem WebGL/GPU',scenario:'Mesmo save, semente 12345, cena inicial 320 × 240, efeitos desligados e movimento reduzido.',referenceWithApprovedModelsAndPalette:a.report,reorganized:b.report,approvedModelOverrides:['buildStationMeshes','buildDepotCrate',"makeParkProp(kind==='sign')"],approvedPaletteOverrides:paletteFunctions,identicalPixels:true,browserFps:null,browserLoadTime:null,browserMemory:null,notes:'A execução de referência usa somente os três modelos e as funções de cor autorizados. Lógica, renderizador e demais modelos são os originais; posições/normais/acabamentos da vegetação têm contrato separado. Os tempos medem execução em Node, incluindo DOM simulado. Não são FPS, carregamento ou memória de um navegador, nem uma conclusão estatística de desempenho.'},null,2)+'\n');
});
