import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

test('copa usa exatamente a mesma malha e escala na câmera e na sombra nos dois LODs',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`gl.isSoftware=false;H=760;globalThis.calls=[];
  drawMesh=(mesh,...pose)=>calls.push({mesh,pose});
  globalThis.tree=[0,0,230,0];`);
 for(const eye of [[0,160,260],[0,160,2400]]){
  g.run(`currentEye=${JSON.stringify(eye)};calls.length=0;renderingShadow=false;drawTree(tree);renderingShadow=true;drawTree(tree)`);
  assert.equal(g.run('calls[0].mesh===calls[1].mesh'),true);
  assert.deepEqual(g.json('calls[0].pose'),g.json('calls[1].pose'));
 }
 g.run('renderingShadow=false;currentEye=[0,160,260];globalThis.closeDetail=treeModelDetail(tree);currentEye=[0,160,2400]');
 assert.equal(g.run('closeDetail'),1);assert.equal(g.run('treeModelDetail(tree)'),0,'otimização por distância permanece disponível');
});

test('troca real de LOD invalida a sombra, enquanto zoom dentro do mesmo LOD reutiliza o mapa',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`gl.isSoftware=false;H=760;state.depot=[];
  worldProps=[{type:'tree',p:[0,0,230,0]}];worldPropVisible=()=>true;
  currentEye=[0,160,260];globalThis.staticPasses=0;
  configureShadowUniforms=()=>{};bindShadowBounds=()=>{};renderShadowBounds=()=>{};
  gl.activeTexture=gl.bindTexture=()=>{};
  renderShadowLayer=(target,pass)=>{if(pass===2)staticPasses++};
  fitMovingShadowWindow=()=>{lighting.liveSpawns=[];lighting.liveWindow=[0,0,1,1];return 'window'};
  lighting={valid:true,fixed:{size:2048},moving:{size:1024},size:1024,
   center:[camera.x,camera.y],extent:shadowMapExtent(),matrix:BODY_IDENTITY,staticVersion:0,key:''};
  updateSunShadows();currentEye=[0,160,270];updateSunShadows();`);
 assert.equal(g.run('staticPasses'),1);
 g.run('currentEye=[0,160,2400];updateSunShadows()');
 assert.equal(g.run('staticPasses'),2,'o mapa acompanha a silhueta que passou a ser visível');
});

test('grama baixa compartilha a geometria visível e seus bytes, sem bake extra de sombra',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`gl.isSoftware=false;currentEye=[0,60,100];vegetationPlanes=null;
  globalThis.low={count:3,byteLength:80},high={count:6,byteLength:120};
  globalThis.tile={center:[0,5,0],radius:60,near:null,meshes:[null,null],plants:[{kind:'tuft'},{kind:'groundcover'}]};
  installVegetationResource(tile,0,low,vegetationResourceKey(tile,0));
  installVegetationResource(tile,1,high,vegetationResourceKey(tile,1));
  groundDetailsBatches=[tile];lighting={center:[0,0]};globalThis.drawn=[];
  drawMesh=mesh=>{if(mesh)drawn.push(mesh)};
  drawGroundDetails();drawVegetationShadows();`);
 assert.equal(g.run('drawn.length'),2);
 assert.equal(g.run('drawn[0]===high&&drawn[1]===high'),true,'folhas e hastes correspondem entre os passes');
 assert.equal(g.run('vegetationResources.bytes'),200,'os dois passes não duplicam alocações');
 assert.equal(g.run('resourceWork.jobs.size'),0,'a malha pronta não cria outra tarefa');
});

test('calçada participa do mapa estático sem mudar sua geometria ou altura física',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`globalThis.casters=[];drawWalkways=()=>casters.push('walk');drawWorldBase=()=>casters.push('base');
  drawVegetationShadows=()=>casters.push('plants');drawStaticShadowCasters()`);
 assert.deepEqual(g.json('casters'),['walk','base','plants']);
 assert.equal(g.run('WALK_HEIGHT'),g.run('meters(.11)'));
});

test('preparação inicial reúne plantas baixas e não prepara o mesmo tile duas vezes',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`gl.isSoftware=false;currentEye=[0,60,100];state.shadowQuality='high';
  globalThis.prepared=[],sampleTile={center:[0,5,0],radius:60,near:null,meshes:[null,null],plants:[{kind:'tuft'},{kind:'groundcover'}]};
  buildGroundDetailsIncremental=function*(){groundDetailsBatches=[sampleTile]};prepareSceneCamera=()=>{};vegetationVisible=()=>true;
  getPlantMesh=()=>({vertices:new Float32Array(27)});
  bakePlantTileIncremental=function*(plants,detail){prepared.push({kinds:plants.map(p=>p.kind),detail});return {count:3,byteLength:108}};
  lighting={valid:true};globalThis.work=prepareVegetationInitial();while(!work.next().done){}`);
 assert.deepEqual(g.json('prepared'),[
  {kinds:['tuft','groundcover'],detail:0},{kinds:['tuft','groundcover'],detail:1}
 ]);
 assert.equal(g.run('vegetationResources.bytes'),216);
});
