import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

test('sombra usa o volume da luz: preserva emissor fora da câmera e elimina emissor fora do mapa',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`gl.isSoftware=false;globalThis.caster={sphere:[0,0,0,3]};
  vegetationPlanes=extractVisibilityPlanes(multiply(perspective(.74,1,2,4000),lookAt([0,50,100],[0,0,0])));
  shadowCasterPlanes=extractVisibilityPlanes(multiply(orthographic(-80,80,-80,80,1,500),lookAt([0,200,0],[0,0,1])));
  renderingShadow=true;`);
 assert.notEqual(g.run('meshVisibility(caster,60,0,0,1,1,1,0)'),0,'emissor fora da câmera ainda pertence à luz');
 assert.equal(g.run('meshVisibility(caster,600,0,0,1,1,1,0)'),0);
 assert.notEqual(g.run('meshVisibility(caster,81,0,0,1,1,1,0)'),0,'esfera que intersecta a borda é conservada');
 g.run('shadowCasterPlanes=null');assert.equal(g.run('meshVisibility(caster,600,0,0,1,1,1,0)'),2,'ausência do volume mantém fallback conservador');
});

test('seleção de pré-passe evita cenas leves e conserva especialização em aparelhos móveis',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`opaqueGPU.depth={};opaqueGPU.prepassEnabled=true;W=1280;H=720;currentEye=[0,100,300];
  globalThis.dense={count:96,mesh:{count:3000,sphere:[0,40,0,65]},data:new Float32Array(96*7)};
  for(let i=0;i<96;i++){dense.data.set([(i%12-5.5)*22,0,(Math.floor(i/12)-3.5)*22,1,1,1,i*.2],i*7);}`);
 assert.equal(g.run('opaquePrepassWorthwhile([dense])'),true);
 g.run('dense.count=2');assert.equal(g.run('opaquePrepassWorthwhile([dense])'),false);
 g.run('dense.count=96;opaqueGPU.prepassEnabled=false');assert.equal(g.run('opaquePrepassWorthwhile([dense])'),false);
});

test('pipeline compila durante o carregamento, fixa atributos compatíveis e libera programas em falha',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`gl.isSoftware=false;objectInstanceAPI={};Object.assign(attrib,{p:0,n:1,c:2,instanceOrigin:3,instanceScale:4,instanceRotation:5});
  globalThis.attributeBindings=[];globalThis.programs=[];
  gl.createProgram=()=>{const program={deleted:false};programs.push(program);return program;};
  gl.deleteProgram=p=>p.deleted=true;gl.getProgramParameter=()=>true;gl.getExtension=()=>null;
  gl.bindAttribLocation=(program,location,name)=>attributeBindings.push({location,name});
  globalThis.preparation=initOpaquePipelineIncremental();globalThis.preparationSteps=0;
  while(!preparation.next().done)preparationSteps++;`);
 assert.ok(g.run('preparationSteps')>=6);
 assert.equal(g.run('!!opaqueGPU.color&&!!opaqueGPU.depth'),true);
 assert.equal(g.run('attributeBindings.length'),12);
 assert.deepEqual(g.json('attributeBindings.slice(0,6).map(b=>b.location)'),[0,1,2,3,4,5]);
 g.run(`opaqueGPU.color=opaqueGPU.depth=null;programs.length=0;
  gl.getProgramParameter=()=>programs.length===1;
  preparation=initOpaquePipelineIncremental();while(!preparation.next().done){}`);
 assert.equal(g.run('opaqueGPU.color'),null);assert.equal(g.run('opaqueGPU.depth'),null);
 assert.equal(g.run('programs.length'),2);assert.equal(g.run('programs.every(p=>p.deleted)'),true);
});

function cacheRuntime(){
 const g=createRuntime(html);g.run(`gl.isSoftware=false;sceneMotionActive=false;
  fallingItems=[];depotFlights=[];saleGhosts=[];worldResourceFalls=[];particles=[];
  for(const o of objects)o.spawnTime=1;
  resourceWork.jobs.clear();invalidateSceneFrame();`);return g;
}

test('cache retém apresentação estática e invalida por câmera, objeto, qualidade, depósito e recursos',()=>{
 const g=cacheRuntime();
 assert.equal(g.run('shouldRenderSceneFrame()'),true);
 assert.equal(g.run('shouldRenderSceneFrame()'),false);
 for(const change of [
  'viewYaw+=.01','objects[0].alive=!objects[0].alive',"state.shadowQuality='ultra'",'cameraPan.y+=1',
  'state.depotLevel++','W++','objectInspection.screenLift=.3','vegetationResources.bytes+=100',
  'invalidateSpawnObstacles()'
 ]){
  g.run(change);assert.equal(g.run('shouldRenderSceneFrame()'),true,change);
  assert.equal(g.run('shouldRenderSceneFrame()'),false,change+' fica estável novamente');
 }
 g.doc.hidden=true;assert.equal(g.run('shouldRenderSceneFrame()'),false);
 g.doc.hidden=false;g.doc.dispatchEvent({type:'visibilitychange'});assert.equal(g.run('shouldRenderSceneFrame()'),true);
});

test('animações, simulação e convergência temporal não são congeladas pelo cache',()=>{
 const g=cacheRuntime();
 g.run('shouldRenderSceneFrame();sceneMotionActive=true');assert.equal(g.run('shouldRenderSceneFrame()'),true);
 g.run('sceneMotionActive=false;worldResourceFalls=[{time:0}]');assert.equal(g.run('shouldRenderSceneFrame()'),true);
 g.run("worldResourceFalls=[];state.aaMode='taa';lighting={image:{taaActive:true,historyValid:true,scale:1}};shouldRenderSceneFrame()");
 for(let i=0;i<12;i++)assert.equal(g.run('shouldRenderSceneFrame()'),true);
 assert.equal(g.run('shouldRenderSceneFrame()'),false);
 g.run('lighting.image.historyValid=false');assert.equal(g.run('shouldRenderSceneFrame()'),true);
});

test('loop continua simulando ao reutilizar a cena e apresenta mudança no mesmo quadro',()=>{
 const g=cacheRuntime();
 g.run(`setFpsCap(0);globalThis.cachedDraws=0;globalThis.simulationSteps=0;
  const actualUpdate=update;update=dt=>{simulationSteps++;actualUpdate(dt);};
  render=()=>{cachedDraws++;rememberSceneFrame(prepareSceneCamera().vp);};
  for(let i=1;i<=60;i++)frame(1000+i*1000/60);`);
 assert.ok(g.run('simulationSteps')>=60);
 assert.equal(g.run('cachedDraws'),1,'um quadro 3D basta para a imagem estática durante este segundo');
 assert.ok(g.run('sceneFrameCache.reused')>=59);
 g.run('viewYaw+=.1;frame(2020)');assert.equal(g.run('cachedDraws'),2,'entrada da câmera aparece imediatamente');
});
